import Phaser from "phaser";
import type { Device, GameState } from "@downtime-ops/shared";
import { AssetRegistry } from "../assets/AssetRegistry";
import { PALETTE } from "./TextureGenerator";

export type BuiltDeviceVisual = {
  container: Phaser.GameObjects.Container;
  sprite?: Phaser.GameObjects.Image;
};

export type DevicePortGeometry = {
  x: number;
  y: number;
  ledX?: number;
  ledY?: number;
};

type DeviceFaceGeometry = {
  statusLed: { x: number; y: number };
  ports: DevicePortGeometry[];
};

const SVG_W = 420;
const SVG_H = 18;

function normX(x: number): number {
  return x / SVG_W;
}

function normY(y: number): number {
  return y / SVG_H;
}

function buildSwitch24pGeometry(): DeviceFaceGeometry {
  const ports: DevicePortGeometry[] = [];
  const startX = 78;
  const stride = 15;

  for (let col = 0; col < 12; col++) {
    const x = startX + col * stride + 6.5;
    ports.push({
      x: normX(x),
      y: normY(6),
      ledX: normX(x),
      ledY: normY(4.8),
    });
  }

  for (let col = 0; col < 12; col++) {
    const x = startX + col * stride + 6.5;
    ports.push({
      x: normX(x),
      y: normY(13),
      ledX: normX(x),
      ledY: normY(11.8),
    });
  }

  return {
    statusLed: { x: normX(65), y: normY(9) },
    ports,
  };
}

const DEVICE_FACE_GEOMETRY: Record<string, DeviceFaceGeometry> = {
  switch_24p: buildSwitch24pGeometry(),
  router_1u: {
    statusLed: { x: normX(65), y: normY(9) },
    ports: [
      { x: normX(88), y: normY(9), ledX: normX(88), ledY: normY(4.8) },
      { x: normX(107), y: normY(9), ledX: normX(107), ledY: normY(4.8) },
      { x: normX(126), y: normY(9), ledX: normX(126), ledY: normY(4.8) },
      { x: normX(145), y: normY(9), ledX: normX(145), ledY: normY(4.8) },
    ],
  },
  firewall_1u: {
    statusLed: { x: normX(65), y: normY(9) },
    ports: [
      { x: normX(88), y: normY(9), ledX: normX(88), ledY: normY(4.8) },
      { x: normX(108), y: normY(9), ledX: normX(108), ledY: normY(4.8) },
      { x: normX(128), y: normY(9), ledX: normX(128), ledY: normY(4.8) },
      { x: normX(148), y: normY(9), ledX: normX(148), ledY: normY(4.8) },
    ],
  },
  server_1u: {
    statusLed: { x: normX(82), y: normY(9) },
    ports: [
      { x: normX(179), y: normY(6), ledX: normX(179), ledY: normY(6) },
      { x: normX(184), y: normY(6), ledX: normX(184), ledY: normY(6) },
    ],
  },
};

export function getDeviceFaceGeometry(device: Device): DeviceFaceGeometry {
  const exact = DEVICE_FACE_GEOMETRY[device.model];
  if (exact) return exact;

  const deviceDesc = AssetRegistry.getDevice(device.model);
  const count = Math.min(device.ports.length, deviceDesc?.portLayout.maxVisible ?? device.ports.length);
  const startX = deviceDesc?.portLayout.startX ?? normX(78);
  const spacing = 15 / SVG_W;

  return {
    statusLed: {
      x: deviceDesc?.statusLed.x ?? normX(65),
      y: deviceDesc?.statusLed.y ?? normY(9),
    },
    ports: Array.from({ length: count }, (_, index) => ({
      x: startX + index * spacing,
      y: deviceDesc?.portLayout.startY ?? 0.5,
      ledX: startX + index * spacing,
      ledY: deviceDesc?.portLayout.ledY ?? deviceDesc?.portLayout.startY ?? 0.5,
    })),
  };
}

function getStatusLedColor(status: Device["status"]): number {
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

function getPortLedColor(status: Device["ports"][number]["status"]): number {
  switch (status) {
    case "up":
      return PALETTE.portUp;
    case "down":
      return PALETTE.portDown;
    case "err_disabled":
      return PALETTE.portErr;
    default:
      return PALETTE.portOff;
  }
}

export function buildRackDeviceVisual(
  scene: Phaser.Scene,
  device: Device,
  state: GameState,
  width: number,
  height: number,
): BuiltDeviceVisual {
  const container = scene.add.container(0, 0);
  const deviceDesc = AssetRegistry.getDevice(device.model);
  const textureKey = deviceDesc?.textureKey ?? `device-${device.type}`;
  const geometry = getDeviceFaceGeometry(device);

  let sprite: Phaser.GameObjects.Image | undefined;
  if (scene.textures.exists(textureKey)) {
    sprite = scene.add.image(0, 0, textureKey)
      .setOrigin(0, 0)
      .setDisplaySize(width, height);
    container.add(sprite);
  } else {
    const body = scene.add.graphics();
    body.fillStyle(PALETTE.switch, 0.85);
    body.fillRoundedRect(0, 0, width, height, 2);
    container.add(body);
  }

  const statusLedX = geometry.statusLed.x * width;
  const statusLedY = geometry.statusLed.y * height;
  const statusLed = scene.add.graphics();
  const statusColor = getStatusLedColor(device.status);

  if (device.status === "online") {
    statusLed.fillStyle(statusColor, 0.06);
    statusLed.fillCircle(statusLedX, statusLedY, 1.2);
  }

  statusLed.fillStyle(statusColor, 0.95);
  statusLed.fillCircle(statusLedX, statusLedY, 0.55);
  statusLed.fillStyle(0xffffff, 0.25);
  statusLed.fillCircle(statusLedX - 0.1, statusLedY - 0.1, 0.12);
  container.add(statusLed);

  const maxVisible = Math.min(device.ports.length, geometry.ports.length);
  for (let i = 0; i < maxVisible; i++) {
    const port = device.ports[i];
    const portGeom = geometry.ports[i];
    const bodyX = portGeom.x * width;
    const bodyY = portGeom.y * height;
    const ledX = (portGeom.ledX ?? portGeom.x) * width;
    const ledY = (portGeom.ledY ?? portGeom.y) * height;
    const ledColor = getPortLedColor(port.status);
    const link = port.linkId ? state.links[port.linkId] : undefined;
    const hasActivity = !!link && link.currentLoadMbps > 0;

    const led = scene.add.graphics();
    if (port.linkId && port.status === "up") {
      led.fillStyle(ledColor, hasActivity ? 0.1 : 0.04);
      led.fillCircle(ledX, ledY, hasActivity ? 1.05 : 0.8);
    }
    led.fillStyle(ledColor, port.status === "up" ? 0.95 : 0.5);
    led.fillCircle(ledX, ledY, hasActivity ? 0.55 : 0.4);
    led.fillStyle(0xffffff, 0.25);
    led.fillCircle(ledX - 0.08, ledY - 0.08, 0.1);
    container.add(led);

    if (port.linkId) {
      const ring = scene.add.graphics();
      ring.lineStyle(0.4, PALETTE.portUp, 0.28);
      ring.strokeCircle(bodyX, bodyY, 1.05);
      container.add(ring);
    }
  }

  if (device.ports.length > geometry.ports.length) {
    const overflowLabel = scene.add
      .text(
        width - 24,
        height / 2,
        `+${device.ports.length - geometry.ports.length}`,
        {
          fontSize: "6px",
          color: "#91857a",
          fontFamily: "'JetBrains Mono', monospace",
        },
      )
      .setOrigin(0, 0.5);
    container.add(overflowLabel);
  }

  return { container, sprite };
}
