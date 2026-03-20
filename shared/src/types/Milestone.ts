export type MilestoneId =
  | "first_client_served"
  | "first_month_profitable"
  | "first_incident_resolved"
  | "first_congested_link"
  | "five_clients"
  | "reputation_70"
  | "ten_clients"
  | "reputation_90";

export interface Milestone {
  id: MilestoneId;
  title: string;
  description: string;
  completed: boolean;
  completedAtTick: number | null;
  reward: string | null; // player-facing reward description
}

export interface MilestoneState {
  milestones: Milestone[];
  unlockedClientTiers: Array<"startup" | "smb" | "enterprise" | "bank">;
  unlockedIncidentClasses: Array<"port_failure" | "device_overload" | "cascading">;
}
