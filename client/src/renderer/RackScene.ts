import Phaser from "phaser";
import type { GameState, Device, Port, Link, CableType } from "@downtime-ops/shared";
import { useGameStore } from "../store/gameStore";
import { rpcClient } from "../rpc/client";
import { RACK, PORT, PALETTE, TEXT_COLORS } from "./TextureGenerator";
import { emitAudioEvent } from "./AudioEvents";
import { getCableStyle, getCableExitX, drawCablePath, interpolateCablePath, getPulseColor } from "./CablePrefab";
import { PerfMonitor } from "./PerfMonitor";

// ── Layout constants ────────────────────────────────────────
// Game logical resolution: 960×540 (scaled by DPR at runtime)
const GAME_W = 960;
const GAME_H = 540;
const RACK_AREA_W = 576;     // rack occupies left 60% for positioning

// ── Rack art positioning ────────────────────────────────────
// rack-42u-empty.png is 1024×1536 (2:3 ratio)
// Displayed at 400×600 in world space. The image has gray padding around the rack
// body; the camera centers on the rack body and the padding goes off-screen.
const RACK_IMG_W = 400;
const RACK_IMG_H = 600; // 400 * (1536/1024) = 600

// Position the rack image in world space (centered in left 60%)
const RACK_X = Math.round((RACK_AREA_W - RACK_IMG_W) / 2); // ~88
const RACK_Y = 20;

// Inner bay area where devices sit (calibrated to rack-42u-empty.png)
const RACK_BAY_LEFT = 92;     // pixels from rack left edge to inner bay left
const RACK_BAY_WIDTH = 216;   // inner bay width in displayed pixels
const RACK_BAY_TOP = 40;      // pixels from rack top to first slot (U1)
const RACK_BAY_BOTTOM = 572;  // pixels from rack top to last slot bottom (U42)
const RACK_U_HEIGHT = (RACK_BAY_BOTTOM - RACK_BAY_TOP) / RACK.TOTAL_U; // ~12.67 px per U

// ── Zoom bands ──────────────────────────────────────────────
// OVERVIEW is calculated dynamically in setupCameras() to fit the full rack.
// These are the base ratios (before DPR multiplication).
const ZOOM_BANDS = {
  OVERVIEW: 0.85,   // full rack visible (recalculated at runtime)
  HALF: 1.2,        // ~21 U visible
  DEVICE: 2.0,      // ~7 U visible, device-level detail
  PORT: 3.2,        // ~3 U visible, port-level detail
} as const;

const ZOOM_BAND_VALUES = [
  ZOOM_BANDS.OVERVIEW,
  ZOOM_BANDS.HALF,
  ZOOM_BANDS.DEVICE,
  ZOOM_BANDS.PORT,
];

// ── Depth layers ────────────────────────────────────────────
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
  UI: 100,
  DRAG_OVERLAY: 200,
} as const;

// UI panel is handled by the overlay RackUIScene

// ── Animation state types ───────────────────────────────────
type TrafficPulse = {
  linkId: string;
  progress: number;
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
  // ── Camera ──────────────────────────────────────────────
  private rackCam!: Phaser.Cameras.Scene2D.Camera;

  // ── Layer containers ────────────────────────────────────
  private bgLayer!: Phaser.GameObjects.Container;
  private rackLayer!: Phaser.GameObjects.Container;
  private slotLayer!: Phaser.GameObjects.Container;
  private deviceLayer!: Phaser.GameObjects.Container;
  private cableLayer!: Phaser.GameObjects.Container;
  private pulseLayer!: Phaser.GameObjects.Container;
  private previewLayer!: Phaser.GameObjects.Container;
  private effectLayer!: Phaser.GameObjects.Container;
  private hitLayer!: Phaser.GameObjects.Container;

  // ── Rack visuals ────────────────────────────────────────
  private deviceVisuals = new Map<string, DeviceVisual>();
  private portHitZones: PortHitZone[] = [];
  private cableGraphics: Phaser.GameObjects.Graphics | null = null;
  private pulseGraphics: Phaser.GameObjects.Graphics | null = null;
  private previewGraphics: Phaser.GameObjects.Graphics | null = null;
  private effectGraphics: Phaser.GameObjects.Graphics | null = null;
  private tooltip: Phaser.GameObjects.Container | null = null;
  private rackTitle: Phaser.GameObjects.Text | null = null;


  // ── State tracking ──────────────────────────────────────
  private lastStateKey = "";
  private unsubscribe: (() => void) | null = null;
  private dpr = 1;

  // ── Camera pan ──────────────────────────────────────────
  private isPanning = false;
  private panStart = { x: 0, y: 0 };
  private camStart = { x: 0, y: 0 };

  // ── Mouse tracking ──────────────────────────────────────
  private mouseWorldX = 0;
  private mouseWorldY = 0;

  // ── Zoom ────────────────────────────────────────────────
  private zoomTween: Phaser.Tweens.Tween | null = null;

  // ── Double-click detection ──────────────────────────────
  private lastDeviceClickTime = 0;
  private lastDeviceClickId = "";

  // ── Drag from rack (remove device) ─────────────────────
  private draggingDevice: {
    itemId: string;
    model: string;
    uHeight: number;
    source: "storage" | "carried" | "installed";
    deviceId?: string;
    sprite: Phaser.GameObjects.Image;
    offsetX: number;
    offsetY: number;
  } | null = null;
  private isDragStarted = false;
  private dragStartPointer = { x: 0, y: 0 };

  // ── Drag from inventory (install device) ────────────────
  // ── Animation state ─────────────────────────────────────
  private trafficPulses: TrafficPulse[] = [];
  private failureVfx = new Map<string, FailureVfx>();
  private portLedTimers = new Map<string, number>();
  private pendingPlacements: Array<{
    deviceId: string;
    targetY: number;
    startY: number;
    progress: number;
  }> = [];

  // ── Audio change tracking ───────────────────────────────
  private prevDeviceIds = new Set<string>();
  private prevLinkIds = new Set<string>();
  private prevFailedDeviceIds = new Set<string>();
  private prevFailedPortKeys = new Set<string>();

  // ── Performance ─────────────────────────────────────────
  private perfMonitor = new PerfMonitor();

  constructor() {
    super({ key: "RackScene" });
  }

  create() {
    this.dpr = window.devicePixelRatio || 1;

    this.createLayers();
    this.setupCameras();
    this.createRackBackground();
    this.createULabels();
    this.setupInput();

    // Launch the UI overlay scene
    if (!this.scene.isActive("RackUIScene")) {
      this.scene.launch("RackUIScene");
    }

    // Graphics objects for rack area
    this.cableGraphics = this.add.graphics().setDepth(DEPTH.CABLES);
    this.cableLayer.add(this.cableGraphics);

    this.pulseGraphics = this.add.graphics().setDepth(DEPTH.TRAFFIC_PULSES);
    this.pulseLayer.add(this.pulseGraphics);

    this.previewGraphics = this.add.graphics().setDepth(DEPTH.CABLE_PREVIEW);
    this.previewLayer.add(this.previewGraphics);

    this.effectGraphics = this.add.graphics().setDepth(DEPTH.EFFECTS);
    this.effectLayer.add(this.effectGraphics);

    // Subscribe to store
    this.unsubscribe = useGameStore.subscribe((store) => {
      const state = store.state;
      if (!state) return;

      // Rack state key
      const rackDevices = this.getRackDevices(state);
      const stateKey = [
        state.tick,
        store.openRackItemId ?? "",
        Object.keys(rackDevices).length,
        Object.keys(state.links).length,
        store.selectedDeviceId,
        store.cablingFrom?.deviceId ?? "",
        store.cablingFrom?.portIndex ?? "",
        store.placingModel ?? "",
        store.selectedClientId ?? "",
        store.highlightedAlertId ?? "",
        Math.round(this.rackCam.zoom * 100),
        ...Object.values(rackDevices).map(
          (d) => `${d.id}:${d.status}:${d.slotU}`,
        ),
      ].join("|");

      if (stateKey !== this.lastStateKey) {
        this.lastStateKey = stateKey;
        this.detectChangesAndEmitAudio(state);
        this.renderAll(state, store);
        this.syncAnimationState(state);
      }

    });

    // Initial render
    const store = useGameStore.getState();
    if (store.state) {
      this.renderAll(store.state, store);
      this.syncAnimationState(store.state);
      for (const id of Object.keys(store.state.devices))
        this.prevDeviceIds.add(id);
      for (const id of Object.keys(store.state.links))
        this.prevLinkIds.add(id);
    }

    this.scale.on("resize", this.handleResize, this);

    this.events.on("wake", () => {
      this.updateRackTitle();
      this.setupCameras();
      this.lastStateKey = "";
      const s = useGameStore.getState();
      if (s.state) {
        this.renderAll(s.state, s);
        this.syncAnimationState(s.state);
      }
      // Wake the UI overlay
      if (this.scene.isSleeping("RackUIScene")) {
        this.scene.wake("RackUIScene");
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
    this.updateRackDragPreview();
    this.renderCablePreview();
    this.renderAnimatedEffects();
  }

  // ── Layers ────────────────────────────────────────────────

  private createLayers() {
    // Rack layers (visible to rackCam only)
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

  // ── Camera ────────────────────────────────────────────────

  private setupCameras() {
    this.dpr = window.devicePixelRatio || 1;

    // Single full-screen camera
    this.rackCam = this.cameras.main;
    this.rackCam.setBackgroundColor("#1a1410");
    this.rackCam.setViewport(0, 0, GAME_W * this.dpr, GAME_H * this.dpr);

    // Zoom to fit the full rack in the viewport
    const overviewZoom = this.getOverviewZoom();
    const zoom = overviewZoom * this.dpr;
    this.rackCam.setZoom(zoom);

    // Center camera on the rack
    const rackCenterX = RACK_X + RACK_IMG_W / 2;
    const rackCenterY = RACK_Y + RACK_IMG_H / 2;
    this.rackCam.centerOn(rackCenterX, rackCenterY);

    // Bounds allow scrolling with some margin around the rack
    this.rackCam.setBounds(
      RACK_X - 50, RACK_Y - 50,
      RACK_IMG_W + 100, RACK_IMG_H + 100,
    );
  }

  private handleResize() {
    this.setupCameras();
  }

  // ── Rack background ───────────────────────────────────────

  private createRackBackground() {
    const rackKey = this.textures.exists("rack-empty") ? "rack-empty" : "rack-frame";
    const rackImg = this.add.image(RACK_X, RACK_Y, rackKey)
      .setOrigin(0, 0)
      .setDisplaySize(RACK_IMG_W, RACK_IMG_H)
      .setDepth(DEPTH.BACKGROUND);
    this.bgLayer.add(rackImg);

    // Rack title
    this.rackTitle = this.add
      .text(RACK_X + RACK_IMG_W / 2, RACK_Y + 12, "RACK A", {
        fontSize: "10px",
        color: TEXT_COLORS.heading,
        fontStyle: "bold",
        fontFamily: "'Nunito', sans-serif",
      })
      .setOrigin(0.5, 0.5)
      .setResolution(2)
      .setDepth(DEPTH.RACK_FRAME);
    this.rackLayer.add(this.rackTitle);
  }

  // ── U labels ──────────────────────────────────────────────

  private createULabels() {
    for (let u = 1; u <= RACK.TOTAL_U; u++) {
      if (u % 5 === 0 || u === 1) {
        const y = this.slotY(u) + RACK_U_HEIGHT / 2;
        const label = this.add
          .text(RACK_X + RACK_BAY_LEFT - 6, y, `${u}`, {
            fontSize: "7px",
            color: TEXT_COLORS.dim,
            fontFamily: "'JetBrains Mono', monospace",
          })
          .setOrigin(1, 0.5)
          .setResolution(2)
          .setDepth(DEPTH.RACK_FRAME);
        this.rackLayer.add(label);
      }
    }
  }

  // ── Input ─────────────────────────────────────────────────

  private setupInput() {
    // Mouse wheel: zoom rack
    this.input.on(
      "wheel",
      (
        pointer: Phaser.Input.Pointer,
        _gameObjects: unknown[],
        _dx: number,
        _dy: number,
        dz: number,
      ) => {
        const cam = this.rackCam;
        const direction = dz > 0 ? -1 : 1;
        const oldZoom = cam.zoom;
        const minZoom = this.getOverviewZoom() * this.dpr;
        const maxZoom = ZOOM_BANDS.PORT * this.dpr;
        let newZoom = Phaser.Math.Clamp(oldZoom * (1 + direction * 0.15), minZoom, maxZoom);

        // Magnetic snap to bands
        const normalizedZoom = newZoom / this.dpr;
        for (const band of ZOOM_BAND_VALUES) {
          if (Math.abs(normalizedZoom - band) < 0.08) {
            newZoom = band * this.dpr;
            break;
          }
        }

        // Zoom toward cursor
        const worldX = cam.scrollX + pointer.x / oldZoom;
        const worldY = cam.scrollY + pointer.y / oldZoom;
        cam.scrollX = worldX - pointer.x / newZoom;
        cam.scrollY = worldY - pointer.y / newZoom;

        this.animateZoomTo(newZoom, 100);
      },
    );

    // Middle mouse pan
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown()) {
        this.isPanning = true;
        this.panStart.x = pointer.x;
        this.panStart.y = pointer.y;
        this.camStart.x = this.rackCam.scrollX;
        this.camStart.y = this.rackCam.scrollY;
      }
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      // Track mouse world position (for rack area)
      const worldPoint = this.rackCam.getWorldPoint(pointer.x, pointer.y);
      this.mouseWorldX = worldPoint.x;
      this.mouseWorldY = worldPoint.y;

      if (this.isPanning) {
        const dx = (this.panStart.x - pointer.x) / this.rackCam.zoom;
        const dy = (this.panStart.y - pointer.y) / this.rackCam.zoom;
        this.rackCam.scrollX = this.camStart.x + dx;
        this.rackCam.scrollY = this.camStart.y + dy;
      }
    });

    this.input.on("pointerup", () => {
      this.isPanning = false;
      if (this.draggingDevice) {
        this.handleDragDrop();
      }
    });

    // ESC handler
    this.input.keyboard?.on("keydown-ESC", () => {
      const store = useGameStore.getState();

      // Cancel active interactions
      if (this.draggingDevice) { this.cancelDrag(); return; }
      if (store.cablingFrom) { store.cancelCabling(); return; }
      if (store.placingModel) { store.cancelPlacing(); return; }

      // If zoomed in, reset to overview
      const currentZoom = this.rackCam.zoom / this.dpr;
      const overviewZoom = this.getOverviewZoom();
      if (currentZoom > overviewZoom + 0.1) {
        this.animateCameraTo(
          RACK_X + RACK_IMG_W / 2,
          RACK_Y + RACK_IMG_H / 2,
          overviewZoom * this.dpr,
        );
        return;
      }

      // Exit rack scene
      store.closeRack();
      this.scene.sleep("RackUIScene");
      this.scene.sleep("RackScene");
      this.scene.wake("WorldScene");
    });

    // Right-click cancel
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        if (this.draggingDevice) this.cancelDrag();
        const store = useGameStore.getState();
        if (store.cablingFrom) store.cancelCabling();
        if (store.placingModel) store.cancelPlacing();
      }
    });

    this.game.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // ── Zoom helpers ──────────────────────────────────────────

  private getOverviewZoom(): number {
    const margin = 20;
    const fitZoomX = RACK_AREA_W / (RACK_IMG_W + margin);
    const fitZoomY = GAME_H / (RACK_IMG_H + margin);
    return Math.min(fitZoomX, fitZoomY);
  }

  private animateZoomTo(targetZoom: number, duration = 200) {
    this.zoomTween?.stop();
    this.zoomTween = this.tweens.add({
      targets: this.rackCam,
      zoom: targetZoom,
      duration,
      ease: "Quad.easeOut",
    });
  }

  public animateCameraTo(
    centerX: number, centerY: number, zoom: number, duration = 300,
  ) {
    this.zoomTween?.stop();
    const vpW = Math.round(GAME_W * this.dpr);
    const vpH = Math.round(GAME_H * this.dpr);
    const targetScrollX = centerX - (vpW / zoom) / 2;
    const targetScrollY = centerY - (vpH / zoom) / 2;

    this.zoomTween = this.tweens.add({
      targets: this.rackCam,
      scrollX: targetScrollX,
      scrollY: targetScrollY,
      zoom,
      duration,
      ease: "Quad.easeOut",
    });
  }

  // ── Coordinate helpers ────────────────────────────────────

  private slotY(u: number): number {
    return RACK_Y + RACK_BAY_TOP + (u - 1) * RACK_U_HEIGHT;
  }

  private deviceX(): number {
    return RACK_X + RACK_BAY_LEFT + 2;
  }

  private updateRackTitle() {
    const rackId = this.getOpenRackId();
    const state = useGameStore.getState().state;
    if (rackId && state?.racks[rackId] && this.rackTitle) {
      this.rackTitle.setText(state.racks[rackId].name.toUpperCase());
    }
  }

  public getOpenRackId(): string | null {
    const store = useGameStore.getState();
    const state = store.state;
    if (!state) return null;
    if (!store.openRackItemId) return Object.keys(state.racks)[0] ?? null;
    const rackItem = state.world.items[store.openRackItemId];
    return rackItem?.installedInRackId ?? null;
  }

  private getRackDevices(state: GameState): Record<string, Device> {
    const rackId = this.getOpenRackId();
    if (!rackId) return {};
    const result: Record<string, Device> = {};
    for (const [id, device] of Object.entries(state.devices)) {
      if (device.rackId === rackId) result[id] = device;
    }
    return result;
  }

  // ── Audio event detection ─────────────────────────────────

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

    for (const id of currentDeviceIds) {
      if (!this.prevDeviceIds.has(id)) {
        emitAudioEvent("device_place", { deviceId: id });
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
    for (const id of this.prevDeviceIds) {
      if (!currentDeviceIds.has(id)) emitAudioEvent("device_remove", { deviceId: id });
    }
    for (const id of currentLinkIds) {
      if (!this.prevLinkIds.has(id)) emitAudioEvent("cable_connect", { linkId: id });
    }
    for (const id of this.prevLinkIds) {
      if (!currentLinkIds.has(id)) emitAudioEvent("cable_disconnect", { linkId: id });
    }
    for (const id of currentFailedDeviceIds) {
      if (!this.prevFailedDeviceIds.has(id))
        emitAudioEvent("device_fail", { deviceId: id });
    }
    for (const id of this.prevFailedDeviceIds) {
      if (!currentFailedDeviceIds.has(id) && currentDeviceIds.has(id))
        emitAudioEvent("device_recover", { deviceId: id });
    }
    for (const key of currentFailedPortKeys) {
      if (!this.prevFailedPortKeys.has(key))
        emitAudioEvent("port_fail", { portKey: key });
    }
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

  // ── Full render ───────────────────────────────────────────

  private renderAll(
    state: GameState,
    store: ReturnType<typeof useGameStore.getState>,
  ) {
    this.renderDevices(state, store);
    this.renderCables(state, store);
  }

  // ── Sync animation state ──────────────────────────────────

  private syncAnimationState(state: GameState) {
    const activeLinkIds = new Set<string>();
    for (const link of Object.values(state.links)) {
      if (link.status !== "cut" && link.currentLoadMbps > 0) {
        activeLinkIds.add(link.id);
      }
    }

    this.trafficPulses = this.trafficPulses.filter((p) =>
      activeLinkIds.has(p.linkId),
    );

    for (const link of Object.values(state.links)) {
      if (!activeLinkIds.has(link.id)) continue;

      const utilization =
        link.maxBandwidthMbps > 0
          ? link.currentLoadMbps / link.maxBandwidthMbps
          : 0;

      const targetCount = Math.max(1, Math.ceil(utilization * 4));
      const existing = this.trafficPulses.filter(
        (p) => p.linkId === link.id,
      ).length;

      const color = getPulseColor(utilization);

      for (let i = existing; i < targetCount; i++) {
        this.trafficPulses.push({
          linkId: link.id,
          progress: i / targetCount,
          speed: 0.3 + utilization * 0.7,
          color,
        });
      }

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

  // ── Animation updates (per frame) ─────────────────────────

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

      if (vfx.flickerTimer > 0.1 + Math.random() * 0.2) {
        vfx.flickerTimer = 0;
        vfx.visible = Math.random() > 0.3;
      }
    }
  }

  private updatePlacementAnimations(dt: number) {
    for (const anim of this.pendingPlacements) {
      anim.progress = Math.min(1, anim.progress + dt * 4);
    }

    for (const anim of this.pendingPlacements) {
      const visual = this.deviceVisuals.get(anim.deviceId);
      if (!visual) continue;

      if (anim.progress < 1) {
        const t = anim.progress;
        const ease = 1 - Math.pow(1 - t, 3);
        const bounce = t < 0.8 ? ease : ease + Math.sin((t - 0.8) * Math.PI * 5) * 0.01 * (1 - t);
        const y = anim.startY + (anim.targetY - anim.startY) * bounce;
        visual.container.setY(y);
      } else {
        visual.container.setY(anim.targetY);
      }
    }

    this.pendingPlacements = this.pendingPlacements.filter(
      (a) => a.progress < 1,
    );
  }

  private updateRackDragPreview() {
    if (!this.draggingDevice) return;
    this.draggingDevice.sprite.setPosition(this.mouseWorldX, this.mouseWorldY);
  }

  // ── Animated rendering (per frame) ────────────────────────

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

      const exitX = getCableExitX(RACK_X + RACK_IMG_W, posA.y, posB.y);
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
      const w = RACK_BAY_WIDTH - 4;
      const h = device.uHeight * RACK_U_HEIGHT - 2;

      if (!vfx.visible) {
        this.effectGraphics.fillStyle(PALETTE.portDown, 0.15);
        this.effectGraphics.fillRect(x, y, w, h);
      }

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

      const flashAlpha = 0.2 + Math.sin(this.time.now * 0.006) * 0.15;
      this.effectGraphics.lineStyle(1.5, PALETTE.portDown, flashAlpha);
      this.effectGraphics.strokeRect(x - 1, y - 1, w + 2, h + 2);
    }

    for (const device of Object.values(this.getRackDevices(state))) {
      for (const port of device.ports) {
        if (port.status !== "down") continue;
        const pos = this.getPortWorldPos(device, port.index);
        if (!pos) continue;

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
    const state = useGameStore.getState().state;
    if (!state) return;

    for (const device of Object.values(this.getRackDevices(state))) {
      for (const port of device.ports) {
        if (!port.linkId) continue;
        const key = port.id;
        const phase = (this.portLedTimers.get(key) ?? Math.random() * 6.28) + 0.05;
        this.portLedTimers.set(key, phase);
      }
    }
  }

  // ── Device rendering ──────────────────────────────────────

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

    // Destroy tooltip
    this.tooltip?.destroy();
    this.tooltip = null;

    // Determine highlighted devices
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
        device, state, selected, highlighted, store,
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
    const h = device.uHeight * RACK_U_HEIGHT - 2;
    const w = RACK_BAY_WIDTH - 4;

    const container = this.add.container(x, y);
    container.setDepth(DEPTH.DEVICES);
    this.deviceLayer.add(container);

    // Progressive detail based on zoom
    const currentZoom = this.rackCam.zoom / this.dpr;
    const showLabels = currentZoom > 1.4;
    const showPorts = currentZoom > 2.1;

    // Device body
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

    const sprite = this.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setVisible(false);
    container.add(sprite);

    if (selected) {
      body.lineStyle(1.5, PALETTE.deviceSelected, 0.8);
      body.strokeRoundedRect(0, 0, w, h, 2);
    }

    if (highlighted) {
      body.lineStyle(1.5, PALETTE.highlight, 0.6);
      body.strokeRoundedRect(-1, -1, w + 2, h + 2, 2);
    }

    // Status LED
    const statusLed = this.add.graphics();
    this.drawStatusLed(statusLed, device, w - 10, h / 2);
    container.add(statusLed);

    // Labels at zoom > 1.4
    if (showLabels) {
      const label = this.add
        .text(8, h / 2, device.name, {
          fontSize: "7px",
          color: TEXT_COLORS.primary,
          fontFamily: "'Nunito', sans-serif",
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);
      container.add(label);
    }

    // Ports at zoom > 2.1
    if (showPorts) {
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

      // Double-click → zoom to device
      if (
        this.lastDeviceClickId === device.id &&
        now - this.lastDeviceClickTime < 300
      ) {
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

    // Ensure UI cam doesn't see rack objects

    return { container, sprite, hitZone };
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
      const glowPulse = 0.15 + Math.sin(this.time.now * 0.002) * 0.05;
      g.fillStyle(color, glowPulse);
      g.fillCircle(x, y, 4);
    }

    g.fillStyle(color, 1);
    g.fillCircle(x, y, 2);
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(x - 0.5, y - 0.5, 0.8);
  }

  // ── Tooltip ───────────────────────────────────────────────

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

    const padding = 6;
    const lineHeight = 12;
    const textWidth = 120;
    const bgHeight = lines.length * lineHeight + padding * 2;

    const container = this.add.container(x, y).setDepth(DEPTH.TOOLTIPS);

    const bg = this.add.graphics();
    bg.fillStyle(0x302820, 0.95);
    bg.fillRoundedRect(0, 0, textWidth + padding * 2, bgHeight, 4);
    bg.lineStyle(1, 0x5a4e40, 0.8);
    bg.strokeRoundedRect(0, 0, textWidth + padding * 2, bgHeight, 4);
    container.add(bg);

    for (let i = 0; i < lines.length; i++) {
      const isTitle = i === 0;
      const text = this.add.text(
        padding,
        padding + i * lineHeight,
        lines[i],
        {
          fontSize: isTitle ? "8px" : "7px",
          color: isTitle ? TEXT_COLORS.primary : TEXT_COLORS.muted,
          fontFamily: isTitle ? "'Nunito', sans-serif" : "'JetBrains Mono', monospace",
          fontStyle: isTitle ? "bold" : "normal",
        },
      );
      container.add(text);
    }

    this.tooltip = container;
  }

  private hideTooltip() {
    this.tooltip?.destroy();
    this.tooltip = null;
  }

  // ── Port rendering + interaction ──────────────────────────

  private createPorts(
    container: Phaser.GameObjects.Container,
    device: Device,
    h: number,
    state: GameState,
    store: ReturnType<typeof useGameStore.getState>,
  ) {
    // Scaled port constants for narrower devices
    const portStartX = 30;
    const portSpacing = Math.min(PORT.SPACING, (RACK_BAY_WIDTH - 60) / Math.min(device.ports.length, 24));
    const portRadius = 3;
    const portHitRadius = 8;

    const maxVisible = Math.min(device.ports.length, 24);
    const cablingFrom = store.cablingFrom;
    const isCabling = !!cablingFrom;
    const isSourceDevice = cablingFrom?.deviceId === device.id;

    for (let i = 0; i < maxVisible; i++) {
      const port = device.ports[i];
      const px = portStartX + i * portSpacing;
      const py = h / 2;

      // Port sprite
      const portKey = this.getPortTextureKey(port);
      const portImg = this.add.image(px, py, portKey)
        .setScale(portRadius / PORT.RADIUS);
      container.add(portImg);

      // Connected overlay + blinking LED
      if (port.linkId) {
        const connImg = this.add.image(px, py, "port-connected")
          .setScale(portRadius / PORT.RADIUS);
        container.add(connImg);

        const link = state.links[port.linkId];
        if (link && link.currentLoadMbps > 0) {
          const ledG = this.add.graphics();
          const phase = this.portLedTimers.get(port.id) ?? 0;
          const blinkAlpha = 0.3 + Math.sin(phase) * 0.3;
          ledG.fillStyle(PALETTE.portUp, blinkAlpha);
          ledG.fillCircle(px, py - portRadius - 2, 1);
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
          sourceG.lineStyle(1.5, PALETTE.highlight, 1);
          sourceG.strokeCircle(px, py, portRadius + 2);
          container.add(sourceG);
        } else if (isValidTarget) {
          const targetG = this.add.graphics();
          targetG.lineStyle(1, PALETTE.portUp, 0.6);
          targetG.strokeCircle(px, py, portRadius + 1.5);
          container.add(targetG);
        }
      }

      // Port hit zone
      const worldX = this.deviceX() + px;
      const worldY = this.slotY(device.slotU) + 1 + py;

      const portZone = this.add
        .zone(worldX, worldY, portHitRadius * 2, portHitRadius * 2)
        .setDepth(DEPTH.HIT_TARGETS + 1)
        .setInteractive({ useHandCursor: true });

      portZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (!pointer.leftButtonDown()) return;
        this.handlePortClick(device, port, i, state);
      });

      portZone.on("pointerover", () => {
        portImg.setScale((portRadius / PORT.RADIUS) * 1.3);
      });
      portZone.on("pointerout", () => {
        portImg.setScale(portRadius / PORT.RADIUS);
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
          portStartX + 24 * portSpacing + 4,
          h / 2,
          `+${device.ports.length - 24}`,
          {
            fontSize: "6px",
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

  // ── Cable preview ─────────────────────────────────────────

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
      RACK_X + RACK_IMG_W + 20 + Math.abs(sourcePos.y - this.mouseWorldY) * 0.25,
      RACK_X + RACK_IMG_W + 100,
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
    this.previewGraphics.fillCircle(sourcePos.x, sourcePos.y, 3);
  }

  // ── Cable rendering ───────────────────────────────────────

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
    const exitX = getCableExitX(RACK_X + RACK_IMG_W, posA.y, posB.y);
    drawCablePath(this.cableGraphics, posA, posB, exitX, style);
  }

  private getPortWorldPos(
    device: Device,
    portIndex: number,
  ): { x: number; y: number } | null {
    if (portIndex >= device.ports.length) return null;
    const portSpacing = Math.min(PORT.SPACING, (RACK_BAY_WIDTH - 60) / Math.min(device.ports.length, 24));
    const x = this.deviceX() + 30 + portIndex * portSpacing;
    const h = device.uHeight * RACK_U_HEIGHT - 2;
    const y = this.slotY(device.slotU) + 1 + h / 2;
    return { x, y };
  }

  // ── Drag-to-remove (from rack) ────────────────────────────

  private startDragFromRack(device: Device, pointer: Phaser.Input.Pointer) {
    this.hideTooltip();
    const textureKey = `device-${device.type}`;
    const w = RACK_BAY_WIDTH - 4;
    const h = device.uHeight * RACK_U_HEIGHT - 2;

    const worldPoint = this.rackCam.getWorldPoint(pointer.x, pointer.y);
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
  }

  public getSlotAtPosition(worldY: number): number | null {
    const relY = worldY - RACK_Y - RACK_BAY_TOP;
    const u = Math.round(relY / RACK_U_HEIGHT) + 1;
    if (u < 1 || u > RACK.TOTAL_U) return null;
    return u;
  }

  public isSlotFree(u: number): boolean {
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
    this.draggingDevice = null;
    this.lastStateKey = "";
  }

  private handleDragDrop() {
    if (!this.draggingDevice) return;

    const { source, deviceId } = this.draggingDevice;

    if (source === "installed" && deviceId) {
      if (!this.isMouseOverRack()) {
        rpcClient.call("removeDevice", { deviceId }).catch(() => {});
      }
    }

    this.draggingDevice.sprite.destroy();
    this.draggingDevice = null;
    this.lastStateKey = "";
  }

  private isMouseOverRack(): boolean {
    const rackLeft = RACK_X + RACK_BAY_LEFT;
    const rackRight = RACK_X + RACK_BAY_LEFT + RACK_BAY_WIDTH;
    const rackTop = RACK_Y + RACK_BAY_TOP;
    const rackBottom = RACK_Y + RACK_BAY_BOTTOM;
    return (
      this.mouseWorldX >= rackLeft &&
      this.mouseWorldX <= rackRight &&
      this.mouseWorldY >= rackTop &&
      this.mouseWorldY <= rackBottom
    );
  }
}
