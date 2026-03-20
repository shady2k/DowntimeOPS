export type CableType = "cat6" | "cat6a" | "om3_fiber" | "os2_fiber";

export interface Link {
  id: string;
  type: CableType;
  portA: { deviceId: string; portIndex: number };
  portB: { deviceId: string; portIndex: number };
  maxBandwidthMbps: number;
  currentLoadMbps: number;
  activeConnectionIds: string[];
  status: "active" | "degraded" | "cut";
  lengthMeters: number;
}
