import Phaser from "phaser";
import type { WorldState, ItemInstance, PlayerState } from "@downtime-ops/shared";
import { useGameStore } from "../../store/gameStore";
import { rpcClient } from "../../rpc/client";

/**
 * World constants — must match server worldFactory.ts
 */
const TILE = 32;

const WORLD = {
  width: 60,
  height: 40,
};

const ROOMS = {
  exterior: { x: 0, y: 0, w: 60, h: 12 },
  lobby: { x: 8, y: 14, w: 20, h: 24 },
  datacenter: { x: 30, y: 14, w: 26, h: 24 },
};

const DOORS = {
  exteriorToLobby: { x: 18, y: 12, w: 2, h: 2 },
  lobbyToDc: { x: 28, y: 24, w: 2, h: 2 },
};

const PLAYER_SPEED = 160;

export class WorldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private playerBody!: Phaser.Physics.Arcade.Body;

  // World layers
  private wallGroup!: Phaser.Physics.Arcade.StaticGroup;
  private doorZones: Phaser.GameObjects.Zone[] = [];
  private placementZones: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private itemSprites: Map<string, Phaser.GameObjects.Container> = new Map();

  // Interaction
  private nearestInteractable: string | null = null;
  private promptText!: Phaser.GameObjects.Text;
  private carriedItemSprite: Phaser.GameObjects.Rectangle | null = null;

  // Sync throttle
  private lastSyncTime = 0;
  private syncInterval = 100; // ms

  // Store unsubscribe
  private unsubscribe?: () => void;

  constructor() {
    super({ key: "WorldScene" });
  }

  create() {
    // Build the world
    this.buildTilemap();
    this.buildWalls();
    this.buildDoors();
    this.buildPlacementZones();

    // Create player
    this.createPlayer();

    // Setup camera
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(100, 100);
    this.cameras.main.setBounds(
      0, 0,
      WORLD.width * TILE,
      WORLD.height * TILE,
    );
    this.cameras.main.setZoom(1.5);
    this.cameras.main.setBackgroundColor(0x0a0806);

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
      color: "#f0e0cc",
      backgroundColor: "#1e1814cc",
      padding: { x: 8, y: 4 },
    }).setDepth(100).setVisible(false);

    // Subscribe to store for world state sync
    this.unsubscribe = useGameStore.subscribe((store) => {
      if (!store.state?.world) return;
      this.syncWorldItems(store.state.world);
    });

    // Initial sync
    const state = useGameStore.getState().state;
    if (state?.world) {
      this.syncPlayerPosition(state.world.player);
      this.syncWorldItems(state.world);
    }

    // Launch UI scene on top
    if (!this.scene.isActive("UIScene")) {
      this.scene.launch("UIScene");
    }
  }

  /**
   * Draw a simple colored tilemap. Placeholder until real tilesets exist.
   */
  private buildTilemap() {
    const g = this.add.graphics().setDepth(0);

    // Background (void)
    g.fillStyle(0x0a0806);
    g.fillRect(0, 0, WORLD.width * TILE, WORLD.height * TILE);

    // Exterior ground
    const ext = ROOMS.exterior;
    g.fillStyle(0x3a3a30);
    g.fillRect(ext.x * TILE, ext.y * TILE, ext.w * TILE, ext.h * TILE);

    // Exterior details — road/path
    g.fillStyle(0x484840);
    g.fillRect(16 * TILE, ext.y * TILE, 8 * TILE, ext.h * TILE);

    // Building facade (wall above lobby and datacenter)
    g.fillStyle(0x5a4a3a);
    g.fillRect(8 * TILE, 12 * TILE, 48 * TILE, 2 * TILE);

    // Door opening in facade
    g.fillStyle(0x2a2218);
    const d1 = DOORS.exteriorToLobby;
    g.fillRect(d1.x * TILE, d1.y * TILE, d1.w * TILE, d1.h * TILE);

    // Lobby floor
    const lob = ROOMS.lobby;
    g.fillStyle(0x3a2e22);
    g.fillRect(lob.x * TILE, lob.y * TILE, lob.w * TILE, lob.h * TILE);

    // Lobby: draw tile grid
    g.lineStyle(1, 0x4a3e32, 0.3);
    for (let tx = lob.x; tx < lob.x + lob.w; tx++) {
      for (let ty = lob.y; ty < lob.y + lob.h; ty++) {
        g.strokeRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }

    // Shop counter area
    g.fillStyle(0x6a5540);
    g.fillRect((lob.x + 3) * TILE, (lob.y + 5) * TILE, 8 * TILE, 2 * TILE);

    // Shop sign text
    this.add.text(
      (lob.x + 5) * TILE, (lob.y + 2) * TILE,
      "EQUIPMENT SHOP",
      { fontSize: "16px", color: "#e8a840", fontStyle: "bold" },
    ).setDepth(5);

    // Door between lobby and DC
    const d2 = DOORS.lobbyToDc;
    g.fillStyle(0x2a2218);
    g.fillRect(d2.x * TILE, d2.y * TILE, d2.w * TILE, d2.h * TILE);

    // Datacenter floor
    const dc = ROOMS.datacenter;
    g.fillStyle(0x2a2a28);
    g.fillRect(dc.x * TILE, dc.y * TILE, dc.w * TILE, dc.h * TILE);

    // Datacenter: draw tile grid (raised floor look)
    g.lineStyle(1, 0x3a3a38, 0.3);
    for (let tx = dc.x; tx < dc.x + dc.w; tx++) {
      for (let ty = dc.y; ty < dc.y + dc.h; ty++) {
        g.strokeRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }

    // Datacenter label
    this.add.text(
      (dc.x + 8) * TILE, (dc.y + 1) * TILE,
      "DATACENTER",
      { fontSize: "18px", color: "#708090", fontStyle: "bold" },
    ).setDepth(5);

    // Wall between lobby and DC
    g.fillStyle(0x5a4a3a);
    g.fillRect(28 * TILE, 14 * TILE, 2 * TILE, 10 * TILE);
    g.fillRect(28 * TILE, 26 * TILE, 2 * TILE, 12 * TILE);

    // Outer walls
    g.fillStyle(0x5a4a3a);
    // Left wall
    g.fillRect((lob.x - 1) * TILE, 14 * TILE, TILE, lob.h * TILE);
    // Right wall
    g.fillRect((dc.x + dc.w) * TILE, 14 * TILE, TILE, dc.h * TILE);
    // Bottom wall
    g.fillRect((lob.x - 1) * TILE, (lob.y + lob.h) * TILE, (dc.x + dc.w - lob.x + 2) * TILE, TILE);
    // Top wall (except door)
    g.fillRect(8 * TILE, 13 * TILE, 10 * TILE, TILE);
    g.fillRect(20 * TILE, 13 * TILE, 36 * TILE, TILE);

    // Ambient props — boxes in lobby
    g.fillStyle(0x7a6a55);
    g.fillRect((lob.x + 14) * TILE, (lob.y + 16) * TILE, 2 * TILE, 2 * TILE);
    g.fillRect((lob.x + 16) * TILE, (lob.y + 17) * TILE, TILE, TILE);

    // Exterior props — lamp posts
    g.fillStyle(0xd4a040);
    g.fillCircle(10 * TILE, 4 * TILE, 6);
    g.fillCircle(30 * TILE, 4 * TILE, 6);
  }

  /**
   * Build invisible collision walls.
   */
  private buildWalls() {
    this.wallGroup = this.physics.add.staticGroup();

    const addWall = (x: number, y: number, w: number, h: number) => {
      const wall = this.add.rectangle(
        x * TILE + (w * TILE) / 2,
        y * TILE + (h * TILE) / 2,
        w * TILE,
        h * TILE,
      );
      this.physics.add.existing(wall, true);
      this.wallGroup.add(wall);
    };

    // Building facade walls (except door openings)
    addWall(8, 12, 10, 2); // left of exterior door
    addWall(20, 12, 36, 2); // right of exterior door

    // Left outer wall
    addWall(7, 14, 1, 24);
    // Right outer wall
    addWall(56, 14, 1, 24);
    // Bottom wall
    addWall(7, 38, 50, 1);
    // Top inner wall (left of exterior door)
    addWall(8, 13, 10, 1);
    // Top inner wall (right of exterior door)
    addWall(20, 13, 36, 1);

    // Divider wall between lobby and DC (above door)
    addWall(28, 14, 2, 10);
    // Divider wall between lobby and DC (below door)
    addWall(28, 26, 2, 12);

    // Shop counter (solid)
    const lob = ROOMS.lobby;
    addWall(lob.x + 3, lob.y + 5, 8, 2);

    // Exterior boundaries (keep player on ground)
    addWall(0, 0, 60, 1); // top
    addWall(0, 0, 1, 12); // left
    addWall(59, 0, 1, 12); // right

    // Prevent walking into void between exterior and building
    addWall(0, 12, 8, 2); // left of building
    addWall(56, 12, 4, 2); // right of building
  }

  /**
   * Build door interaction zones.
   */
  private buildDoors() {
    const state = useGameStore.getState().state;
    if (!state?.world) return;

    for (const room of Object.values(state.world.rooms)) {
      for (const interactable of Object.values(room.interactables)) {
        if (interactable.kind !== "door") continue;

        const zone = this.add.zone(
          interactable.position.x,
          interactable.position.y,
          interactable.size.w,
          interactable.size.h,
        );
        this.physics.add.existing(zone, true);
        zone.setData("interactableId", interactable.id);
        zone.setData("roomId", room.id);
        zone.setData("targetRoom", interactable.data.targetRoom);
        this.doorZones.push(zone);
      }
    }
  }

  /**
   * Build visual placement zone indicators in the datacenter.
   */
  private buildPlacementZones() {
    const state = useGameStore.getState().state;
    if (!state?.world) return;

    for (const room of Object.values(state.world.rooms)) {
      for (const zone of Object.values(room.placementZones)) {
        const rect = this.add.rectangle(
          zone.position.x,
          zone.position.y,
          zone.size.w,
          zone.size.h,
          0x60c070,
          0.1,
        ).setDepth(1);

        // Dashed border effect
        const border = this.add.rectangle(
          zone.position.x,
          zone.position.y,
          zone.size.w,
          zone.size.h,
        ).setDepth(1);
        border.setStrokeStyle(1, 0x60c070, 0.3);

        this.placementZones.set(zone.id, rect);
      }
    }
  }

  /**
   * Create the player character.
   */
  private createPlayer() {
    const state = useGameStore.getState().state;
    const playerState = state?.world?.player;
    const startX = playerState?.position.x ?? 18 * TILE;
    const startY = playerState?.position.y ?? 6 * TILE;

    // Generate player texture if not exists
    if (!this.textures.exists("player")) {
      const g = this.add.graphics();
      // Body
      g.fillStyle(0xe8a840);
      g.fillRoundedRect(4, 8, 24, 20, 4);
      // Head
      g.fillStyle(0xf0d0a0);
      g.fillCircle(16, 8, 8);
      // Eyes
      g.fillStyle(0x1e1814);
      g.fillCircle(13, 7, 2);
      g.fillCircle(19, 7, 2);
      g.generateTexture("player", 32, 32);
      g.destroy();
    }

    this.playerSprite = this.add.sprite(0, 0, "player");
    this.player = this.add.container(startX, startY, [this.playerSprite]);
    this.player.setSize(24, 24);
    this.player.setDepth(50);

    this.physics.add.existing(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCollideWorldBounds(false);
    this.playerBody.setOffset(4, 4);

    // Collide with walls
    this.physics.add.collider(this.player, this.wallGroup);
  }

  /**
   * Sync world items from server state.
   */
  private syncWorldItems(world: WorldState) {
    if (!world.items) return;

    // Remove sprites for items that no longer exist
    for (const [itemId, sprite] of this.itemSprites) {
      if (!world.items[itemId]) {
        sprite.destroy();
        this.itemSprites.delete(itemId);
      }
    }

    // Create/update sprites for items
    for (const [itemId, item] of Object.entries(world.items) as [string, ItemInstance][]) {
      if (item.state === "carried") {
        // Don't render carried items as world objects — they follow the player
        const existing = this.itemSprites.get(itemId);
        if (existing) {
          existing.setVisible(false);
        }
        continue;
      }

      if (!item.position) continue;

      let container = this.itemSprites.get(itemId);
      if (!container) {
        container = this.createItemSprite(item);
        this.itemSprites.set(itemId, container);
      }

      container.setPosition(item.position.x, item.position.y);
      container.setVisible(true);
      container.setDepth(item.state === "placed" ? 20 : 10);
    }

    // Update placement zone occupied visuals
    for (const room of Object.values(world.rooms)) {
      for (const zone of Object.values(room.placementZones)) {
        const rect = this.placementZones.get(zone.id);
        if (rect) {
          if (zone.occupiedByItemId) {
            rect.setFillStyle(0x4a8a55, 0.05);
          } else {
            rect.setFillStyle(0x60c070, 0.1);
          }
        }
      }
    }

    // Update carried item visual
    this.updateCarriedItemVisual(world);
  }

  private createItemSprite(item: ItemInstance): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);

    if (item.kind === "rack") {
      // Rack: tall dark rectangle
      const body = this.add.rectangle(0, 0, 2.5 * TILE, 5 * TILE, 0x4a4240);
      body.setStrokeStyle(2, 0x6a6058);
      const label = this.add.text(0, -2.5 * TILE - 10, "RACK", {
        fontSize: "10px",
        color: "#a89070",
      }).setOrigin(0.5);
      container.add([body, label]);
    } else if (item.kind === "device") {
      // Device: small colored box
      const color = item.model.includes("server") ? 0x3a6a40
        : item.model.includes("switch") ? 0x3a6a8a
        : 0x9a6a2a;
      const body = this.add.rectangle(0, 0, 1.5 * TILE, TILE, color);
      body.setStrokeStyle(1, 0xffffff, 0.3);
      container.add([body]);
    }

    return container;
  }

  private updateCarriedItemVisual(world: WorldState) {
    const carryingId = world.player?.carryingItemId;

    if (!carryingId) {
      if (this.carriedItemSprite) {
        this.carriedItemSprite.destroy();
        this.carriedItemSprite = null;
      }
      return;
    }

    const item = world.items[carryingId];
    if (!item) return;

    if (!this.carriedItemSprite) {
      const color = item.kind === "rack" ? 0x4a4240
        : item.model?.includes("server") ? 0x3a6a40
        : item.model?.includes("switch") ? 0x3a6a8a
        : 0x9a6a2a;

      const size = item.kind === "rack" ? { w: 2 * TILE, h: 3 * TILE } : { w: 1.5 * TILE, h: TILE };
      this.carriedItemSprite = this.add.rectangle(0, 0, size.w, size.h, color, 0.8);
      this.carriedItemSprite.setStrokeStyle(2, 0xe8a840);
      this.carriedItemSprite.setDepth(49);
    }

    // Float above player
    this.carriedItemSprite.setPosition(
      this.player.x,
      this.player.y - 28,
    );
  }

  /**
   * Sync player position from server state (e.g. after door transition).
   */
  private syncPlayerPosition(playerState: PlayerState) {
    if (!playerState) return;
    this.player.setPosition(playerState.position.x, playerState.position.y);
  }

  update(_time: number, _delta: number) {
    this.handleMovement();
    this.checkInteractables();
    this.handleInteraction();
    this.syncPositionToServer();

    // Update carried item position
    if (this.carriedItemSprite) {
      this.carriedItemSprite.setPosition(
        this.player.x,
        this.player.y - 28,
      );
    }
  }

  private handleMovement() {
    const speed = PLAYER_SPEED;
    let vx = 0;
    let vy = 0;

    const left = this.cursors.left?.isDown || this.wasd.A.isDown;
    const right = this.cursors.right?.isDown || this.wasd.D.isDown;
    const up = this.cursors.up?.isDown || this.wasd.W.isDown;
    const down = this.cursors.down?.isDown || this.wasd.S.isDown;

    if (left) vx -= speed;
    if (right) vx += speed;
    if (up) vy -= speed;
    if (down) vy += speed;

    // Normalize diagonal
    if (vx !== 0 && vy !== 0) {
      const norm = Math.SQRT1_2;
      vx *= norm;
      vy *= norm;
    }

    this.playerBody.setVelocity(vx, vy);

    // Update facing
    if (vx < 0) this.playerSprite.setFlipX(true);
    else if (vx > 0) this.playerSprite.setFlipX(false);
  }

  private checkInteractables() {
    const px = this.player.x;
    const py = this.player.y;
    let nearest: string | null = null;
    let nearestDist = Infinity;
    let promptMsg = "";

    // Check doors
    for (const zone of this.doorZones) {
      const dist = Phaser.Math.Distance.Between(px, py, zone.x, zone.y);
      if (dist < TILE * 2.5 && dist < nearestDist) {
        nearestDist = dist;
        nearest = zone.getData("interactableId") as string;
        const target = zone.getData("targetRoom") as string;
        promptMsg = `[E] Enter ${target}`;
      }
    }

    // Check shop counter
    const state = useGameStore.getState().state;
    if (state?.world) {
      const room = state.world.rooms[state.world.player.roomId];
      if (room) {
        for (const inter of Object.values(room.interactables)) {
          if (inter.kind === "shop_counter") {
            const dist = Phaser.Math.Distance.Between(px, py, inter.position.x, inter.position.y);
            if (dist < TILE * 3 && dist < nearestDist) {
              nearestDist = dist;
              nearest = inter.id;
              promptMsg = "[E] Browse Shop";
            }
          }
        }
      }

      // Check placement zones (when carrying a rack)
      if (state.world.player.carryingItemId) {
        const carriedItem = state.world.items[state.world.player.carryingItemId];
        if (carriedItem?.kind === "rack") {
          const currentRoom = state.world.rooms[state.world.player.roomId];
          if (currentRoom) {
            for (const zone of Object.values(currentRoom.placementZones)) {
              if (zone.occupiedByItemId) continue;
              const dist = Phaser.Math.Distance.Between(px, py, zone.position.x, zone.position.y);
              if (dist < TILE * 3 && dist < nearestDist) {
                nearestDist = dist;
                nearest = `zone:${zone.id}`;
                promptMsg = "[E] Place Rack Here";
              }
            }
          }
        }
      }

      // Check placed items (racks on floor) for pickup
      if (!state.world.player.carryingItemId) {
        for (const item of Object.values(state.world.items)) {
          if (item.state !== "placed" || item.roomId !== state.world.player.roomId) continue;
          if (!item.position) continue;
          const dist = Phaser.Math.Distance.Between(px, py, item.position.x, item.position.y);
          if (dist < TILE * 2.5 && dist < nearestDist) {
            nearestDist = dist;
            nearest = `item:${item.id}`;
            promptMsg = `[E] Pick up ${item.kind}`;
          }
        }
      }
    }

    this.nearestInteractable = nearest;

    if (nearest && promptMsg) {
      this.promptText.setText(promptMsg);
      this.promptText.setPosition(px - this.promptText.width / 2, py - 50);
      this.promptText.setVisible(true);
    } else {
      this.promptText.setVisible(false);
    }
  }

  private handleInteraction() {
    if (!Phaser.Input.Keyboard.JustDown(this.interactKey)) return;
    if (!this.nearestInteractable) return;

    const state = useGameStore.getState().state;
    if (!state?.world) return;

    const id = this.nearestInteractable;

    if (id.startsWith("zone:")) {
      // Place rack on zone
      const zoneId = id.slice(5);
      const carryingId = state.world.player.carryingItemId;
      if (carryingId) {
        rpcClient.call("placeRack", { itemId: carryingId, zoneId });
      }
      return;
    }

    if (id.startsWith("item:")) {
      // Pick up item
      const itemId = id.slice(5);
      rpcClient.call("pickupItem", { itemId });
      return;
    }

    // Check if it's a door
    const room = state.world.rooms[state.world.player.roomId];
    if (room?.interactables[id]?.kind === "door") {
      rpcClient.call("enterDoor", { interactableId: id }).then(() => {
        // After door transition, sync player position from server
        const newState = useGameStore.getState().state;
        if (newState?.world?.player) {
          this.syncPlayerPosition(newState.world.player);
        }
      });
      return;
    }

    // Shop counter
    if (room?.interactables[id]?.kind === "shop_counter") {
      // Emit event to show shop UI
      this.events.emit("openShop");
      this.scene.launch("UIScene");
      useGameStore.getState().setView("shop");
      return;
    }
  }

  private syncPositionToServer() {
    const now = Date.now();
    if (now - this.lastSyncTime < this.syncInterval) return;

    const vx = this.playerBody.velocity.x;
    const vy = this.playerBody.velocity.y;

    // Only sync when moving
    if (vx === 0 && vy === 0) return;

    this.lastSyncTime = now;

    const facing: "up" | "down" | "left" | "right" =
      Math.abs(vx) > Math.abs(vy)
        ? (vx < 0 ? "left" : "right")
        : (vy < 0 ? "up" : "down");

    rpcClient.call("movePlayer", {
      position: { x: this.player.x, y: this.player.y },
      facing,
    });
  }

  destroy() {
    this.unsubscribe?.();
  }
}
