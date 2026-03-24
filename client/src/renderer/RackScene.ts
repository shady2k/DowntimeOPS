import Phaser from "phaser";
import type { GameState, Device, Port, Link, CableType } from "@downtime-ops/shared";
import { useGameStore } from "../store/gameStore";
import { useBrowserStore } from "../ui/browser/browserStore";
import { rpcClient } from "../rpc/client";
import { RACK, PALETTE, TEXT_COLORS } from "./TextureGenerator";
import { AssetRegistry } from "../assets/AssetRegistry";
import { emitAudioEvent } from "./AudioEvents";
import { getCableStyle, drawCablePath, drawCablePreview, getPulseColor } from "./CablePrefab";
import { PerfMonitor } from "./PerfMonitor";
import { buildRackDeviceVisual, getDeviceFaceGeometry } from "./DeviceVisualFactory";

// ── Layout constants ────────────────────────────────────────
// Game logical resolution: 960×540 (scaled by DPR at runtime)
const GAME_H = 540;
const RACK_AREA_W = 576;     // rack occupies left 60% for positioning
const ZOOM_BTN_W = 54;
const ZOOM_BTN_H = 16;
const ZOOM_BTN_X = RACK_AREA_W - ZOOM_BTN_W - 6;
const ZOOM_BTN_Y = 6;
const SCROLL_BTN_W = 26;
const SCROLL_BTN_H = 16;
const SCROLL_UP_BTN_X = ZOOM_BTN_X - SCROLL_BTN_W - 4;
const SCROLL_DOWN_BTN_X = SCROLL_UP_BTN_X - SCROLL_BTN_W - 4;
const SCROLL_BTN_Y = ZOOM_BTN_Y;

// Desired display height for the rack image (px, at logical resolution)
const RACK_DISPLAY_H = 510;

// ── Zoom bands ──────────────────────────────────────────────
// OVERVIEW is calculated dynamically in setupCameras() to fit the full rack.
// These are the base ratios (before DPR multiplication).
// Two zoom modes: full rack visible, or zoomed so rack fills viewport width

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
  sprite?: Phaser.GameObjects.Image;
  hitZone: Phaser.GameObjects.Zone;
};

type PortHitZone = {
  zone: Phaser.GameObjects.Zone;
  debug?: Phaser.GameObjects.Graphics;
  deviceId: string;
  portIndex: number;
  worldX: number;
  worldY: number;
};

type ConsoleHitZone = {
  zone: Phaser.GameObjects.Zone;
  debug?: Phaser.GameObjects.Graphics;
  deviceId: string;
  worldX: number;
  worldY: number;
};

type RackLayout = {
  imgW: number;
  imgH: number;
  x: number;
  y: number;
  bayLeft: number;
  bayWidth: number;
  bayTop: number;
  bayBottom: number;
  uHeight: number;
  labelX: number;
};

export class RackScene extends Phaser.Scene {
  // ── Rack layout (derived from texture + JSON descriptor in create()) ──
  private rl!: RackLayout;

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
  private consoleHitZones: ConsoleHitZone[] = [];
  private cableGraphics: Phaser.GameObjects.Graphics | null = null;
  private pulseGraphics: Phaser.GameObjects.Graphics | null = null;
  private previewGraphics: Phaser.GameObjects.Graphics | null = null;
  private effectGraphics: Phaser.GameObjects.Graphics | null = null;
  private tooltip: Phaser.GameObjects.Container | null = null;
  private portTooltip: Phaser.GameObjects.Container | null = null;
  private lastHoveredPortKey = "";
  private hoveredDeviceId: string | null = null;
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

  // ── Drag from rack (remove/move device) ─────────────────
  private draggingDevice: {
    itemId: string;
    model: string;
    uHeight: number;
    source: "storage" | "carried" | "installed";
    deviceId?: string;
    sourceSlotU?: number;
    sprite: Phaser.GameObjects.Image;
    offsetX: number;
    offsetY: number;
  } | null = null;
  private isDragStarted = false;
  private dragStartPointer = { x: 0, y: 0 };

  // ── Slot-drop preview ────────────────────────────────────
  private slotHighlightGraphics: Phaser.GameObjects.Graphics | null = null;
  private externalDragHighlightU: number | null = null;  // set by inventory drag

  // ── Pan guard ────────────────────────────────────────────
  private blockPan = false;  // set by device/port hitZone, checked by global pointerdown

  // ── Drag from inventory (install device) ────────────────
  // ── Animation state ─────────────────────────────────────
  private trafficPulses: TrafficPulse[] = [];
  private failureVfx = new Map<string, FailureVfx>();
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

  // ── Debug ──────────────────────────────────────────────
  private showDebugZones = false;

  // ── Performance ─────────────────────────────────────────
  private perfMonitor = new PerfMonitor();

  constructor() {
    super({ key: "RackScene" });
  }

  create() {
    this.dpr = window.devicePixelRatio || 1;
    this.rl = this.buildLayout();

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

    this.slotHighlightGraphics = this.add.graphics().setDepth(DEPTH.SLOT_HIGHLIGHTS);
    this.slotLayer.add(this.slotHighlightGraphics);

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
    this.updateRackTitle();
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

    this.rackCam = this.cameras.main;
    this.rackCam.setBackgroundColor("#1a1410");
    this.rackCam.setViewport(0, 0, Math.round(RACK_AREA_W * this.dpr), Math.round(GAME_H * this.dpr));
    this.rackCam.setBounds(
      0,
      this.rl.y - 24,
      RACK_AREA_W,
      this.rl.imgH + 48,
    );

    const { scrollX, scrollY } = this.getOverviewCameraState();
    this.rackCam.setZoom(this.getOverviewZoom());
    this.rackCam.setScroll(scrollX, scrollY);
  }

  private handleResize() {
    const wasCloseUp = this.rackCam ? this.isCloseUp() : false;
    const currentCenterY = this.rackCam
      ? this.rackCam.scrollY + this.getViewportWorldSize(this.rackCam.zoom).height / 2
      : this.rl.y + this.rl.imgH / 2;

    this.setupCameras();

    if (wasCloseUp) {
      const { scrollX, scrollY } = this.getCloseUpCameraState(currentCenterY);
      this.rackCam.setZoom(this.getCloseUpZoom());
      this.rackCam.setScroll(scrollX, scrollY);
      this.events.emit("zoomChanged");
    }
  }

  // ── Rack background ───────────────────────────────────────

  private createRackBackground() {
    const rackImg = this.add.image(this.rl.x, this.rl.y, "rack-empty")
      .setOrigin(0, 0)
      .setDisplaySize(this.rl.imgW, this.rl.imgH)
      .setDepth(DEPTH.BACKGROUND);
    this.bgLayer.add(rackImg);

    // Rack title
    this.rackTitle = this.add
      .text(this.rl.x + this.rl.imgW / 2, this.rl.y + 12, "RACK A", {
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
    const labelX = this.rl.labelX;
    for (let u = 1; u <= RACK.TOTAL_U; u++) {
      if (u % 5 === 0 || u === 1) {
        const y = this.slotY(u) + this.rl.uHeight / 2;
        const label = this.add
          .text(labelX, y, `${u}`, {
            fontSize: "7px",
            color: TEXT_COLORS.muted,
            fontFamily: "'JetBrains Mono', monospace",
          })
          .setOrigin(0.5, 0.5)
          .setResolution(2)
          .setDepth(DEPTH.RACK_FRAME);
        this.rackLayer.add(label);
      }
    }
  }

  // ── Input ─────────────────────────────────────────────────

  private lastBgTapTime = 0;

  private setupInput() {
    // Track mouse world position + drag-to-pan in close-up
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const worldPoint = this.rackCam.getWorldPoint(pointer.x, pointer.y);
      this.mouseWorldX = worldPoint.x;
      this.mouseWorldY = worldPoint.y;

      if (this.isPanning && !this.draggingDevice) {
        // Vertical scroll only in close-up mode, not while dragging a device
        const dy = (this.panStart.y - pointer.y) / this.rackCam.zoom;
        const clamped = this.clampScrollToRack(this.rackCam.scrollX, this.camStart.y + dy, this.rackCam.zoom);
        this.rackCam.scrollY = clamped.scrollY;
      }

      // Port hover tooltip — only in close-up mode
      if (this.isCloseUp()) {
        const hitPort = this.findPortAtWorld(worldPoint.x, worldPoint.y);
        const portKey = hitPort ? `${hitPort.deviceId}:${hitPort.portIndex}` : "";
        if (portKey !== this.lastHoveredPortKey) {
          this.lastHoveredPortKey = portKey;
          this.hidePortTooltip();
          if (hitPort) {
            const state = useGameStore.getState().state;
            if (state) {
              const device = state.devices[hitPort.deviceId];
              if (device) {
                this.showPortTooltip(device, device.ports[hitPort.portIndex], hitPort.portIndex, hitPort.worldX, hitPort.worldY, state);
              }
            }
          }
        }
      } else if (this.lastHoveredPortKey) {
        this.lastHoveredPortKey = "";
        this.hidePortTooltip();
      }
    });

    // Left-click: check ports first, then pan/zoom
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      if (this.isPointerOverOverlayButtons(pointer)) return;

      // Manual hit-testing — zones don't reliably receive input through zoomed cameras
      const worldPoint = this.rackCam.getWorldPoint(pointer.x, pointer.y);

      // Console port check first — opens browser
      const hitConsole = this.findConsoleAtWorld(worldPoint.x, worldPoint.y);
      if (hitConsole) {
        this.blockPan = true;
        useBrowserStore.getState().openBrowser("console", hitConsole.deviceId);
        return;
      }

      const hitPort = this.findPortAtWorld(worldPoint.x, worldPoint.y);
      if (hitPort) {
        this.blockPan = true;
        const freshStore = useGameStore.getState();
        const freshState = freshStore.state;
        if (freshState) {
          const freshDevice = freshState.devices[hitPort.deviceId];
          if (freshDevice) {
            const freshPort = freshDevice.ports[hitPort.portIndex];
            if (freshPort) {
              this.handlePortClick(freshDevice, freshPort, hitPort.portIndex, freshState);
              return;
            }
          }
        }
      }

      // Double-click detection → toggle zoom
      const now = this.time.now;
      if (now - this.lastBgTapTime < 300) {
        this.toggleZoom(worldPoint.y);
        this.lastBgTapTime = 0;
        this.blockPan = false;
        return;
      }
      this.lastBgTapTime = now;

      // Start drag-to-pan only if not clicking on a device/port and not in cabling mode
      const wasPanBlocked = this.blockPan;
      this.blockPan = false;
      const store = useGameStore.getState();
      if (this.isCloseUp() && !wasPanBlocked && !store.cablingFrom) {
        this.isPanning = true;
        this.panStart.x = pointer.x;
        this.panStart.y = pointer.y;
        this.camStart.x = this.rackCam.scrollX;
        this.camStart.y = this.rackCam.scrollY;
      }
    });

    this.input.on("pointerup", () => {
      this.isPanning = false;
      if (this.draggingDevice) {
        this.handleDragDrop();
      }
    });

    // Mouse wheel: scroll rack vertically in close-up mode
    this.input.on("wheel", (
      _pointer: Phaser.Input.Pointer,
      _gameObjects: unknown[],
      _dx: number, dy: number, _dz: number,
    ) => {
      if (!this.isCloseUp()) return;
      const nextScrollY = this.rackCam.scrollY + dy * 0.5 / (this.rackCam.zoom / this.dpr);
      const clamped = this.clampScrollToRack(this.rackCam.scrollX, nextScrollY, this.rackCam.zoom);
      this.rackCam.scrollY = clamped.scrollY;
    });

    // ESC: cancel interactions → zoom out → exit
    this.input.keyboard?.on("keydown-ESC", () => {
      const store = useGameStore.getState();
      if (this.draggingDevice) { this.cancelDrag(); return; }
      if (store.cablingFrom) { store.cancelCabling(); return; }
      if (store.placingModel) { store.cancelPlacing(); return; }

      if (this.isCloseUp()) {
        this.zoomToOverview();
        return;
      }

      store.closeRack();
      this.scene.sleep("RackUIScene");
      this.scene.sleep("RackScene");
      this.scene.wake("WorldScene");
    });

    // F1: toggle debug hit zone overlays
    this.input.keyboard?.on("keydown-F1", (e: KeyboardEvent) => {
      e.preventDefault();
      this.showDebugZones = !this.showDebugZones;
      for (const phz of this.portHitZones) {
        phz.debug?.setVisible(this.showDebugZones);
      }
      for (const chz of this.consoleHitZones) {
        chz.debug?.setVisible(this.showDebugZones);
      }
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

  private isPointerOverOverlayButtons(pointer: Phaser.Input.Pointer): boolean {
    const px = pointer.x / this.dpr;
    const py = pointer.y / this.dpr;
    const inRect = (x: number, y: number, w: number, h: number) =>
      px >= x && px <= x + w && py >= y && py <= y + h;

    return (
      inRect(ZOOM_BTN_X, ZOOM_BTN_Y, ZOOM_BTN_W, ZOOM_BTN_H) ||
      inRect(SCROLL_UP_BTN_X, SCROLL_BTN_Y, SCROLL_BTN_W, SCROLL_BTN_H) ||
      inRect(SCROLL_DOWN_BTN_X, SCROLL_BTN_Y, SCROLL_BTN_W, SCROLL_BTN_H)
    );
  }

  // ── Zoom helpers ──────────────────────────────────────────

  private getOverviewZoom(): number {
    const marginX = 24;
    const marginY = 24;
    const fitZoomX = this.rackCam.width / (this.rl.imgW + marginX * 2);
    const fitZoomY = this.rackCam.height / (this.rl.imgH + marginY * 2);
    return Math.min(fitZoomX, fitZoomY);
  }

  private getCloseUpZoom(): number {
    const horizontalPadding = 4;
    return this.rackCam.width / (this.rl.bayWidth + horizontalPadding * 2);
  }

  private getViewportWorldSize(zoom: number) {
    return {
      width: this.rackCam.width / zoom,
      height: this.rackCam.height / zoom,
    };
  }

  private clampScrollToRack(scrollX: number, scrollY: number, zoom: number) {
    const marginX = 12;
    const marginY = 12;
    const { width, height } = this.getViewportWorldSize(zoom);

    const clampAxis = (start: number, size: number, viewportSize: number, margin: number, value: number) => {
      const min = start - margin;
      const max = start + size + margin - viewportSize;
      if (min <= max) return Phaser.Math.Clamp(value, min, max);
      return start + size / 2 - viewportSize / 2;
    };

    return {
      scrollX: clampAxis(this.rl.x, this.rl.imgW, width, marginX, scrollX),
      scrollY: clampAxis(this.rl.y, this.rl.imgH, height, marginY, scrollY),
    };
  }

  private getOverviewCameraState() {
    const zoom = this.getOverviewZoom();
    const { width, height } = this.getViewportWorldSize(zoom);
    const scrollX = this.rl.x + this.rl.imgW / 2 - width / 2;
    const scrollY = this.rl.y + this.rl.imgH / 2 - height / 2;
    return this.clampScrollToRack(scrollX, scrollY, zoom);
  }

  private getCloseUpCameraState(focusY?: number) {
    const zoom = this.getCloseUpZoom();
    const horizontalPadding = 4;
    const topPadding = 4;
    const { height } = this.getViewportWorldSize(zoom);
    const scrollX = this.rl.x + this.rl.bayLeft - horizontalPadding;
    const scrollY = focusY !== undefined
      ? focusY - height / 2
      : this.rl.y - topPadding;
    return this.clampScrollToRack(scrollX, scrollY, zoom);
  }

  private getCameraCenterFromScroll(scrollX: number, scrollY: number, zoom: number) {
    const { width, height } = this.getViewportWorldSize(zoom);
    return {
      centerX: scrollX + width / 2,
      centerY: scrollY + height / 2,
    };
  }

  public isCloseUp(): boolean {
    return this.rackCam.zoom > this.getOverviewZoom() * 1.1;
  }

  public getUHeight(): number {
    return this.rl.uHeight;
  }

  /** Returns one "page" height in world units at close-up zoom. */
  public getPageScrollDelta(): number {
    const zoom = this.isCloseUp() ? this.rackCam.zoom : this.getCloseUpZoom();
    return (this.rackCam.height / zoom) * 0.85;
  }

  /** Called by inventory drag (RackUIScene) to show slot preview highlight. */
  public showDragSlotPreview(screenX: number, screenY: number): void {
    const worldPoint = this.rackCam.getWorldPoint(screenX, screenY);
    const targetU = this.getSlotAtPosition(worldPoint.y);
    if (targetU && this.isSlotFree(targetU)) {
      this.externalDragHighlightU = targetU;
    } else {
      this.externalDragHighlightU = null;
    }
  }

  public clearDragSlotPreview(): void {
    this.externalDragHighlightU = null;
    this.slotHighlightGraphics?.clear();
  }

  public scrollBy(deltaWorldY: number) {
    if (!this.rackCam) return;
    // Auto-zoom in if in overview — page scroll implies the user wants close-up
    if (!this.isCloseUp()) {
      this.toggleZoom();
      // After zoom tween starts, queue the scroll via a delayed call
      this.time.delayedCall(350, () => this.scrollBy(deltaWorldY));
      return;
    }
    const clamped = this.clampScrollToRack(
      this.rackCam.scrollX,
      this.rackCam.scrollY + deltaWorldY,
      this.rackCam.zoom,
    );
    const tweenState = { scrollY: this.rackCam.scrollY };
    this.zoomTween?.stop();
    this.zoomTween = this.tweens.add({
      targets: tweenState,
      scrollY: clamped.scrollY,
      duration: 180,
      ease: "Quad.easeOut",
      onUpdate: () => {
        this.rackCam.scrollY = tweenState.scrollY;
      },
      onComplete: () => {
        this.rackCam.scrollY = clamped.scrollY;
      },
    });
  }

  public pageScroll(direction: -1 | 1) {
    if (!this.rackCam) return;

    if (!this.isCloseUp()) {
      const zoom = this.getCloseUpZoom();
      const { scrollX, scrollY } = this.getCloseUpCameraState();
      this.rackCam.setZoom(zoom);
      this.rackCam.setScroll(scrollX, scrollY);
      this.events.emit("zoomChanged");
    }

    const currentTop = this.rackCam.worldView.y;
    const viewportHeight = this.rackCam.worldView.height;
    const marginY = 12;
    const minY = this.rl.y - marginY;
    const maxY = this.rl.y + this.rl.imgH + marginY - viewportHeight;
    const targetTop = Phaser.Math.Clamp(
      currentTop + viewportHeight * 0.85 * direction,
      minY,
      maxY,
    );
    this.zoomTween?.stop();
    this.isPanning = false;
    this.rackCam.centerOn(this.rackCam.worldView.centerX, targetTop + viewportHeight / 2);
  }

  /** Toggle between overview and close-up. When zooming in, snap to the clicked U-slot. */
  public toggleZoom(worldY?: number) {
    if (this.isCloseUp()) {
      this.zoomToOverview();
    } else {
      let focusY: number | undefined;
      if (worldY !== undefined) {
        const relY = worldY - this.rl.y - this.rl.bayTop;
        const u = Math.max(1, Math.min(RACK.TOTAL_U, Math.floor(relY / this.rl.uHeight) + 1));
        focusY = this.slotY(u) + this.rl.uHeight / 2;
      }

      const zoom = this.getCloseUpZoom();
      const { scrollX, scrollY } = this.getCloseUpCameraState(focusY);
      this.animateCameraTo(scrollX, scrollY, zoom);
    }
  }

  private zoomToOverview() {
    const zoom = this.getOverviewZoom();
    const { scrollX, scrollY } = this.getOverviewCameraState();
    this.animateCameraTo(scrollX, scrollY, zoom);
  }

  public animateCameraTo(
    scrollX: number, scrollY: number, zoom: number, duration = 300,
  ) {
    this.zoomTween?.stop();
    this.isPanning = false;
    const clamped = this.clampScrollToRack(scrollX, scrollY, zoom);
    const startZoom = this.rackCam.zoom;
    const startCenter = this.getCameraCenterFromScroll(
      this.rackCam.scrollX,
      this.rackCam.scrollY,
      this.rackCam.zoom,
    );
    const targetCenter = this.getCameraCenterFromScroll(clamped.scrollX, clamped.scrollY, zoom);
    const tweenState = { t: 0 };

    this.zoomTween = this.tweens.add({
      targets: tweenState,
      t: 1,
      duration,
      ease: "Quad.easeOut",
      onUpdate: () => {
        const nextZoom = Phaser.Math.Linear(startZoom, zoom, tweenState.t);
        const nextCenterX = Phaser.Math.Linear(startCenter.centerX, targetCenter.centerX, tweenState.t);
        const nextCenterY = Phaser.Math.Linear(startCenter.centerY, targetCenter.centerY, tweenState.t);
        const { width, height } = this.getViewportWorldSize(nextZoom);
        const next = this.clampScrollToRack(
          nextCenterX - width / 2,
          nextCenterY - height / 2,
          nextZoom,
        );
        this.rackCam.setZoom(nextZoom);
        this.rackCam.centerOn(next.scrollX + width / 2, next.scrollY + height / 2);
      },
      onComplete: () => {
        this.rackCam.setZoom(zoom);
        const targetCenter = this.getCameraCenterFromScroll(clamped.scrollX, clamped.scrollY, zoom);
        this.rackCam.centerOn(targetCenter.centerX, targetCenter.centerY);
        this.events.emit("zoomChanged");
      },
    });
  }

  // ── Coordinate helpers ────────────────────────────────────

  private slotY(u: number): number {
    return this.rl.y + this.rl.bayTop + (u - 1) * this.rl.uHeight;
  }

  private deviceX(): number {
    return this.rl.x + this.rl.bayLeft + 2;
  }

  private buildLayout(): RackLayout {
    const rackKey = "rack-empty";
    const src = this.textures.get(rackKey).getSourceImage() as HTMLImageElement;
    const desc = AssetRegistry.getRack("rack-42u");

    const imgH = RACK_DISPLAY_H;
    const imgW = Math.round(imgH * (src.width / src.height));
    const x = Math.round((RACK_AREA_W - imgW) / 2);
    const y = Math.round((GAME_H - imgH) / 2);

    const bayLeft   = Math.round(imgW * (desc?.bay.left   ?? 0.066));
    const bayRight  = Math.round(imgW * (desc?.bay.right  ?? 0.935));
    const bayTop    = Math.round(imgH * (desc?.bay.top    ?? 0.029));
    const bayBottom = Math.round(imgH * (desc?.bay.bottom ?? 0.974));
    const bayWidth  = bayRight - bayLeft;
    const totalU    = desc?.totalU ?? RACK.TOTAL_U;
    const uHeight   = (bayBottom - bayTop) / totalU;
    const labelX    = x + Math.round((desc?.uLabelX ?? 0.034) * imgW);

    return { imgW, imgH, x, y, bayLeft, bayWidth, bayTop, bayBottom, uHeight, labelX };
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
    this.slotHighlightGraphics?.clear();

    if (!this.draggingDevice) {
      // Draw external (inventory) drag preview if active
      if (this.externalDragHighlightU !== null) {
        this.drawSlotHighlight(this.externalDragHighlightU);
      }
      return;
    }

    this.draggingDevice.sprite.setPosition(this.mouseWorldX, this.mouseWorldY);

    if (this.isMouseOverRack()) {
      const targetU = this.getSlotAtPosition(this.mouseWorldY);
      if (targetU) {
        const isFree = this.isSlotFreeExcluding(targetU, this.draggingDevice.deviceId);
        if (isFree) {
          this.drawSlotHighlight(targetU, true);
        } else if (targetU !== this.draggingDevice.sourceSlotU) {
          this.drawSlotHighlight(targetU, false);
        }
      }
    }
  }

  private drawSlotHighlight(u: number, valid = true) {
    if (!this.slotHighlightGraphics) return;
    const x = this.deviceX();
    const y = this.slotY(u);
    const w = this.rl.bayWidth - 4;
    const h = this.rl.uHeight - 2;
    const color = valid ? 0x44ff99 : 0xff4444;
    this.slotHighlightGraphics.fillStyle(color, 0.18);
    this.slotHighlightGraphics.fillRect(x, y, w, h);
    this.slotHighlightGraphics.lineStyle(1, color, 0.7);
    this.slotHighlightGraphics.strokeRect(x, y, w, h);
  }

  // ── Animated rendering (per frame) ────────────────────────

  private renderAnimatedEffects() {
    this.renderTrafficPulses();
    this.renderFailureEffects();
  }

  private renderTrafficPulses() {
    if (!this.pulseGraphics) return;
    this.pulseGraphics.clear();

    const state = useGameStore.getState().state;
    if (!state) return;

    // Traffic pulse circles removed — orange port LEDs are sufficient
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
      const w = this.rl.bayWidth - 4;
      const h = device.uHeight * this.rl.uHeight - 2;

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
    for (const phz of this.portHitZones) {
      phz.zone.destroy();
      phz.debug?.destroy();
    }
    this.portHitZones = [];

    // Destroy old console hit zones
    for (const chz of this.consoleHitZones) {
      chz.zone.destroy();
      chz.debug?.destroy();
    }
    this.consoleHitZones = [];

    // Destroy tooltip (will re-show after rebuild if device still hovered)
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

    // Re-show device tooltip if a device was hovered before rebuild
    if (this.hoveredDeviceId && rackDevices[this.hoveredDeviceId]) {
      const device = rackDevices[this.hoveredDeviceId];
      const x = this.deviceX();
      const y = this.slotY(device.slotU) + 1;
      const w = this.rl.bayWidth - 4;
      this.showTooltip(device, state, x + w + 8, y);
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
    const h = device.uHeight * this.rl.uHeight - 2;
    const w = this.rl.bayWidth - 4;

    const container = this.add.container(x, y);
    container.setDepth(DEPTH.DEVICES);
    this.deviceLayer.add(container);

    // Progressive detail based on zoom
    const showPorts = this.isCloseUp();

    const builtVisual = buildRackDeviceVisual(this, device, state, w, h);
    container.add(builtVisual.container);
    const sprite = builtVisual.sprite;

    // Selection / highlight borders always drawn on top
    if (highlighted) {
      const border = this.add.graphics();
      border.lineStyle(1.5, PALETTE.highlight, 0.6);
      border.strokeRoundedRect(-1, -1, w + 2, h + 2, 2);
      container.add(border);
    }

    if (showPorts || device.ports.length > 0) {
      this.createPortHitZones(container, device, h, state, store);
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

      // Block background pan — device click should not start panning
      this.blockPan = true;

      // During cabling mode, device zone should not interfere — let port zones handle it
      if (store.cablingFrom) return;

      // Double-click → toggle zoom centered on device
      if (
        this.lastDeviceClickId === device.id &&
        now - this.lastDeviceClickTime < 300
      ) {
        this.toggleZoom(y + h / 2);
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
      this.hoveredDeviceId = device.id;
      this.showTooltip(device, state, x + w + 8, y);
    });
    hitZone.on("pointerout", () => {
      this.hoveredDeviceId = null;
      this.hideTooltip();
    });

    this.hitLayer.add(hitZone);

    // Ensure UI cam doesn't see rack objects

    return { container, sprite, hitZone };
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

    // Tooltip is inverse-scaled so content sizes are in screen pixels
    const invZoom = 1 / this.rackCam.zoom;
    const padding = 10;
    const lineHeight = 20;
    const bgHeight = lines.length * lineHeight + padding * 2;

    // Create text objects first to measure max width
    const textObjs: Phaser.GameObjects.Text[] = [];
    let maxTextW = 0;
    for (let i = 0; i < lines.length; i++) {
      const isTitle = i === 0;
      const text = this.add.text(
        padding,
        padding + i * lineHeight,
        lines[i],
        {
          fontSize: isTitle ? "14px" : "12px",
          color: isTitle ? TEXT_COLORS.primary : TEXT_COLORS.muted,
          fontFamily: isTitle ? "'Nunito', sans-serif" : "'JetBrains Mono', monospace",
          fontStyle: isTitle ? "bold" : "normal",
        },
      );
      textObjs.push(text);
      maxTextW = Math.max(maxTextW, text.width);
    }

    const bgWidth = maxTextW + padding * 2;

    const container = this.add.container(x, y).setDepth(DEPTH.TOOLTIPS);
    container.setScale(invZoom);

    const bg = this.add.graphics();
    bg.fillStyle(0x302820, 0.95);
    bg.fillRoundedRect(0, 0, bgWidth, bgHeight, 4);
    bg.lineStyle(1, 0x5a4e40, 0.8);
    bg.strokeRoundedRect(0, 0, bgWidth, bgHeight, 4);
    container.add(bg);

    for (const text of textObjs) {
      container.add(text);
    }

    this.tooltip = container;
  }

  private hideTooltip() {
    this.tooltip?.destroy();
    this.tooltip = null;
  }

  private showPortTooltip(
    device: Device,
    port: Port,
    portIndex: number,
    worldX: number,
    worldY: number,
    state: GameState,
  ) {
    this.hidePortTooltip();

    // Port label
    const isRouter = device.type === "router";
    const portLabel = isRouter && portIndex === 0 ? "WAN" : `eth${portIndex}`;

    const lines: string[] = [`${device.name} — ${portLabel}`];
    lines.push(`Status: ${port.status.toUpperCase()}`);

    if (port.linkId) {
      const link = state.links[port.linkId];
      if (link) {
        const otherId = link.portA.deviceId === device.id ? link.portB.deviceId : link.portA.deviceId;
        const otherDev = state.devices[otherId];
        lines.push(`Connected to: ${otherDev?.name || otherId}`);
        if (link.currentLoadMbps > 0) {
          lines.push(`Load: ${link.currentLoadMbps.toFixed(0)}/${link.maxBandwidthMbps} Mbps`);
        }
      }
    } else {
      lines.push("No cable");
    }

    if (port.status === "down") {
      lines.push("Click to repair");
    } else if (!port.linkId && port.status === "up") {
      if (isRouter && portIndex === 0) {
        lines.push("Click to connect ISP uplink");
      } else {
        lines.push("Click to start cabling");
      }
    }

    // Tooltip is inverse-scaled so content sizes are in screen pixels
    const invZoom = 1 / this.rackCam.zoom;
    const padding = 10;
    const lineHeight = 20;
    const bgHeight = lines.length * lineHeight + padding * 2;

    // Create text objects first to measure max width
    const textObjs: Phaser.GameObjects.Text[] = [];
    let maxTextW = 0;
    for (let i = 0; i < lines.length; i++) {
      const isTitle = i === 0;
      const isAction = i === lines.length - 1 && (lines[i].startsWith("Click"));
      const text = this.add.text(
        padding,
        padding + i * lineHeight,
        lines[i],
        {
          fontSize: isTitle ? "14px" : "12px",
          color: isAction ? "#e8a840" : isTitle ? TEXT_COLORS.primary : TEXT_COLORS.muted,
          fontFamily: isTitle ? "'Nunito', sans-serif" : "'JetBrains Mono', monospace",
          fontStyle: isTitle ? "bold" : "normal",
        },
      );
      textObjs.push(text);
      maxTextW = Math.max(maxTextW, text.width);
    }

    const bgWidth = maxTextW + padding * 2;

    // Offset in world space: small gap next to port, then shift up by scaled tooltip height
    const tipX = worldX + 4;
    const tipY = worldY - bgHeight * invZoom - 2;

    const container = this.add.container(tipX, tipY).setDepth(DEPTH.TOOLTIPS);
    container.setScale(invZoom);

    const bg = this.add.graphics();
    bg.fillStyle(0x302820, 0.95);
    bg.fillRoundedRect(0, 0, bgWidth, bgHeight, 4);
    bg.lineStyle(1, 0x5a4e40, 0.8);
    bg.strokeRoundedRect(0, 0, bgWidth, bgHeight, 4);
    container.add(bg);

    for (const text of textObjs) {
      container.add(text);
    }

    this.portTooltip = container;
  }

  private hidePortTooltip() {
    this.portTooltip?.destroy();
    this.portTooltip = null;
  }

  // ── Port rendering + interaction ──────────────────────────

  private createPortHitZones(
    container: Phaser.GameObjects.Container,
    device: Device,
    h: number,
    state: GameState,
    store: ReturnType<typeof useGameStore.getState>,
  ) {
    const devW = this.rl.bayWidth - 4;
    const geometry = getDeviceFaceGeometry(device);
    const maxVisible = Math.min(device.ports.length, geometry.ports.length);
    const deviceDesc = AssetRegistry.getDevice(device.model);
    const portHitFraction = deviceDesc?.portLayout.portHitRadius ?? 0.5;
    const portHitRadius = portHitFraction * h;
    const cablingFrom = store.cablingFrom;
    const isCabling = !!cablingFrom;
    const isSourceDevice = cablingFrom?.deviceId === device.id;

    for (let i = 0; i < maxVisible; i++) {
      const port = device.ports[i];
      const portGeom = geometry.ports[i];
      const px = portGeom.x * devW;
      const portBodyY = portGeom.y * h;

      // ── Cabling mode highlights ──
      if (isCabling) {
        const isSource = isSourceDevice && cablingFrom.portIndex === i;
        const isValidTarget = !isSourceDevice && !port.linkId && port.status === "up";

        if (isSource) {
          const g = this.add.graphics();
          g.lineStyle(0.4, PALETTE.highlight, 0.9);
          g.strokeCircle(px, portBodyY, 1.2);
          container.add(g);
        } else if (isValidTarget) {
          const g = this.add.graphics();
          g.lineStyle(0.3, PALETTE.portUp, 0.6);
          g.strokeCircle(px, portBodyY, 1.0);
          container.add(g);
        }
      }

      // ── Hit zone (sized for comfortable clicking) ──
      const worldX = this.deviceX() + px;
      const worldY = this.slotY(device.slotU) + 1 + portBodyY;

      // Port hit zone — placed at scene root (not in container) for reliable input
      const zoneSize = portHitRadius * 2;
      const portZone = this.add
        .zone(worldX, worldY, zoneSize, zoneSize)
        .setDepth(DEPTH.DRAG_OVERLAY)
        .setInteractive({ useHandCursor: true });


      // Input is handled via manual hit-testing in the global pointerdown handler.
      // Zone is kept for cursor styling only.

      // Debug overlay — toggled with F1
      const dbg = this.add.graphics().setDepth(DEPTH.DRAG_OVERLAY + 1);
      dbg.lineStyle(0.3, 0xff00ff, 0.6);
      dbg.strokeRect(worldX - portHitRadius, worldY - portHitRadius, zoneSize, zoneSize);
      dbg.fillStyle(0xff00ff, 0.8);
      dbg.fillCircle(worldX, worldY, 0.4);
      dbg.setVisible(this.showDebugZones);

      this.portHitZones.push({
        zone: portZone,
        debug: dbg,
        deviceId: device.id,
        portIndex: i,
        worldX,
        worldY,
      });
    }

    // ── Console port hit zone ──
    if (geometry.consolePort) {
      const conX = geometry.consolePort.x * devW;
      const conY = geometry.consolePort.y * h;
      const conWorldX = this.deviceX() + conX;
      const conWorldY = this.slotY(device.slotU) + 1 + conY;
      const conSize = portHitRadius * 2.2; // slightly larger than network ports

      const conZone = this.add
        .zone(conWorldX, conWorldY, conSize, conSize)
        .setDepth(DEPTH.DRAG_OVERLAY)
        .setInteractive({ useHandCursor: true });

      const conDbg = this.add.graphics().setDepth(DEPTH.DRAG_OVERLAY + 1);
      conDbg.lineStyle(0.3, 0x00ffff, 0.6);
      conDbg.strokeRect(conWorldX - conSize / 2, conWorldY - conSize / 2, conSize, conSize);
      conDbg.fillStyle(0x00ffff, 0.8);
      conDbg.fillCircle(conWorldX, conWorldY, 0.4);
      conDbg.setVisible(this.showDebugZones);

      this.consoleHitZones.push({
        zone: conZone,
        debug: conDbg,
        deviceId: device.id,
        worldX: conWorldX,
        worldY: conWorldY,
      });
    }
  }

  /** Find a port hit zone at the given world coordinates */
  private findPortAtWorld(wx: number, wy: number): PortHitZone | null {
    for (const phz of this.portHitZones) {
      const dx = Math.abs(wx - phz.worldX);
      const dy = Math.abs(wy - phz.worldY);
      const halfSize = phz.zone.width / 2;
      if (dx <= halfSize && dy <= halfSize) {
        return phz;
      }
    }
    return null;
  }

  /** Find a console port hit zone at the given world coordinates */
  private findConsoleAtWorld(wx: number, wy: number): ConsoleHitZone | null {
    for (const chz of this.consoleHitZones) {
      const dx = Math.abs(wx - chz.worldX);
      const dy = Math.abs(wy - chz.worldY);
      const halfSize = chz.zone.width / 2;
      if (dx <= halfSize && dy <= halfSize) {
        return chz;
      }
    }
    return null;
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
      if (port.linkId) {
        console.warn(`[cable] target port ${device.id}:p${portIndex} already connected`);
        return;
      }

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
        .then(() => {
          console.log(`[cable] connected ${source.deviceId}:p${source.portIndex} → ${device.id}:p${portIndex}`);
        })
        .catch((err: unknown) => {
          console.error("[cable] connectPorts failed:", err);
        });

      store.cancelCabling();
    } else if (port.linkId) {
      // Unplug this end — disconnect the link and start cabling from the other end
      const state = useGameStore.getState().state;
      const link = state?.links[port.linkId];
      if (link) {
        // Find the other end of the cable
        const isPortA =
          link.portA.deviceId === device.id && link.portA.portIndex === portIndex;
        const otherEnd = isPortA ? link.portB : link.portA;

        rpcClient
          .call("disconnectPorts", { linkId: port.linkId } as never)
          .then(() => {
            // Start cabling from the other end so the user can re-route
            store.startCabling({
              deviceId: otherEnd.deviceId,
              portIndex: otherEnd.portIndex,
            });
          })
          .catch(() => {});
      }
    } else if (port.status === "up") {
      // Special case: clicking router WAN port (port 0) auto-connects ISP uplink
      if (device.type === "router" && portIndex === 0) {
        const state = useGameStore.getState().state;
        const hasUplinkHere = state?.uplinks.some((u) => u.deviceId === device.id);
        if (!hasUplinkHere) {
          rpcClient
            .call("connectUplink", { deviceId: device.id, portIndex: 0 })
            .then(() => {
              console.log(`[uplink] connected ISP to ${device.id} WAN port`);
            })
            .catch((err: unknown) => {
              console.error("[uplink] connectUplink failed:", err);
            });
          return;
        }
      }
      store.startCabling({ deviceId: device.id, portIndex });
    } else if (port.status === "down") {
      rpcClient
        .call("repairPort", { deviceId: device.id, portIndex })
        .catch(() => {});
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

    const bayRight = this.rl.x + this.rl.bayLeft + this.rl.bayWidth;
    drawCablePreview(
      this.previewGraphics,
      sourcePos,
      this.mouseWorldX,
      this.mouseWorldY,
      bayRight,
      this.time.now,
    );
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

    // Collect links from this rack's devices' ports
    const rackDevices = this.getRackDevices(state);
    const rackLinkIds = new Set<string>();
    for (const device of Object.values(rackDevices)) {
      for (const port of device.ports) {
        if (port.linkId) rackLinkIds.add(port.linkId);
      }
    }

    for (const linkId of rackLinkIds) {
      const link = state.links[linkId];
      if (link) {
        this.renderSingleCable(state, link, highlightedLinkIds.has(link.id));
      }
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

    // ISP demarc device (rackId="") — use fixed anchor at top-left of rack frame
    const posA = devA.rackId === ""
      ? { x: this.rl.x + this.rl.bayLeft - 8, y: this.rl.y + 20 }
      : this.getPortWorldPos(devA, link.portA.portIndex);
    const posB = devB.rackId === ""
      ? { x: this.rl.x + this.rl.bayLeft - 8, y: this.rl.y + 20 }
      : this.getPortWorldPos(devB, link.portB.portIndex);
    if (!posA || !posB) return;

    const utilization =
      link.maxBandwidthMbps > 0
        ? link.currentLoadMbps / link.maxBandwidthMbps
        : 0;

    const bayRight = this.rl.x + this.rl.bayLeft + this.rl.bayWidth;
    const style = getCableStyle(utilization, link.status, isHighlighted, this.time.now, link.type);
    drawCablePath(this.cableGraphics, posA, posB, bayRight, style);
  }

  private getPortWorldPos(
    device: Device,
    portIndex: number,
  ): { x: number; y: number } | null {
    if (portIndex >= device.ports.length) return null;
    const geometry = getDeviceFaceGeometry(device);
    const portGeom = geometry.ports[portIndex];
    if (!portGeom) return null;

    const w = this.rl.bayWidth - 4;
    const h = device.uHeight * this.rl.uHeight - 2;
    return {
      x: this.deviceX() + portGeom.x * w,
      y: this.slotY(device.slotU) + 1 + portGeom.y * h,
    };
  }

  // ── Drag-to-remove (from rack) ────────────────────────────

  private startDragFromRack(device: Device, pointer: Phaser.Input.Pointer) {
    this.hideTooltip();
    const textureKey = `device-${device.type}`;
    const w = this.rl.bayWidth - 4;
    const h = device.uHeight * this.rl.uHeight - 2;
    const itemId = this.getInstalledItemIdForDevice(device);
    if (!itemId) return;

    const worldPoint = this.rackCam.getWorldPoint(pointer.x, pointer.y);
    const sprite = this.add
      .image(worldPoint.x, worldPoint.y, textureKey)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(w, h)
      .setAlpha(0.7)
      .setDepth(DEPTH.EFFECTS + 1);


    this.draggingDevice = {
      itemId, model: device.model, uHeight: device.uHeight,
      source: "installed", deviceId: device.id, sourceSlotU: device.slotU,
      sprite, offsetX: 0, offsetY: 0,
    };
  }

  private getInstalledItemIdForDevice(device: Device): string | null {
    const state = useGameStore.getState().state;
    if (!state) return null;

    for (const [itemId, item] of Object.entries(state.world.items)) {
      if (
        item.kind === "device" &&
        item.state === "installed" &&
        item.model === device.model &&
        item.installedInRackId === device.rackId &&
        item.installedAtSlotU === device.slotU
      ) {
        return itemId;
      }
    }

    return null;
  }

  public getSlotAtPosition(worldY: number): number | null {
    const relY = worldY - this.rl.y - this.rl.bayTop;
    const u = Math.round(relY / this.rl.uHeight) + 1;
    if (u < 1 || u > RACK.TOTAL_U) return null;
    return u;
  }

  public isSlotFree(u: number): boolean {
    return this.isSlotFreeExcluding(u, undefined);
  }

  private isSlotFreeExcluding(u: number, excludeDeviceId: string | undefined): boolean {
    const state = useGameStore.getState().state;
    if (!state) return false;
    const rackDevices = this.getRackDevices(state);
    for (const device of Object.values(rackDevices)) {
      if (device.id === excludeDeviceId) continue;
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

    const { source, deviceId, itemId, sourceSlotU } = this.draggingDevice;

    if (source === "installed" && deviceId) {
      if (this.isMouseOverRack()) {
        const targetU = this.getSlotAtPosition(this.mouseWorldY);
        const isFree = targetU ? this.isSlotFreeExcluding(targetU, deviceId) : false;
        if (targetU && isFree && targetU !== sourceSlotU) {
          // Move to new slot: uninstall then re-install from storage
          const store = useGameStore.getState();
          const rackItemId = store.openRackItemId;
          if (rackItemId) {
            rpcClient.call("uninstallDevice", { deviceId })
              .then(() => rpcClient.call("installDeviceFromStorage", { itemId, rackItemId, slotU: targetU }))
              .catch(() => {});
          }
        }
        // else: dropped back in same slot — do nothing
      } else {
        // Dragged outside rack → uninstall to storage
        rpcClient.call("uninstallDevice", { deviceId }).catch(() => {});
      }
    }

    this.draggingDevice.sprite.destroy();
    this.draggingDevice = null;
    this.slotHighlightGraphics?.clear();
    this.lastStateKey = "";
  }

  private isMouseOverRack(): boolean {
    const rackLeft = this.rl.x + this.rl.bayLeft;
    const rackRight = this.rl.x + this.rl.bayLeft + this.rl.bayWidth;
    const rackTop = this.rl.y + this.rl.bayTop;
    const rackBottom = this.rl.y + this.rl.bayBottom;
    return (
      this.mouseWorldX >= rackLeft &&
      this.mouseWorldX <= rackRight &&
      this.mouseWorldY >= rackTop &&
      this.mouseWorldY <= rackBottom
    );
  }
}
