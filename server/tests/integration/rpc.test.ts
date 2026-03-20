import { describe, it, expect, beforeEach } from "vitest";
import type {
  GameState,
  JsonRpcRequest,
  JsonRpcNotification,
} from "@downtime-ops/shared";
import { createInitialState } from "../../src/engine";
import { handleRpcRequest, type GameServer } from "../../src/rpc/handler";

function createMockServer(): GameServer & {
  state: GameState;
  notifications: JsonRpcNotification[];
} {
  const server = {
    state: createInitialState(),
    notifications: [] as JsonRpcNotification[],
    getState() {
      return server.state;
    },
    setState(s: GameState) {
      server.state = s;
    },
    broadcast(n: JsonRpcNotification) {
      server.notifications.push(n);
    },
    async saveGame(_name: string) {},
    async loadGame(_saveId: string) {},
  };
  return server;
}

function makeRequest(
  method: string,
  params?: Record<string, unknown>,
  id = 1,
): JsonRpcRequest {
  return { jsonrpc: "2.0", method, params, id };
}

describe("JSON-RPC handler", () => {
  let server: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    server = createMockServer();
  });

  it("should return snapshot via getSnapshot", async () => {
    const response = await handleRpcRequest(
      makeRequest("getSnapshot"),
      server,
    );

    expect(response.error).toBeUndefined();
    expect(response.result).toBeDefined();

    const result = response.result as { state: GameState };
    expect(result.state.tick).toBe(0);
    expect(result.state.money).toBeGreaterThan(0);
  });

  it("should place a device via placeDevice", async () => {
    const rackId = Object.keys(server.state.racks)[0];

    const response = await handleRpcRequest(
      makeRequest("placeDevice", { rackId, slotU: 1, model: "server_1u" }),
      server,
    );

    expect(response.error).toBeUndefined();
    expect(Object.keys(server.state.devices)).toHaveLength(1);
  });

  it("should return error for unknown method", async () => {
    const response = await handleRpcRequest(
      makeRequest("nonexistentMethod"),
      server,
    );

    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(-32601);
  });

  it("should return error for invalid action", async () => {
    const response = await handleRpcRequest(
      makeRequest("placeDevice", {
        rackId: "nonexistent",
        slotU: 1,
        model: "server_1u",
      }),
      server,
    );

    expect(response.error).toBeDefined();
  });

  it("should handle full round-trip: place, connect, accept", async () => {
    const rackId = Object.keys(server.state.racks)[0];

    // Place router
    await handleRpcRequest(
      makeRequest("placeDevice", { rackId, slotU: 1, model: "router_1u" }, 1),
      server,
    );

    // Place switch
    await handleRpcRequest(
      makeRequest("placeDevice", { rackId, slotU: 2, model: "switch_24p" }, 2),
      server,
    );

    // Place server
    await handleRpcRequest(
      makeRequest("placeDevice", { rackId, slotU: 3, model: "server_1u" }, 3),
      server,
    );

    expect(Object.keys(server.state.devices)).toHaveLength(3);

    const router = Object.values(server.state.devices).find(
      (d) => d.type === "router",
    )!;
    const sw = Object.values(server.state.devices).find(
      (d) => d.type === "switch",
    )!;
    const srv = Object.values(server.state.devices).find(
      (d) => d.type === "server",
    )!;

    // Connect router:0 ↔ switch:0
    await handleRpcRequest(
      makeRequest(
        "connectPorts",
        {
          deviceIdA: router.id,
          portIndexA: 0,
          deviceIdB: sw.id,
          portIndexB: 0,
          cableType: "cat6",
        },
        4,
      ),
      server,
    );

    // Connect switch:1 ↔ server:0
    await handleRpcRequest(
      makeRequest(
        "connectPorts",
        {
          deviceIdA: sw.id,
          portIndexA: 1,
          deviceIdB: srv.id,
          portIndexB: 0,
          cableType: "cat6",
        },
        5,
      ),
      server,
    );

    expect(Object.keys(server.state.links)).toHaveLength(2);

    // Add a prospect manually
    const clientId = "rpc-test-client";
    server.state = {
      ...server.state,
      clients: {
        [clientId]: {
          id: clientId,
          name: "RPC Test Corp",
          type: "startup",
          contract: {
            bandwidthMbps: 10,
            uptimeSla: 99.0,
            isolationRequired: false,
            dedicatedHardware: false,
            monthlyRevenue: 150,
            penaltyPerViolation: 100,
            durationMonths: 6,
          },
          satisfaction: 100,
          status: "prospect",
        },
      },
    };

    // Accept client via RPC
    const acceptResponse = await handleRpcRequest(
      makeRequest("acceptClient", { clientId }, 6),
      server,
    );

    expect(acceptResponse.error).toBeUndefined();
    expect(server.state.clients[clientId].status).toBe("active");
    expect(Object.keys(server.state.connections).length).toBeGreaterThan(0);

    // Set speed
    const speedResponse = await handleRpcRequest(
      makeRequest("setSpeed", { speed: 2 }, 7),
      server,
    );

    expect(speedResponse.error).toBeUndefined();
    expect(server.state.speed).toBe(2);

    // Pause
    const pauseResponse = await handleRpcRequest(
      makeRequest("pause", undefined, 8),
      server,
    );

    expect(pauseResponse.error).toBeUndefined();
    expect(server.state.speed).toBe(0);

    // Repair a port that's already up — should error
    const repairResponse = await handleRpcRequest(
      makeRequest(
        "repairPort",
        { deviceId: srv.id, portIndex: 0 },
        9,
      ),
      server,
    );

    expect(repairResponse.error).toBeDefined();
  });

  it("should handle tracer start and step", async () => {
    const rackId = Object.keys(server.state.racks)[0];

    // Build network
    await handleRpcRequest(
      makeRequest("placeDevice", { rackId, slotU: 1, model: "router_1u" }, 1),
      server,
    );
    await handleRpcRequest(
      makeRequest("placeDevice", { rackId, slotU: 2, model: "switch_24p" }, 2),
      server,
    );
    await handleRpcRequest(
      makeRequest("placeDevice", { rackId, slotU: 3, model: "server_1u" }, 3),
      server,
    );

    const router = Object.values(server.state.devices).find(
      (d) => d.type === "router",
    )!;
    const sw = Object.values(server.state.devices).find(
      (d) => d.type === "switch",
    )!;
    const srv = Object.values(server.state.devices).find(
      (d) => d.type === "server",
    )!;

    await handleRpcRequest(
      makeRequest("connectPorts", {
        deviceIdA: router.id,
        portIndexA: 0,
        deviceIdB: sw.id,
        portIndexB: 0,
        cableType: "cat6",
      }, 4),
      server,
    );
    await handleRpcRequest(
      makeRequest("connectPorts", {
        deviceIdA: sw.id,
        portIndexA: 1,
        deviceIdB: srv.id,
        portIndexB: 0,
        cableType: "cat6",
      }, 5),
      server,
    );

    // Start tracer
    const startResponse = await handleRpcRequest(
      makeRequest("startTracer", {
        srcIp: srv.config.ip,
        dstIp: "203.0.113.1",
        protocol: "tcp",
        dstPort: 443,
      }, 6),
      server,
    );

    expect(startResponse.error).toBeUndefined();
    const tracerId = (startResponse.result as { tracerId: string }).tracerId;
    expect(tracerId).toBeDefined();

    // Step tracer until done
    let done = false;
    let steps = 0;
    while (!done && steps < 10) {
      const stepResponse = await handleRpcRequest(
        makeRequest("stepTracer", { tracerId }, 100 + steps),
        server,
      );
      expect(stepResponse.error).toBeUndefined();
      const packet = (stepResponse.result as { packet: { status: string } })
        .packet;
      if (
        packet.status === "delivered" ||
        packet.status === "dropped" ||
        packet.status === "expired"
      ) {
        done = true;
      }
      steps++;
    }

    expect(done).toBe(true);
  });
});
