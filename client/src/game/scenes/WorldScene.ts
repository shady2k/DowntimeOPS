import Phaser from "phaser";
import type { WorldState, ItemInstance, RoomId, Interactable } from "@downtime-ops/shared";
import { useGameStore } from "../../store/gameStore";
import { useBrowserStore } from "../../ui/browser/browserStore";
import { rpcClient } from "../../rpc/client";
import { AssetRegistry } from "../../assets/AssetRegistry";
import type { BackgroundDescriptor } from "../../assets/AssetDescriptors";
import { getDeviceFaceGeometry } from "../../renderer/DeviceVisualFactory";
import { drawCablePath, getCableStyle } from "../../renderer/CablePrefab";
import { PALETTE } from "../../renderer/TextureGenerator";

/**
 * Side-view explorable world scene.
 *
 * All gameplay data (rooms, doors, interactables, placement zones)
 * comes from the server via WorldState. The client only handles
 * rendering and input — it never hardcodes room connections or layouts.
 */

/** Game viewport — all rooms render at this logical size */
const GAME_W = 960;
const GAME_H = 540;

const PLAYER_SPEED = 200;

/** Fallback descriptor when a room kind has no registered background asset */
const DEFAULT_BACKGROUND: BackgroundDescriptor = {
  id: "bg-default",
  textureKey: "room-bg",
  floorY: 0.85,
  playerScale: 90,
};


export class WorldScene extends Phaser.Scene {
  // Current room
  private currentRoom: RoomId = "checkpoint";

  // Background
  private bgSprite!: Phaser.GameObjects.Image;

  // Player
  private player!: Phaser.GameObjects.Container;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private playerBody!: Phaser.Physics.Arcade.Body;

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;

  // Room objects (cleared on room change)
  private roomObjects: Phaser.GameObjects.GameObject[] = [];
  private itemSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private carriedSprite: Phaser.GameObjects.Image | null = null;

  // Interaction
  private nearestInteractable: { id: string; kind: string; prompt: string } | null = null;
  private promptText!: Phaser.GameObjects.Text;

  // E-key press tracking
  private ePressedAt = 0; // timestamp when E was first pressed
  private eWasDown = false; // previous frame state

  // Hold-E tracking (for picking up racks)
  private holdStartTime = 0;
  private holdTarget: string | null = null;
  private holdBarBg: Phaser.GameObjects.Rectangle | null = null;
  private holdBarFill: Phaser.GameObjects.Rectangle | null = null;
  private static readonly HOLD_DURATION = 600; // ms to hold E
  private static readonly TAP_THRESHOLD = 200; // max ms for a tap

  // Debug overlay
  private debugGfx: Phaser.GameObjects.Graphics | null = null;

  // Sync
  private lastSyncTime = 0;
  private unsubscribe?: () => void;

  constructor() {
    super({ key: "WorldScene" });
  }

  private getRender(): { textureKey: string; floorY: number; playerScale: number } {
    const world = useGameStore.getState().state?.world;
    const room = world?.rooms[this.currentRoom];
    const desc = room
      ? (AssetRegistry.getBackground(`bg-${room.kind}`) ?? DEFAULT_BACKGROUND)
      : DEFAULT_BACKGROUND;
    return {
      textureKey: desc.textureKey,
      floorY: desc.floorY * GAME_H,
      playerScale: desc.playerScale,
    };
  }

  create() {
    // Zoom camera by DPR so logical coords stay at 960x540
    // while canvas renders at native DPI for sharp text
    const dpr = window.devicePixelRatio || 1;
    this.cameras.main.setZoom(dpr);
    this.cameras.main.setBounds(0, 0, GAME_W, GAME_H);
    this.cameras.main.centerOn(GAME_W / 2, GAME_H / 2);
    this.cameras.main.setBackgroundColor(0x0d0a07);

    // Create background sprite (will be swapped per room)
    this.bgSprite = this.add.image(GAME_W / 2, GAME_H / 2, "bg-checkpoint")
      .setDisplaySize(GAME_W, GAME_H)
      .setDepth(0);

    // Create player
    this.createPlayer();

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // F1 toggles global debug mode
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F1).on("down", () => {
      useGameStore.getState().toggleDebugMode();
    });

    // Interaction prompt — fixed at bottom center
    this.promptText = this.add.text(GAME_W / 2, GAME_H - 40, "", {
      fontSize: "14px",
      fontFamily: "'Nunito', sans-serif",
      color: "#f0e0cc",
      backgroundColor: "#1e1814dd",
      padding: { x: 12, y: 6 },
    }).setDepth(200).setVisible(false).setOrigin(0.5).setResolution(dpr);

    // Subscribe to store
    this.unsubscribe = useGameStore.subscribe((store) => {
      if (!store.state?.world) return;
      const world = store.state.world;

      // Room changed? Rebuild the room
      if (world.player.roomId !== this.currentRoom) {
        this.enterRoom(world.player.roomId, world);
      }

      this.syncWorldItems(world);
    });

    // Initial room setup
    const state = useGameStore.getState().state;
    if (state?.world) {
      this.currentRoom = state.world.player.roomId;
      this.enterRoom(this.currentRoom, state.world);
      const pos = this.playerToScreen(state.world);
      this.player.setPosition(pos.x, pos.y);
    }

    // Launch UI overlay
    if (!this.scene.isActive("UIScene")) {
      this.scene.launch("UIScene");
    }

    // Launch quest tracker (always on top)
    if (!this.scene.isActive("QuestTrackerScene")) {
      this.scene.launch("QuestTrackerScene");
      this.scene.bringToTop("QuestTrackerScene");
    }
  }

  // --- Room management ---

  private enterRoom(roomId: RoomId, world: WorldState) {
    this.currentRoom = roomId;
    useGameStore.getState().closeShop();

    // Clear previous room objects
    for (const obj of this.roomObjects) {
      obj.destroy();
    }
    this.roomObjects = [];

    for (const [, sprite] of this.itemSprites) {
      sprite.destroy();
    }
    this.itemSprites.clear();

    // Swap background
    const render = this.getRender();
    if (this.textures.exists(render.textureKey)) {
      this.bgSprite.setTexture(render.textureKey);
      this.bgSprite.setDisplaySize(GAME_W, GAME_H);
    }

    // Rescale player for this room
    this.playerSprite.setScale(render.playerScale / 580);
    this.playerSprite.setOrigin(0.5, 0.85);

    // Draw placement zone outlines
    this.drawPlacementZones(world);

    // Build visual hints from server interactables
    this.buildInteractableHints(world);

    // Sync items for this room
    this.syncWorldItems(world);
  }

  private getOccupiedRackSlots(world: WorldState): Set<number> {
    const occupied = new Set<number>();
    for (const item of Object.values(world.items)) {
      if (item.kind === "rack" && item.roomId === this.currentRoom && item.rackSlotIndex !== null) {
        occupied.add(item.rackSlotIndex);
      }
    }
    return occupied;
  }

  private drawPlacementZones(world: WorldState) {
    const room = world.rooms[this.currentRoom];
    if (!room) return;

    const desc = AssetRegistry.getBackground(`bg-${room.kind}`);
    if (!desc?.rackSlots) return;

    const occupied = this.getOccupiedRackSlots(world);

    for (let i = 0; i < desc.rackSlots.length; i++) {
      if (occupied.has(i)) continue;

      const slot = desc.rackSlots[i];
      const screenX = slot.x * GAME_W;
      const screenY = slot.y * GAME_H;
      // Use rack aspect ratio for the dashed outline
      const rackH = slot.height;
      const rackW = Math.round(rackH * 0.4); // approximate rack aspect ratio

      const g = this.add.graphics();
      g.lineStyle(1, 0x4a6a8a, 0.4);

      const x1 = screenX - rackW / 2;
      const y1 = screenY - rackH;
      this.drawDashedRect(g, x1, y1, rackW, rackH, 6, 4);

      g.setDepth(5);
      this.roomObjects.push(g);
    }
  }

  private drawDashedRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, dash: number, gap: number) {
    const sides = [
      { sx: x, sy: y, ex: x + w, ey: y },
      { sx: x + w, sy: y, ex: x + w, ey: y + h },
      { sx: x + w, sy: y + h, ex: x, ey: y + h },
      { sx: x, sy: y + h, ex: x, ey: y },
    ];
    for (const { sx, sy, ex, ey } of sides) {
      const len = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2);
      const dx = (ex - sx) / len;
      const dy = (ey - sy) / len;
      let d = 0;
      let drawing = true;
      while (d < len) {
        const segLen = Math.min(drawing ? dash : gap, len - d);
        if (drawing) {
          g.beginPath();
          g.moveTo(sx + dx * d, sy + dy * d);
          g.lineTo(sx + dx * (d + segLen), sy + dy * (d + segLen));
          g.strokePath();
        }
        d += segLen;
        drawing = !drawing;
      }
    }
  }

  private buildInteractableHints(_world: WorldState) {
    // No visual hints — interaction prompt at bottom is sufficient
  }

  /** Map server player position to screen coordinates */
  private playerToScreen(world: WorldState): { x: number; y: number } {
    const room = world.rooms[world.player.roomId];
    if (!room) return { x: GAME_W / 2, y: this.getRender().floorY };
    const roomWidthPx = room.widthTiles * 32;
    return {
      x: (world.player.position.x / roomWidthPx) * GAME_W,
      y: this.getRender().floorY,
    };
  }

  private edgeTransition(targetRoom: string, _spawnPoint: string, _enterFrom: "left" | "right") {
    this.playerBody.setVelocityX(0);
    const exitSide = _enterFrom === "right" ? "left" : "right";
    rpcClient.call("edgeExit", { side: exitSide }).then(() => {
      const newState = useGameStore.getState().state;
      if (newState?.world) {
        this.enterRoom(targetRoom, newState.world);
        const pos = this.playerToScreen(newState.world);
        this.player.setPosition(pos.x, pos.y);
      }
    });
  }

  // --- Player ---

  private createPlayer() {
    // Use real player sprite sheet or fallback
    if (this.textures.exists("player-walk")) {
      this.playerSprite = this.add.sprite(0, 0, "player-walk", 0);
      const scale = 90 / 580;
      this.playerSprite.setScale(scale);
      this.playerSprite.setOrigin(0.5, 0.85);

      this.anims.create({
        key: "walk",
        frames: this.anims.generateFrameNumbers("player-walk", { start: 1, end: 8 }),
        frameRate: 10,
        repeat: -1,
      });
      this.anims.create({
        key: "idle",
        frames: [{ key: "player-walk", frame: 0 }],
        frameRate: 1,
      });
    } else {
      if (!this.textures.exists("player-fallback")) {
        const g = this.add.graphics();
        g.fillStyle(0xe8a840);
        g.fillRoundedRect(8, 16, 48, 40, 6);
        g.fillStyle(0xf0d0a0);
        g.fillCircle(32, 16, 16);
        g.fillStyle(0x1e1814);
        g.fillCircle(26, 14, 3);
        g.fillCircle(38, 14, 3);
        g.generateTexture("player-fallback", 64, 64);
        g.destroy();
      }
      this.playerSprite = this.add.sprite(0, 0, "player-fallback");
    }

    this.player = this.add.container(GAME_W / 2, this.getRender().floorY, [this.playerSprite]);
    this.player.setSize(40, 80);
    this.player.setDepth(50);

    this.physics.add.existing(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCollideWorldBounds(false);
  }

  // --- Items ---

  private syncWorldItems(world: WorldState) {
    if (!world.items) return;

    // Remove sprites for items not in current room or deleted
    for (const [itemId, sprite] of this.itemSprites) {
      const item = world.items[itemId];
      if (!item || item.roomId !== this.currentRoom || item.state === "carried") {
        sprite.destroy();
        this.itemSprites.delete(itemId);
      }
    }

    // Create/update sprites for items in this room
    const room = world.rooms[this.currentRoom];
    for (const [itemId, item] of Object.entries(world.items) as [string, ItemInstance][]) {
      if (item.state === "carried") continue;

      // For in_storage items, only show if we're in the storage room
      if (item.state === "in_storage") {
        if (this.currentRoom !== "storage") continue;
      } else if (item.kind === "rack" && item.rackSlotIndex !== null) {
        if (item.roomId !== this.currentRoom) continue;
      } else {
        if (item.roomId !== this.currentRoom) continue;
        if (!item.position) continue;
      }

      let container = this.itemSprites.get(itemId);
      // Recreate rack sprites each sync so installed devices stay up to date
      if (container && item.kind === "rack") {
        container.destroy();
        container = undefined;
        this.itemSprites.delete(itemId);
      }
      if (!container) {
        container = this.createItemSprite(item);
        this.itemSprites.set(itemId, container);
      }

      // Position items
      if (item.kind === "rack" && item.rackSlotIndex !== null) {
        // Rack position from background descriptor
        const bgDesc = AssetRegistry.getBackground(`bg-${room?.kind}`);
        const slot = bgDesc?.rackSlots?.[item.rackSlotIndex];
        if (slot) {
          const screenX = slot.x * GAME_W;
          const screenY = slot.y * GAME_H;
          container.setPosition(screenX, screenY - slot.height / 2);
        }
      } else if (room) {
        // Storage items positioned by placement zone
        for (const zone of Object.values(room.placementZones)) {
          if (zone.occupiedByItemId === itemId) {
            const roomWidthPx = room.widthTiles * 32;
            const screenX = (zone.position.x / roomWidthPx) * GAME_W;
            if (item.state === "in_storage") {
              container.setPosition(screenX, this.getRender().floorY - 40);
            } else {
              container.setPosition(screenX, this.getRender().floorY - 30);
            }
            break;
          }
        }
      }

      container.setVisible(true);
      container.setDepth(20);
    }

    // Update carried visual
    this.updateCarriedVisual(world);
  }

  private getPackageSize(model: string): { w: number; h: number } {
    const state = useGameStore.getState().state;
    if (state?.world.shop) {
      for (const listing of Object.values(state.world.shop.listings)) {
        if (listing.model === model) {
          return listing.specs.packageSize;
        }
      }
    }
    return { w: 70, h: 50 }; // fallback
  }

  private createItemSprite(item: ItemInstance): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);

    // Storage packages render as boxes — size from listing specs
    if (item.state === "in_storage") {
      const pkg = this.getPackageSize(item.model);
      if (this.textures.exists("package-box")) {
        const sprite = this.add.image(0, 0, "package-box");
        sprite.setDisplaySize(pkg.w, pkg.h);
        container.add(sprite);
      } else {
        const box = this.add.rectangle(0, 0, pkg.w, pkg.h, 0x8a6a40);
        box.setStrokeStyle(2, 0xa08050);
        container.add(box);
        const label = this.add.text(0, 0, "PKG", {
          fontSize: "10px",
          fontFamily: "monospace",
          color: "#f0e0cc",
        }).setOrigin(0.5);
        container.add(label);
      }
      return container;
    }

    if (item.kind === "rack") {
      const desc = AssetRegistry.getRack("rack-42u");
      const textureKey = desc?.textureKey ?? "rack-empty";
      const totalU = desc?.totalU ?? 42;
      const bay = desc?.bay ?? { left: 0.203, right: 0.796, top: 0.089, bottom: 0.904 };

      // Derive display size from actual texture aspect ratio
      const rackH = 240;
      let rackW = Math.round(rackH * 0.4); // fallback
      if (this.textures.exists(textureKey)) {
        const src = this.textures.get(textureKey).getSourceImage() as HTMLImageElement;
        rackW = Math.round(rackH * (src.width / src.height));
        const sprite = this.add.image(0, 0, textureKey);
        sprite.setDisplaySize(rackW, rackH);
        container.add(sprite);
      } else {
        const body = this.add.rectangle(0, 0, rackW, rackH, 0x4a4240);
        body.setStrokeStyle(2, 0x6a6058);
        container.add(body);
      }

      // Render installed devices using actual device textures
      const rackId = item.installedInRackId;
      const gameState = useGameStore.getState().state;
      if (rackId && gameState) {
        const bayTopPx = rackH * bay.top;
        const bayBottomPx = rackH * bay.bottom;
        const bayLeftPx = rackW * bay.left;
        const bayRightPx = rackW * bay.right;
        const bayH = bayBottomPx - bayTopPx;
        const bayW = bayRightPx - bayLeftPx;
        const uSlotH = bayH / totalU;

        // Build device position map for cable rendering
        const devPositions: Record<string, { x: number; y: number; w: number; h: number }> = {};

        for (const device of Object.values(gameState.devices)) {
          if (device.rackId !== rackId) continue;
          const devY = -rackH / 2 + bayTopPx + (device.slotU - 1) * uSlotH;
          const devH = device.uHeight * uSlotH;
          const devX = -rackW / 2 + bayLeftPx;
          devPositions[device.id] = { x: devX, y: devY, w: bayW, h: devH };

          const devTextureKey = `device-${device.type}`;
          if (this.textures.exists(devTextureKey)) {
            const devSprite = this.add.image(devX, devY, devTextureKey);
            devSprite.setOrigin(0, 0);
            devSprite.setDisplaySize(bayW, devH);
            container.add(devSprite);
          }

          // LEDs
          const geometry = getDeviceFaceGeometry(device);
          const ledG = this.add.graphics();
          const ledR = 0.6; // LED radius at world scale

          // Status LED
          const sColor = device.status === "online" ? PALETTE.portUp
            : device.status === "failed" ? PALETTE.portDown
            : device.status === "degraded" ? PALETTE.portErr
            : PALETTE.portOff;
          const sX = devX + geometry.statusLed.x * bayW;
          const sY = devY + geometry.statusLed.y * devH;
          if (device.status === "online") {
            ledG.fillStyle(sColor, 0.08);
            ledG.fillCircle(sX, sY, ledR * 2);
          }
          ledG.fillStyle(sColor, 0.9);
          ledG.fillCircle(sX, sY, ledR);

          // Port LEDs
          const maxVisible = Math.min(device.ports.length, geometry.ports.length);
          for (let i = 0; i < maxVisible; i++) {
            const port = device.ports[i];
            const pg = geometry.ports[i];
            const lx = (pg.ledX ?? pg.x) * bayW + devX;
            const ly = (pg.ledY ?? pg.y) * devH + devY;
            const hasLink = !!port.linkId && port.status !== "err_disabled";
            const link = port.linkId ? gameState.links[port.linkId] : undefined;
            const hasActivity = !!link && link.currentLoadMbps > 0;

            // Link LED
            if (hasLink) {
              ledG.fillStyle(PALETTE.portUp, 0.08);
              ledG.fillCircle(lx, ly, ledR * 1.5);
              ledG.fillStyle(PALETTE.portUp, 0.9);
              ledG.fillCircle(lx, ly, ledR * 0.7);
            } else if (port.status === "err_disabled") {
              ledG.fillStyle(PALETTE.portErr, 0.7);
              ledG.fillCircle(lx, ly, ledR * 0.7);
            } else {
              ledG.fillStyle(PALETTE.portOff, 0.3);
              ledG.fillCircle(lx, ly, ledR * 0.5);
            }

            // Activity LED
            const ax = (pg.actLedX ?? pg.x + 0.008) * bayW + devX;
            const ay = (pg.actLedY ?? pg.y) * devH + devY;
            if (hasActivity && Math.random() > 0.3) {
              ledG.fillStyle(PALETTE.portErr, 0.08);
              ledG.fillCircle(ax, ay, ledR * 1.5);
              ledG.fillStyle(PALETTE.portErr, 0.9);
              ledG.fillCircle(ax, ay, ledR * 0.7);
            } else {
              ledG.fillStyle(PALETTE.portOff, 0.2);
              ledG.fillCircle(ax, ay, ledR * 0.5);
            }
          }
          container.add(ledG);
        }

        // Cables — walk ports of rack devices to find links
        const cableG = this.add.graphics();
        const drawnLinks = new Set<string>();
        for (const device of Object.values(gameState.devices)) {
          if (device.rackId !== rackId) continue;
          for (const port of device.ports) {
            if (!port.linkId || drawnLinks.has(port.linkId)) continue;
            drawnLinks.add(port.linkId);
            const link = gameState.links[port.linkId];
            if (!link) continue;
            const posA = devPositions[link.portA.deviceId];
            const posB = devPositions[link.portB.deviceId];
            if (!posA || !posB) continue;
            const geoA = getDeviceFaceGeometry(gameState.devices[link.portA.deviceId]);
            const geoB = getDeviceFaceGeometry(gameState.devices[link.portB.deviceId]);
            const pgA = geoA.ports[link.portA.portIndex];
            const pgB = geoB.ports[link.portB.portIndex];
            if (!pgA || !pgB) continue;
            const ptA = { x: posA.x + pgA.x * posA.w, y: posA.y + pgA.y * posA.h };
            const ptB = { x: posB.x + pgB.x * posB.w, y: posB.y + pgB.y * posB.h };
            const util = link.maxBandwidthMbps > 0 ? link.currentLoadMbps / link.maxBandwidthMbps : 0;
            const bayRight = -rackW / 2 + bayRightPx;
            const style = getCableStyle(util, link.status, false, 0, link.type);
            drawCablePath(cableG, ptA, ptB, bayRight, style);
          }
        }
        container.add(cableG);
      }
    } else if (item.kind === "device") {
      const textureKey = item.model.includes("server") ? "device-server"
        : item.model.includes("switch") ? "device-switch"
        : item.model.includes("router") ? "device-router"
        : item.model.includes("firewall") ? "device-firewall"
        : null;

      if (textureKey && this.textures.exists(textureKey)) {
        const sprite = this.add.image(0, 0, textureKey);
        sprite.setDisplaySize(50, 20);
        container.add(sprite);
      } else {
        const color = item.model.includes("server") ? 0x3a6a40
          : item.model.includes("switch") ? 0x3a6a8a
          : 0x9a6a2a;
        const body = this.add.rectangle(0, 0, 50, 20, color);
        container.add(body);
      }
    }

    return container;
  }

  private updateCarriedVisual(world: WorldState) {
    const carryingId = world.player?.carryingItemId;

    if (!carryingId) {
      if (this.carriedSprite) {
        this.carriedSprite.destroy();
        this.carriedSprite = null;
      }
      return;
    }

    const item = world.items[carryingId];
    if (!item) return;

    if (!this.carriedSprite) {
      // For carried items, show as package box
      const textureKey = this.textures.exists("package-box") ? "package-box" : null;

      if (textureKey) {
        this.carriedSprite = this.add.image(0, 0, textureKey);
        this.carriedSprite.setDisplaySize(60, 52);
      } else {
        const g = this.add.graphics();
        g.fillStyle(0x8a6a40);
        g.fillRect(0, 0, 60, 52);
        g.generateTexture("carried-fallback", 60, 52);
        g.destroy();
        this.carriedSprite = this.add.image(0, 0, "carried-fallback");
      }
      this.carriedSprite.setDepth(49).setAlpha(0.9);
    }

    // Float above player head
    this.carriedSprite.setPosition(this.player.x, this.player.y - 50);
  }

  // --- Update loop ---

  update(_time: number, _delta: number) {
    // Skip all input when browser overlay is open (rack view uses scene switch, not overlay)
    if (useBrowserStore.getState().open) {
      this.playerBody.setVelocity(0, 0);
      if (this.playerSprite.anims.isPlaying) {
        this.playerSprite.stop();
        this.playerSprite.setFrame(0);
      }
      return;
    }

    this.handleMovement();
    this.checkInteractables();
    this.handleInteraction();
    this.syncPositionToServer();
    this.drawDebugOverlay();

    if (this.carriedSprite) {
      this.carriedSprite.setPosition(this.player.x, this.player.y - 50);
    }
  }

  private drawDebugOverlay() {
    const debug = useGameStore.getState().debugMode;

    if (!debug) {
      if (this.debugGfx) {
        this.debugGfx.destroy();
        this.debugGfx = null;
      }
      return;
    }

    if (!this.debugGfx) {
      this.debugGfx = this.add.graphics().setDepth(999);
    }
    this.debugGfx.clear();

    const state = useGameStore.getState().state;
    const room = state?.world?.rooms[this.currentRoom];
    if (!room) return;

    const bgDesc = AssetRegistry.getBackground(`bg-${room.kind}`);
    if (!bgDesc?.rackSlots) return;

    const occupied = this.getOccupiedRackSlots(state!.world);

    for (let i = 0; i < bgDesc.rackSlots.length; i++) {
      const slot = bgDesc.rackSlots[i];
      const sx = slot.x * GAME_W;
      const sy = slot.y * GAME_H;
      const rackH = slot.height;
      const rackW = Math.round(rackH * 0.4);

      const color = occupied.has(i) ? 0x40c040 : 0x4a90d0;
      this.debugGfx.lineStyle(2, color, 0.8);
      this.debugGfx.strokeRect(sx - rackW / 2, sy - rackH, rackW, rackH);

      // Slot index label
      const label = this.add.text(sx, sy - rackH - 4, `slot ${i}`, {
        fontSize: "10px",
        fontFamily: "monospace",
        color: occupied.has(i) ? "#40c040" : "#4a90d0",
      }).setOrigin(0.5, 1).setDepth(999);
      // Clean up labels next frame by adding to a temp list
      this.time.delayedCall(0, () => label.destroy());
    }

    // Floor line
    this.debugGfx.lineStyle(1, 0xff4040, 0.5);
    this.debugGfx.lineBetween(0, bgDesc.floorY * GAME_H, GAME_W, bgDesc.floorY * GAME_H);
  }

  private handleMovement() {
    let vx = 0;

    const left = this.cursors.left?.isDown || this.wasd.A.isDown;
    const right = this.cursors.right?.isDown || this.wasd.D.isDown;

    if (left) vx = -PLAYER_SPEED;
    if (right) vx = PLAYER_SPEED;

    this.playerBody.setVelocityX(vx);
    // Lock to floor
    this.player.y = this.getRender().floorY;
    this.playerBody.setVelocityY(0);

    // Edge exits — auto-transition or clamp
    const state = useGameStore.getState().state;
    const room = state?.world?.rooms[this.currentRoom];
    const edges = room?.edgeExits;

    if (this.player.x <= 20) {
      if (edges?.left) {
        this.edgeTransition(edges.left.targetRoom, edges.left.spawnPoint, "right");
        return;
      }
      this.player.x = 20;
    } else if (this.player.x >= GAME_W - 20) {
      if (edges?.right) {
        this.edgeTransition(edges.right.targetRoom, edges.right.spawnPoint, "left");
        return;
      }
      this.player.x = GAME_W - 20;
    }

    // Animation and facing
    if (vx !== 0) {
      this.playerSprite.setFlipX(vx < 0);
      if (this.anims.exists("walk")) {
        if (!this.playerSprite.anims.isPlaying || this.playerSprite.anims.currentAnim?.key !== "walk") {
          this.playerSprite.play("walk");
        }
      }
    } else {
      if (this.playerSprite.anims.isPlaying) {
        this.playerSprite.stop();
      }
      this.playerSprite.setFrame(0);
    }
  }

  /** Check all interactables from server state — no client-side hardcoding */
  private checkInteractables() {
    const px = this.player.x;
    this.nearestInteractable = null;

    const state = useGameStore.getState().state;
    if (!state?.world) return;

    const room = state.world.rooms[this.currentRoom];
    if (!room) return;

    const roomWidthPx = room.widthTiles * 32;

    // Check all interactables from server
    for (const interactable of Object.values(room.interactables)) {
      if (!interactable.enabled) continue;

      // Map server position to screen X
      const screenX = (interactable.position.x / roomWidthPx) * GAME_W;
      const interactRange = Math.max((interactable.size.w / roomWidthPx) * GAME_W * 0.5, 60);

      if (Math.abs(px - screenX) < interactRange) {
        const label = this.getInteractLabel(interactable);
        this.nearestInteractable = { id: interactable.id, kind: interactable.kind, prompt: label };
      }
    }

    // Check rack slots from background descriptor (when carrying a rack)
    if (state.world.player.carryingItemId) {
      const carriedItem = state.world.items[state.world.player.carryingItemId];
      if (carriedItem?.kind === "rack") {
        const bgDesc = AssetRegistry.getBackground(`bg-${room.kind}`);
        const occupied = this.getOccupiedRackSlots(state.world);
        for (let i = 0; i < (bgDesc?.rackSlots?.length ?? 0); i++) {
          if (occupied.has(i)) continue;
          const slot = bgDesc!.rackSlots![i];
          const screenX = slot.x * GAME_W;
          if (Math.abs(px - screenX) < 50) {
            this.nearestInteractable = { id: String(i), kind: "rack_pad", prompt: "[E] Place Rack" };
          }
        }
      }
    }

    // Check placed racks for interaction (open rack / hold to pick up)
    if (!state.world.player.carryingItemId || state.world.items[state.world.player.carryingItemId]?.kind === "device") {
      for (const [itemId, item] of Object.entries(state.world.items)) {
        if (item.state !== "placed" || item.roomId !== this.currentRoom || item.kind !== "rack") continue;
        const itemContainer = this.itemSprites.get(itemId);
        if (itemContainer && Math.abs(px - itemContainer.x) < 80) {
          const canPickUp = !state.world.player.carryingItemId;
          const carryingDevice = state.world.player.carryingItemId &&
            state.world.items[state.world.player.carryingItemId]?.kind === "device";
          const prompt = carryingDevice
            ? "[E] Install in Rack"
            : canPickUp
              ? "[E] Open Rack  [Hold E] Pick up"
              : "[E] Open Rack";
          this.nearestInteractable = { id: itemId, kind: "rack", prompt };
        }
      }
    }

    // Check placed items for pickup (skip racks — they use "Open Rack" instead)
    if (!state.world.player.carryingItemId) {
      for (const [itemId, item] of Object.entries(state.world.items)) {
        if (item.state !== "placed" || item.roomId !== this.currentRoom) continue;
        if (item.kind === "rack") continue;
        const itemContainer = this.itemSprites.get(itemId);
        if (itemContainer && Math.abs(px - itemContainer.x) < 60) {
          this.nearestInteractable = { id: itemId, kind: "item", prompt: `[E] Pick up ${item.kind}` };
        }
      }

      // Check storage shelves with packages
      for (const zone of Object.values(room.placementZones)) {
        if (zone.kind !== "storage_shelf" || !zone.occupiedByItemId) continue;
        const screenX = (zone.position.x / roomWidthPx) * GAME_W;
        if (Math.abs(px - screenX) < 60) {
          this.nearestInteractable = { id: zone.id, kind: "storage_shelf", prompt: "[E] Pick up package" };
        }
      }
    }

    // Reset hold bar if target changed or walked away
    if (this.holdTarget && this.nearestInteractable?.id !== this.holdTarget) {
      this.resetHold();
    }

    // Show/hide prompt — fixed at bottom center
    if (this.nearestInteractable) {
      this.promptText.setText(this.nearestInteractable.prompt);
      this.promptText.setVisible(true);
    } else {
      this.promptText.setVisible(false);
    }
  }

  private getInteractLabel(interactable: Interactable): string {
    return `[E] ${interactable.label}`;
  }

  private handleInteraction() {
    const isDown = this.interactKey.isDown;
    const justUp = !isDown && this.eWasDown;

    // Track when E was first pressed
    if (isDown && !this.eWasDown) {
      this.ePressedAt = Date.now();
    }
    this.eWasDown = isDown;

    // --- Hold-E logic for racks (hold = pickup, tap = open) ---
    if (isDown && this.nearestInteractable?.kind === "rack") {
      if (this.holdTarget !== this.nearestInteractable.id) {
        this.holdStartTime = Date.now();
        this.holdTarget = this.nearestInteractable.id;
      }

      const state = useGameStore.getState().state;
      const canPickUp = state?.world && !state.world.player.carryingItemId;

      if (canPickUp) {
        const elapsed = Date.now() - this.holdStartTime;
        const progress = Math.min(elapsed / WorldScene.HOLD_DURATION, 1);
        // Only show bar after tap threshold so quick presses don't flash it
        this.updateHoldBar(elapsed > WorldScene.TAP_THRESHOLD ? progress : 0);

        if (progress >= 1) {
          rpcClient.call("pickupItem", { itemId: this.holdTarget });
          this.resetHold();
          return;
        }
      }
      return;
    }

    // Reset hold if E released or target changed
    if (!isDown && this.holdTarget) {
      const wasTap = Date.now() - this.holdStartTime < WorldScene.TAP_THRESHOLD;
      const tappedId = this.holdTarget;
      this.resetHold();

      if (wasTap && this.nearestInteractable?.kind === "rack" && this.nearestInteractable.id === tappedId) {
        useGameStore.getState().openRack(tappedId);
        this.scene.sleep("WorldScene");
        if (this.scene.isSleeping("RackScene")) {
          this.scene.wake("RackScene");
        } else if (!this.scene.isActive("RackScene")) {
          this.scene.launch("RackScene");
        }
        this.scene.bringToTop("QuestTrackerScene");
      }
      return;
    }

    // --- Release-based interactions (rack_pad) ---
    // Only place rack on short tap release, so hold-E doesn't trigger placement
    if (justUp && this.nearestInteractable?.kind === "rack_pad") {
      const pressDuration = Date.now() - this.ePressedAt;
      if (pressDuration < WorldScene.TAP_THRESHOLD) {
        const state = useGameStore.getState().state;
        const carryingId = state?.world?.player.carryingItemId;
        if (carryingId) {
          rpcClient.call("placeRack", { itemId: carryingId, slotIndex: parseInt(this.nearestInteractable.id, 10) });
        }
      }
      return;
    }

    // --- Normal tap-E interactions (JustDown) ---
    if (!Phaser.Input.Keyboard.JustDown(this.interactKey)) return;
    if (!this.nearestInteractable) return;

    const { id, kind } = this.nearestInteractable;
    const state = useGameStore.getState().state;
    if (!state?.world) return;

    if (kind === "door") {
      rpcClient.call("enterDoor", { interactableId: id }).then(() => {
        const newState = useGameStore.getState().state;
        if (newState?.world) {
          this.enterRoom(newState.world.player.roomId, newState.world);
          const pos = this.playerToScreen(newState.world);
          this.player.setPosition(pos.x, pos.y);
        }
      });
      return;
    }

    if (kind === "staff_computer" || kind === "laptop") {
      useBrowserStore.getState().openBrowser("network");
      return;
    }

    if (kind === "item") {
      rpcClient.call("pickupItem", { itemId: id });
      return;
    }

    if (kind === "storage_shelf") {
      rpcClient.call("pickupFromStorage", { shelfId: id });
      return;
    }
  }

  private resetHold() {
    this.holdTarget = null;
    this.holdStartTime = 0;
    this.updateHoldBar(0);
  }

  private updateHoldBar(progress: number) {
    if (progress <= 0) {
      this.holdBarBg?.setVisible(false);
      this.holdBarFill?.setVisible(false);
      return;
    }

    const barW = 60;
    const barH = 6;
    const x = this.player.x - barW / 2;
    const y = this.player.y - 70;

    if (!this.holdBarBg) {
      this.holdBarBg = this.add.rectangle(x, y, barW, barH, 0x1e1814, 0.8)
        .setOrigin(0, 0.5).setDepth(200);
      this.holdBarFill = this.add.rectangle(x, y, 0, barH, 0xe8a840, 1)
        .setOrigin(0, 0.5).setDepth(201);
    }

    this.holdBarBg.setPosition(x, y).setVisible(true);
    this.holdBarFill!.setPosition(x, y).setSize(barW * progress, barH).setVisible(true);
  }

  /** Map screen coordinates back to world/server coordinates */
  private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const state = useGameStore.getState().state;
    const room = state?.world?.rooms[this.currentRoom];
    if (!room) return { x: screenX, y: screenY };
    const roomWidthPx = room.widthTiles * 32;
    return {
      x: (screenX / GAME_W) * roomWidthPx,
      y: (screenY / GAME_H) * (room.heightTiles * 32),
    };
  }

  private syncPositionToServer() {
    const now = Date.now();
    if (now - this.lastSyncTime < 100) return;

    const vx = this.playerBody.velocity.x;
    if (vx === 0) return;

    this.lastSyncTime = now;
    const worldPos = this.screenToWorld(this.player.x, this.player.y);
    rpcClient.call("movePlayer", {
      position: worldPos,
      facing: vx < 0 ? "left" : "right",
    });
  }

  destroy() {
    this.unsubscribe?.();
  }
}
