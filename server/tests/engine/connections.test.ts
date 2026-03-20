import { describe, it, expect } from "vitest";
import { createInitialState, applyAction } from "../../src/engine";

function buildBasicNetwork() {
  let state = createInitialState();
  const rackId = Object.keys(state.racks)[0];

  // Place router, switch, server
  let result = applyAction(state, {
    type: "PLACE_DEVICE",
    rackId,
    slotU: 1,
    model: "router_1u",
  });
  state = result.state;
  const routerId = Object.values(state.devices).find(
    (d) => d.type === "router",
  )!.id;

  result = applyAction(state, {
    type: "PLACE_DEVICE",
    rackId,
    slotU: 2,
    model: "switch_24p",
  });
  state = result.state;
  const switchId = Object.values(state.devices).find(
    (d) => d.type === "switch",
  )!.id;

  result = applyAction(state, {
    type: "PLACE_DEVICE",
    rackId,
    slotU: 3,
    model: "server_1u",
  });
  state = result.state;
  const serverId = Object.values(state.devices).find(
    (d) => d.type === "server",
  )!.id;

  // Cable: router:0 ↔ switch:0
  result = applyAction(state, {
    type: "CONNECT_PORTS",
    deviceIdA: routerId,
    portIndexA: 0,
    deviceIdB: switchId,
    portIndexB: 0,
    cableType: "cat6",
  });
  state = result.state;

  // Cable: switch:1 ↔ server:0
  result = applyAction(state, {
    type: "CONNECT_PORTS",
    deviceIdA: switchId,
    portIndexA: 1,
    deviceIdB: serverId,
    portIndexB: 0,
    cableType: "cat6",
  });
  state = result.state;

  return { state, routerId, switchId, serverId, rackId };
}

describe("CONNECT_PORTS", () => {
  it("should create a link between two ports", () => {
    const state = createInitialState();
    const rackId = Object.keys(state.racks)[0];

    let result = applyAction(state, {
      type: "PLACE_DEVICE",
      rackId,
      slotU: 1,
      model: "switch_24p",
    });
    const switchId = Object.keys(result.state.devices)[0];

    result = applyAction(result.state, {
      type: "PLACE_DEVICE",
      rackId,
      slotU: 2,
      model: "server_1u",
    });
    const devices = Object.values(result.state.devices);
    const serverId = devices.find((d) => d.type === "server")!.id;

    result = applyAction(result.state, {
      type: "CONNECT_PORTS",
      deviceIdA: switchId,
      portIndexA: 0,
      deviceIdB: serverId,
      portIndexB: 0,
      cableType: "cat6",
    });

    expect(result.error).toBeUndefined();
    expect(Object.keys(result.state.links)).toHaveLength(1);

    const link = Object.values(result.state.links)[0];
    expect(link.status).toBe("active");
    expect(link.maxBandwidthMbps).toBe(1000);

    // Ports should reference the link
    const sw = result.state.devices[switchId];
    expect(sw.ports[0].linkId).toBe(link.id);
  });

  it("should reject connecting already-connected port", () => {
    const { state, switchId, serverId } = buildBasicNetwork();

    // Try to connect server:0 again (already connected)
    const result = applyAction(state, {
      type: "CONNECT_PORTS",
      deviceIdA: switchId,
      portIndexA: 2,
      deviceIdB: serverId,
      portIndexB: 0,
      cableType: "cat6",
    });

    expect(result.error).toBeDefined();
  });
});

describe("Connection path resolution", () => {
  it("should create connections when accepting a client", () => {
    const { state } = buildBasicNetwork();

    // Manually add a prospect client
    const clientId = "test-client";
    const stateWithClient = {
      ...state,
      clients: {
        [clientId]: {
          id: clientId,
          name: "Test Client",
          type: "startup" as const,
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
          status: "prospect" as const,
        },
      },
    };

    const result = applyAction(stateWithClient, {
      type: "ACCEPT_CLIENT",
      clientId,
    });

    expect(result.error).toBeUndefined();
    expect(result.state.clients[clientId].status).toBe("active");

    // Should have created at least one connection
    const connections = Object.values(result.state.connections);
    expect(connections.length).toBeGreaterThan(0);
    expect(connections[0].status).toBe("active");
    expect(connections[0].clientId).toBe(clientId);
    expect(connections[0].path.length).toBeGreaterThan(0);
  });
});

describe("REPAIR_PORT", () => {
  it("should repair a failed port", () => {
    const { state, serverId } = buildBasicNetwork();

    // Manually break a port
    const server = state.devices[serverId];
    const brokenState = {
      ...state,
      devices: {
        ...state.devices,
        [serverId]: {
          ...server,
          ports: server.ports.map((p, i) =>
            i === 0 ? { ...p, status: "down" as const } : p,
          ),
        },
      },
    };

    const result = applyAction(brokenState, {
      type: "REPAIR_PORT",
      deviceId: serverId,
      portIndex: 0,
    });

    expect(result.error).toBeUndefined();
    expect(result.state.devices[serverId].ports[0].status).toBe("up");
    expect(result.state.money).toBe(brokenState.money - 200);
  });

  it("should reject repairing an already-up port", () => {
    const { state, serverId } = buildBasicNetwork();

    const result = applyAction(state, {
      type: "REPAIR_PORT",
      deviceId: serverId,
      portIndex: 0,
    });

    expect(result.error).toBeDefined();
  });
});
