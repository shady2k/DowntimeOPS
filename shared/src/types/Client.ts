export interface Contract {
  bandwidthMbps: number;
  uptimeSla: number;
  isolationRequired: boolean;
  dedicatedHardware: boolean;
  monthlyRevenue: number;
  penaltyPerViolation: number;
  durationMonths: number;
}

export interface Client {
  id: string;
  name: string;
  type: "startup" | "smb" | "enterprise" | "bank";
  contract: Contract;
  satisfaction: number;
  status: "prospect" | "active" | "warning" | "churned";
  flavor: string;
  prospectTick: number | null; // tick when this client became a prospect (for expiry display)
}
