import Phaser from "phaser";
import { useGameStore } from "../store/gameStore";
import { rpcClient } from "../rpc/client";
import { RACK, PALETTE, TEXT_COLORS } from "./TextureGenerator";
import type { RackScene } from "./RackScene";

// Layout constants (in logical coords — 960×540)
const PANEL_X = 576; // right 40% starts here
// Zoom button (positioned top-right of rack area)
const ZOOM_BTN_W = 54;
const ZOOM_BTN_H = 16;
const ZOOM_BTN_X = PANEL_X - ZOOM_BTN_W - 6;
const ZOOM_BTN_Y = 6;
const PANEL_W = 384; // 960 - 576
const PANEL_H = 540;
const CARD_H = 52;
const CARD_GAP = 4;
const CARD_MARGIN = 12;
const HEADER_H = 40;
const ECONOMY_H = 36;
const SCROLL_AREA_TOP = HEADER_H + ECONOMY_H + 8;
const SCROLL_AREA_H = PANEL_H - SCROLL_AREA_TOP - 8;

// Model → display info (client-side mapping)
const MODEL_INFO: Record<string, { name: string; type: string; uHeight: number; ports: number }> = {
  server_1u: { name: "1U Server", type: "server", uHeight: 1, ports: 4 },
  switch_24p: { name: "24-Port Switch", type: "switch", uHeight: 1, ports: 24 },
  router_1u: { name: "Router", type: "router", uHeight: 1, ports: 4 },
};

type InventoryEntry = {
  model: string;
  count: number;
  firstItemId: string;
};

export class RackUIScene extends Phaser.Scene {
  private dpr = 1;
  private panelBg: Phaser.GameObjects.Graphics | null = null;
  private headerText: Phaser.GameObjects.Text | null = null;
  private economyText: Phaser.GameObjects.Text | null = null;
  private scrollContainer: Phaser.GameObjects.Container | null = null;
  private scrollMask: Phaser.Display.Masks.GeometryMask | null = null;
  private scrollOffset = 0;
  private maxScroll = 0;
  private cardObjects: Phaser.GameObjects.Container[] = [];

  // Drag state
  private dragging: {
    itemId: string;
    model: string;
    sprite: Phaser.GameObjects.Image;
    originX: number;
    originY: number;
  } | null = null;

  private zoomBtnBg: Phaser.GameObjects.Graphics | null = null;
  private zoomBtnLabel: Phaser.GameObjects.Text | null = null;

  private unsubscribe: (() => void) | null = null;
  private lastStateKey = "";

  constructor() {
    super({ key: "RackUIScene" });
  }

  create() {
    this.dpr = window.devicePixelRatio || 1;

    // Fixed camera — no zoom/pan, same pattern as UIScene
    const cam = this.cameras.main;
    cam.setZoom(this.dpr);
    cam.setBounds(0, 0, 960, 540);
    cam.centerOn(480, 270);

    this.createPanel();
    this.createZoomButton();
    this.setupInput();

    // Subscribe to store for inventory changes
    this.unsubscribe = useGameStore.subscribe((store) => {
      const state = store.state;
      if (!state) return;

      const items = state.world?.items;
      if (!items) return;

      // Compute a state key for inventory changes
      const invKey = Object.values(items)
        .filter((i) => i.kind === "device" && (i.state === "in_storage" || i.state === "carried"))
        .map((i) => `${i.model}:${i.state}`)
        .sort()
        .join("|") + `|$${state.money}|cs${state.world.cableStock.cat6}`;

      if (invKey === this.lastStateKey) return;
      this.lastStateKey = invKey;

      this.updateInventory();
      this.updateEconomy();
    });

    // Initial render
    const store = useGameStore.getState();
    if (store.state) {
      this.updateInventory();
      this.updateEconomy();
    }

    // Hook up zoom change events from RackScene
    this.time.delayedCall(0, () => {
      const rs = this.scene.get("RackScene") as RackScene | null;
      rs?.events.on("zoomChanged", this.updateZoomBtn, this);
      this.updateZoomBtn();
    });

    // Force refresh on wake
    this.events.on("wake", () => {
      this.lastStateKey = "";
      this.updateZoomBtn();
      const s = useGameStore.getState();
      if (s.state) {
        this.updateInventory();
        this.updateEconomy();
      }
    });
  }

  shutdown() {
    this.unsubscribe?.();
  }

  private createZoomButton() {
    const cx = ZOOM_BTN_X + ZOOM_BTN_W / 2;
    const cy = ZOOM_BTN_Y + ZOOM_BTN_H / 2;

    this.zoomBtnBg = this.add.graphics();
    this.zoomBtnLabel = this.add
      .text(cx, cy, "ZOOM IN", {
        fontSize: "8px",
        color: TEXT_COLORS.muted,
        fontFamily: "'JetBrains Mono', monospace",
      })
      .setOrigin(0.5, 0.5)
      .setResolution(2);

    this.drawZoomBtn(0x252010);

    const zone = this.add
      .zone(cx, cy, ZOOM_BTN_W, ZOOM_BTN_H)
      .setInteractive({ useHandCursor: true });

    zone.on("pointerover", () => this.drawZoomBtn(0x3a3020));
    zone.on("pointerout", () => this.drawZoomBtn(0x252010));
    zone.on("pointerdown", () => {
      const rs = this.scene.get("RackScene") as RackScene | null;
      rs?.toggleZoom();
    });
  }

  private drawZoomBtn(bgColor: number) {
    if (!this.zoomBtnBg) return;
    this.zoomBtnBg.clear();
    this.zoomBtnBg.fillStyle(bgColor, 0.9);
    this.zoomBtnBg.fillRoundedRect(ZOOM_BTN_X, ZOOM_BTN_Y, ZOOM_BTN_W, ZOOM_BTN_H, 3);
    this.zoomBtnBg.lineStyle(1, 0x4a4030, 0.7);
    this.zoomBtnBg.strokeRoundedRect(ZOOM_BTN_X, ZOOM_BTN_Y, ZOOM_BTN_W, ZOOM_BTN_H, 3);
  }

  private updateZoomBtn() {
    if (!this.zoomBtnLabel) return;
    const rs = this.scene.get("RackScene") as RackScene | null;
    if (!rs) return;
    const zoomed = rs.isCloseUp();
    this.zoomBtnLabel.setText(zoomed ? "ZOOM OUT" : "ZOOM IN");
    this.zoomBtnLabel.setColor(zoomed ? TEXT_COLORS.heading : TEXT_COLORS.muted);
  }

  private createPanel() {
    // Panel background
    this.panelBg = this.add.graphics();
    this.panelBg.fillStyle(0x1e1814, 0.95);
    this.panelBg.fillRect(PANEL_X, 0, PANEL_W, PANEL_H);
    // Left border
    this.panelBg.lineStyle(1, 0x3a3020, 0.6);
    this.panelBg.lineBetween(PANEL_X, 0, PANEL_X, PANEL_H);

    // Header
    this.headerText = this.add
      .text(PANEL_X + PANEL_W / 2, 16, "INVENTORY", {
        fontSize: "12px",
        color: TEXT_COLORS.heading,
        fontFamily: "'Nunito', sans-serif",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0.5)
      .setResolution(2);

    // Economy widget
    this.economyText = this.add
      .text(PANEL_X + CARD_MARGIN, HEADER_H + 4, "", {
        fontSize: "10px",
        color: TEXT_COLORS.success,
        fontFamily: "'JetBrains Mono', monospace",
        fontStyle: "bold",
      })
      .setResolution(2);

    // Scrollable container for inventory cards
    this.scrollContainer = this.add.container(PANEL_X + CARD_MARGIN, SCROLL_AREA_TOP);

    // Create scroll mask (hidden — only used as a geometry mask shape)
    const maskShape = this.add.graphics();
    maskShape.setVisible(false);
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(
      PANEL_X + CARD_MARGIN,
      SCROLL_AREA_TOP,
      PANEL_W - CARD_MARGIN * 2,
      SCROLL_AREA_H,
    );
    this.scrollMask = maskShape.createGeometryMask();
    this.scrollContainer.setMask(this.scrollMask);
  }

  private setupInput() {
    // Scroll wheel over inventory panel
    this.input.on(
      "wheel",
      (
        pointer: Phaser.Input.Pointer,
        _gameObjects: unknown[],
        _dx: number,
        _dy: number,
        dz: number,
      ) => {
        // Only scroll if pointer is over the panel
        const px = pointer.x / this.dpr;
        if (px < PANEL_X) return;

        this.scrollOffset = Phaser.Math.Clamp(
          this.scrollOffset + dz * 0.5,
          0,
          Math.max(0, this.maxScroll),
        );
        if (this.scrollContainer) {
          this.scrollContainer.setY(SCROLL_AREA_TOP - this.scrollOffset);
        }
      },
    );

    // Drag handling
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      const wx = pointer.x / this.dpr;
      const wy = pointer.y / this.dpr;
      this.dragging.sprite.setPosition(wx, wy);
    });

    this.input.on("pointerup", () => {
      if (!this.dragging) return;
      this.handleDrop();
    });
  }

  private updateEconomy() {
    const state = useGameStore.getState().state;
    if (!state || !this.economyText) return;

    const { money, world } = state;
    const cs = world.cableStock;
    const moneyStr = money >= 10_000 ? `$${(money / 1000).toFixed(0)}K` : `$${money.toLocaleString()}`;
    this.economyText.setText(
      `${moneyStr}  Cat6:${cs.cat6}  Cat6a:${cs.cat6a}  Fiber:${cs.om3_fiber}  SM:${cs.os2_fiber}`,
    );
  }

  private updateInventory() {
    // Clear old cards
    for (const card of this.cardObjects) card.destroy();
    this.cardObjects = [];

    const state = useGameStore.getState().state;
    if (!state || !this.scrollContainer) return;

    // Group items by model
    const modelCounts = new Map<string, InventoryEntry>();
    for (const item of Object.values(state.world.items)) {
      if (item.kind !== "device") continue;
      if (item.state !== "in_storage" && item.state !== "carried") continue;

      const existing = modelCounts.get(item.model);
      if (existing) {
        existing.count++;
      } else {
        modelCounts.set(item.model, { model: item.model, count: 1, firstItemId: item.id });
      }
    }

    const cardW = PANEL_W - CARD_MARGIN * 2;
    let y = 0;

    for (const [, entry] of modelCounts) {
      const card = this.createCard(0, y, cardW, entry);
      this.scrollContainer.add(card);
      this.cardObjects.push(card);
      y += CARD_H + CARD_GAP;
    }

    // Show "empty" message if no items
    if (modelCounts.size === 0) {
      const emptyText = this.add
        .text(cardW / 2, 40, "No equipment in storage", {
          fontSize: "10px",
          color: TEXT_COLORS.dim,
          fontFamily: "'Nunito', sans-serif",
          fontStyle: "italic",
        })
        .setOrigin(0.5, 0.5)
        .setResolution(2);
      const emptyContainer = this.add.container(0, 0);
      emptyContainer.add(emptyText);
      this.scrollContainer.add(emptyContainer);
      this.cardObjects.push(emptyContainer);
    }

    // Update max scroll
    this.maxScroll = Math.max(0, y - SCROLL_AREA_H);
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset, 0, this.maxScroll);
    this.scrollContainer.setY(SCROLL_AREA_TOP - this.scrollOffset);
  }

  private createCard(
    x: number,
    y: number,
    w: number,
    entry: InventoryEntry,
  ): Phaser.GameObjects.Container {
    const info = MODEL_INFO[entry.model] ?? { name: entry.model, type: "server", uHeight: 1, ports: 0 };
    const textureKey = `device-${info.type}`;

    const container = this.add.container(x, y);

    // Card background
    const bg = this.add.graphics();
    bg.fillStyle(0x2a2218, 0.8);
    bg.fillRoundedRect(0, 0, w, CARD_H, 4);
    bg.lineStyle(1, 0x3a3020, 0.5);
    bg.strokeRoundedRect(0, 0, w, CARD_H, 4);
    container.add(bg);

    // Type color strip (left edge)
    const typeColors: Record<string, number> = {
      server: PALETTE.server,
      switch: PALETTE.switch,
      router: PALETTE.router,
      firewall: PALETTE.firewall,
    };
    const stripColor = typeColors[info.type] ?? PALETTE.server;
    const strip = this.add.graphics();
    strip.fillStyle(stripColor, 0.9);
    strip.fillRoundedRect(0, 0, 4, CARD_H, { tl: 4, bl: 4, tr: 0, br: 0 });
    container.add(strip);

    // Device icon (small preview)
    const icon = this.add
      .image(28, CARD_H / 2, textureKey)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(36, 14);
    container.add(icon);

    // Device name
    const nameText = this.add
      .text(52, 10, info.name, {
        fontSize: "10px",
        color: TEXT_COLORS.primary,
        fontFamily: "'Nunito', sans-serif",
        fontStyle: "bold",
      })
      .setResolution(2);
    container.add(nameText);

    // Specs line
    const specsStr = `${info.uHeight}U  ${info.ports} ports`;
    const specsText = this.add
      .text(52, 28, specsStr, {
        fontSize: "8px",
        color: TEXT_COLORS.muted,
        fontFamily: "'JetBrains Mono', monospace",
      })
      .setResolution(2);
    container.add(specsText);

    // Count badge (right side)
    if (entry.count > 1) {
      const badgeBg = this.add.graphics();
      badgeBg.fillStyle(0x1e1814, 0.9);
      badgeBg.fillRoundedRect(w - 32, 8, 24, 18, 9);
      badgeBg.lineStyle(1, stripColor, 0.5);
      badgeBg.strokeRoundedRect(w - 32, 8, 24, 18, 9);
      container.add(badgeBg);

      const badge = this.add
        .text(w - 20, 17, `${entry.count}`, {
          fontSize: "9px",
          color: TEXT_COLORS.accent,
          fontFamily: "'JetBrains Mono', monospace",
          fontStyle: "bold",
        })
        .setOrigin(0.5, 0.5)
        .setResolution(2);
      container.add(badge);
    }

    // "×1" or just count shown on right
    if (entry.count === 1) {
      const singleText = this.add
        .text(w - 16, CARD_H / 2, "×1", {
          fontSize: "9px",
          color: TEXT_COLORS.dim,
          fontFamily: "'JetBrains Mono', monospace",
        })
        .setOrigin(0.5, 0.5)
        .setResolution(2);
      container.add(singleText);
    }

    // Hit zone for drag initiation
    const hitZone = this.add
      .zone(0, 0, w, CARD_H)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true, draggable: false });

    hitZone.on("pointerover", () => {
      bg.clear();
      bg.fillStyle(0x3a3020, 0.9);
      bg.fillRoundedRect(0, 0, w, CARD_H, 4);
      bg.lineStyle(1.5, PALETTE.highlight, 0.6);
      bg.strokeRoundedRect(0, 0, w, CARD_H, 4);
    });

    hitZone.on("pointerout", () => {
      if (this.dragging) return;
      bg.clear();
      bg.fillStyle(0x2a2218, 0.8);
      bg.fillRoundedRect(0, 0, w, CARD_H, 4);
      bg.lineStyle(1, 0x3a3020, 0.5);
      bg.strokeRoundedRect(0, 0, w, CARD_H, 4);
    });

    hitZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      this.startDrag(entry, pointer);
    });

    container.add(hitZone);

    return container;
  }

  private startDrag(entry: InventoryEntry, pointer: Phaser.Input.Pointer) {
    if (this.dragging) return;

    const info = MODEL_INFO[entry.model] ?? { name: entry.model, type: "server", uHeight: 1, ports: 0 };
    const textureKey = `device-${info.type}`;

    const w = RACK.INNER_WIDTH - 4;
    const h = info.uHeight * RACK.SLOT_HEIGHT - 2;

    const px = pointer.x / this.dpr;
    const py = pointer.y / this.dpr;

    const sprite = this.add
      .image(px, py, textureKey)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(w, h)
      .setAlpha(0.7)
      .setDepth(100);

    this.dragging = {
      itemId: entry.firstItemId,
      model: entry.model,
      sprite,
      originX: px,
      originY: py,
    };
  }

  private handleDrop() {
    if (!this.dragging) return;

    const { itemId, sprite } = this.dragging;
    const px = sprite.x;

    // Check if dropped over rack area (left 60%)
    if (px < PANEL_X) {
      // Convert screen coords to RackScene world coords
      const rackScene = this.scene.get("RackScene") as RackScene;
      const rackCam = rackScene.cameras.main;
      const worldPoint = rackCam.getWorldPoint(
        sprite.x * this.dpr,
        sprite.y * this.dpr,
      );

      const targetU = rackScene.getSlotAtPosition(worldPoint.y);
      const store = useGameStore.getState();

      if (targetU && rackScene.isSlotFree(targetU) && store.openRackItemId) {
        // Valid drop — install device
        rpcClient
          .call("installDeviceFromStorage", {
            itemId,
            rackItemId: store.openRackItemId,
            slotU: targetU,
          })
          .catch(() => {});

        sprite.destroy();
        this.dragging = null;
        return;
      }
    }

    // Invalid drop or dropped back on inventory — bounce back
    const originX = this.dragging.originX;
    const originY = this.dragging.originY;
    this.tweens.add({
      targets: sprite,
      x: originX,
      y: originY,
      alpha: 0,
      duration: 200,
      ease: "Quad.easeIn",
      onComplete: () => {
        sprite.destroy();
      },
    });
    this.dragging = null;
  }
}
