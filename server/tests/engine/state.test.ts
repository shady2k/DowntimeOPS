import { describe, it, expect } from "vitest";
import { createInitialState, applyAction, BALANCE } from "../../src/engine";

describe("createInitialState", () => {
  it("should create a valid initial state", () => {
    const state = createInitialState();

    expect(state.tick).toBe(0);
    expect(state.speed).toBe(1);
    expect(state.money).toBe(BALANCE.STARTING_MONEY);
    expect(state.reputation).toBe(BALANCE.STARTING_REPUTATION);
    expect(state.phase).toBe(1);

    const rackIds = Object.keys(state.racks);
    expect(rackIds).toHaveLength(1);

    const rack = state.racks[rackIds[0]];
    expect(rack.totalU).toBe(42);
    expect(rack.currentPowerWatts).toBe(0);
    expect(Object.keys(rack.devices)).toHaveLength(0);

    expect(Object.keys(state.devices)).toHaveLength(0);
    expect(Object.keys(state.links)).toHaveLength(0);
    expect(Object.keys(state.connections)).toHaveLength(0);
    expect(state.uplinks).toHaveLength(1);
  });
});

describe("SET_SPEED", () => {
  it("should change game speed", () => {
    const state = createInitialState();
    const result = applyAction(state, { type: "SET_SPEED", speed: 2 });

    expect(result.error).toBeUndefined();
    expect(result.state.speed).toBe(2);
  });

  it("should reject invalid speed", () => {
    const state = createInitialState();
    const result = applyAction(state, { type: "SET_SPEED", speed: 5 });

    expect(result.error).toBeDefined();
    expect(result.state.speed).toBe(1);
  });

  it("should allow pausing", () => {
    const state = createInitialState();
    const result = applyAction(state, { type: "SET_SPEED", speed: 0 });

    expect(result.error).toBeUndefined();
    expect(result.state.speed).toBe(0);
  });
});
