import type {
  GameState,
  JsonRpcRequest,
  JsonRpcNotification,
} from "@downtime-ops/shared";
import pino from "pino";
import { createInitialState, applyAction, BALANCE } from "./engine";
import { createShop } from "./engine/world/shop";
import { createInitialTutorial } from "./engine/simulation/objectives";
import { handleRpcRequest, clearTracers, type GameServer } from "./rpc/handler";
import { diffStates, isDiffEmpty } from "./sync/differ";
import { hashState } from "./sync/hasher";
import { JsonFileStorage } from "./storage/jsonFile";
import type { ServerWebSocket } from "bun";

const log = pino({ name: "downtime-ops" });
const storage = new JsonFileStorage();

// --- Game state (null = no active session) ---

let gameState: GameState | null = null;
let previousState: GameState | null = null;

// --- Connected clients ---

const clients = new Set<ServerWebSocket<unknown>>();

// --- Session helpers ---

function resetSessionState() {
  previousState = null;
  ticksSinceHash = 0;
  clearTracers();
}

function broadcastSnapshot() {
  if (!gameState) return;
  const notification: JsonRpcNotification = {
    jsonrpc: "2.0",
    method: "snapshot",
    params: { state: gameState } as unknown as Record<string, unknown>,
  };
  const msg = JSON.stringify(notification);
  for (const ws of clients) {
    ws.send(msg);
  }
}

function broadcastNoSession() {
  const notification: JsonRpcNotification = {
    jsonrpc: "2.0",
    method: "noSession",
    params: {} as Record<string, unknown>,
  };
  const msg = JSON.stringify(notification);
  for (const ws of clients) {
    ws.send(msg);
  }
}

// --- GameServer interface for RPC handler ---

const gameServer: GameServer = {
  getState: () => gameState,
  setState: (state: GameState) => {
    previousState = gameState;
    gameState = state;
    broadcastDiff();
  },
  broadcast: (notification: JsonRpcNotification) => {
    const msg = JSON.stringify(notification);
    for (const ws of clients) {
      ws.send(msg);
    }
  },
  saveGame: async (name: string) => {
    if (!gameState) throw new Error("No active session");
    await storage.save(name, gameState);
    log.info({ name }, "Game saved");
  },
  loadGame: async (saveId: string) => {
    stopTickLoop();
    resetSessionState();
    gameState = await storage.load(saveId);
    // Migrate old saves: reset tutorial if objective IDs changed
    if (gameState.tutorial?.objectives?.[0]?.id === "buy_router") {
      gameState = { ...gameState, tutorial: createInitialTutorial() };
    }
    // Migrate old saves: add cableStock and cable listings if missing
    if (!gameState.world.cableStock) {
      const freshShop = createShop();
      const mergedListings = { ...gameState.world.shop.listings };
      for (const [id, listing] of Object.entries(freshShop.listings)) {
        if (!mergedListings[id]) mergedListings[id] = listing;
      }
      gameState = {
        ...gameState,
        world: {
          ...gameState.world,
          cableStock: { cat6: 0, cat6a: 0, om3_fiber: 0, os2_fiber: 0 },
          shop: { ...gameState.world.shop, listings: mergedListings },
        },
      };
    }
    previousState = gameState;
    log.info({ saveId }, "Game loaded");
    broadcastSnapshot();
    startTickLoop();
  },
  newGame: () => {
    stopTickLoop();
    resetSessionState();
    gameState = createInitialState();
    previousState = gameState;
    log.info("New game started");
    broadcastSnapshot();
    startTickLoop();
  },
  listSaves: async () => {
    const saves = await storage.list();
    saves.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return saves;
  },
  deleteSave: async (saveId: string) => {
    await storage.delete(saveId);
    log.info({ saveId }, "Save deleted");
  },
  exitToMenu: async () => {
    if (gameState) {
      await storage.save("autosave", gameState);
      log.info("Auto-saved before exit to menu");
    }
    stopTickLoop();
    resetSessionState();
    gameState = null;
    previousState = null;
    broadcastNoSession();
    log.info("Exited to menu");
  },
};

// --- State sync ---

let ticksSinceHash = 0;
const HASH_INTERVAL = 10;

function broadcastDiff() {
  if (!gameState || !previousState) return;

  const diff = diffStates(previousState, gameState);
  if (isDiffEmpty(diff)) return;

  ticksSinceHash++;
  const hash = ticksSinceHash >= HASH_INTERVAL ? hashState(gameState) : undefined;
  if (hash) ticksSinceHash = 0;

  const notification: JsonRpcNotification = {
    jsonrpc: "2.0",
    method: "stateDiff",
    params: {
      tick: gameState.tick,
      diff,
      ...(hash ? { hash } : {}),
    } as Record<string, unknown>,
  };

  const msg = JSON.stringify(notification);
  for (const ws of clients) {
    ws.send(msg);
  }
}

// --- Tick loop ---

let tickTimer: ReturnType<typeof setInterval> | null = null;

function startTickLoop() {
  if (tickTimer) return;
  if (!gameState) return;

  tickTimer = setInterval(() => {
    if (!gameState || gameState.speed === 0) return;

    // Process multiple ticks based on speed
    for (let i = 0; i < gameState.speed; i++) {
      previousState = gameState;
      const result = applyAction(gameState, { type: "TICK" });
      gameState = result.state;
    }

    broadcastDiff();
  }, BALANCE.TICK_INTERVAL_MS);

  log.info("Tick loop started");
}

function stopTickLoop() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
    log.info("Tick loop stopped");
  }
}

// --- WebSocket server ---

const server = Bun.serve({
  port: 3000,
  fetch(req, server) {
    if (server.upgrade(req)) return;
    return new Response("DowntimeOPS Server");
  },
  websocket: {
    open(ws) {
      clients.add(ws);
      log.info({ clientCount: clients.size }, "Client connected");

      if (gameState) {
        // Active session: send snapshot and resume tick loop
        const snapshot: JsonRpcNotification = {
          jsonrpc: "2.0",
          method: "snapshot",
          params: { state: gameState } as unknown as Record<string, unknown>,
        };
        ws.send(JSON.stringify(snapshot));
        startTickLoop();
      } else {
        // No session: tell client to show menu
        const noSession: JsonRpcNotification = {
          jsonrpc: "2.0",
          method: "noSession",
          params: {} as Record<string, unknown>,
        };
        ws.send(JSON.stringify(noSession));
      }
    },

    async message(ws, message) {
      try {
        const request = JSON.parse(
          typeof message === "string" ? message : new TextDecoder().decode(message),
        ) as JsonRpcRequest;

        if (request.jsonrpc !== "2.0" || !request.method) {
          ws.send(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32600, message: "Invalid request" },
              id: request.id ?? null,
            }),
          );
          return;
        }

        const response = await handleRpcRequest(request, gameServer);
        ws.send(JSON.stringify(response));
      } catch (err) {
        log.error({ err }, "Failed to parse message");
        ws.send(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32700, message: "Parse error" },
            id: null,
          }),
        );
      }
    },

    close(ws) {
      clients.delete(ws);
      log.info({ clientCount: clients.size }, "Client disconnected");

      if (clients.size === 0) {
        // Auto-save and pause when last client disconnects
        if (gameState) {
          storage.save("autosave", gameState).catch((err) => {
            log.error({ err }, "Auto-save on disconnect failed");
          });
        }
        stopTickLoop();
      }
    },
  },
});

log.info({ port: server.port }, "DowntimeOPS server running");
