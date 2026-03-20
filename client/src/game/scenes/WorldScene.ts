import Phaser from "phaser";
import type { WorldState, ItemInstance, RoomId, RoomKind, Interactable } from "@downtime-ops/shared";
import { useGameStore } from "../../store/gameStore";
import { rpcClient } from "../../rpc/client";

/**
 * Side-view explorable world scene.
 *
 * All gameplay data (rooms, doors, interactables, placement zones)
 * comes from the server via WorldState. The client only handles
 * rendering and input — it never hardcodes room connections or layouts.
 */

/** Game viewport — all rooms render at this size */
const GAME_W = 960;
const GAME_H = 540;

const PLAYER_SPEED = 200;

// --- Client-only rendering config (mapped by room kind) ---

interface RenderConfig {
  backgroundKey: string;
  floorY: number;
  playerScale: number;
}

const RENDER_BY_KIND: Record<RoomKind, RenderConfig> = {
  checkpoint: { backgroundKey: "bg-checkpoint", floorY: GAME_H * 0.72, playerScale: 90 },
  yard: { backgroundKey: "bg-yard", floorY: GAME_H * 0.72, playerScale: 90 },
  storage: { backgroundKey: "bg-storage", floorY: GAME_H * 0.92, playerScale: 140 },
  datacenter: { backgroundKey: "bg-datacenter", floorY: GAME_H * 0.85, playerScale: 100 },
  office: { backgroundKey: "bg-datacenter", floorY: GAME_H * 0.85, playerScale: 100 },
};

const DEFAULT_RENDER: RenderConfig = {
  backgroundKey: "room-bg",
  floorY: GAME_H * 0.85,
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

  // Sync
  private lastSyncTime = 0;
  private unsubscribe?: () => void;

  constructor() {
    super({ key: "WorldScene" });
  }

  private getRender(): RenderConfig {
    const world = useGameStore.getState().state?.world;
    const room = world?.rooms[this.currentRoom];
    if (room) return RENDER_BY_KIND[room.kind] ?? DEFAULT_RENDER;
    return DEFAULT_RENDER;
  }

  create() {
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

    // Interaction prompt — fixed at bottom center
    this.promptText = this.add.text(GAME_W / 2, GAME_H - 40, "", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#f0e0cc",
      backgroundColor: "#1e1814dd",
      padding: { x: 12, y: 6 },
    }).setDepth(200).setVisible(false).setOrigin(0.5);

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
  }

  // --- Room management ---

  private enterRoom(roomId: RoomId, world: WorldState) {
    this.currentRoom = roomId;

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
    if (this.textures.exists(render.backgroundKey)) {
      this.bgSprite.setTexture(render.backgroundKey);
      this.bgSprite.setDisplaySize(GAME_W, GAME_H);
    }

    // Rescale player for this room
    this.playerSprite.setScale(render.playerScale / 580);
    this.playerSprite.setOrigin(0.5, 0.85);

    // Build visual hints from server interactables
    this.buildInteractableHints(world);

    // Sync items for this room
    this.syncWorldItems(world);
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
    for (const [itemId, item] of Object.entries(world.items) as [string, ItemInstance][]) {
      if (item.state === "carried" || item.roomId !== this.currentRoom) continue;
      if (!item.position) continue;

      let container = this.itemSprites.get(itemId);
      if (!container) {
        container = this.createItemSprite(item);
        this.itemSprites.set(itemId, container);
      }

      // Map server position to screen position using placement zones
      if (item.state === "placed") {
        const room = world.rooms[this.currentRoom];
        if (room) {
          for (const zone of Object.values(room.placementZones)) {
            if (zone.occupiedByItemId === itemId) {
              const screenX = (zone.position.x / (room.widthTiles * 32)) * GAME_W;
              const screenY = this.getRender().floorY - 60;
              container.setPosition(screenX, screenY);
              break;
            }
          }
        }
      }

      container.setVisible(true);
      container.setDepth(20);
    }

    // Update carried visual
    this.updateCarriedVisual(world);
  }

  private createItemSprite(item: ItemInstance): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);

    if (item.kind === "rack") {
      const key = this.textures.exists("rack-world") ? "rack-world" : "rack-frame";
      if (this.textures.exists(key)) {
        const sprite = this.add.image(0, 0, key);
        sprite.setDisplaySize(60, 120);
        container.add(sprite);
      } else {
        const body = this.add.rectangle(0, 0, 60, 120, 0x4a4240);
        body.setStrokeStyle(2, 0x6a6058);
        container.add(body);
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
        this.carriedSprite.setDisplaySize(40, 35);
      } else {
        const g = this.add.graphics();
        g.fillStyle(0x8a6a40);
        g.fillRect(0, 0, 40, 30);
        g.generateTexture("carried-fallback", 40, 30);
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
    this.handleMovement();
    this.checkInteractables();
    this.handleInteraction();
    this.syncPositionToServer();

    if (this.carriedSprite) {
      this.carriedSprite.setPosition(this.player.x, this.player.y - 50);
    }
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

    // Check placement zones (when carrying a rack)
    if (state.world.player.carryingItemId) {
      const carriedItem = state.world.items[state.world.player.carryingItemId];
      if (carriedItem?.kind === "rack") {
        for (const zone of Object.values(room.placementZones)) {
          if (zone.kind !== "rack_slot" || zone.occupiedByItemId) continue;
          const screenX = (zone.position.x / roomWidthPx) * GAME_W;
          if (Math.abs(px - screenX) < 50) {
            this.nearestInteractable = { id: zone.id, kind: "rack_pad", prompt: "[E] Place Rack" };
          }
        }
      }
    }

    // Check placed items for pickup
    if (!state.world.player.carryingItemId) {
      for (const [itemId, item] of Object.entries(state.world.items)) {
        if (item.state !== "placed" || item.roomId !== this.currentRoom) continue;
        const itemContainer = this.itemSprites.get(itemId);
        if (itemContainer && Math.abs(px - itemContainer.x) < 60) {
          this.nearestInteractable = { id: itemId, kind: "item", prompt: `[E] Pick up ${item.kind}` };
        }
      }
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
      this.events.emit("openShop");
      return;
    }

    if (kind === "rack_pad") {
      const carryingId = state.world.player.carryingItemId;
      if (carryingId) {
        rpcClient.call("placeRack", { itemId: carryingId, zoneId: id });
      }
      return;
    }

    if (kind === "item") {
      rpcClient.call("pickupItem", { itemId: id });
      return;
    }

    if (kind === "storage_shelf") {
      // Pickup from storage shelf
      rpcClient.call("pickupFromStorage", { itemId: id });
      return;
    }
  }

  private syncPositionToServer() {
    const now = Date.now();
    if (now - this.lastSyncTime < 100) return;

    const vx = this.playerBody.velocity.x;
    if (vx === 0) return;

    this.lastSyncTime = now;
    rpcClient.call("movePlayer", {
      position: { x: this.player.x, y: this.player.y },
      facing: vx < 0 ? "left" : "right",
    });
  }

  destroy() {
    this.unsubscribe?.();
  }
}
