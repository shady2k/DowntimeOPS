import Phaser from "phaser";
import type { GameState, Device, Port } from "@downtime-ops/shared";
import { useGameStore } from "../store/gameStore";

const RACK_X = 100;
const RACK_Y = 40;
const RACK_WIDTH = 400;
const SLOT_HEIGHT = 16;
const TOTAL_U = 42;
const PORT_RADIUS = 4;
const PORT_SPACING = 14;
const COLORS = {
  rackBg: 0x2d2d3d,
  rackBorder: 0x4a4a6a,
  slotEmpty: 0x333348,
  slotHover: 0x444460,
  server: 0x2ecc71,
  switch: 0x3498db,
  router: 0xe67e22,
  firewall: 0xe74c3c,
  portUp: 0x2ecc71,
  portDown: 0xe74c3c,
  portErr: 0xf39c12,
  cable: 0x9b59b6,
  selected: 0xf1c40f,
  text: 0xecf0f1,
  slotLabel: 0x666680,
};

export class RackScene extends Phaser.Scene {
  private deviceGraphics = new Map<string, Phaser.GameObjects.Container>();
  private cableGraphics: Phaser.GameObjects.Graphics | null = null;
  private lastStateJson = "";
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super({ key: "RackScene" });
  }

  create() {
    this.drawRackFrame();
    this.cableGraphics = this.add.graphics();

    // Subscribe to store changes
    this.unsubscribe = useGameStore.subscribe((store) => {
      const state = store.state;
      if (!state) return;

      const stateKey = `${state.tick}-${Object.keys(state.devices).length}-${Object.keys(state.links).length}-${store.selectedDeviceId}`;
      if (stateKey === this.lastStateJson) return;
      this.lastStateJson = stateKey;

      this.renderDevices(state, store.selectedDeviceId);
      this.renderCables(state);
    });

    // Initial render
    const store = useGameStore.getState();
    if (store.state) {
      this.renderDevices(store.state, store.selectedDeviceId);
      this.renderCables(store.state);
    }
  }

  shutdown() {
    this.unsubscribe?.();
  }

  private drawRackFrame() {
    const g = this.add.graphics();

    // Rack background
    g.fillStyle(COLORS.rackBg, 1);
    g.fillRect(RACK_X, RACK_Y, RACK_WIDTH, TOTAL_U * SLOT_HEIGHT);

    // Rack border
    g.lineStyle(2, COLORS.rackBorder, 1);
    g.strokeRect(RACK_X, RACK_Y, RACK_WIDTH, TOTAL_U * SLOT_HEIGHT);

    // U slot lines and labels
    for (let u = 1; u <= TOTAL_U; u++) {
      const y = RACK_Y + (u - 1) * SLOT_HEIGHT;

      g.lineStyle(1, COLORS.rackBorder, 0.3);
      g.lineBetween(RACK_X, y, RACK_X + RACK_WIDTH, y);

      // U labels every 5 units
      if (u % 5 === 0 || u === 1) {
        this.add
          .text(RACK_X - 30, y + 2, `${u}U`, {
            fontSize: "10px",
            color: "#666680",
          })
          .setOrigin(0, 0);
      }
    }

    // Rack title
    this.add
      .text(RACK_X + RACK_WIDTH / 2, RACK_Y - 20, "RACK A", {
        fontSize: "14px",
        color: "#ecf0f1",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);
  }

  private renderDevices(state: GameState, selectedDeviceId: string | null) {
    // Clear old device graphics
    for (const [, container] of this.deviceGraphics) {
      container.destroy();
    }
    this.deviceGraphics.clear();

    // Track which slots are rendered (avoid duplicates for multi-U devices)
    const rendered = new Set<string>();

    for (const device of Object.values(state.devices)) {
      if (rendered.has(device.id)) continue;
      rendered.add(device.id);

      const container = this.createDeviceVisual(
        device,
        device.id === selectedDeviceId,
      );
      this.deviceGraphics.set(device.id, container);

      // Click handler
      container.setInteractive(
        new Phaser.Geom.Rectangle(
          0,
          0,
          RACK_WIDTH - 4,
          device.uHeight * SLOT_HEIGHT - 2,
        ),
        Phaser.Geom.Rectangle.Contains,
      );
      container.on("pointerdown", () => {
        useGameStore.getState().selectDevice(device.id);
      });
    }
  }

  private createDeviceVisual(
    device: Device,
    selected: boolean,
  ): Phaser.GameObjects.Container {
    const x = RACK_X + 2;
    const y = RACK_Y + (device.slotU - 1) * SLOT_HEIGHT + 1;
    const w = RACK_WIDTH - 4;
    const h = device.uHeight * SLOT_HEIGHT - 2;

    const container = this.add.container(x, y);

    // Device body
    const color = this.getDeviceColor(device.type);
    const g = this.add.graphics();
    g.fillStyle(color, selected ? 1 : 0.7);
    g.fillRoundedRect(0, 0, w, h, 3);

    if (selected) {
      g.lineStyle(2, COLORS.selected, 1);
      g.strokeRoundedRect(0, 0, w, h, 3);
    }

    container.add(g);

    // Device name
    const label = this.add
      .text(8, h / 2, device.name, {
        fontSize: "10px",
        color: "#ffffff",
      })
      .setOrigin(0, 0.5);
    container.add(label);

    // Status indicator
    const statusColor =
      device.status === "online"
        ? COLORS.portUp
        : device.status === "failed"
          ? COLORS.portDown
          : COLORS.portErr;
    const statusDot = this.add.graphics();
    statusDot.fillStyle(statusColor, 1);
    statusDot.fillCircle(w - 12, h / 2, 4);
    container.add(statusDot);

    // Port indicators
    this.renderPorts(container, device, w, h);

    return container;
  }

  private renderPorts(
    container: Phaser.GameObjects.Container,
    device: Device,
    _w: number,
    h: number,
  ) {
    const maxPortsVisible = Math.min(device.ports.length, 24);
    const startX = 140;

    for (let i = 0; i < maxPortsVisible; i++) {
      const port = device.ports[i];
      const px = startX + i * PORT_SPACING;
      const py = h / 2;

      const portG = this.add.graphics();
      const portColor = this.getPortColor(port);
      portG.fillStyle(portColor, 1);
      portG.fillCircle(px, py, PORT_RADIUS);

      if (port.linkId) {
        portG.lineStyle(1, 0xffffff, 0.5);
        portG.strokeCircle(px, py, PORT_RADIUS);
      }

      container.add(portG);
    }

    // Show overflow count
    if (device.ports.length > 24) {
      const overflowLabel = this.add
        .text(startX + 24 * PORT_SPACING, h / 2, `+${device.ports.length - 24}`, {
          fontSize: "8px",
          color: "#999",
        })
        .setOrigin(0, 0.5);
      container.add(overflowLabel);
    }
  }

  private renderCables(state: GameState) {
    if (!this.cableGraphics) return;
    this.cableGraphics.clear();

    for (const link of Object.values(state.links)) {
      const devA = state.devices[link.portA.deviceId];
      const devB = state.devices[link.portB.deviceId];
      if (!devA || !devB) continue;

      const posA = this.getPortPosition(devA, link.portA.portIndex);
      const posB = this.getPortPosition(devB, link.portB.portIndex);
      if (!posA || !posB) continue;

      const utilization = link.maxBandwidthMbps > 0
        ? link.currentLoadMbps / link.maxBandwidthMbps
        : 0;

      const alpha = Math.max(0.3, Math.min(1, 0.3 + utilization * 0.7));
      const color =
        link.status === "cut"
          ? COLORS.portDown
          : utilization > 0.9
            ? COLORS.portErr
            : COLORS.cable;

      this.cableGraphics.lineStyle(2, color, alpha);

      // Draw a curved cable between ports
      const midX = RACK_X + RACK_WIDTH + 30 + Math.abs(posA.y - posB.y) * 0.3;

      this.cableGraphics.beginPath();
      this.cableGraphics.moveTo(posA.x, posA.y);
      this.cableGraphics.lineTo(midX, posA.y);
      this.cableGraphics.lineTo(midX, posB.y);
      this.cableGraphics.lineTo(posB.x, posB.y);
      this.cableGraphics.strokePath();
    }
  }

  private getPortPosition(
    device: Device,
    portIndex: number,
  ): { x: number; y: number } | null {
    if (portIndex >= device.ports.length) return null;

    const x = RACK_X + 2 + 140 + portIndex * PORT_SPACING;
    const y =
      RACK_Y +
      (device.slotU - 1) * SLOT_HEIGHT +
      1 +
      (device.uHeight * SLOT_HEIGHT - 2) / 2;

    return { x, y };
  }

  private getDeviceColor(type: string): number {
    switch (type) {
      case "server":
        return COLORS.server;
      case "switch":
        return COLORS.switch;
      case "router":
        return COLORS.router;
      case "firewall":
        return COLORS.firewall;
      default:
        return COLORS.slotEmpty;
    }
  }

  private getPortColor(port: Port): number {
    switch (port.status) {
      case "up":
        return COLORS.portUp;
      case "down":
        return COLORS.portDown;
      case "err_disabled":
        return COLORS.portErr;
      default:
        return COLORS.portDown;
    }
  }
}
