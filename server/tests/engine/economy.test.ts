import { describe, it, expect } from "vitest";
import { createInitialState, applyAction, BALANCE } from "../../src/engine";

describe("Economy", () => {
  it("should accrue uplink costs per tick", () => {
    const state = createInitialState();

    const result = applyAction(state, { type: "TICK" });

    // Uplink cost should reduce money slightly
    const tickCost = BALANCE.UPLINK_MONTHLY_COST / BALANCE.TICKS_PER_GAME_MONTH;
    expect(result.state.money).toBeLessThan(state.money);
    expect(result.state.money).toBeCloseTo(state.money - tickCost, 2);
  });

  it("should track monthly expenses", () => {
    const state = createInitialState();

    const result = applyAction(state, { type: "TICK" });

    expect(result.state.monthlyExpenses).toBe(BALANCE.UPLINK_MONTHLY_COST);
  });
});
