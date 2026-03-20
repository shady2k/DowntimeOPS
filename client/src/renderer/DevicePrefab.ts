/**
 * Device visual prefab — defines how each device type is composed visually.
 * Abstracts device rendering so art swaps don't require scene changes.
 */

import type { DeviceType } from "@downtime-ops/shared";
import { RACK, PORT, PALETTE } from "./TextureGenerator";

export interface DevicePrefabDef {
  textureKey: string;
  labelOffsetX: number;
  statusLedOffsetX: number;
  portStartX: number;
  portSpacing: number;
  maxVisiblePorts: number;
}

const PREFAB_DEFS: Record<string, DevicePrefabDef> = {
  server: {
    textureKey: "device-server",
    labelOffsetX: 10,
    statusLedOffsetX: RACK.INNER_WIDTH - 24,
    portStartX: PORT.START_X,
    portSpacing: PORT.SPACING,
    maxVisiblePorts: 24,
  },
  switch: {
    textureKey: "device-switch",
    labelOffsetX: 10,
    statusLedOffsetX: RACK.INNER_WIDTH - 24,
    portStartX: PORT.START_X,
    portSpacing: PORT.SPACING,
    maxVisiblePorts: 24,
  },
  router: {
    textureKey: "device-router",
    labelOffsetX: 10,
    statusLedOffsetX: RACK.INNER_WIDTH - 24,
    portStartX: PORT.START_X,
    portSpacing: PORT.SPACING,
    maxVisiblePorts: 24,
  },
  firewall: {
    textureKey: "device-firewall",
    labelOffsetX: 10,
    statusLedOffsetX: RACK.INNER_WIDTH - 24,
    portStartX: PORT.START_X,
    portSpacing: PORT.SPACING,
    maxVisiblePorts: 24,
  },
};

export function getDevicePrefab(type: DeviceType): DevicePrefabDef {
  return PREFAB_DEFS[type] ?? PREFAB_DEFS.server;
}

/** Returns the state overlay texture key for a device status */
export function getOverlayKey(
  status: string,
  selected: boolean,
): string | null {
  if (selected) return "overlay-selected";
  switch (status) {
    case "failed":
      return "overlay-failed";
    case "degraded":
      return "overlay-degraded";
    case "online":
      return "overlay-active";
    default:
      return null;
  }
}

/** Returns the port texture key for a port status */
export function getPortKey(status: string): string {
  switch (status) {
    case "up":
      return "port-up";
    case "down":
      return "port-down";
    case "err_disabled":
      return "port-err";
    default:
      return "port-off";
  }
}

/** Status LED color lookup */
export function getStatusLedColor(status: string): number {
  switch (status) {
    case "online":
      return PALETTE.portUp;
    case "failed":
      return PALETTE.portDown;
    case "degraded":
      return PALETTE.portErr;
    default:
      return PALETTE.portOff;
  }
}
