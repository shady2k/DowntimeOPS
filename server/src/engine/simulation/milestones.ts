import type { GameState, MilestoneState, MilestoneId } from "@downtime-ops/shared";
import { BALANCE } from "../config/balance";

const MILESTONE_DEFINITIONS: Array<{
  id: MilestoneId;
  title: string;
  description: string;
  reward: string | null;
}> = [
  {
    id: "first_client_served",
    title: "First Client Served",
    description: "Accept and serve your first hosting client",
    reward: "Unlocks SMB-tier clients",
  },
  {
    id: "first_month_profitable",
    title: "In the Black",
    description: "Reach positive net monthly cashflow",
    reward: null,
  },
  {
    id: "first_incident_resolved",
    title: "Crisis Averted",
    description: "Fix a port failure while clients are active",
    reward: "Unlocks device overload incidents",
  },
  {
    id: "first_congested_link",
    title: "Growing Pains",
    description: "Push a link past 90% capacity",
    reward: null,
  },
  {
    id: "five_clients",
    title: "Full House",
    description: "Serve 5 clients simultaneously",
    reward: "Unlocks Enterprise-tier clients",
  },
  {
    id: "reputation_70",
    title: "Trusted Provider",
    description: "Reach 70 reputation",
    reward: "Unlocks Finance-tier clients",
  },
  {
    id: "ten_clients",
    title: "Datacenter Operator",
    description: "Serve 10 clients simultaneously",
    reward: "Unlocks cascading failure events",
  },
  {
    id: "reputation_90",
    title: "Industry Leader",
    description: "Reach 90 reputation",
    reward: null,
  },
];

export function createInitialMilestones(): MilestoneState {
  return {
    milestones: MILESTONE_DEFINITIONS.map((def) => ({
      id: def.id,
      title: def.title,
      description: def.description,
      completed: false,
      completedAtTick: null,
      reward: def.reward,
    })),
    unlockedClientTiers: ["startup"],
    unlockedIncidentClasses: ["port_failure"],
  };
}

export function evaluateMilestones(state: GameState): GameState {
  const progression = state.progression;
  const milestones = progression.milestones.map((m) => ({ ...m }));
  let changed = false;

  const complete = (id: MilestoneId) => {
    const m = milestones.find((ms) => ms.id === id);
    if (m && !m.completed) {
      m.completed = true;
      m.completedAtTick = state.tick;
      changed = true;
    }
  };

  const isComplete = (id: MilestoneId): boolean =>
    milestones.find((m) => m.id === id)?.completed ?? false;

  const activeClients = Object.values(state.clients).filter(
    (c) => c.status === "active" || c.status === "warning",
  );

  // First client served
  if (activeClients.length > 0) complete("first_client_served");

  // First month profitable
  if (state.monthlyRevenue > state.monthlyExpenses && state.monthlyRevenue > 0)
    complete("first_month_profitable");

  // First incident resolved — tracked by repairPort action, check tutorial flag
  if (state.tutorial.objectives.some((o) => o.id === "survive_incident" && o.completed))
    complete("first_incident_resolved");

  // First congested link
  for (const link of Object.values(state.links)) {
    if (
      link.maxBandwidthMbps > 0 &&
      link.currentLoadMbps / link.maxBandwidthMbps > BALANCE.CONGESTION_THRESHOLD
    )
      complete("first_congested_link");
  }

  // Five clients
  if (activeClients.length >= 5) complete("five_clients");

  // Reputation 70
  if (state.reputation >= 70) complete("reputation_70");

  // Ten clients
  if (activeClients.length >= 10) complete("ten_clients");

  // Reputation 90
  if (state.reputation >= 90) complete("reputation_90");

  if (!changed) return state;

  // Compute unlocks
  const unlockedClientTiers: MilestoneState["unlockedClientTiers"] = ["startup"];
  if (isComplete("first_client_served")) unlockedClientTiers.push("smb");
  if (isComplete("five_clients")) unlockedClientTiers.push("enterprise");
  if (isComplete("reputation_70")) unlockedClientTiers.push("bank");

  const unlockedIncidentClasses: MilestoneState["unlockedIncidentClasses"] = [
    "port_failure",
  ];
  if (isComplete("first_incident_resolved"))
    unlockedIncidentClasses.push("device_overload");
  if (isComplete("ten_clients"))
    unlockedIncidentClasses.push("cascading");

  // Log new milestones
  const newLog = [...state.log];
  for (const m of milestones) {
    const prev = progression.milestones.find((pm) => pm.id === m.id);
    if (m.completed && prev && !prev.completed) {
      newLog.push({
        id: `log-${crypto.randomUUID()}`,
        tick: state.tick,
        message: `Milestone unlocked: ${m.title}${m.reward ? ` — ${m.reward}` : ""}`,
        category: "system",
      });
    }
  }

  return {
    ...state,
    log: newLog,
    progression: {
      milestones,
      unlockedClientTiers,
      unlockedIncidentClasses,
    },
  };
}
