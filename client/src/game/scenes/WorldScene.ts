import Phaser from "phaser";
import type { WorldState, ItemInstance, RoomId } from "@downtime-ops/shared";
import { useGameStore } from "../../store/gameStore";
import { rpcClient } from "../../rpc/client";

/**
 * Side-view explorable world scene.
 *
 * Each room is a full-screen illustrated background.
 * Player walks left/right on the floor.
 * Room transitions happen at screen edges or doors.
 * Items/racks are layered sprites on top of the background.
 */

/** Game viewport — all rooms render at this size */
const GAME_W = 960;
const GAME_H = 540;

/** Player floor Y — where the character walks (percentage from top) */
const FLOOR_Y = GAME_H * 0.82;

const PLAYER_SPEED = 200;

/** Room background texture keys */
const ROOM_BG: Record<string, string> = {
  exterior: "room-exterior",
  lobby: "room-shop",
  datacenter: "room-bg",
};

/** Room connections — which room is left/right of each room, and door targets */
const ROOM_CONNECTIONS: Record<string, {
  left?: { room: string; interactableId: string };
  right?: { room: string; interactableId: string };
  doors?: Array<{ x: number; targetRoom: string; interactableId: string }>;
}> = {
  exterior: {
    doors: [{ x: GAME_W * 0.5, targetRoom: "lobby", interactableId: "door-to-lobby" }],
  },
  lobby: {
    left: { room: "exterior", interactableId: "door-to-exterior" },
    right: { room: "datacenter", interactableId: "door-to-datacenter" },
    doors: [
      { x: GAME_W * 0.1, targetRoom: "exterior", interactableId: "door-to-exterior" },
      { x: GAME_W * 0.9, targetRoom: "datacenter", interactableId: "door-to-datacenter" },
    ],
  },
  datacenter: {
    left: { room: "lobby", interactableId: "door-to-lobby" },
    doors: [{ x: GAME_W * 0.1, targetRoom: "lobby", interactableId: "door-to-lobby" }],
  },
};

/** Placement zone visual positions within datacenter room (in screen coords) */
const DC_RACK_SLOTS = [
  { id: "rack-slot-0", x: GAME_W * 0.25, y: FLOOR_Y - 60 },
  { id: "rack-slot-1", x: GAME_W * 0.40, y: FLOOR_Y - 60 },
  { id: "rack-slot-2", x: GAME_W * 0.55, y: FLOOR_Y - 60 },
  { id: "rack-slot-3", x: GAME_W * 0.70, y: FLOOR_Y - 60 },
  { id: "rack-slot-4", x: GAME_W * 0.85, y: FLOOR_Y - 60 },
  { id: "rack-slot-5", x: GAME_W * 0.30, y: FLOOR_Y - 160 },
];

/** Shop counter position in lobby */
const SHOP_COUNTER_X = GAME_W * 0.5;
const SHOP_COUNTER_Y = FLOOR_Y - 20;

export class WorldScene extends Phaser.Scene {
  // Current room
  private currentRoom: RoomId = "exterior";

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
  private nearestInteractable: string | null = null;
  private promptText!: Phaser.GameObjects.Text;

  // Sync
  private lastSyncTime = 0;
  private unsubscribe?: () => void;

  constructor() {
    super({ key: "WorldScene" });
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0d0a07);

    // Create background sprite (will be swapped per room)
    this.bgSprite = this.add.image(GAME_W / 2, GAME_H / 2, "room-exterior")
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

    // Interaction prompt
    this.promptText = this.add.text(0, 0, "", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#f0e0cc",
      backgroundColor: "#1e1814dd",
      padding: { x: 8, y: 4 },
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
      this.player.setPosition(GAME_W / 2, FLOOR_Y);
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
    const bgKey = ROOM_BG[roomId];
    if (bgKey && this.textures.exists(bgKey)) {
      this.bgSprite.setTexture(bgKey);
      this.bgSprite.setDisplaySize(GAME_W, GAME_H);
    }

    // Build room-specific elements
    this.buildRoomElements(roomId, world);

    // Sync items for this room
    this.syncWorldItems(world);
  }

  private buildRoomElements(roomId: RoomId, _world: WorldState) {
    const conn = ROOM_CONNECTIONS[roomId];
    if (!conn) return;

    // Door indicators
    if (conn.doors) {
      for (const door of conn.doors) {
        // Door glow indicator
        const glow = this.add.rectangle(door.x, FLOOR_Y - 40, 40, 80, 0xe8a840, 0.08)
          .setDepth(5);
        this.roomObjects.push(glow);

        // Door label
        const label = this.add.text(door.x, FLOOR_Y - 90, `[E] → ${door.targetRoom}`, {
          fontSize: "11px",
          fontFamily: "monospace",
          color: "#e8a840",
        }).setOrigin(0.5).setDepth(5).setAlpha(0.6);
        this.roomObjects.push(label);
      }
    }

    // Edge transition arrows
    if (conn.left) {
      const arrow = this.add.text(15, FLOOR_Y - 30, "◀", {
        fontSize: "24px", color: "#e8a840",
      }).setOrigin(0.5).setDepth(5).setAlpha(0.5);
      this.roomObjects.push(arrow);
      const hint = this.add.text(15, FLOOR_Y - 55, conn.left.room, {
        fontSize: "10px", fontFamily: "monospace", color: "#e8a840",
      }).setOrigin(0.5).setDepth(5).setAlpha(0.4);
      this.roomObjects.push(hint);
    }
    if (conn.right) {
      const arrow = this.add.text(GAME_W - 15, FLOOR_Y - 30, "▶", {
        fontSize: "24px", color: "#e8a840",
      }).setOrigin(0.5).setDepth(5).setAlpha(0.5);
      this.roomObjects.push(arrow);
      const hint = this.add.text(GAME_W - 15, FLOOR_Y - 55, conn.right.room, {
        fontSize: "10px", fontFamily: "monospace", color: "#e8a840",
      }).setOrigin(0.5).setDepth(5).setAlpha(0.4);
      this.roomObjects.push(hint);
    }

    // Room-specific elements
    if (roomId === "lobby") {
      // Shop counter highlight
      const counter = this.add.rectangle(
        SHOP_COUNTER_X, SHOP_COUNTER_Y,
        120, 10, 0xe8a840, 0.15,
      ).setDepth(5);
      this.roomObjects.push(counter);
    }

    if (roomId === "datacenter") {
      // Placement zone indicators
      for (const slot of DC_RACK_SLOTS) {
        const rect = this.add.rectangle(
          slot.x, slot.y,
          60, 120, 0x60c070, 0.08,
        ).setDepth(2);
        rect.setStrokeStyle(1, 0x60c070, 0.2);
        rect.setData("zoneId", slot.id);
        this.roomObjects.push(rect);
      }
    }
  }

  // --- Player ---

  private createPlayer() {
    // Use real player sprite sheet or fallback
    if (this.textures.exists("player-walk")) {
      this.playerSprite = this.add.sprite(0, 0, "player-walk", 0);
      // Each frame is 384x1024. Character is ~384x700 with whitespace above.
      // Scale to ~56x150 preserving aspect ratio, then offset up so feet touch floor.
      const scale = 90 / 384; // target ~90px wide
      this.playerSprite.setScale(scale);
      // Shift sprite up so feet align with container origin (floor)
      this.playerSprite.setOrigin(0.5, 0.85);

      // Create walk animation
      this.anims.create({
        key: "walk",
        frames: this.anims.generateFrameNumbers("player-walk", { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      });
      this.anims.create({
        key: "idle",
        frames: [{ key: "player-walk", frame: 0 }],
        frameRate: 1,
      });
    } else {
      // Fallback procedural sprite
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

    this.player = this.add.container(GAME_W / 2, FLOOR_Y, [this.playerSprite]);
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

      // Map server position to screen position
      // For placed racks in datacenter, use rack slot positions
      if (item.state === "placed" && this.currentRoom === "datacenter") {
        const slotIndex = DC_RACK_SLOTS.findIndex((s) => {
          const room = world.rooms[this.currentRoom];
          const zone = room?.placementZones[s.id];
          return zone?.occupiedByItemId === itemId;
        });
        if (slotIndex >= 0) {
          const slot = DC_RACK_SLOTS[slotIndex];
          container.setPosition(slot.x, slot.y);
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
      if (this.textures.exists("rack-frame")) {
        const sprite = this.add.image(0, 0, "rack-frame");
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
      let textureKey: string | null = null;
      if (item.kind === "rack") {
        textureKey = "rack-frame";
      } else {
        textureKey = item.model.includes("server") ? "device-server"
          : item.model.includes("switch") ? "device-switch"
          : item.model.includes("router") ? "device-router"
          : null;
      }

      if (textureKey && this.textures.exists(textureKey)) {
        this.carriedSprite = this.add.image(0, 0, textureKey);
        const size = item.kind === "rack" ? { w: 40, h: 80 } : { w: 50, h: 20 };
        this.carriedSprite.setDisplaySize(size.w, size.h);
      } else {
        // Fallback rectangle as image
        const g = this.add.graphics();
        g.fillStyle(0x4a4240);
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
    this.checkEdgeTransition();
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
    this.player.y = FLOOR_Y;
    this.playerBody.setVelocityY(0);

    // Animation and facing
    if (vx !== 0) {
      // Sprite faces right by default — flip when walking left
      if (vx < 0) this.playerSprite.setFlipX(true);
      else this.playerSprite.setFlipX(false);

      if (this.anims.exists("walk") && this.playerSprite.anims.currentAnim?.key !== "walk") {
        this.playerSprite.play("walk");
      }
    } else {
      // Idle
      if (this.anims.exists("idle") && this.playerSprite.anims.currentAnim?.key !== "idle") {
        this.playerSprite.play("idle");
      }
    }
  }

  /** Transition rooms when player walks to screen edge */
  private checkEdgeTransition() {
    const conn = ROOM_CONNECTIONS[this.currentRoom];
    if (!conn) return;

    if (this.player.x <= 20) {
      if (conn.left) {
        this.transitionToRoom(conn.left.room, conn.left.interactableId, "right");
      } else {
        // No room to the left — clamp
        this.player.x = 20;
      }
    } else if (this.player.x >= GAME_W - 20) {
      if (conn.right) {
        this.transitionToRoom(conn.right.room, conn.right.interactableId, "left");
      } else {
        // No room to the right — clamp
        this.player.x = GAME_W - 20;
      }
    }
  }

  private transitionToRoom(targetRoom: string, interactableId: string, enterFrom: "left" | "right") {
    rpcClient.call("enterDoor", { interactableId }).then(() => {
      const newState = useGameStore.getState().state;
      if (newState?.world) {
        this.enterRoom(targetRoom, newState.world);
        this.player.setPosition(
          enterFrom === "left" ? 60 : GAME_W - 60,
          FLOOR_Y,
        );
      }
    });
  }

  private checkInteractables() {
    const px = this.player.x;
    let nearest: string | null = null;
    let promptMsg = "";

    const state = useGameStore.getState().state;
    if (!state?.world) return;

    const conn = ROOM_CONNECTIONS[this.currentRoom];

    // Check doors
    if (conn?.doors) {
      for (const door of conn.doors) {
        if (Math.abs(px - door.x) < 50) {
          nearest = `door:${door.interactableId}:${door.targetRoom}`;
          promptMsg = `[E] Enter ${door.targetRoom}`;
        }
      }
    }

    // Check shop counter (in lobby)
    if (this.currentRoom === "lobby") {
      if (Math.abs(px - SHOP_COUNTER_X) < 80) {
        nearest = "shop";
        promptMsg = "[E] Browse Shop";
      }
    }

    // Check placement zones (when carrying a rack in datacenter)
    if (this.currentRoom === "datacenter" && state.world.player.carryingItemId) {
      const carriedItem = state.world.items[state.world.player.carryingItemId];
      if (carriedItem?.kind === "rack") {
        const room = state.world.rooms[this.currentRoom];
        for (const slot of DC_RACK_SLOTS) {
          const zone = room?.placementZones[slot.id];
          if (zone?.occupiedByItemId) continue;
          if (Math.abs(px - slot.x) < 50) {
            nearest = `zone:${slot.id}`;
            promptMsg = "[E] Place Rack Here";
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
          nearest = `item:${itemId}`;
          promptMsg = `[E] Pick up ${item.kind}`;
        }
      }
    }

    this.nearestInteractable = nearest;

    if (nearest && promptMsg) {
      this.promptText.setText(promptMsg);
      this.promptText.setPosition(this.player.x, this.player.y - 80);
      this.promptText.setVisible(true);
    } else {
      this.promptText.setVisible(false);
    }
  }

  private handleInteraction() {
    if (!Phaser.Input.Keyboard.JustDown(this.interactKey)) return;
    if (!this.nearestInteractable) return;

    const id = this.nearestInteractable;
    const state = useGameStore.getState().state;
    if (!state?.world) return;

    if (id.startsWith("door:")) {
      const [, interactableId, targetRoom] = id.split(":");
      rpcClient.call("enterDoor", { interactableId }).then(() => {
        const newState = useGameStore.getState().state;
        if (newState?.world) {
          this.enterRoom(targetRoom, newState.world);
          this.player.setPosition(GAME_W / 2, FLOOR_Y);
        }
      });
      return;
    }

    if (id === "shop") {
      this.events.emit("openShop");
      return;
    }

    if (id.startsWith("zone:")) {
      const zoneId = id.slice(5);
      const carryingId = state.world.player.carryingItemId;
      if (carryingId) {
        rpcClient.call("placeRack", { itemId: carryingId, zoneId });
      }
      return;
    }

    if (id.startsWith("item:")) {
      const itemId = id.slice(5);
      rpcClient.call("pickupItem", { itemId });
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
