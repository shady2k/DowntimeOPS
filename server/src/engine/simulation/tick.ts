import type { GameState } from "@downtime-ops/shared";
import { BALANCE } from "../config/balance";
import { generateFailures } from "./failureGen";
import {
  updateConnectionHealth,
  updateLinkUtilization,
  reestablishConnections,
} from "./connectionEngine";
import { processEconomyTick } from "./economy";
import { checkSla } from "./sla";
import { generateProspect, shouldGenerateProspect } from "../config/clients";

export function processTick(state: GameState): GameState {
  let next: GameState = { ...state, tick: state.tick + 1 };

  // Generate random failures
  next = generateFailures(next);

  // Terminate connections with broken paths
  next = updateConnectionHealth(next);

  // Try to re-establish terminated connections
  next = reestablishConnections(next);

  // Recalculate link utilization
  next = updateLinkUtilization(next);

  // Economy: accrue revenue, deduct costs
  next = processEconomyTick(next);

  // SLA checks
  next = checkSla(next);

  // Client prospect generation
  next = generateClientsIfDue(next);

  // Trim log and alerts
  next = trimLogAndAlerts(next);

  return next;
}

function generateClientsIfDue(state: GameState): GameState {
  const prospectCount = Object.values(state.clients).filter(
    (c) => c.status === "prospect",
  ).length;

  if (!shouldGenerateProspect(state.tick, prospectCount)) return state;

  const prospect = generateProspect(state.reputation, state.tick);
  const newLog = [
    ...state.log,
    {
      id: `log-${crypto.randomUUID()}`,
      tick: state.tick,
      message: `New prospect: ${prospect.name} (${prospect.contract.bandwidthMbps} Mbps, $${prospect.contract.monthlyRevenue}/mo)`,
      category: "client" as const,
    },
  ];

  return {
    ...state,
    clients: { ...state.clients, [prospect.id]: prospect },
    log: newLog,
  };
}

function trimLogAndAlerts(state: GameState): GameState {
  const log =
    state.log.length > BALANCE.MAX_LOG_ENTRIES
      ? state.log.slice(-BALANCE.MAX_LOG_ENTRIES)
      : state.log;

  const alerts =
    state.alerts.length > BALANCE.MAX_ALERTS
      ? state.alerts.slice(-BALANCE.MAX_ALERTS)
      : state.alerts;

  if (log === state.log && alerts === state.alerts) return state;
  return { ...state, log, alerts };
}
