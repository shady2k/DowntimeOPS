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
import { evaluateObjectives } from "./objectives";
import { evaluateMilestones } from "./milestones";
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

  // Evaluate tutorial objectives
  next = evaluateObjectives(next);

  // Evaluate milestones (after objectives so survive_incident is tracked)
  next = evaluateMilestones(next);

  // Client prospect generation
  next = generateClientsIfDue(next);

  // Expire old prospects
  next = expireProspects(next);

  // Trim log and alerts
  next = trimLogAndAlerts(next);

  return next;
}

function generateClientsIfDue(state: GameState): GameState {
  // Don't generate random prospects until tutorial starter client is resolved
  if (!state.tutorial.firstClientActivated) return state;

  const prospectCount = Object.values(state.clients).filter(
    (c) => c.status === "prospect",
  ).length;

  if (!shouldGenerateProspect(state.tick, prospectCount)) return state;

  const prospect = generateProspect(
    state.reputation,
    state.tick,
    state.progression.unlockedClientTiers,
  );

  const newLog = [
    ...state.log,
    {
      id: `log-${crypto.randomUUID()}`,
      tick: state.tick,
      message: `New prospect: ${prospect.name} (${prospect.type}, ${prospect.contract.bandwidthMbps} Mbps, $${prospect.contract.monthlyRevenue}/mo)`,
      category: "client" as const,
    },
  ];

  return {
    ...state,
    clients: { ...state.clients, [prospect.id]: prospect },
    log: newLog,
  };
}

function expireProspects(state: GameState): GameState {
  const expired: string[] = [];
  for (const client of Object.values(state.clients)) {
    if (
      client.status === "prospect" &&
      client.prospectTick !== null &&
      state.tick - client.prospectTick >= BALANCE.PROSPECT_EXPIRE_TICKS
    ) {
      expired.push(client.id);
    }
  }

  if (expired.length === 0) return state;

  const newClients = { ...state.clients };
  const newLog = [...state.log];

  for (const id of expired) {
    const client = newClients[id];
    newLog.push({
      id: `log-${crypto.randomUUID()}`,
      tick: state.tick,
      message: `Prospect expired: ${client.name} found another provider`,
      category: "client" as const,
    });
    delete newClients[id];
  }

  return { ...state, clients: newClients, log: newLog };
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
