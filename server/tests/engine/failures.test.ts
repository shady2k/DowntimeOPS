import { describe, it, expect } from "vitest";
import { createInitialState, applyAction } from "../../src/engine";
import { generateFailures } from "../../src/engine/simulation/failureGen";
import {
  updateConnectionHealth,
} from "../../src/engine/simulation/connectionEngine";

function buildNetworkWithClient() {
  let state = createInitialState();
  const rackId = Object.keys(state.racks)[0];

  let result = applyAction(state, {
    type: "PLACE_DEVICE",
    rackId,
    slotU: 1,
    model: "router_1u",
  });
  state = result.state;

  result = applyAction(state, {
    type: "PLACE_DEVICE",
    rackId,
    slotU: 2,
    model: "switch_24p",
  });
  state = result.state;

  result = applyAction(state, {
    type: "PLACE_DEVICE",
    rackId,
    slotU: 3,
    model: "server_1u",
  });
  state = result.state;

  const router = Object.values(state.devices).find(
    (d) => d.type === "router",
  )!;
  const sw = Object.values(state.devices).find((d) => d.type === "switch")!;
  const server = Object.values(state.devices).find(
    (d) => d.type === "server",
  )!;

  result = applyAction(state, {
    type: "CONNECT_PORTS",
    deviceIdA: router.id,
    portIndexA: 0,
    deviceIdB: sw.id,
    portIndexB: 0,
    cableType: "cat6",
  });
  state = result.state;

  result = applyAction(state, {
    type: "CONNECT_PORTS",
    deviceIdA: sw.id,
    portIndexA: 1,
    deviceIdB: server.id,
    portIndexB: 0,
    cableType: "cat6",
  });
  state = result.state;

  // Add and accept a client
  const clientId = "test-client";
  state = {
    ...state,
    clients: {
      [clientId]: {
        id: clientId,
        name: "Test Corp",
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

  result = applyAction(state, { type: "ACCEPT_CLIENT", clientId });
  state = result.state;

  return { state, router, sw, server, clientId };
}

describe("Failure generator", () => {
  it("should fail ports when rng always triggers", () => {
    const { state } = buildNetworkWithClient();

    // Use an rng that always triggers failure
    const failed = generateFailures(state, () => 0);

    // All up ports should now be down
    for (const device of Object.values(failed.devices)) {
      for (const port of device.ports) {
        if (state.devices[device.id].ports[port.index].status === "up") {
          expect(port.status).toBe("down");
        }
      }
    }

    // Should have generated alerts
    expect(failed.alerts.length).toBeGreaterThan(state.alerts.length);
  });

  it("should not fail ports when rng never triggers", () => {
    const { state } = buildNetworkWithClient();

    const result = generateFailures(state, () => 1);

    // All ports should remain up
    for (const device of Object.values(result.devices)) {
      for (const port of device.ports) {
        expect(port.status).toBe(
          state.devices[device.id].ports[port.index].status,
        );
      }
    }
  });
});

describe("Port failure affects connections", () => {
  it("should terminate connections when a port in the path goes down", () => {
    const { state, sw } = buildNetworkWithClient();

    // Verify we have active connections
    const activeConns = Object.values(state.connections).filter(
      (c) => c.status === "active",
    );
    expect(activeConns.length).toBeGreaterThan(0);

    // Break switch port 1 (connects to server)
    const brokenState = {
      ...state,
      devices: {
        ...state.devices,
        [sw.id]: {
          ...state.devices[sw.id],
          ports: state.devices[sw.id].ports.map((p, i) =>
            i === 1 ? { ...p, status: "down" as const } : p,
          ),
        },
      },
    };

    // Run connection health check
    const afterHealth = updateConnectionHealth(brokenState);

    // Connections should be terminated
    const terminatedConns = Object.values(afterHealth.connections).filter(
      (c) => c.status === "terminated",
    );
    expect(terminatedConns.length).toBeGreaterThan(0);
  });

  it("should re-establish connections after port is repaired", () => {
    const { state, sw } = buildNetworkWithClient();

    // Break switch port 1
    let brokenState = {
      ...state,
      devices: {
        ...state.devices,
        [sw.id]: {
          ...state.devices[sw.id],
          ports: state.devices[sw.id].ports.map((p, i) =>
            i === 1 ? { ...p, status: "down" as const } : p,
          ),
        },
      },
    };

    // Terminate connections
    brokenState = updateConnectionHealth(brokenState);
    const terminated = Object.values(brokenState.connections).filter(
      (c) => c.status === "terminated",
    );
    expect(terminated.length).toBeGreaterThan(0);

    // Repair the port
    const result = applyAction(brokenState, {
      type: "REPAIR_PORT",
      deviceId: sw.id,
      portIndex: 1,
    });

    // Connections should be re-established
    const reestablished = Object.values(result.state.connections).filter(
      (c) => c.status === "active",
    );
    expect(reestablished.length).toBeGreaterThan(0);
  });
});
