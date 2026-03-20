import type { GameState } from "@downtime-ops/shared";
import { BALANCE } from "../config/balance";

export function checkSla(state: GameState): GameState {
  if (state.tick % BALANCE.SLA_CHECK_INTERVAL_TICKS !== 0) return state;

  let newState = { ...state };
  const newClients = { ...state.clients };
  const newAlerts = [...state.alerts];
  const newLog = [...state.log];
  let reputation = state.reputation;

  for (const client of Object.values(state.clients)) {
    if (client.status !== "active" && client.status !== "warning") continue;

    // Count this client's connections
    const clientConns = Object.values(state.connections).filter(
      (c) => c.clientId === client.id,
    );
    if (clientConns.length === 0) continue;

    const activeCount = clientConns.filter(
      (c) => c.status === "active",
    ).length;
    const uptimePercent = (activeCount / clientConns.length) * 100;

    if (uptimePercent < client.contract.uptimeSla) {
      // SLA violation
      const newSatisfaction = Math.max(
        0,
        client.satisfaction - BALANCE.SATISFACTION_LOSS_ON_VIOLATION,
      );
      reputation = Math.max(
        0,
        reputation - BALANCE.REPUTATION_LOSS_ON_SLA_VIOLATION,
      );
      newState = {
        ...newState,
        money: newState.money - client.contract.penaltyPerViolation,
      };

      let newStatus: "active" | "warning" | "churned" = client.status === "warning" ? "warning" : "active";
      if (newSatisfaction <= BALANCE.CHURN_SATISFACTION_THRESHOLD) {
        newStatus = "churned";
      } else if (newSatisfaction < 50) {
        newStatus = "warning";
      }

      newClients[client.id] = {
        ...client,
        satisfaction: newSatisfaction,
        status: newStatus,
      };

      newAlerts.push({
        id: `alert-${crypto.randomUUID()}`,
        type: "sla_violation",
        severity: "warning",
        message: `SLA violation for ${client.name}: ${uptimePercent.toFixed(1)}% (required ${client.contract.uptimeSla}%)`,
        clientId: client.id,
        tick: state.tick,
        acknowledged: false,
      });

      newLog.push({
        id: `log-${crypto.randomUUID()}`,
        tick: state.tick,
        message: `SLA violation: ${client.name} at ${uptimePercent.toFixed(1)}% uptime`,
        category: "client",
      });
    } else {
      reputation = Math.min(100, reputation + BALANCE.REPUTATION_GAIN_ON_SLA_MET);
    }
  }

  return {
    ...newState,
    clients: newClients,
    alerts: newAlerts,
    log: newLog,
    reputation,
  };
}
