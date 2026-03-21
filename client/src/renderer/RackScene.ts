import Phaser from "phaser";
import type { GameState, Device, Port, Link, CableType } from "@downtime-ops/shared";
import { useGameStore } from "../store/gameStore";
import { rpcClient } from "../rpc/client";
import { RACK, PORT, PALETTE, TEXT_COLORS } from "./TextureGenerator";
import { emitAudioEvent } from "./AudioEvents";
import { getCableStyle, getCableExitX, drawCablePath, interpolateCablePath, getPulseColor } from "./CablePrefab";
import { PerfMonitor } from "./PerfMonitor";

// Layout — rack anchored in left bay (58% of 960px viewport)
const RACK_X = 50;
const RACK_Y = 30;
const BAY_WIDTH = 557; // left 58% of 960px logical viewport

// Zoom bands (multiplied by DPR at runtime)
// Tuned for the bay viewport (left 58% of screen)
const ZOOM_BANDS = {
  OVERVIEW: 0.55, // full rack visible in bay
  HALF: 1.0,      // ~21 U visible
  DEVICE: 1.6,    // ~7 U visible, device-level detail
  PORT: 2.5,      // ~3 U visible, port-level detail
} as const;

const ZOOM_BAND_VALUES = [
  ZOOM_BANDS.OVERVIEW,
  ZOOM_BANDS.HALF,
  ZOOM_BANDS.DEVICE,
  ZOOM_BANDS.PORT,
];

// Depth layers
const DEPTH = {
  BACKGROUND: 0,
  RACK_FRAME: 10,
  SLOT_HIGHLIGHTS: 15,
  DEVICES: 20,
  DEVICE_OVERLAYS: 25,
  CABLES: 30,
  TRAFFIC_PULSES: 32,
  CABLE_PREVIEW: 35,
  EFFECTS: 40,
  TOOLTIPS: 45,
  HIT_TARGETS: 50,
} as const;

// ── Animation state types ────────────────────────────────────

type TrafficPulse = {
  linkId: string;
  progress: number; // 0→1 along cable path
  speed: number;
  color: number;
};

type FailureVfx = {
  deviceId: string;
  flickerTimer: number;
  sparkTimer: number;
  visible: boolean;
};

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
  private pulseLayer!: Phaser.GameObjects.Container;
  private previewLayer!: Phaser.GameObjects.Container;
  private effectLayer!: Phaser.GameObjects.Container;
  private hitLayer!: Phaser.GameObjects.Container;

  private deviceVisuals = new Map<string, DeviceVisual>();
  private portHitZones: PortHitZone[] = [];
  private cableGraphics: Phaser.GameObjects.Graphics | null = null;
  private pulseGraphics: Phaser.GameObjects.Graphics | null = null;
  private previewGraphics: Phaser.GameObjects.Graphics | null = null;
  private effectGraphics: Phaser.GameObjects.Graphics | null = null;
  private slotHighlights: Phaser.GameObjects.Image[] = [];
  private placementSlotZones: Phaser.GameObjects.Zone[] = [];
  private tooltip: Phaser.GameObjects.Container | null = null;

  private rackTitle: Phaser.GameObjects.Text | null = null;
  private lastStateKey = "";
  private unsubscribe: (() => void) | null = null;

  // Camera pan
  private isPanning = false;
  private panStart = { x: 0, y: 0 };
  private camStart = { x: 0, y: 0 };

  // Mouse tracking
  private mouseWorldX = 0;
  private mouseWorldY = 0;

  // Zoom
  private zoomTween: Phaser.Tweens.Tween | null = null;
  private dpr = 1;

  // Double-click detection
  private lastDeviceClickTime = 0;
  private lastDeviceClickId = "";

  // Workbench drag-to-install / drag-to-remove
  private workbenchItems: Phaser.GameObjects.Container[] = [];
  private draggingDevice: {
    itemId: string;
    model: string;
    uHeight: number;
    source: "storage" | "carried" | "installed";
    deviceId?: string; // set when dragging from rack (installed device)
    sprite: Phaser.GameObjects.Image;
    offsetX: number;
    offsetY: number;
  } | null = null;
  private dragGhost: Phaser.GameObjects.Graphics | null = null;
  private isDragStarted = false;
  private dragStartPointer = { x: 0, y: 0 };

  // ── Animation state ──────────────────────────────────────────
  private trafficPulses: TrafficPulse[] = [];
  private failureVfx = new Map<string, FailureVfx>();
  private portLedTimers = new Map<string, number>(); // portId → blink phase
  private pendingPlacements: Array<{
    deviceId: string;
    targetY: number;
    startY: number;
    progress: number;
  }> = [];

  // Track previous state for change detection (audio events)
  private prevDeviceIds = new Set<string>();
  private prevLinkIds = new Set<string>();
  private prevFailedDeviceIds = new Set<string>();
  private prevFailedPortKeys = new Set<string>();

  // Performance monitoring
  private perfMonitor = new PerfMonitor();

  constructor() {
    super({ key: "RackScene" });
  }

  create() {
    // Transparent background — workstation-bg.png is rendered by React behind the canvas
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");

    this.createLayers();
    this.createBackground();
    this.createRackFrame();
    this.createULabels();
    this.setupCamera();
    this.setupInput();

    this.cableGraphics = this.add.graphics();
    this.cableGraphics.setDepth(DEPTH.CABLES);
    this.cableLayer.add(this.cableGraphics);

    this.pulseGraphics = this.add.graphics();
    this.pulseGraphics.setDepth(DEPTH.TRAFFIC_PULSES);
    this.pulseLayer.add(this.pulseGraphics);

    this.previewGraphics = this.add.graphics();
    this.previewGraphics.setDepth(DEPTH.CABLE_PREVIEW);
    this.previewLayer.add(this.previewGraphics);

    this.effectGraphics = this.add.graphics();
    this.effectGraphics.setDepth(DEPTH.EFFECTS);
    this.effectLayer.add(this.effectGraphics);

    // Subscribe to store
    this.unsubscribe = useGameStore.subscribe((store) => {
      const state = store.state;
      if (!state) return;

      const rackDevices = this.getRackDevices(state);
      const stateKey = [
        state.tick,
        store.openRackItemId ?? "",
        store.rackMode,
        store.workFocusDeviceId ?? "",
        Object.keys(rackDevices).length,
        Object.keys(state.links).length,
        store.selectedDeviceId,
        store.cablingFrom?.deviceId ?? "",
        store.cablingFrom?.portIndex ?? "",
        store.placingModel ?? "",
        store.selectedClientId ?? "",
        store.highlightedAlertId ?? "",
        ...Object.values(rackDevices).map(
          (d) => `${d.id}:${d.status}:${d.slotU}`,
        ),
      ].join("|");

      if (stateKey === this.lastStateKey) return;
      this.lastStateKey = stateKey;

      this.detectChangesAndEmitAudio(state);
      this.renderAll(state, store);
      this.syncAnimationState(state);
    });

    // Initial render
    const store = useGameStore.getState();
    if (store.state) {
      this.renderAll(store.state, store);
      this.syncAnimationState(store.state);
      // Seed prev-state trackers
      for (const id of Object.keys(store.state.devices))
        this.prevDeviceIds.add(id);
      for (const id of Object.keys(store.state.links))
        this.prevLinkIds.add(id);
    }

    this.autoEnterPlacementMode();

    this.scale.on("resize", this.handleResize, this);

    // When scene wakes (returned to from WorldScene), refresh title and re-render
    this.events.on("wake", () => {
      this.updateRackTitle();
      this.setupCamera(); // reset zoom to overview
      this.autoEnterPlacementMode();
      this.lastStateKey = ""; // force re-render
      const s = useGameStore.getState();
      if (s.state) {
        this.renderAll(s.state, s);
        this.syncAnimationState(s.state);
      }
    });
  }

  shutdown() {
    this.unsubscribe?.();
    this.scale.off("resize", this.handleResize, this);
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;
    this.perfMonitor.recordFrameTime(delta);
    this.updateTrafficPulses(dt);
    this.updateFailureVfx(dt);
    this.updatePlacementAnimations(dt);
    this.updateDragPreview();
    this.renderCablePreview();
    this.renderAnimatedEffects();
  }

  // ── Layers ───────────────────────────────────────────────────

  private createLayers() {
    this.bgLayer = this.add.container(0, 0).setDepth(DEPTH.BACKGROUND);
    this.rackLayer = this.add.container(0, 0).setDepth(DEPTH.RACK_FRAME);
    this.slotLayer = this.add.container(0, 0).setDepth(DEPTH.SLOT_HIGHLIGHTS);
    this.deviceLayer = this.add.container(0, 0).setDepth(DEPTH.DEVICES);
    this.cableLayer = this.add.container(0, 0).setDepth(DEPTH.CABLES);
    this.pulseLayer = this.add.container(0, 0).setDepth(DEPTH.TRAFFIC_PULSES);
    this.previewLayer = this.add.container(0, 0).setDepth(DEPTH.CABLE_PREVIEW);
    this.effectLayer = this.add.container(0, 0).setDepth(DEPTH.EFFECTS);
    this.hitLayer = this.add.container(0, 0).setDepth(DEPTH.HIT_TARGETS);
  }

  // ── Background ───────────────────────────────────────────────

  private createBackground() {
    // Background is handled by the React RackWorkstation component
    // (workstation-bg.png rendered as a CSS background behind the transparent canvas).
    // No Phaser background needed — canvas is transparent.
  }

  // ── Rack frame ───────────────────────────────────────────────

  private createRackFrame() {
    const frameKey = this.textures.exists("rack-empty") ? "rack-empty" : "rack-frame";
    const frame = this.add
      .image(RACK_X, RACK_Y, frameKey)
      .setOrigin(0, 0);
    // Scale the image to match RACK layout dimensions
    const rackH = RACK.HEIGHT + 20; // slots + title area
    frame.setDisplaySize(RACK.WIDTH, rackH);
    frame.setDepth(DEPTH.RACK_FRAME);
    this.rackLayer.add(frame);

    this.rackTitle = this.add
      .text(RACK_X + RACK.WIDTH / 2, RACK_Y + 10, "RACK A", {
        fontSize: "11px",
        color: TEXT_COLORS.heading,
        fontStyle: "bold",
        fontFamily: "'Nunito', sans-serif",
      })
      .setOrigin(0.5, 0.5)
      .setResolution(2);
    this.rackTitle.setDepth(DEPTH.RACK_FRAME);
    this.rackLayer.add(this.rackTitle);

    // Cable stock is shown in the React HUD overlay (InventoryHUD)
  }

  // ── U labels ─────────────────────────────────────────────────

  private createULabels() {
    for (let u = 1; u <= RACK.TOTAL_U; u++) {
      if (u % 5 === 0 || u === 1) {
        const y = this.slotY(u) + RACK.SLOT_HEIGHT / 2;
        const label = this.add
          .text(RACK_X - 8, y, `${u}`, {
            fontSize: "9px",
            color: TEXT_COLORS.dim,
            fontFamily: "'JetBrains Mono', monospace",
          })
          .setOrigin(1, 0.5)
          .setResolution(2);
        label.setDepth(DEPTH.RACK_FRAME);
        this.rackLayer.add(label);
      }
    }
  }

  // ── Camera ───────────────────────────────────────────────────

  private setupCamera() {
    const cam = this.cameras.main;
    this.dpr = window.devicePixelRatio || 1;
    const rackTotalH = RACK.HEIGHT + 40; // slots + title + padding
    cam.setBackgroundColor("rgba(0,0,0,0)");
    cam.setZoom(ZOOM_BANDS.OVERVIEW * this.dpr);

    // Position camera so the rack aligns with the bay opening in the background art.
    // The bay opening center is at ~23% of the viewport width.
    // We need the rack center (world coords) to map to that screen position.
    const zoom = ZOOM_BANDS.OVERVIEW * this.dpr;
    const viewW = this.scale.width / zoom;
    const viewH = this.scale.height / zoom;
    const rackCenterX = RACK_X + RACK.WIDTH / 2;
    const rackCenterY = RACK_Y + rackTotalH / 2;

    // scrollX/Y so that rack center appears at 23% of viewport width, 48% of viewport height
    const targetScreenXPct = 0.23;
    const targetScreenYPct = 0.48;
    cam.scrollX = rackCenterX - viewW * targetScreenXPct;
    cam.scrollY = rackCenterY - viewH * targetScreenYPct;

    cam.setBounds(-500, -500, 3000, 3000); // loose bounds for panning in work mode
  }

  private handleResize() {
    this.setupCamera();
  }

  // ── Input ────────────────────────────────────────────────────

  private setupInput() {
    this.input.on(
      "wheel",
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: unknown[],
        _dx: number,
        _dy: number,
        dz: number,
      ) => {
        const direction = dz > 0 ? -1 : 1; // scroll down = zoom out, up = zoom in
        const currentBand = this.getCurrentZoomBandIndex();
        const targetIndex = Phaser.Math.Clamp(
          currentBand + direction,
          0,
          ZOOM_BAND_VALUES.length - 1,
        );

        // Clamp to mode zoom range
        const store = useGameStore.getState();
        const minIndex = store.rackMode === "work" ? 1 : 0; // Work: HALF..PORT, Overview: OVERVIEW..HALF
        const maxIndex = store.rackMode === "work" ? 3 : 1;
        const clampedIndex = Phaser.Math.Clamp(targetIndex, minIndex, maxIndex);

        const targetZoom = ZOOM_BAND_VALUES[clampedIndex] * this.dpr;
        this.animateZoomTo(targetZoom);
      },
    );

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
      const worldPoint = this.cameras.main.getWorldPoint(
        pointer.x,
        pointer.y,
      );
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
      if (this.draggingDevice) {
        this.handleDragDrop();
      }
    });

    this.input.keyboard?.on("keydown-ESC", () => {
      const store = useGameStore.getState();

      // Layer 1: cancel active interactions
      if (this.draggingDevice) { this.cancelDrag(); return; }
      if (store.cablingFrom) { store.cancelCabling(); return; }
      if (store.placingModel) { store.cancelPlacing(); return; }

      // Layer 2: Work → Overview
      if (store.rackMode === "work") {
        store.enterOverviewMode();
        const rackTotalH = RACK.HEIGHT + 40;
        this.animateCameraTo(
          RACK_X + RACK.WIDTH / 2,
          RACK_Y + rackTotalH / 2,
          ZOOM_BANDS.OVERVIEW * this.dpr,
        );
        return;
      }

      // Layer 3: Overview → exit rack scene
      store.closeRack();
      this.scene.sleep("RackScene");
      this.scene.wake("WorldScene");
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        if (this.draggingDevice) this.cancelDrag();
        const store = useGameStore.getState();
        if (store.cablingFrom) store.cancelCabling();
        if (store.placingModel) store.cancelPlacing();
      }
    });

    this.game.canvas.addEventListener("contextmenu", (e) =>
      e.preventDefault(),
    );
  }

  // ── Zoom helpers ────────────────────────────────────────────

  private getCurrentZoomBandIndex(): number {
    const currentZoom = this.cameras.main.zoom / this.dpr;
    let closest = 0;
    let closestDist = Math.abs(ZOOM_BAND_VALUES[0] - currentZoom);
    for (let i = 1; i < ZOOM_BAND_VALUES.length; i++) {
      const dist = Math.abs(ZOOM_BAND_VALUES[i] - currentZoom);
      if (dist < closestDist) {
        closest = i;
        closestDist = dist;
      }
    }
    return closest;
  }

  private animateZoomTo(targetZoom: number, duration = 200) {
    this.zoomTween?.stop();
    const cam = this.cameras.main;
    this.zoomTween = this.tweens.add({
      targets: cam,
      zoom: targetZoom,
      duration,
      ease: "Quad.easeOut",
    });
  }

  /** Smoothly animate camera to a world position and zoom level */
  public animateCameraTo(
    centerX: number,
    centerY: number,
    zoom: number,
    duration = 300,
  ) {
    this.zoomTween?.stop();
    const cam = this.cameras.main;
    // Convert centerX/centerY to scrollX/scrollY
    const targetScrollX = centerX - (this.scale.width / zoom) / 2;
    const targetScrollY = centerY - (this.scale.height / zoom) / 2;

    this.zoomTween = this.tweens.add({
      targets: cam,
      scrollX: targetScrollX,
      scrollY: targetScrollY,
      zoom,
      duration,
      ease: "Quad.easeOut",
    });
  }

  // ── Coordinate helpers ───────────────────────────────────────

  private slotY(u: number): number {
    return RACK_Y + 20 + (u - 1) * RACK.SLOT_HEIGHT;
  }

  private deviceX(): number {
    return RACK_X + RACK.RAIL_WIDTH + 2;
  }

  private updateRackTitle() {
    const rackId = this.getOpenRackId();
    const state = useGameStore.getState().state;
    if (rackId && state?.racks[rackId] && this.rackTitle) {
      this.rackTitle.setText(state.racks[rackId].name.toUpperCase());
    }
  }

  /** If the player is carrying a device, it appears on the workbench for drag-to-install */
  private autoEnterPlacementMode() {
    // No-op: carried devices now appear on the workbench and are dragged in.
    // The old click-to-place slot flow is replaced by drag-to-install.
  }

  /** Resolve the simulation rackId from the currently opened rack item */
  private getOpenRackId(): string | null {
    const store = useGameStore.getState();
    const state = store.state;
    if (!state) return null;
    if (!store.openRackItemId) return Object.keys(state.racks)[0] ?? null;
    const rackItem = state.world.items[store.openRackItemId];
    return rackItem?.installedInRackId ?? null;
  }

  /** Filter state.devices to only those belonging to the currently open rack */
  private getRackDevices(state: GameState): Record<string, Device> {
    const rackId = this.getOpenRackId();
    if (!rackId) return {};
    const result: Record<string, Device> = {};
    for (const [id, device] of Object.entries(state.devices)) {
      if (device.rackId === rackId) result[id] = device;
    }
    return result;
  }

  // ── Audio event detection ────────────────────────────────────

  private detectChangesAndEmitAudio(state: GameState) {
    const rackDevices = this.getRackDevices(state);
    const currentDeviceIds = new Set(Object.keys(rackDevices));
    const currentLinkIds = new Set(Object.keys(state.links));
    const currentFailedDeviceIds = new Set<string>();
    const currentFailedPortKeys = new Set<string>();

    for (const device of Object.values(rackDevices)) {
      if (device.status === "failed") currentFailedDeviceIds.add(device.id);
      for (const port of device.ports) {
        if (port.status === "down")
          currentFailedPortKeys.add(`${device.id}:${port.index}`);
      }
    }

    // New devices placed
    for (const id of currentDeviceIds) {
      if (!this.prevDeviceIds.has(id)) {
        emitAudioEvent("device_place", { deviceId: id });
        // Queue placement animation
        const device = rackDevices[id];
        if (device) {
          this.pendingPlacements.push({
            deviceId: id,
            targetY: this.slotY(device.slotU) + 1,
            startY: this.slotY(device.slotU) - 20,
            progress: 0,
          });
        }
      }
    }
    // Devices removed
    for (const id of this.prevDeviceIds) {
      if (!currentDeviceIds.has(id)) emitAudioEvent("device_remove", { deviceId: id });
    }

    // New links
    for (const id of currentLinkIds) {
      if (!this.prevLinkIds.has(id)) emitAudioEvent("cable_connect", { linkId: id });
    }
    // Removed links
    for (const id of this.prevLinkIds) {
      if (!currentLinkIds.has(id)) emitAudioEvent("cable_disconnect", { linkId: id });
    }

    // Device failures
    for (const id of currentFailedDeviceIds) {
      if (!this.prevFailedDeviceIds.has(id))
        emitAudioEvent("device_fail", { deviceId: id });
    }
    // Device recoveries
    for (const id of this.prevFailedDeviceIds) {
      if (!currentFailedDeviceIds.has(id) && currentDeviceIds.has(id))
        emitAudioEvent("device_recover", { deviceId: id });
    }

    // Port failures
    for (const key of currentFailedPortKeys) {
      if (!this.prevFailedPortKeys.has(key))
        emitAudioEvent("port_fail", { portKey: key });
    }
    // Port repairs
    for (const key of this.prevFailedPortKeys) {
      if (!currentFailedPortKeys.has(key)) {
        emitAudioEvent("port_repair", { portKey: key });
        emitAudioEvent("traffic_restore", { portKey: key });
      }
    }

    this.prevDeviceIds = currentDeviceIds;
    this.prevLinkIds = currentLinkIds;
    this.prevFailedDeviceIds = currentFailedDeviceIds;
    this.prevFailedPortKeys = currentFailedPortKeys;
  }

  // ── Full render ──────────────────────────────────────────────

  private renderAll(
    state: GameState,
    store: ReturnType<typeof useGameStore.getState>,
  ) {
    this.renderDevices(state, store);
    this.renderCables(state, store);
    this.renderPlacementSlots(state, store);
    this.renderWorkbench(state, store);
  }

  // ── Sync animation state with game state ─────────────────────

  private syncAnimationState(state: GameState) {
    // Sync traffic pulses: spawn/despawn based on active links
    const activeLinkIds = new Set<string>();
    for (const link of Object.values(state.links)) {
      if (link.status !== "cut" && link.currentLoadMbps > 0) {
        activeLinkIds.add(link.id);
      }
    }

    // Remove pulses for dead links
    this.trafficPulses = this.trafficPulses.filter((p) =>
      activeLinkIds.has(p.linkId),
    );

    // Spawn pulses for links that need more
    for (const link of Object.values(state.links)) {
      if (!activeLinkIds.has(link.id)) continue;

      const utilization =
        link.maxBandwidthMbps > 0
          ? link.currentLoadMbps / link.maxBandwidthMbps
          : 0;

      // Target pulse count: 1 at low util, up to 4 at high util
      const targetCount = Math.max(1, Math.ceil(utilization * 4));
      const existing = this.trafficPulses.filter(
        (p) => p.linkId === link.id,
      ).length;

      const color = getPulseColor(utilization);

      for (let i = existing; i < targetCount; i++) {
        this.trafficPulses.push({
          linkId: link.id,
          progress: i / targetCount, // stagger
          speed: 0.3 + utilization * 0.7, // faster at higher util
          color,
        });
      }

      // Trim excess
      if (existing > targetCount) {
        let removed = 0;
        this.trafficPulses = this.trafficPulses.filter((p) => {
          if (p.linkId === link.id && removed < existing - targetCount) {
            removed++;
            return false;
          }
          return true;
        });
      }
    }

    // Sync failure VFX
    const rackDevicesSync = this.getRackDevices(state);
    for (const device of Object.values(rackDevicesSync)) {
      if (device.status === "failed" && !this.failureVfx.has(device.id)) {
        this.failureVfx.set(device.id, {
          deviceId: device.id,
          flickerTimer: 0,
          sparkTimer: 0,
          visible: true,
        });
      }
      if (device.status !== "failed" && this.failureVfx.has(device.id)) {
        this.failureVfx.delete(device.id);
      }
    }
  }

  // ── Animation updates (per frame) ───────────────────────────

  private updateTrafficPulses(dt: number) {
    for (const pulse of this.trafficPulses) {
      pulse.progress += pulse.speed * dt;
      if (pulse.progress > 1) pulse.progress -= 1;
    }
  }

  private updateFailureVfx(dt: number) {
    for (const [, vfx] of this.failureVfx) {
      vfx.flickerTimer += dt;
      vfx.sparkTimer += dt;

      // Intermittent flicker: toggle visibility
      if (vfx.flickerTimer > 0.1 + Math.random() * 0.2) {
        vfx.flickerTimer = 0;
        vfx.visible = Math.random() > 0.3; // mostly visible, occasional flicker off
      }
    }
  }

  private updatePlacementAnimations(dt: number) {
    for (const anim of this.pendingPlacements) {
      anim.progress = Math.min(1, anim.progress + dt * 4); // 0.25s animation
    }

    // Apply to device containers
    for (const anim of this.pendingPlacements) {
      const visual = this.deviceVisuals.get(anim.deviceId);
      if (!visual) continue;

      if (anim.progress < 1) {
        // Ease-out bounce
        const t = anim.progress;
        const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
        const bounce = t < 0.8 ? ease : ease + Math.sin((t - 0.8) * Math.PI * 5) * 0.01 * (1 - t);
        const y = anim.startY + (anim.targetY - anim.startY) * bounce;
        visual.container.setY(y);
      } else {
        visual.container.setY(anim.targetY);
      }
    }

    // Remove completed
    this.pendingPlacements = this.pendingPlacements.filter(
      (a) => a.progress < 1,
    );
  }

  private updateDragPreview() {
    if (!this.draggingDevice) {
      this.dragGhost?.clear();
      return;
    }

    // Move dragged sprite to mouse position
    this.draggingDevice.sprite.setPosition(this.mouseWorldX, this.mouseWorldY);

    // Show ghost snap preview at nearest valid slot
    if (!this.dragGhost) return;
    this.dragGhost.clear();

    const targetU = this.getSlotAtPosition(this.mouseWorldY);
    if (!targetU) return;

    const x = this.deviceX();
    const y = this.slotY(targetU) + 1;
    const w = RACK.INNER_WIDTH - 4;
    const h = RACK.SLOT_HEIGHT - 2;
    const free = this.isSlotFree(targetU);

    // Ghost outline at snap position
    const color = free ? PALETTE.slotValid : PALETTE.slotInvalid;
    this.dragGhost.lineStyle(2, color, 0.8);
    this.dragGhost.strokeRoundedRect(x, y, w, h, 3);
    this.dragGhost.fillStyle(color, 0.15);
    this.dragGhost.fillRoundedRect(x, y, w, h, 3);
  }

  // ── Animated rendering (per frame) ──────────────────────────

  private renderAnimatedEffects() {
    this.renderTrafficPulses();
    this.renderFailureEffects();
    this.renderPortLedBlinks();
  }

  private renderTrafficPulses() {
    if (!this.pulseGraphics) return;
    this.pulseGraphics.clear();

    const state = useGameStore.getState().state;
    if (!state) return;

    for (const pulse of this.trafficPulses) {
      const link = state.links[pulse.linkId];
      if (!link) continue;

      const devA = state.devices[link.portA.deviceId];
      const devB = state.devices[link.portB.deviceId];
      if (!devA || !devB) continue;

      const posA = this.getPortWorldPos(devA, link.portA.portIndex);
      const posB = this.getPortWorldPos(devB, link.portB.portIndex);
      if (!posA || !posB) continue;

      const exitX = getCableExitX(RACK_X + RACK.WIDTH, posA.y, posB.y);
      const pos = interpolateCablePath(posA, posB, exitX, pulse.progress);

      const size = 2 + (link.currentLoadMbps / Math.max(link.maxBandwidthMbps, 1)) * 2;
      this.pulseGraphics.fillStyle(pulse.color, 0.3);
      this.pulseGraphics.fillCircle(pos.x, pos.y, size + 2);
      this.pulseGraphics.fillStyle(pulse.color, 0.8);
      this.pulseGraphics.fillCircle(pos.x, pos.y, size);
    }
  }

  private renderFailureEffects() {
    if (!this.effectGraphics) return;
    this.effectGraphics.clear();

    const state = useGameStore.getState().state;
    if (!state) return;

    for (const [deviceId, vfx] of this.failureVfx) {
      const device = state.devices[deviceId];
      if (!device) continue;

      const x = this.deviceX();
      const y = this.slotY(device.slotU) + 1;
      const w = RACK.INNER_WIDTH - 4;
      const h = device.uHeight * RACK.SLOT_HEIGHT - 2;

      // Intermittent red flash overlay
      if (!vfx.visible) {
        this.effectGraphics.fillStyle(PALETTE.portDown, 0.15);
        this.effectGraphics.fillRect(x, y, w, h);
      }

      // Spark particles (small random dots around device)
      if (vfx.sparkTimer > 0.3 + Math.random() * 0.5) {
        vfx.sparkTimer = 0;
      }
      const sparkPhase = vfx.sparkTimer / 0.4;
      if (sparkPhase < 0.15) {
        const sparkCount = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < sparkCount; i++) {
          const sx = x + Math.random() * w;
          const sy = y + Math.random() * h;
          const sparkAlpha = 1 - sparkPhase / 0.15;
          this.effectGraphics.fillStyle(0xffaa44, sparkAlpha * 0.8);
          this.effectGraphics.fillCircle(sx, sy, 1 + Math.random() * 1.5);
        }
      }

      // Warning flash border
      const flashAlpha = 0.2 + Math.sin(this.time.now * 0.006) * 0.15;
      this.effectGraphics.lineStyle(1.5, PALETTE.portDown, flashAlpha);
      this.effectGraphics.strokeRect(x - 1, y - 1, w + 2, h + 2);
    }

    // Failed port sparks
    for (const device of Object.values(this.getRackDevices(state))) {
      for (const port of device.ports) {
        if (port.status !== "down") continue;
        const pos = this.getPortWorldPos(device, port.index);
        if (!pos) continue;

        // Red pulsing ring
        const pulseScale =
          0.8 + Math.sin(this.time.now * 0.005 + port.index) * 0.3;
        this.effectGraphics.lineStyle(1, PALETTE.portDown, 0.4 * pulseScale);
        this.effectGraphics.strokeCircle(
          pos.x,
          pos.y,
          PORT.RADIUS + 3 * pulseScale,
        );
      }
    }
  }

  private renderPortLedBlinks() {
    // Port LED blink effect is handled by alpha modulation on port sprites
    // during createPorts — here we just update timers
    const state = useGameStore.getState().state;
    if (!state) return;

    for (const device of Object.values(this.getRackDevices(state))) {
      for (const port of device.ports) {
        if (!port.linkId) continue;
        const key = port.id;
        const phase = (this.portLedTimers.get(key) ?? Math.random() * 6.28) +
          0.05; // ~20Hz base rate
        this.portLedTimers.set(key, phase);
      }
    }
  }

  // ── Device rendering ─────────────────────────────────────────

  private renderDevices(
    state: GameState,
    store: ReturnType<typeof useGameStore.getState>,
  ) {
    const rackDevices = this.getRackDevices(state);

    // Destroy old visuals
    for (const [id, visual] of this.deviceVisuals) {
      if (!rackDevices[id]) {
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

    if (store.highlightedAlertId && state.alerts) {
      const alert = state.alerts.find(
        (a) => a.id === store.highlightedAlertId,
      );
      if (alert?.deviceId) highlightedDeviceIds.add(alert.deviceId);
    }

    if (store.selectedClientId) {
      for (const conn of Object.values(state.connections)) {
        if (conn.clientId === store.selectedClientId && conn.path) {
          for (const hop of conn.path) {
            highlightedDeviceIds.add(hop.deviceId);
          }
        }
      }
    }

    for (const device of Object.values(rackDevices)) {
      const selected = device.id === store.selectedDeviceId;
      const highlighted = highlightedDeviceIds.has(device.id);

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

    const isOverview = store.rackMode === "overview";

    // Device body — draw directly with graphics for precise sizing
    const typeColors: Record<string, number> = {
      server: PALETTE.server,
      switch: PALETTE.switch,
      router: PALETTE.router,
      firewall: PALETTE.firewall,
    };
    const faceColors: Record<string, number> = {
      server: PALETTE.serverFace,
      switch: PALETTE.switchFace,
      router: PALETTE.routerFace,
      firewall: PALETTE.firewallFace,
    };
    const baseColor = typeColors[device.type] ?? PALETTE.server;
    const faceColor = faceColors[device.type] ?? PALETTE.serverFace;

    const body = this.add.graphics();
    body.fillStyle(baseColor, selected ? 1 : 0.85);
    body.fillRoundedRect(0, 0, w, h, 2);
    body.fillStyle(faceColor, selected ? 1 : 0.85);
    body.fillRoundedRect(2, 1, w - 4, h - 2, 1);
    container.add(body);

    // Use a dummy sprite for the DeviceVisual return type
    const sprite = this.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setVisible(false);
    container.add(sprite);

    // Selection border
    if (selected) {
      body.lineStyle(1.5, PALETTE.deviceSelected, 0.8);
      body.strokeRoundedRect(0, 0, w, h, 2);
    }

    // Highlight border
    if (highlighted) {
      body.lineStyle(1.5, PALETTE.highlight, 0.6);
      body.strokeRoundedRect(-1, -1, w + 2, h + 2, 2);
    }

    // Status LED — small colored dot
    const statusLed = this.add.graphics();
    this.drawStatusLed(statusLed, device, w - 12, h / 2);
    container.add(statusLed);

    // Device name + ports — only in work mode
    if (!isOverview) {
      const label = this.add
        .text(10, h / 2, device.name, {
          fontSize: "9px",
          color: TEXT_COLORS.primary,
          fontFamily: "'Nunito', sans-serif",
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);
      container.add(label);

      this.createPorts(container, device, h, state, store);
    }

    // Hit zone
    const hitZone = this.add
      .zone(x, y, w, h)
      .setOrigin(0, 0)
      .setDepth(DEPTH.HIT_TARGETS)
      .setInteractive({ useHandCursor: true });

    hitZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      const now = this.time.now;
      const store = useGameStore.getState();

      // Double-click detection (300ms threshold)
      if (
        this.lastDeviceClickId === device.id &&
        now - this.lastDeviceClickTime < 300
      ) {
        store.enterWorkMode(device.id);
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        this.animateCameraTo(centerX, centerY, ZOOM_BANDS.DEVICE * this.dpr);
        this.lastDeviceClickTime = 0;
        return;
      }

      this.lastDeviceClickTime = now;
      this.lastDeviceClickId = device.id;
      store.selectDevice(device.id);

      // Track for potential drag-to-remove
      this.isDragStarted = false;
      this.dragStartPointer = { x: pointer.x, y: pointer.y };

      const onMove = (p: Phaser.Input.Pointer) => {
        if (this.draggingDevice) return;
        const dist = Math.sqrt(
          (p.x - this.dragStartPointer.x) ** 2 +
          (p.y - this.dragStartPointer.y) ** 2,
        );
        // Start drag after 8px movement threshold
        if (dist > 8) {
          this.isDragStarted = true;
          this.input.off("pointermove", onMove);
          this.startDragFromRack(device, p);
        }
      };
      const onUp = () => {
        this.input.off("pointermove", onMove);
        this.input.off("pointerup", onUp);
      };
      this.input.on("pointermove", onMove);
      this.input.on("pointerup", onUp);
    });

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

    // Glow for active devices
    if (device.status === "online") {
      const glowPulse =
        0.15 + Math.sin(this.time.now * 0.002) * 0.05;
      g.fillStyle(color, glowPulse);
      g.fillCircle(x, y, 6);
    }

    // LED dot
    g.fillStyle(color, 1);
    g.fillCircle(x, y, 3);

    // Highlight pip
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(x - 0.5, y - 1, 1);
  }

  // ── Tooltip ──────────────────────────────────────────────────

  private showTooltip(
    device: Device,
    state: GameState,
    x: number,
    y: number,
  ) {
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

    const bg = this.add.graphics();
    bg.fillStyle(0x302820, 0.95);
    bg.fillRoundedRect(0, 0, textWidth + padding * 2, bgHeight, 6);
    bg.lineStyle(1, 0x5a4e40, 0.8);
    bg.strokeRoundedRect(0, 0, textWidth + padding * 2, bgHeight, 6);
    container.add(bg);

    for (let i = 0; i < lines.length; i++) {
      const isTitle = i === 0;
      const text = this.add.text(
        padding,
        padding + i * lineHeight,
        lines[i],
        {
          fontSize: isTitle ? "10px" : "9px",
          color: isTitle ? TEXT_COLORS.primary : TEXT_COLORS.muted,
          fontFamily: isTitle ? "'Nunito', sans-serif" : "'JetBrains Mono', monospace",
          fontStyle: isTitle ? "bold" : "normal",
        },
      );
      container.add(text);
    }

    const store = useGameStore.getState();
    if (!store.cablingFrom && !store.placingModel) {
      const hint = this.add.text(
        padding,
        bgHeight + 2,
        "Click port to cable",
        {
          fontSize: "8px",
          color: TEXT_COLORS.dim,
          fontFamily: "'Nunito', sans-serif",
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

      // Connected overlay + blinking LED
      if (port.linkId) {
        const connImg = this.add.image(px, py, "port-connected");
        container.add(connImg);

        // Blinking activity LED (small green dot above port)
        const link = state.links[port.linkId];
        if (link && link.currentLoadMbps > 0) {
          const ledG = this.add.graphics();
          const phase = this.portLedTimers.get(port.id) ?? 0;
          const blinkAlpha = 0.3 + Math.sin(phase) * 0.3;
          ledG.fillStyle(PALETTE.portUp, blinkAlpha);
          ledG.fillCircle(px, py - PORT.RADIUS - 2, 1.5);
          container.add(ledG);
        }
      }

      // Cabling highlights
      if (isCabling) {
        const isSource = isSourceDevice && cablingFrom.portIndex === i;
        const isValidTarget =
          !isSourceDevice && !port.linkId && port.status === "up";

        if (isSource) {
          const sourceG = this.add.graphics();
          sourceG.lineStyle(2, PALETTE.highlight, 1);
          sourceG.strokeCircle(px, py, PORT.RADIUS + 3);
          container.add(sourceG);
        } else if (isValidTarget) {
          const targetG = this.add.graphics();
          targetG.lineStyle(1.5, PALETTE.portUp, 0.6);
          targetG.strokeCircle(px, py, PORT.RADIUS + 2);
          container.add(targetG);
        }
      }

      // Port hit zone
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

    if (device.ports.length > 24) {
      const overflowLabel = this.add
        .text(
          PORT.START_X + 24 * PORT.SPACING + 4,
          h / 2,
          `+${device.ports.length - 24}`,
          {
            fontSize: "8px",
            color: TEXT_COLORS.dim,
            fontFamily: "'JetBrains Mono', monospace",
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
      const source = store.cablingFrom;
      if (source.deviceId === device.id) {
        store.cancelCabling();
        return;
      }
      if (port.linkId || port.status !== "up") return;

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
      store.selectDevice(device.id);
    } else if (port.status === "up") {
      store.startCabling({ deviceId: device.id, portIndex });
    } else if (port.status === "down") {
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

    this.previewGraphics.lineStyle(2, PALETTE.highlight, 0.5);

    const midX = Math.min(
      RACK_X + RACK.WIDTH + 20 + Math.abs(sourcePos.y - this.mouseWorldY) * 0.25,
      BAY_WIDTH - 20, // stay within bay
    );

    this.previewGraphics.beginPath();
    this.previewGraphics.moveTo(sourcePos.x, sourcePos.y);
    this.previewGraphics.lineTo(midX, sourcePos.y);
    this.previewGraphics.lineTo(midX, this.mouseWorldY);
    this.previewGraphics.lineTo(this.mouseWorldX, this.mouseWorldY);
    this.previewGraphics.strokePath();

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
      this.renderSingleCable(state, link, highlightedLinkIds.has(link.id));
    }
  }

  private renderSingleCable(
    state: GameState,
    link: Link,
    isHighlighted: boolean,
  ) {
    if (!this.cableGraphics) return;

    const devA = state.devices[link.portA.deviceId];
    const devB = state.devices[link.portB.deviceId];
    if (!devA || !devB) return;

    const posA = this.getPortWorldPos(devA, link.portA.portIndex);
    const posB = this.getPortWorldPos(devB, link.portB.portIndex);
    if (!posA || !posB) return;

    const utilization =
      link.maxBandwidthMbps > 0
        ? link.currentLoadMbps / link.maxBandwidthMbps
        : 0;

    const style = getCableStyle(utilization, link.status, isHighlighted, this.time.now);
    const exitX = getCableExitX(RACK_X + RACK.WIDTH, posA.y, posB.y);
    drawCablePath(this.cableGraphics, posA, posB, exitX, style);
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
    for (const z of this.placementSlotZones) z.destroy();
    this.placementSlotZones = [];

    if (!store.placingModel) return;

    const rackDevices = this.getRackDevices(state);
    const occupied = new Set<number>();
    for (const device of Object.values(rackDevices)) {
      for (let u = device.slotU; u < device.slotU + device.uHeight; u++) {
        occupied.add(u);
      }
    }

    for (let u = 1; u <= RACK.TOTAL_U; u++) {
      if (occupied.has(u)) continue;

      const x = this.deviceX();
      const y = this.slotY(u) + 1;

      const highlight = this.add
        .image(x, y, "slot-valid")
        .setOrigin(0, 0)
        .setDepth(DEPTH.SLOT_HIGHLIGHTS);
      this.slotLayer.add(highlight);
      this.slotHighlights.push(highlight);

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
        const currentState = currentStore.state;
        if (!currentState) return;

        // Check if player is carrying a device item → use installDevice
        const carryingId = currentState.world.player.carryingItemId;
        const carriedItem = carryingId ? currentState.world.items[carryingId] : null;

        if (carriedItem?.kind === "device" && currentStore.openRackItemId) {
          rpcClient
            .call("installDevice", {
              itemId: carriedItem.id,
              rackItemId: currentStore.openRackItemId,
              slotU: u,
            })
            .catch(() => {});
        } else {
          // Fallback: direct placement (old path)
          const rackId = this.getOpenRackId();
          if (!rackId) return;
          rpcClient
            .call("placeDevice", {
              rackId,
              slotU: u,
              model: currentStore.placingModel,
            })
            .catch(() => {});
        }

        currentStore.cancelPlacing();
      });

      this.hitLayer.add(zone);
      this.placementSlotZones.push(zone);
    }
  }

  // ── Equipment workbench ────────────────────────────────────

  private renderWorkbench(
    state: GameState,
    _store: ReturnType<typeof useGameStore.getState>,
  ) {
    // Clear old workbench items
    for (const item of this.workbenchItems) item.destroy();
    this.workbenchItems = [];

    // Don't show workbench while dragging (the dragged item is separate)
    if (this.draggingDevice) return;

    // Collect installable devices: in_storage + carried
    const modelCounts = new Map<string, { count: number; itemId: string; source: "storage" | "carried" }>();
    const carryingId = state.world.player.carryingItemId;

    for (const item of Object.values(state.world.items)) {
      if (item.kind !== "device") continue;
      if (item.state !== "in_storage" && item.id !== carryingId) continue;

      const source = item.id === carryingId ? "carried" : "storage";
      const existing = modelCounts.get(item.model);
      if (existing) {
        existing.count++;
      } else {
        modelCounts.set(item.model, { count: 1, itemId: item.id, source });
      }
    }

    if (modelCounts.size === 0) return;

    // Workbench area: left of rack, compact grid
    const benchX = RACK_X + RACK.WIDTH + 20; // Right of rack (temporary until React tray replaces this)
    const benchStartY = RACK_Y + 60;
    const itemSpacing = 44;

    let index = 0;
    for (const [model, { count, itemId, source }] of modelCounts) {
      const y = benchStartY + index * itemSpacing;
      this.createWorkbenchItem(benchX, y, model, count, itemId, source);
      index++;
    }
  }

  private createWorkbenchItem(
    x: number,
    y: number,
    model: string,
    count: number,
    firstItemId: string,
    source: "storage" | "carried" = "storage",
  ) {
    // Map model to device type for texture
    const typeMap: Record<string, string> = {
      server_1u: "server",
      switch_24p: "switch",
      router_1u: "router",
    };
    const deviceType = typeMap[model] ?? "server";
    const textureKey = `device-${deviceType}`;

    const itemW = 72;
    const itemH = 36;
    const container = this.add.container(x, y).setDepth(DEPTH.DEVICES);

    // Device sprite as compact visual (like Uncle Chop items)
    const sprite = this.add
      .image(itemW / 2, itemH / 2, textureKey)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(itemW - 4, 14);
    container.add(sprite);

    // Subtle border
    const border = this.add.graphics();
    border.lineStyle(1, 0x5a4e40, 0.4);
    border.strokeRoundedRect(0, 0, itemW, itemH, 3);
    container.add(border);

    // Count badge (top-right corner)
    if (count > 1) {
      const badgeBg = this.add.graphics();
      badgeBg.fillStyle(0x302820, 0.9);
      badgeBg.fillCircle(itemW - 2, 2, 8);
      container.add(badgeBg);

      const badge = this.add
        .text(itemW - 2, 2, `${count}`, {
          fontSize: "8px",
          color: TEXT_COLORS.accent,
          fontFamily: "'JetBrains Mono', monospace",
          fontStyle: "bold",
        })
        .setOrigin(0.5, 0.5);
      container.add(badge);
    }

    // Hit zone for drag
    const hitZone = this.add
      .zone(x, y, itemW, itemH)
      .setOrigin(0, 0)
      .setDepth(DEPTH.HIT_TARGETS + 3)
      .setInteractive({ useHandCursor: true });

    hitZone.on("pointerover", () => {
      border.clear();
      border.lineStyle(1.5, PALETTE.highlight, 0.7);
      border.strokeRoundedRect(0, 0, itemW, itemH, 3);
      sprite.setAlpha(1);
    });

    hitZone.on("pointerout", () => {
      if (this.draggingDevice) return;
      border.clear();
      border.lineStyle(1, 0x5a4e40, 0.4);
      border.strokeRoundedRect(0, 0, itemW, itemH, 3);
      sprite.setAlpha(0.85);
    });

    hitZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      this.startDrag(firstItemId, model, deviceType, source, pointer);
    });

    this.hitLayer.add(hitZone);
    this.workbenchItems.push(container);
    this.workbenchItems.push(hitZone as unknown as Phaser.GameObjects.Container);
  }

  // ── Drag-to-install ────────────────────────────────────────

  private startDrag(
    itemId: string,
    model: string,
    deviceType: string,
    source: "storage" | "carried",
    pointer: Phaser.Input.Pointer,
  ) {
    const textureKey = `device-${deviceType}`;
    const w = RACK.INNER_WIDTH - 4;
    const h = RACK.SLOT_HEIGHT - 2;

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const sprite = this.add
      .image(worldPoint.x, worldPoint.y, textureKey)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(w, h)
      .setAlpha(0.7)
      .setDepth(DEPTH.EFFECTS + 1);

    this.draggingDevice = {
      itemId, model, uHeight: 1, source, sprite,
      offsetX: 0, offsetY: 0,
    };

    this.dragGhost = this.add.graphics();
    this.dragGhost.setDepth(DEPTH.SLOT_HIGHLIGHTS + 1);
  }

  private startDragFromRack(device: Device, pointer: Phaser.Input.Pointer) {
    this.hideTooltip();
    const textureKey = `device-${device.type}`;
    const w = RACK.INNER_WIDTH - 4;
    const h = device.uHeight * RACK.SLOT_HEIGHT - 2;

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const sprite = this.add
      .image(worldPoint.x, worldPoint.y, textureKey)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(w, h)
      .setAlpha(0.7)
      .setDepth(DEPTH.EFFECTS + 1);

    this.draggingDevice = {
      itemId: "", model: device.model, uHeight: device.uHeight,
      source: "installed", deviceId: device.id,
      sprite, offsetX: 0, offsetY: 0,
    };

    this.dragGhost = this.add.graphics();
    this.dragGhost.setDepth(DEPTH.SLOT_HIGHLIGHTS + 1);
  }

  private getSlotAtPosition(worldY: number): number | null {
    const relY = worldY - RACK_Y - 20;
    const u = Math.round(relY / RACK.SLOT_HEIGHT) + 1;
    if (u < 1 || u > RACK.TOTAL_U) return null;
    return u;
  }

  private isSlotFree(u: number): boolean {
    const state = useGameStore.getState().state;
    if (!state) return false;
    const rackDevices = this.getRackDevices(state);
    for (const device of Object.values(rackDevices)) {
      if (u >= device.slotU && u < device.slotU + device.uHeight) return false;
    }
    return true;
  }

  private cancelDrag() {
    if (!this.draggingDevice) return;
    this.draggingDevice.sprite.destroy();
    this.dragGhost?.destroy();
    this.dragGhost = null;
    this.draggingDevice = null;
    this.lastStateKey = "";
  }

  private handleDragDrop() {
    if (!this.draggingDevice) return;

    const { itemId, source, deviceId } = this.draggingDevice;
    const store = useGameStore.getState();
    const targetU = this.getSlotAtPosition(this.mouseWorldY);
    const isOverRack = this.isMouseOverRack();

    if (source === "installed" && deviceId) {
      // Dragging FROM rack — if dropped outside rack, remove device
      if (!isOverRack) {
        rpcClient.call("removeDevice", { deviceId }).catch(() => {});
      }
      // If dropped back on rack, just cancel (snap back)
    } else if (targetU && this.isSlotFree(targetU) && store.openRackItemId && isOverRack) {
      // Dragging TO rack — install
      if (source === "carried") {
        rpcClient
          .call("installDevice", {
            itemId,
            rackItemId: store.openRackItemId,
            slotU: targetU,
          })
          .catch(() => {});
      } else {
        rpcClient
          .call("installDeviceFromStorage", {
            itemId,
            rackItemId: store.openRackItemId,
            slotU: targetU,
          })
          .catch(() => {});
      }
    }

    // Cleanup
    this.draggingDevice.sprite.destroy();
    this.dragGhost?.destroy();
    this.dragGhost = null;
    this.draggingDevice = null;
    this.lastStateKey = "";
  }

  private isMouseOverRack(): boolean {
    const rackLeft = RACK_X;
    const rackRight = RACK_X + RACK.WIDTH;
    const rackTop = RACK_Y;
    const rackBottom = RACK_Y + RACK.HEIGHT + 40;
    return (
      this.mouseWorldX >= rackLeft &&
      this.mouseWorldX <= rackRight &&
      this.mouseWorldY >= rackTop &&
      this.mouseWorldY <= rackBottom
    );
  }
}
