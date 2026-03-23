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
  /** Link LED position (green when cable connected) */
  ledX?: number;
  ledY?: number;
  /** Activity LED position (orange blink on traffic) — offset from link LED */
  actLedX?: number;
  actLedY?: number;
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
      ledX: normX(x - 1.5),
      ledY: normY(4.8),
      actLedX: normX(x + 1.5),
      actLedY: normY(4.8),
    });
  }

  for (let col = 0; col < 12; col++) {
    const x = startX + col * stride + 6.5;
    ports.push({
      x: normX(x),
      y: normY(13),
      ledX: normX(x - 1.5),
      ledY: normY(11.8),
      actLedX: normX(x + 1.5),
      actLedY: normY(11.8),
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
      { x: normX(88), y: normY(9), ledX: normX(86), ledY: normY(4.8), actLedX: normX(90), actLedY: normY(4.8) },
      { x: normX(107), y: normY(9), ledX: normX(105), ledY: normY(4.8), actLedX: normX(109), actLedY: normY(4.8) },
      { x: normX(126), y: normY(9), ledX: normX(124), ledY: normY(4.8), actLedX: normX(128), actLedY: normY(4.8) },
      { x: normX(145), y: normY(9), ledX: normX(143), ledY: normY(4.8), actLedX: normX(147), actLedY: normY(4.8) },
    ],
  },
  firewall_1u: {
    statusLed: { x: normX(65), y: normY(9) },
    ports: [
      { x: normX(88), y: normY(9), ledX: normX(86), ledY: normY(4.8), actLedX: normX(90), actLedY: normY(4.8) },
      { x: normX(108), y: normY(9), ledX: normX(106), ledY: normY(4.8), actLedX: normX(110), actLedY: normY(4.8) },
      { x: normX(128), y: normY(9), ledX: normX(126), ledY: normY(4.8), actLedX: normX(130), actLedY: normY(4.8) },
      { x: normX(148), y: normY(9), ledX: normX(146), ledY: normY(4.8), actLedX: normX(150), actLedY: normY(4.8) },
    ],
  },
  server_1u: {
    statusLed: { x: normX(82), y: normY(9) },
    ports: [
      { x: normX(179), y: normY(6), ledX: normX(178), ledY: normY(6), actLedX: normX(180), actLedY: normY(6) },
      { x: normX(184), y: normY(6), ledX: normX(183), ledY: normY(6), actLedX: normX(185), actLedY: normY(6) },
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
    ports: Array.from({ length: count }, (_, index) => {
      const px = startX + index * spacing;
      const ledOff = 1.5 / SVG_W;
      return {
        x: px,
        y: deviceDesc?.portLayout.startY ?? 0.5,
        ledX: px - ledOff,
        ledY: deviceDesc?.portLayout.ledY ?? deviceDesc?.portLayout.startY ?? 0.5,
        actLedX: px + ledOff,
        actLedY: deviceDesc?.portLayout.ledY ?? deviceDesc?.portLayout.startY ?? 0.5,
      };
    }),
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
    const ledX = (portGeom.ledX ?? portGeom.x) * width;
    const ledY = (portGeom.ledY ?? portGeom.y) * height;
    const link = port.linkId ? state.links[port.linkId] : undefined;
    const hasLink = !!port.linkId && port.status !== "err_disabled";
    const hasActivity = !!link && link.currentLoadMbps > 0;
    // Simulate activity blink: use port index as seed for varied timing
    const activityBlink = hasActivity
      ? Math.random() > 0.3 // ~70% chance lit each frame → flickering effect
      : false;

    const led = scene.add.graphics();

    // ── Link LED (left) — green when cable connected, off otherwise ──
    if (hasLink) {
      // Glow
      led.fillStyle(PALETTE.portUp, 0.06);
      led.fillCircle(ledX, ledY, 0.9);
      // LED dot
      led.fillStyle(PALETTE.portUp, 0.95);
      led.fillCircle(ledX, ledY, 0.4);
    } else if (port.status === "err_disabled") {
      led.fillStyle(PALETTE.portErr, 0.7);
      led.fillCircle(ledX, ledY, 0.4);
    } else {
      // No link — dim off
      led.fillStyle(PALETTE.portOff, 0.3);
      led.fillCircle(ledX, ledY, 0.3);
    }
    // Specular highlight
    led.fillStyle(0xffffff, 0.2);
    led.fillCircle(ledX - 0.06, ledY - 0.06, 0.08);

    // ── Activity LED (right) — orange blink on traffic ──
    const actX = (portGeom.actLedX ?? portGeom.x + 0.008) * width;
    const actY = (portGeom.actLedY ?? portGeom.y) * height;
    if (activityBlink) {
      // Glow
      led.fillStyle(PALETTE.portErr, 0.08);
      led.fillCircle(actX, actY, 0.9);
      // LED dot
      led.fillStyle(PALETTE.portErr, 0.9);
      led.fillCircle(actX, actY, 0.4);
    } else {
      // Off
      led.fillStyle(PALETTE.portOff, 0.2);
      led.fillCircle(actX, actY, 0.3);
    }
    led.fillStyle(0xffffff, 0.15);
    led.fillCircle(actX - 0.06, actY - 0.06, 0.08);

    container.add(led);
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
