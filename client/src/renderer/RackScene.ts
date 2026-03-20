import Phaser from "phaser";
import type { GameState, Device, Port, CableType } from "@downtime-ops/shared";
import { useGameStore } from "../store/gameStore";
import { rpcClient } from "../rpc/client";
import { RACK, PORT, PALETTE } from "./TextureGenerator";

// Layout: rack is centered in the scene
const RACK_X = 370;
const RACK_Y = 80;

// Depth layers
const DEPTH = {
  BACKGROUND: 0,
  RACK_FRAME: 10,
  SLOT_HIGHLIGHTS: 15,
  DEVICES: 20,
  DEVICE_OVERLAYS: 25,
  CABLES: 30,
  CABLE_PREVIEW: 35,
  EFFECTS: 40,
  TOOLTIPS: 45,
  HIT_TARGETS: 50,
} as const;

type DeviceVisual = {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  hitZone: Phaser.GameObjects.Zone;
};

type PortHitZone = {
  zone: Phaser.GameObjects.Zone;
  deviceId: string;
  portIndex: number;
  worldX: number;
  worldY: number;
};

export class RackScene extends Phaser.Scene {
  // Layer containers
  private bgLayer!: Phaser.GameObjects.Container;
  private rackLayer!: Phaser.GameObjects.Container;
  private slotLayer!: Phaser.GameObjects.Container;
  private deviceLayer!: Phaser.GameObjects.Container;
  private cableLayer!: Phaser.GameObjects.Container;
  private previewLayer!: Phaser.GameObjects.Container;
  private effectLayer!: Phaser.GameObjects.Container;
  private hitLayer!: Phaser.GameObjects.Container;

  private deviceVisuals = new Map<string, DeviceVisual>();
  private portHitZones: PortHitZone[] = [];
  private cableGraphics: Phaser.GameObjects.Graphics | null = null;
  private previewGraphics: Phaser.GameObjects.Graphics | null = null;
  private slotHighlights: Phaser.GameObjects.Image[] = [];
  private placementSlotZones: Phaser.GameObjects.Zone[] = [];
  private tooltip: Phaser.GameObjects.Container | null = null;

  private lastStateKey = "";
  private unsubscribe: (() => void) | null = null;

  // Camera pan state
  private isPanning = false;
  private panStart = { x: 0, y: 0 };
  private camStart = { x: 0, y: 0 };

  // Cable preview tracking
  private mouseWorldX = 0;
  private mouseWorldY = 0;

  constructor() {
    super({ key: "RackScene" });
  }

  create() {
    this.createLayers();
    this.createBackground();
    this.createRackFrame();
    this.createULabels();
    this.setupCamera();
    this.setupInput();

    this.cableGraphics = this.add.graphics();
    this.cableGraphics.setDepth(DEPTH.CABLES);
    this.cableLayer.add(this.cableGraphics);

    this.previewGraphics = this.add.graphics();
    this.previewGraphics.setDepth(DEPTH.CABLE_PREVIEW);
    this.previewLayer.add(this.previewGraphics);

    // Subscribe to store
    this.unsubscribe = useGameStore.subscribe((store) => {
      const state = store.state;
      if (!state) return;

      const stateKey = [
        state.tick,
        Object.keys(state.devices).length,
        Object.keys(state.links).length,
        store.selectedDeviceId,
        store.cablingFrom?.deviceId ?? "",
        store.cablingFrom?.portIndex ?? "",
        store.placingModel ?? "",
        store.selectedClientId ?? "",
        store.highlightedAlertId ?? "",
        ...Object.values(state.devices).map(
          (d) => `${d.id}:${d.status}:${d.slotU}`,
        ),
      ].join("|");

      if (stateKey === this.lastStateKey) return;
      this.lastStateKey = stateKey;

      this.renderAll(state, store);
    });

    // Initial render
    const store = useGameStore.getState();
    if (store.state) {
      this.renderAll(store.state, store);
    }

    this.scale.on("resize", this.handleResize, this);
  }

  shutdown() {
    this.unsubscribe?.();
    this.scale.off("resize", this.handleResize, this);
  }

  update() {
    // Update cable preview each frame (follows mouse)
    this.renderCablePreview();
  }

  // ── Layers ───────────────────────────────────────────────────

  private createLayers() {
    this.bgLayer = this.add.container(0, 0).setDepth(DEPTH.BACKGROUND);
    this.rackLayer = this.add.container(0, 0).setDepth(DEPTH.RACK_FRAME);
    this.slotLayer = this.add.container(0, 0).setDepth(DEPTH.SLOT_HIGHLIGHTS);
    this.deviceLayer = this.add.container(0, 0).setDepth(DEPTH.DEVICES);
    this.cableLayer = this.add.container(0, 0).setDepth(DEPTH.CABLES);
    this.previewLayer = this.add.container(0, 0).setDepth(DEPTH.CABLE_PREVIEW);
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

  // ── U labels ─────────────────────────────────────────────────

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
      }
    }
  }

  // ── Camera ───────────────────────────────────────────────────

  private setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, 1200, 900);
    cam.centerOn(RACK_X + RACK.WIDTH / 2, RACK_Y + RACK.HEIGHT / 2 + 20);
  }

  private handleResize() {
    this.setupCamera();
  }

  // ── Input ────────────────────────────────────────────────────

  private setupInput() {
    // Zoom with mouse wheel
    this.input.on(
      "wheel",
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: unknown[],
        _dx: number,
        _dy: number,
        dz: number,
      ) => {
        const cam = this.cameras.main;
        cam.setZoom(Phaser.Math.Clamp(cam.zoom - dz * 0.001, 0.5, 2.5));
      },
    );

    // Pan with middle mouse drag
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown()) {
        this.isPanning = true;
        this.panStart.x = pointer.x;
        this.panStart.y = pointer.y;
        this.camStart.x = this.cameras.main.scrollX;
        this.camStart.y = this.cameras.main.scrollY;
      }
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      // Track mouse world position for cable preview
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.mouseWorldX = worldPoint.x;
      this.mouseWorldY = worldPoint.y;

      if (this.isPanning) {
        const dx = (this.panStart.x - pointer.x) / this.cameras.main.zoom;
        const dy = (this.panStart.y - pointer.y) / this.cameras.main.zoom;
        this.cameras.main.scrollX = this.camStart.x + dx;
        this.cameras.main.scrollY = this.camStart.y + dy;
      }
    });

    this.input.on("pointerup", () => {
      this.isPanning = false;
    });

    // Escape cancels cabling/placing
    this.input.keyboard?.on("keydown-ESC", () => {
      const store = useGameStore.getState();
      if (store.cablingFrom) store.cancelCabling();
      if (store.placingModel) store.cancelPlacing();
    });

    // Right-click on background cancels cabling/placing
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        const store = useGameStore.getState();
        if (store.cablingFrom) store.cancelCabling();
        if (store.placingModel) store.cancelPlacing();
      }
    });

    this.game.canvas.addEventListener("contextmenu", (e) =>
      e.preventDefault(),
    );
  }

  // ── Coordinate helpers ───────────────────────────────────────

  private slotY(u: number): number {
    return RACK_Y + 20 + (u - 1) * RACK.SLOT_HEIGHT;
  }

  private deviceX(): number {
    return RACK_X + RACK.RAIL_WIDTH + 2;
  }

  // ── Full render ──────────────────────────────────────────────

  private renderAll(
    state: GameState,
    store: ReturnType<typeof useGameStore.getState>,
  ) {
    this.renderDevices(state, store);
    this.renderCables(state, store);
    this.renderPlacementSlots(state, store);
  }

  // ── Device rendering ─────────────────────────────────────────

  private renderDevices(
    state: GameState,
    store: ReturnType<typeof useGameStore.getState>,
  ) {
    // Destroy old visuals
    for (const [id, visual] of this.deviceVisuals) {
      if (!state.devices[id]) {
        visual.container.destroy();
        visual.hitZone.destroy();
        this.deviceVisuals.delete(id);
      }
    }

    // Destroy old port hit zones
    for (const phz of this.portHitZones) phz.zone.destroy();
    this.portHitZones = [];

    // Destroy old slot highlights
    for (const sh of this.slotHighlights) sh.destroy();
    this.slotHighlights = [];

    // Destroy tooltip
    this.tooltip?.destroy();
    this.tooltip = null;

    // Determine highlighted devices from alert or client
    const highlightedDeviceIds = new Set<string>();
    const highlightedLinkIds = new Set<string>();

    // Alert highlighting
    if (store.highlightedAlertId && state.alerts) {
      const alert = state.alerts.find((a) => a.id === store.highlightedAlertId);
      if (alert?.deviceId) highlightedDeviceIds.add(alert.deviceId);
    }

    // Client-to-path highlighting
    if (store.selectedClientId) {
      // Find connections belonging to this client
      for (const conn of Object.values(state.connections)) {
        if (conn.clientId === store.selectedClientId && conn.path) {
          for (const hop of conn.path) {
            highlightedDeviceIds.add(hop.deviceId);
            if (hop.linkId) highlightedLinkIds.add(hop.linkId);
          }
        }
      }
    }

    // Create/update device visuals
    for (const device of Object.values(state.devices)) {
      const selected = device.id === store.selectedDeviceId;
      const highlighted = highlightedDeviceIds.has(device.id);

      // Always recreate (device count is small)
      const existing = this.deviceVisuals.get(device.id);
      if (existing) {
        existing.container.destroy();
        existing.hitZone.destroy();
      }

      const visual = this.createDeviceVisual(
        device,
        state,
        selected,
        highlighted,
        store,
      );
      this.deviceVisuals.set(device.id, visual);
    }
  }

  private createDeviceVisual(
    device: Device,
    state: GameState,
    selected: boolean,
    highlighted: boolean,
    store: ReturnType<typeof useGameStore.getState>,
  ): DeviceVisual {
    const x = this.deviceX();
    const y = this.slotY(device.slotU) + 1;
    const h = device.uHeight * RACK.SLOT_HEIGHT - 2;
    const w = RACK.INNER_WIDTH - 4;

    const container = this.add.container(x, y);
    container.setDepth(DEPTH.DEVICES);
    this.deviceLayer.add(container);

    // Device sprite
    const textureKey = `device-${device.type}`;
    const sprite = this.add.image(0, 0, textureKey).setOrigin(0, 0);
    if (device.uHeight > 1) sprite.setDisplaySize(sprite.width, h);
    container.add(sprite);

    // State overlay
    const overlay = this.createStateOverlay(device, selected, h);
    if (overlay) container.add(overlay);

    // Path highlight glow
    if (highlighted) {
      const glowG = this.add.graphics();
      glowG.lineStyle(2, PALETTE.highlight, 0.6);
      glowG.strokeRoundedRect(-1, -1, w + 2, h + 2, 3);
      container.add(glowG);
    }

    // Selection border
    if (selected) {
      const borderG = this.add.graphics();
      borderG.lineStyle(2, PALETTE.deviceSelected, 0.8);
      borderG.strokeRoundedRect(0, 0, w, h, 2);
      container.add(borderG);
    }

    // Device name
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
    this.drawStatusLed(statusLed, device, w - 20, h / 2);
    container.add(statusLed);

    // Ports
    this.createPorts(container, device, h, state, store);

    sprite.setAlpha(selected ? 1 : 0.85);

    // Device hit zone
    const hitZone = this.add
      .zone(x, y, w, h)
      .setOrigin(0, 0)
      .setDepth(DEPTH.HIT_TARGETS)
      .setInteractive({ useHandCursor: true });

    hitZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        useGameStore.getState().selectDevice(device.id);
      }
    });

    // Tooltip on hover
    hitZone.on("pointerover", () => {
      this.showTooltip(device, state, x + w + 8, y);
    });
    hitZone.on("pointerout", () => {
      this.hideTooltip();
    });

    this.hitLayer.add(hitZone);

    return { container, sprite, hitZone };
  }

  private createStateOverlay(
    device: Device,
    selected: boolean,
    h: number,
  ): Phaser.GameObjects.Image | null {
    let key: string | null = null;
    if (selected) key = "overlay-selected";
    else if (device.status === "failed") key = "overlay-failed";
    else if (device.status === "degraded") key = "overlay-degraded";
    else if (device.status === "online") key = "overlay-active";

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

    if (device.status === "online") {
      g.fillStyle(color, 0.2);
      g.fillCircle(x, y, 5);
    }
    g.fillStyle(color, 1);
    g.fillCircle(x, y, 3);
  }

  // ── Tooltip ──────────────────────────────────────────────────

  private showTooltip(device: Device, state: GameState, x: number, y: number) {
    this.hideTooltip();

    const connectedPorts = device.ports.filter((p) => p.linkId).length;
    const lines = [
      device.name,
      `Type: ${device.type}`,
      `Status: ${device.status}`,
      `Power: ${device.powerDrawWatts}W`,
      `Ports: ${connectedPorts}/${device.ports.length} connected`,
    ];

    const padding = 8;
    const lineHeight = 14;
    const textWidth = 150;
    const bgHeight = lines.length * lineHeight + padding * 2;

    const container = this.add.container(x, y).setDepth(DEPTH.TOOLTIPS);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRoundedRect(0, 0, textWidth + padding * 2, bgHeight, 4);
    bg.lineStyle(1, 0x444460, 0.8);
    bg.strokeRoundedRect(0, 0, textWidth + padding * 2, bgHeight, 4);
    container.add(bg);

    // Text lines
    for (let i = 0; i < lines.length; i++) {
      const isTitle = i === 0;
      const text = this.add.text(padding, padding + i * lineHeight, lines[i], {
        fontSize: isTitle ? "10px" : "9px",
        color: isTitle ? "#ecf0f1" : "#95a5a6",
        fontFamily: "monospace",
        fontStyle: isTitle ? "bold" : "normal",
      });
      container.add(text);
    }

    // Context actions hint
    const store = useGameStore.getState();
    if (!store.cablingFrom && !store.placingModel) {
      const hint = this.add.text(
        padding,
        bgHeight + 2,
        "Click port to cable",
        {
          fontSize: "8px",
          color: "#666680",
          fontFamily: "monospace",
          fontStyle: "italic",
        },
      );
      container.add(hint);
    }

    this.tooltip = container;
  }

  private hideTooltip() {
    this.tooltip?.destroy();
    this.tooltip = null;
  }

  // ── Port rendering + interaction ─────────────────────────────

  private createPorts(
    container: Phaser.GameObjects.Container,
    device: Device,
    h: number,
    state: GameState,
    store: ReturnType<typeof useGameStore.getState>,
  ) {
    const maxVisible = Math.min(device.ports.length, 24);
    const cablingFrom = store.cablingFrom;
    const isCabling = !!cablingFrom;
    const isSourceDevice = cablingFrom?.deviceId === device.id;

    for (let i = 0; i < maxVisible; i++) {
      const port = device.ports[i];
      const px = PORT.START_X + i * PORT.SPACING;
      const py = h / 2;

      // Port sprite
      const portKey = this.getPortTextureKey(port);
      const portImg = this.add.image(px, py, portKey);
      container.add(portImg);

      // Connected overlay
      if (port.linkId) {
        const connImg = this.add.image(px, py, "port-connected");
        container.add(connImg);
      }

      // Cabling highlight: valid targets glow, source port highlighted
      if (isCabling) {
        const isSource =
          isSourceDevice && cablingFrom.portIndex === i;
        const isValidTarget =
          !isSourceDevice && !port.linkId && port.status === "up";

        if (isSource) {
          // Highlight source port
          const sourceG = this.add.graphics();
          sourceG.lineStyle(2, PALETTE.highlight, 1);
          sourceG.strokeCircle(px, py, PORT.RADIUS + 3);
          container.add(sourceG);
        } else if (isValidTarget) {
          // Highlight valid target
          const targetG = this.add.graphics();
          targetG.lineStyle(1.5, PALETTE.portUp, 0.6);
          targetG.strokeCircle(px, py, PORT.RADIUS + 2);
          container.add(targetG);
        }
      }

      // Port hit zone (oversized)
      const worldX = this.deviceX() + px;
      const worldY = this.slotY(device.slotU) + 1 + py;

      const portZone = this.add
        .zone(worldX, worldY, PORT.HIT_RADIUS * 2, PORT.HIT_RADIUS * 2)
        .setDepth(DEPTH.HIT_TARGETS + 1)
        .setInteractive({ useHandCursor: true });

      portZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (!pointer.leftButtonDown()) return;
        this.handlePortClick(device, port, i, state);
      });

      portZone.on("pointerover", () => {
        // Hover highlight on port
        portImg.setScale(1.3);
      });
      portZone.on("pointerout", () => {
        portImg.setScale(1);
      });

      this.hitLayer.add(portZone);
      this.portHitZones.push({
        zone: portZone,
        deviceId: device.id,
        portIndex: i,
        worldX,
        worldY,
      });
    }

    // Overflow label
    if (device.ports.length > 24) {
      const overflowLabel = this.add
        .text(
          PORT.START_X + 24 * PORT.SPACING + 4,
          h / 2,
          `+${device.ports.length - 24}`,
          {
            fontSize: "8px",
            color: "#666680",
            fontFamily: "monospace",
          },
        )
        .setOrigin(0, 0.5);
      container.add(overflowLabel);
    }
  }

  private handlePortClick(
    device: Device,
    port: Port,
    portIndex: number,
    _state: GameState,
  ) {
    const store = useGameStore.getState();

    if (store.cablingFrom) {
      // Complete the cable
      const source = store.cablingFrom;

      // Can't cable to same device
      if (source.deviceId === device.id) {
        store.cancelCabling();
        return;
      }

      // Target must be available
      if (port.linkId || port.status !== "up") return;

      // Send RPC
      rpcClient
        .call("connectPorts", {
          portA: `${source.deviceId}-p${source.portIndex}`,
          portB: `${device.id}-p${portIndex}`,
          cableType: "cat6" as CableType,
          deviceIdA: source.deviceId,
          portIndexA: source.portIndex,
          deviceIdB: device.id,
          portIndexB: portIndex,
        } as never)
        .catch(() => {});

      store.cancelCabling();
    } else if (port.linkId) {
      // Clicking a connected port — offer disconnect
      // For now, right-click disconnects
      // Left-click on connected port selects device
      store.selectDevice(device.id);
    } else if (port.status === "up") {
      // Start cabling from this port
      store.startCabling({ deviceId: device.id, portIndex });
    } else if (port.status === "down") {
      // Repair action
      rpcClient
        .call("repairPort", { deviceId: device.id, portIndex })
        .catch(() => {});
    }
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

  // ── Cable preview ────────────────────────────────────────────

  private renderCablePreview() {
    if (!this.previewGraphics) return;
    this.previewGraphics.clear();

    const store = useGameStore.getState();
    if (!store.cablingFrom || !store.state) return;

    const device = store.state.devices[store.cablingFrom.deviceId];
    if (!device) return;

    const sourcePos = this.getPortWorldPos(device, store.cablingFrom.portIndex);
    if (!sourcePos) return;

    // Draw preview cable from source port to mouse
    this.previewGraphics.lineStyle(2, PALETTE.highlight, 0.5);

    const midX =
      RACK_X +
      RACK.WIDTH +
      20 +
      Math.abs(sourcePos.y - this.mouseWorldY) * 0.25;

    this.previewGraphics.beginPath();
    this.previewGraphics.moveTo(sourcePos.x, sourcePos.y);
    this.previewGraphics.lineTo(midX, sourcePos.y);
    this.previewGraphics.lineTo(midX, this.mouseWorldY);
    this.previewGraphics.lineTo(this.mouseWorldX, this.mouseWorldY);
    this.previewGraphics.strokePath();

    // Pulsing dot at source
    const t = this.time.now * 0.003;
    const pulseAlpha = 0.4 + Math.sin(t) * 0.3;
    this.previewGraphics.fillStyle(PALETTE.highlight, pulseAlpha);
    this.previewGraphics.fillCircle(sourcePos.x, sourcePos.y, 4);
  }

  // ── Cable rendering ──────────────────────────────────────────

  private renderCables(
    state: GameState,
    store: ReturnType<typeof useGameStore.getState>,
  ) {
    if (!this.cableGraphics) return;
    this.cableGraphics.clear();

    // Determine highlighted links
    const highlightedLinkIds = new Set<string>();
    if (store.selectedClientId) {
      for (const conn of Object.values(state.connections)) {
        if (conn.clientId === store.selectedClientId && conn.path) {
          for (const hop of conn.path) {
            if (hop.linkId) highlightedLinkIds.add(hop.linkId);
          }
        }
      }
    }

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

      const isHighlighted = highlightedLinkIds.has(link.id);
      const alpha = isHighlighted
        ? 1
        : Math.max(0.3, Math.min(1, 0.3 + utilization * 0.7));

      const color = isHighlighted
        ? PALETTE.highlight
        : link.status === "cut"
          ? PALETTE.cableCut
          : utilization > 0.9
            ? PALETTE.cableCongested
            : PALETTE.cable;

      const lineWidth = isHighlighted ? 3 : 2.5;
      this.cableGraphics.lineStyle(lineWidth, color, alpha);

      const exitX =
        RACK_X + RACK.WIDTH + 20 + Math.abs(posA.y - posB.y) * 0.25;

      this.cableGraphics.beginPath();
      this.cableGraphics.moveTo(posA.x, posA.y);
      this.cableGraphics.lineTo(exitX, posA.y);
      this.cableGraphics.lineTo(exitX, posB.y);
      this.cableGraphics.lineTo(posB.x, posB.y);
      this.cableGraphics.strokePath();

      // Endpoint dots
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

  // ── Placement slots ──────────────────────────────────────────

  private renderPlacementSlots(
    state: GameState,
    store: ReturnType<typeof useGameStore.getState>,
  ) {
    // Clear old
    for (const z of this.placementSlotZones) z.destroy();
    this.placementSlotZones = [];

    if (!store.placingModel) return;

    // Find occupied slots
    const occupied = new Set<number>();
    for (const device of Object.values(state.devices)) {
      for (let u = device.slotU; u < device.slotU + device.uHeight; u++) {
        occupied.add(u);
      }
    }

    // Show placement highlights for empty slots
    for (let u = 1; u <= RACK.TOTAL_U; u++) {
      if (occupied.has(u)) continue;

      const x = this.deviceX();
      const y = this.slotY(u) + 1;

      // Valid slot highlight
      const highlight = this.add
        .image(x, y, "slot-valid")
        .setOrigin(0, 0)
        .setDepth(DEPTH.SLOT_HIGHLIGHTS);
      this.slotLayer.add(highlight);
      this.slotHighlights.push(highlight);

      // Placement hit zone
      const zone = this.add
        .zone(x, y, RACK.INNER_WIDTH - 4, RACK.SLOT_HEIGHT - 2)
        .setOrigin(0, 0)
        .setDepth(DEPTH.HIT_TARGETS + 2)
        .setInteractive({ useHandCursor: true });

      zone.on("pointerover", () => {
        highlight.setAlpha(1);
      });
      zone.on("pointerout", () => {
        highlight.setAlpha(0.7);
      });
      zone.on("pointerdown", () => {
        const currentStore = useGameStore.getState();
        if (!currentStore.placingModel) return;
        const rackId = Object.keys(state.racks)[0];
        if (!rackId) return;

        rpcClient
          .call("placeDevice", {
            rackId,
            slotU: u,
            model: currentStore.placingModel,
          })
          .catch(() => {});

        currentStore.cancelPlacing();
      });

      this.hitLayer.add(zone);
      this.placementSlotZones.push(zone);
    }
  }
}
