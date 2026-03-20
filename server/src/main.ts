import type {
  GameState,
  JsonRpcRequest,
  JsonRpcNotification,
} from "@downtime-ops/shared";
import pino from "pino";
import { createInitialState, applyAction, BALANCE } from "./engine";
import { handleRpcRequest, type GameServer } from "./rpc/handler";
import { diffStates, isDiffEmpty } from "./sync/differ";
import { hashState } from "./sync/hasher";
import { JsonFileStorage } from "./storage/jsonFile";
import type { ServerWebSocket } from "bun";

const log = pino({ name: "downtime-ops" });
const storage = new JsonFileStorage();

// --- Game state ---

let gameState: GameState = createInitialState();
let previousState: GameState = gameState;

// --- Connected clients ---

const clients = new Set<ServerWebSocket<unknown>>();

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
    await storage.save(name, gameState);
    log.info({ name }, "Game saved");
  },
  loadGame: async (saveId: string) => {
    gameState = await storage.load(saveId);
    previousState = gameState;
    log.info({ saveId }, "Game loaded");
  },
};

// --- State sync ---

let ticksSinceHash = 0;
const HASH_INTERVAL = 10;

function broadcastDiff() {
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

  tickTimer = setInterval(() => {
    if (gameState.speed === 0) return;

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

      // Send full snapshot on connect
      const snapshot: JsonRpcNotification = {
        jsonrpc: "2.0",
        method: "snapshot",
        params: { state: gameState } as unknown as Record<string, unknown>,
      };
      ws.send(JSON.stringify(snapshot));
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
        stopTickLoop();
      }
    },
  },
});

// Start tick loop immediately
startTickLoop();

log.info({ port: server.port }, "DowntimeOPS server running");
