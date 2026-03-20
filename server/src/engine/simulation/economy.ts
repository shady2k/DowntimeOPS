import type { GameState } from "@downtime-ops/shared";
import { BALANCE } from "../config/balance";

export function processEconomyTick(state: GameState): GameState {
  const tickFraction = 1 / BALANCE.TICKS_PER_GAME_MONTH;

  let monthlyRevenue = 0;
  for (const client of Object.values(state.clients)) {
    if (client.status === "active") {
      monthlyRevenue += client.contract.monthlyRevenue;
    }
  }

  let monthlyExpenses = 0;
  for (const uplink of state.uplinks) {
    if (uplink.status === "active") {
      monthlyExpenses += uplink.monthlyCost;
    }
  }

  const perTickRevenue = monthlyRevenue * tickFraction;
  const perTickCost = monthlyExpenses * tickFraction;

  return {
    ...state,
    money: state.money + perTickRevenue - perTickCost,
    monthlyRevenue,
    monthlyExpenses,
  };
}
