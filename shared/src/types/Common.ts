export interface Alert {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  message: string;
  deviceId?: string;
  portIndex?: number;
  clientId?: string;
  tick: number;
  acknowledged: boolean;
}

export interface LogEntry {
  id: string;
  tick: number;
  message: string;
  category: "system" | "network" | "client" | "economy";
}

export interface Uplink {
  id: string;
  name: string;
  bandwidthMbps: number;
  monthlyCost: number;
  status: "active" | "down";
  deviceId: string;
  portIndex: number;
}

export interface SaveInfo {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  phase: number;
  money: number;
}
