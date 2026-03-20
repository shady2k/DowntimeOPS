import type { Port } from "./Port";

export type DeviceType =
  | "server"
  | "switch"
  | "router"
  | "firewall"
  | "pdu"
  | "patch_panel";

export type DeviceStatus = "online" | "offline" | "degraded" | "failed";

export interface DeviceConfig {
  [key: string]: unknown;
}

export interface Device {
  id: string;
  type: DeviceType;
  name: string;
  model: string;
  uHeight: number;
  rackId: string;
  slotU: number;
  ports: Port[];
  powerDrawWatts: number;
  heatOutput: number;
  status: DeviceStatus;
  health: number;
  config: DeviceConfig;
}
