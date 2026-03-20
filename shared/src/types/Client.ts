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
}
