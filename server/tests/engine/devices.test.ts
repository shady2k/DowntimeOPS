import { describe, it, expect } from "vitest";
import { createInitialState, applyAction } from "../../src/engine";

describe("PLACE_DEVICE", () => {
  it("should place a server in the rack", () => {
    const state = createInitialState();
    const rackId = Object.keys(state.racks)[0];

    const result = applyAction(state, {
      type: "PLACE_DEVICE",
      rackId,
      slotU: 1,
      model: "server_1u",
    });

    expect(result.error).toBeUndefined();
    expect(Object.keys(result.state.devices)).toHaveLength(1);

    const device = Object.values(result.state.devices)[0];
    expect(device.type).toBe("server");
    expect(device.slotU).toBe(1);
    expect(device.ports).toHaveLength(2);
    expect(device.status).toBe("online");
    expect(device.config.ip).toBeDefined();

    // Money should be deducted
    expect(result.state.money).toBe(state.money - 2000);

    // Rack should show the device
    const rack = result.state.racks[rackId];
    expect(rack.devices[1]).toBeDefined();
    expect(rack.currentPowerWatts).toBe(300);
  });

  it("should place a switch with 24 ports", () => {
    const state = createInitialState();
    const rackId = Object.keys(state.racks)[0];

    const result = applyAction(state, {
      type: "PLACE_DEVICE",
      rackId,
      slotU: 5,
      model: "switch_24p",
    });

    expect(result.error).toBeUndefined();
    const device = Object.values(result.state.devices)[0];
    expect(device.type).toBe("switch");
    expect(device.ports).toHaveLength(24);
  });

  it("should assign uplink to first router", () => {
    const state = createInitialState();
    const rackId = Object.keys(state.racks)[0];

    const result = applyAction(state, {
      type: "PLACE_DEVICE",
      rackId,
      slotU: 10,
      model: "router_1u",
    });

    expect(result.error).toBeUndefined();
    const device = Object.values(result.state.devices)[0];
    expect(device.config.ip).toBe("10.0.0.1");

    // Uplink should be assigned to this router
    expect(result.state.uplinks[0].deviceId).toBe(device.id);
    expect(result.state.uplinks[0].portIndex).toBe(3); // last port of 4
  });

  it("should reject placement in occupied slot", () => {
    const state = createInitialState();
    const rackId = Object.keys(state.racks)[0];

    const s1 = applyAction(state, {
      type: "PLACE_DEVICE",
      rackId,
      slotU: 1,
      model: "server_1u",
    });
    const s2 = applyAction(s1.state, {
      type: "PLACE_DEVICE",
      rackId,
      slotU: 1,
      model: "server_1u",
    });

    expect(s2.error).toBeDefined();
    expect(Object.keys(s2.state.devices)).toHaveLength(1);
  });

  it("should reject unknown equipment model", () => {
    const state = createInitialState();
    const rackId = Object.keys(state.racks)[0];

    const result = applyAction(state, {
      type: "PLACE_DEVICE",
      rackId,
      slotU: 1,
      model: "nonexistent",
    });

    expect(result.error).toBeDefined();
  });

  it("should reject when not enough money", () => {
    const state = { ...createInitialState(), money: 100 };
    const rackId = Object.keys(state.racks)[0];

    const result = applyAction(state, {
      type: "PLACE_DEVICE",
      rackId,
      slotU: 1,
      model: "server_1u",
    });

    expect(result.error).toBeDefined();
  });
});

describe("REMOVE_DEVICE", () => {
  it("should remove a device from the rack", () => {
    const state = createInitialState();
    const rackId = Object.keys(state.racks)[0];

    const s1 = applyAction(state, {
      type: "PLACE_DEVICE",
      rackId,
      slotU: 1,
      model: "server_1u",
    });
    const deviceId = Object.keys(s1.state.devices)[0];

    const s2 = applyAction(s1.state, {
      type: "REMOVE_DEVICE",
      deviceId,
    });

    expect(s2.error).toBeUndefined();
    expect(Object.keys(s2.state.devices)).toHaveLength(0);

    const rack = s2.state.racks[rackId];
    expect(rack.devices[1]).toBeUndefined();
    expect(rack.currentPowerWatts).toBe(0);
  });
});
