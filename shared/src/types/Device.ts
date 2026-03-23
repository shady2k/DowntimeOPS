import type { Port } from "./Port";

export type DeviceType =
  | "server"
  | "switch"
  | "router"
  | "firewall"
  | "pdu"
  | "patch_panel";

export type DeviceStatus = "online" | "offline" | "degraded" | "failed";

// --- Per-device-type configuration ---

export interface InterfaceConfig {
  ip: string | null;
  mask: number | null;
  enabled: boolean;
  description: string;
}

export interface RouterConfig {
  hostname: string;
  interfaces: Record<number, InterfaceConfig>; // keyed by port index
}

export interface SwitchConfig {
  hostname: string;
  managementIp: string | null;
  managementMask: number | null;
}

export interface ServerConfig {
  hostname: string;
  ip: string | null;
  mask: number | null;
  gateway: string | null;
  services: Array<{ name: string; port: number; enabled: boolean }>;
}

export interface FirewallConfig {
  hostname: string;
  interfaces: Record<number, InterfaceConfig>;
}

/** Generic fallback for device types without specific config (pdu, patch_panel) */
export interface DeviceConfig {
  [key: string]: unknown;
}

export type TypedDeviceConfig =
  | RouterConfig
  | SwitchConfig
  | ServerConfig
  | FirewallConfig
  | DeviceConfig;

/** Get the first configured IP for a device, regardless of config type */
export function getDeviceIp(device: Device): string | null {
  const cfg = device.config;
  if ("interfaces" in cfg) {
    // Router or firewall — find first interface with an IP
    const ifaces = cfg.interfaces as Record<number, InterfaceConfig>;
    for (const iface of Object.values(ifaces)) {
      if (iface.ip) return iface.ip;
    }
    return null;
  }
  if ("ip" in cfg && typeof cfg.ip === "string") {
    return cfg.ip; // Server or switch management IP or legacy
  }
  if ("managementIp" in cfg && typeof cfg.managementIp === "string") {
    return cfg.managementIp;
  }
  return null;
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
  config: TypedDeviceConfig;
}
