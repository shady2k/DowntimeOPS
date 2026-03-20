import Phaser from "phaser";
import type { GameState, Device, Port } from "@downtime-ops/shared";
import { useGameStore } from "../store/gameStore";
import { RACK, PORT, PALETTE } from "./TextureGenerator";

// Layout: rack is centered in the scene
const RACK_X = 370;
const RACK_Y = 80;

// Depth layers (explicit z-ordering)
const DEPTH = {
  BACKGROUND: 0,
  RACK_FRAME: 10,
  SLOT_HIGHLIGHTS: 15,
  DEVICES: 20,
  DEVICE_OVERLAYS: 25,
  CABLES: 30,
  EFFECTS: 40,
  HIT_TARGETS: 50,
} as const;

type DeviceVisual = {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  overlay: Phaser.GameObjects.Image | null;
  label: Phaser.GameObjects.Text;
  statusLed: Phaser.GameObjects.Graphics;
  portSprites: Phaser.GameObjects.Image[];
  portConnected: Phaser.GameObjects.Image[];
};

export class RackScene extends Phaser.Scene {
  // Layer containers (explicit depth ordering)
  private bgLayer!: Phaser.GameObjects.Container;
  private rackLayer!: Phaser.GameObjects.Container;
  private slotLayer!: Phaser.GameObjects.Container;
  private deviceLayer!: Phaser.GameObjects.Container;
  private cableLayer!: Phaser.GameObjects.Container;
  private effectLayer!: Phaser.GameObjects.Container;
  private hitLayer!: Phaser.GameObjects.Container;

  private deviceVisuals = new Map<string, DeviceVisual>();
  private cableGraphics: Phaser.GameObjects.Graphics | null = null;
  private slotHighlights: Phaser.GameObjects.Image[] = [];
  private uLabels: Phaser.GameObjects.Text[] = [];

  private lastStateKey = "";
  private unsubscribe: (() => void) | null = null;

  // Camera controls
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private camStart = { x: 0, y: 0 };

  constructor() {
    super({ key: "RackScene" });
  }

  create() {
    this.createLayers();
    this.createBackground();
    this.createRackFrame();
    this.createULabels();
    this.setupCamera();
    this.setupZoomPan();

    this.cableGraphics = this.add.graphics();
    this.cableGraphics.setDepth(DEPTH.CABLES);
    this.cableLayer.add(this.cableGraphics);

    // Subscribe to store
    this.unsubscribe = useGameStore.subscribe((store) => {
      const state = store.state;
      if (!state) return;

      const stateKey = [
        state.tick,
        Object.keys(state.devices).length,
        Object.keys(state.links).length,
        store.selectedDeviceId,
        // Include device statuses in key for overlay updates
        ...Object.values(state.devices).map(
          (d) => `${d.id}:${d.status}:${d.slotU}`,
        ),
      ].join("|");

      if (stateKey === this.lastStateKey) return;
      this.lastStateKey = stateKey;

      this.renderDevices(state, store.selectedDeviceId);
      this.renderCables(state);
    });

    // Initial render
    const store = useGameStore.getState();
    if (store.state) {
      this.renderDevices(store.state, store.selectedDeviceId);
      this.renderCables(store.state);
    }

    // Handle resize
    this.scale.on("resize", this.handleResize, this);
  }

  shutdown() {
    this.unsubscribe?.();
    this.scale.off("resize", this.handleResize, this);
  }

  // ── Layer setup ──────────────────────────────────────────────

  private createLayers() {
    this.bgLayer = this.add.container(0, 0).setDepth(DEPTH.BACKGROUND);
    this.rackLayer = this.add.container(0, 0).setDepth(DEPTH.RACK_FRAME);
    this.slotLayer = this.add.container(0, 0).setDepth(DEPTH.SLOT_HIGHLIGHTS);
    this.deviceLayer = this.add.container(0, 0).setDepth(DEPTH.DEVICES);
    this.cableLayer = this.add.container(0, 0).setDepth(DEPTH.CABLES);
    this.effectLayer = this.add.container(0, 0).setDepth(DEPTH.EFFECTS);
    this.hitLayer = this.add.container(0, 0).setDepth(DEPTH.HIT_TARGETS);
  }

  // ── Background ───────────────────────────────────────────────

  private createBackground() {
    const bg = this.add.image(0, 0, "room-bg").setOrigin(0, 0);
    bg.setDepth(DEPTH.BACKGROUND);
    this.bgLayer.add(bg);
  }

  // ── Rack frame ───────────────────────────────────────────────

  private createRackFrame() {
    const frame = this.add.image(RACK_X, RACK_Y, "rack-frame").setOrigin(0, 0);
    frame.setDepth(DEPTH.RACK_FRAME);
    this.rackLayer.add(frame);

    // Rack title
    const title = this.add
      .text(RACK_X + RACK.WIDTH / 2, RACK_Y + 10, "RACK A", {
        fontSize: "11px",
        color: "#aaaacc",
        fontStyle: "bold",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 0.5);
    title.setDepth(DEPTH.RACK_FRAME);
    this.rackLayer.add(title);
  }

  // ── U-position labels ────────────────────────────────────────

  private createULabels() {
    for (let u = 1; u <= RACK.TOTAL_U; u++) {
      if (u % 5 === 0 || u === 1) {
        const y = this.slotY(u) + RACK.SLOT_HEIGHT / 2;
        const label = this.add
          .text(RACK_X - 8, y, `${u}`, {
            fontSize: "9px",
            color: "#555570",
            fontFamily: "monospace",
          })
          .setOrigin(1, 0.5);
        label.setDepth(DEPTH.RACK_FRAME);
        this.rackLayer.add(label);
        this.uLabels.push(label);
      }
    }
  }

  // ── Camera: zoom + pan ───────────────────────────────────────

  private setupCamera() {
    const cam = this.cameras.main;
    // Set world bounds large enough for room + rack + cable overflow
    cam.setBounds(0, 0, 1200, 900);
    // Center on rack
    cam.centerOn(RACK_X + RACK.WIDTH / 2, RACK_Y + RACK.HEIGHT / 2 + 20);
  }

  private setupZoomPan() {
    // Zoom with mouse wheel
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gameObjects: unknown[], _dx: number, _dy: number, dz: number) => {
      const cam = this.cameras.main;
      const newZoom = Phaser.Math.Clamp(cam.zoom - dz * 0.001, 0.5, 2.5);
      cam.setZoom(newZoom);
    });

    // Pan with middle mouse or right click drag
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown() || pointer.rightButtonDown()) {
        this.isDragging = true;
        this.dragStart.x = pointer.x;
        this.dragStart.y = pointer.y;
        this.camStart.x = this.cameras.main.scrollX;
        this.camStart.y = this.cameras.main.scrollY;
      }
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const dx = (this.dragStart.x - pointer.x) / this.cameras.main.zoom;
      const dy = (this.dragStart.y - pointer.y) / this.cameras.main.zoom;
      this.cameras.main.scrollX = this.camStart.x + dx;
      this.cameras.main.scrollY = this.camStart.y + dy;
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.middleButtonDown()) {
        this.isDragging = false;
      }
    });

    // Disable context menu on canvas
    this.game.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private handleResize() {
    // Camera auto-adjusts via Phaser.Scale.RESIZE mode
    // Re-center if needed
    this.setupCamera();
  }

  // ── Coordinate helpers ───────────────────────────────────────

  /** Y position of a U-slot in world space (top of the slot) */
  private slotY(u: number): number {
    return RACK_Y + 20 + (u - 1) * RACK.SLOT_HEIGHT; // +20 for rack top cap
  }

  /** X position of the device area (inside rails) */
  private deviceX(): number {
    return RACK_X + RACK.RAIL_WIDTH + 2;
  }

  // ── Device rendering ─────────────────────────────────────────

  private renderDevices(state: GameState, selectedDeviceId: string | null) {
    // Remove visuals for devices no longer in state
    for (const [id, visual] of this.deviceVisuals) {
      if (!state.devices[id]) {
        visual.container.destroy();
        this.deviceVisuals.delete(id);
      }
    }

    // Clear slot highlights
    for (const sh of this.slotHighlights) sh.destroy();
    this.slotHighlights = [];

    const occupied = new Set<number>();
    for (const device of Object.values(state.devices)) {
      for (let u = device.slotU; u < device.slotU + device.uHeight; u++) {
        occupied.add(u);
      }
    }

    // Show slot highlights for empty slots
    for (let u = 1; u <= RACK.TOTAL_U; u++) {
      if (!occupied.has(u)) {
        const highlight = this.add
          .image(this.deviceX(), this.slotY(u) + 1, "slot-hover")
          .setOrigin(0, 0)
          .setAlpha(0);
        highlight.setDepth(DEPTH.SLOT_HIGHLIGHTS);
        this.slotLayer.add(highlight);
        this.slotHighlights.push(highlight);
      }
    }

    // Create or update device visuals
    for (const device of Object.values(state.devices)) {
      const selected = device.id === selectedDeviceId;
      const existing = this.deviceVisuals.get(device.id);

      if (existing) {
        this.updateDeviceVisual(existing, device, selected);
      } else {
        const visual = this.createDeviceVisual(device, selected);
        this.deviceVisuals.set(device.id, visual);
      }
    }
  }

  private createDeviceVisual(
    device: Device,
    selected: boolean,
  ): DeviceVisual {
    const x = this.deviceX();
    const y = this.slotY(device.slotU) + 1;
    const h = device.uHeight * RACK.SLOT_HEIGHT - 2;

    const container = this.add.container(x, y);
    container.setDepth(DEPTH.DEVICES);
    this.deviceLayer.add(container);

    // Device sprite
    const textureKey = `device-${device.type}`;
    const sprite = this.add.image(0, 0, textureKey).setOrigin(0, 0);
    // Scale height for multi-U devices
    if (device.uHeight > 1) {
      sprite.setDisplaySize(sprite.width, h);
    }
    container.add(sprite);

    // State overlay
    const overlay = this.createStateOverlay(device, selected, h);
    if (overlay) container.add(overlay);

    // Selection border
    if (selected) {
      const borderG = this.add.graphics();
      borderG.lineStyle(2, PALETTE.deviceSelected, 0.8);
      borderG.strokeRoundedRect(0, 0, RACK.INNER_WIDTH - 4, h, 2);
      container.add(borderG);
    }

    // Device name label
    const label = this.add
      .text(10, h / 2, device.name, {
        fontSize: "9px",
        color: "#ddddee",
        fontFamily: "monospace",
      })
      .setOrigin(0, 0.5);
    container.add(label);

    // Status LED
    const statusLed = this.add.graphics();
    this.drawStatusLed(statusLed, device, RACK.INNER_WIDTH - 20, h / 2);
    container.add(statusLed);

    // Port sprites
    const { portSprites, portConnected } = this.createPorts(
      container,
      device,
      h,
    );

    // Hit area (oversized, invisible — on the hit layer)
    const hitZone = this.add.zone(
      x,
      y,
      RACK.INNER_WIDTH - 4,
      h,
    );
    hitZone.setOrigin(0, 0);
    hitZone.setDepth(DEPTH.HIT_TARGETS);
    hitZone.setInteractive({ useHandCursor: true });
    hitZone.on("pointerdown", () => {
      useGameStore.getState().selectDevice(device.id);
    });
    hitZone.on("pointerover", () => {
      sprite.setAlpha(1);
    });
    hitZone.on("pointerout", () => {
      sprite.setAlpha(selected ? 1 : 0.85);
    });
    this.hitLayer.add(hitZone);

    sprite.setAlpha(selected ? 1 : 0.85);

    return {
      container,
      sprite,
      overlay,
      label,
      statusLed,
      portSprites,
      portConnected,
    };
  }

  private updateDeviceVisual(
    visual: DeviceVisual,
    device: Device,
    selected: boolean,
  ) {
    // Recreate — simpler and safer than incremental updates for now
    // (device count is small, ~5-15 devices per rack)
    visual.container.destroy();
    const newVisual = this.createDeviceVisual(device, selected);
    this.deviceVisuals.set(device.id, newVisual);
  }

  private createStateOverlay(
    device: Device,
    selected: boolean,
    h: number,
  ): Phaser.GameObjects.Image | null {
    let key: string | null = null;

    if (selected) {
      key = "overlay-selected";
    } else if (device.status === "failed") {
      key = "overlay-failed";
    } else if (device.status === "degraded") {
      key = "overlay-degraded";
    } else if (device.status === "online") {
      key = "overlay-active";
    }

    if (!key) return null;

    const overlay = this.add.image(0, 0, key).setOrigin(0, 0);
    if (h !== RACK.SLOT_HEIGHT - 2) {
      overlay.setDisplaySize(RACK.INNER_WIDTH - 4, h);
    }
    return overlay;
  }

  private drawStatusLed(
    g: Phaser.GameObjects.Graphics,
    device: Device,
    x: number,
    y: number,
  ) {
    const color =
      device.status === "online"
        ? PALETTE.portUp
        : device.status === "failed"
          ? PALETTE.portDown
          : device.status === "degraded"
            ? PALETTE.portErr
            : PALETTE.portOff;

    // LED glow
    if (device.status === "online") {
      g.fillStyle(color, 0.2);
      g.fillCircle(x, y, 5);
    }
    // LED dot
    g.fillStyle(color, 1);
    g.fillCircle(x, y, 3);
  }

  // ── Port rendering ───────────────────────────────────────────

  private createPorts(
    container: Phaser.GameObjects.Container,
    device: Device,
    h: number,
  ): { portSprites: Phaser.GameObjects.Image[]; portConnected: Phaser.GameObjects.Image[] } {
    const portSprites: Phaser.GameObjects.Image[] = [];
    const portConnected: Phaser.GameObjects.Image[] = [];
    const maxVisible = Math.min(device.ports.length, 24);

    for (let i = 0; i < maxVisible; i++) {
      const port = device.ports[i];
      const px = PORT.START_X + i * PORT.SPACING;
      const py = h / 2;

      // Port sprite (LED-based)
      const portKey = this.getPortTextureKey(port);
      const portImg = this.add.image(px, py, portKey);
      container.add(portImg);
      portSprites.push(portImg);

      // Connected overlay
      if (port.linkId) {
        const connImg = this.add.image(px, py, "port-connected");
        container.add(connImg);
        portConnected.push(connImg);
      }
    }

    // Overflow label
    if (device.ports.length > 24) {
      const overflowLabel = this.add
        .text(PORT.START_X + 24 * PORT.SPACING + 4, h / 2, `+${device.ports.length - 24}`, {
          fontSize: "8px",
          color: "#666680",
          fontFamily: "monospace",
        })
        .setOrigin(0, 0.5);
      container.add(overflowLabel);
    }

    return { portSprites, portConnected };
  }

  private getPortTextureKey(port: Port): string {
    switch (port.status) {
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

  // ── Cable rendering ──────────────────────────────────────────

  private renderCables(state: GameState) {
    if (!this.cableGraphics) return;
    this.cableGraphics.clear();

    for (const link of Object.values(state.links)) {
      const devA = state.devices[link.portA.deviceId];
      const devB = state.devices[link.portB.deviceId];
      if (!devA || !devB) continue;

      const posA = this.getPortWorldPos(devA, link.portA.portIndex);
      const posB = this.getPortWorldPos(devB, link.portB.portIndex);
      if (!posA || !posB) continue;

      const utilization =
        link.maxBandwidthMbps > 0
          ? link.currentLoadMbps / link.maxBandwidthMbps
          : 0;

      const alpha = Math.max(0.3, Math.min(1, 0.3 + utilization * 0.7));
      const color =
        link.status === "cut"
          ? PALETTE.cableCut
          : utilization > 0.9
            ? PALETTE.cableCongested
            : PALETTE.cable;

      this.cableGraphics.lineStyle(2.5, color, alpha);

      // L-shaped cable routing out through the right side of the rack
      const exitX =
        RACK_X + RACK.WIDTH + 20 + Math.abs(posA.y - posB.y) * 0.25;

      this.cableGraphics.beginPath();
      this.cableGraphics.moveTo(posA.x, posA.y);
      this.cableGraphics.lineTo(exitX, posA.y);
      this.cableGraphics.lineTo(exitX, posB.y);
      this.cableGraphics.lineTo(posB.x, posB.y);
      this.cableGraphics.strokePath();

      // Cable endpoint dots
      this.cableGraphics.fillStyle(color, alpha);
      this.cableGraphics.fillCircle(posA.x, posA.y, 2);
      this.cableGraphics.fillCircle(posB.x, posB.y, 2);
    }
  }

  private getPortWorldPos(
    device: Device,
    portIndex: number,
  ): { x: number; y: number } | null {
    if (portIndex >= device.ports.length) return null;

    const x = this.deviceX() + PORT.START_X + portIndex * PORT.SPACING;
    const h = device.uHeight * RACK.SLOT_HEIGHT - 2;
    const y = this.slotY(device.slotU) + 1 + h / 2;

    return { x, y };
  }
}
