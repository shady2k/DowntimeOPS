# Migration Plan: Explorable Physical World (Uncle Chop Style)

## Goal
Transform DowntimeOPS from "React panels + Phaser rack view" into an explorable physical-space game where the player walks around, picks up equipment, carries it, and physically installs it. Phaser-first, React-minimal.

---

## Vertical Slice Scope

Prove one thing: **walking around and physically doing datacenter work feels better than clicking panels.**

What's in the slice:
- Checkpoint spawn → yard with storage building + datacenter building
- Front-facing datacenter facade, door to enter interior
- Interior: staff area (desk with computer) + server floor with rack placement zones
- One player avatar with 8-direction movement
- Use the staff computer to browse the shop and buy equipment
- Purchased items arrive as packages in the storage building (in the yard)
- Walk to storage, pick up package box, carry to datacenter floor, place rack
- Buy server/switch from computer, pick up package from storage, carry to rack, install it
- Money decreases, installed item appears, audio feedback
- Optional: player can buy a laptop to access the shop from anywhere
- One objective: "Install your first rack and one server"

What's NOT in the slice:
- No cables, no tracer, no firewall/VLAN
- No advanced network config
- No multiple racks or complex layouts

---

## Scene Structure

Replace `RackScene.ts` with:

| Scene | Purpose |
|-------|---------|
| `BootScene` | Config, shared managers, save bootstrap |
| `PreloadScene` | Asset loading (evolve from existing) |
| `WorldScene` | Main explorable map — exterior (front-facing building), datacenter interior in one tilemap |
| `UIScene` | Screen-space HUD only — money, objective, interaction prompt, pause |
| `RackInstallScene` | Optional close-up for rack/device install |

### World approach — Location flow:

```
Checkpoint (player spawn)
        ↓
    Yard (fenced area)
    ├── Storage building (purchased packages arrive here)
    └── Datacenter building (front-facing facade)
                ↓ (enter door)
        Datacenter interior
        ├── Staff area (desk + computer for shop access)
        └── Server floor (rack placement zones)
```

- **Checkpoint:** Player spawns here. Entry point to the datacenter campus.
- **Yard:** Open area between checkpoint and buildings. Storage building on one side, datacenter on the other.
- **Storage:** Where purchased packages/boxes are delivered. Player walks here to pick up orders.
- **Datacenter exterior:** Front-facing building facade. Door to enter.
- **Datacenter interior:** Staff area with desk/computer + server floor with rack placement zones.
- **Staff computer:** Stationary computer at a desk inside the datacenter. Player interacts with it to open the shop and buy equipment. (Player may also have a laptop — could be a purchasable item that lets them shop from anywhere.)
- Camera follow on player with deadzone and bounds
- World size: ~80x50 to 120x70 tiles (16x16 or 32x32)
- Collision layers: walls, fences, placed racks, storage shelves, blocked tiles
- Interaction zones: checkpoint gate, storage shelves, datacenter door, staff computer, rack placement pads, installed rack hotspots
- Transitions: fade between yard ↔ datacenter interior

---

## New Shared Types

Add to `shared/src/types/`:

### `World.ts`
```ts
export interface Vec2 { x: number; y: number }
export type RoomId = string;
export type ItemId = string;
export type InteractableId = string;
```

### `Room.ts`
```ts
export interface Room {
  id: RoomId;
  kind: "checkpoint" | "yard" | "storage" | "datacenter" | "office";
  name: string;
  tilemapKey: string;
  width: number;
  height: number;
  spawnPoints: Record<string, Vec2>;
  placementZones: PlacementZone[];
  interactables: Record<InteractableId, Interactable>;
}
```

### `Placement.ts`
```ts
export interface PlacementZone {
  id: string;
  roomId: RoomId;
  kind: "rack_slot" | "floor_item" | "storage_shelf";
  position: Vec2;
  size: { w: number; h: number };
  occupiedByItemId: string | null;
}
```

### `Player.ts`
```ts
export interface PlayerState {
  id: string;
  roomId: RoomId;
  position: Vec2;
  facing: "up" | "down" | "left" | "right";
  velocity: Vec2;
  carryingItemId: ItemId | null;
  interactingWithId: InteractableId | null;
}
```

### `ItemInstance.ts`
```ts
export interface ItemInstance {
  id: ItemId;
  kind: "rack" | "device" | "tool" | "decor";
  model: string;
  state: "in_storage" | "placed" | "carried" | "installed";
  roomId: RoomId | null;
  position: Vec2 | null;
  owner: "world" | "player" | "storage" | "rack";
  ownerRef: string | null;
}
```

### `Shop.ts`
```ts
// Shop is accessed via the player's notebook computer, not a physical location
export interface ShopListing {
  id: string;
  model: string;
  itemKind: "rack" | "device";
  price: number;
  stock: number | null;
}

export interface ShopState {
  listings: Record<string, ShopListing>;
}
```

### `Storage.ts`
```ts
// Purchased items arrive as packages in the storage area
// Player picks up boxes from storage and carries them to the datacenter floor
export interface StorageState {
  packages: Record<ItemId, StoragePackage>;
}

export interface StoragePackage {
  itemId: ItemId;
  purchasedAt: number; // game tick
}
```

### `Interactable.ts`
```ts
export interface Interactable {
  id: InteractableId;
  kind: "door" | "gate" | "rack_pad" | "rack" | "storage_shelf" | "staff_computer" | "laptop" | "terminal";
  roomId: RoomId;
  position: Vec2;
  size: { w: number; h: number };
  enabled: boolean;
  data: Record<string, unknown>;
}
```

### Extend `GameState.ts`
```ts
world: { rooms: Record<RoomId, Room> }
player: PlayerState
items: Record<ItemId, ItemInstance>
shop: ShopState       // catalog — accessed via notebook
storage: StorageState // packages waiting for pickup
```

**Key modeling rule:** Keep `Rack` and `Device` as simulation/business entities. `ItemInstance` is the spatial layer that points to rack/device IDs. Don't overload `Rack` with floor transform data.

---

## New Server RPC Actions

```ts
{ type: "MOVE_PLAYER"; position: Vec2; facing: Facing; seq: number }
{ type: "INTERACT"; interactableId: string }
{ type: "OPEN_SHOP"; via: "staff_computer" | "laptop" }             // open shop UI
{ type: "BUY_ITEM"; listingId: string }                            // purchase → item goes to storage
{ type: "PICKUP_FROM_STORAGE"; itemId: string }                    // pick up package box from storage
{ type: "PICKUP_ITEM"; itemId: string }                            // pick up placed item
{ type: "DROP_ITEM"; roomId: string; position: Vec2 }
{ type: "PLACE_RACK"; itemId: string; zoneId: string }
{ type: "INSTALL_DEVICE"; itemId: string; rackId: string; slotU: number }
{ type: "ENTER_DOOR"; interactableId: string }
```

JSON-RPC methods: `movePlayer`, `interact`, `openShop`, `buyItem`, `pickupFromStorage`, `pickupItem`, `dropItem`, `placeRack`, `installDevice`, `enterDoor`

**Authority:** Server validates purchases, storage contents, carrying state, room membership, zone occupancy, placement, install legality. Client can predict movement locally.

**Purchase flow:** Player opens notebook → browses shop catalog → buys item → item appears as package in storage area → player walks to storage → picks up box → carries to datacenter → places/installs.

---

## Client Architecture

### New folder structure:
```
client/src/
  game/
    scenes/
      BootScene.ts
      PreloadScene.ts
      WorldScene.ts
      UIScene.ts
      RackInstallScene.ts
    entities/
      PlayerController.ts
      CarryableView.ts
      RackView.ts
      InteractableView.ts
    systems/
      InputSystem.ts
      InteractionSystem.ts
      CameraSystem.ts
      AudioSystem.ts
      WorldSyncSystem.ts
    tilemaps/
    prefabs/
  state/
    sessionStore.ts      # server snapshot mirror + connection state
    viewModelStore.ts    # minimal UI state (pause, debug flags, open modal)
  rpc/                   # keep existing
  sync/                  # keep existing
  ui-react/              # minimal React (dev tools, save/load only)
    DevPanel.tsx
    SaveLoadModal.tsx
```

### Input:
- WASD/arrows for movement
- E to interact
- Space to pick up / place
- Mouse optional, not primary
- Phaser owns all gameplay input

---

## What Survives From Current Codebase

### Keep:
- Server authoritative model + RPC transport
- WebSocket/JSON-RPC plumbing (`client/src/rpc`, `client/src/sync`, `server/src/rpc`, `server/src/sync`)
- Simulation engine (`server/src/engine/simulation/`)
- Equipment & economy config (`server/src/engine/config/`)
- Shared types for Rack, Device, Client, Connection, Link

### Rewrite:
- `RackScene.ts` → new scene structure
- `PhaserGame.tsx` → new scene registration
- `App.tsx` → minimal shell
- Most React side panels

### React that can survive temporarily:
- Save/load, event log, debug tools, maybe tracer

### React to remove from primary flow:
- EquipmentShop (replaced by in-game staff computer/laptop interaction), DevicePanel, CablePanel, tutorial overlays

---

## Sprint Breakdown

### Sprint 1: World Foundation (1-2 weeks)
- Add new shared spatial types
- Extend server state factory with world map, player, storage, items
- Add WorldScene: checkpoint → yard (storage building + datacenter facade) → datacenter interior (staff area + server floor)
- Player spawn at checkpoint, camera follow, collision
- **Deliverable:** Walk from checkpoint through yard into datacenter interior

### Sprint 2: Interaction Framework (1-2 weeks)
- Input system, interaction prompts, overlap detection
- Server actions: movePlayer, interact, enterDoor
- Ambience/audio region switching (exterior yard vs interior HVAC hum)
- **Deliverable:** Fully traversable slice with prompts, gate, and building entry

### Sprint 3: Shop Computer & Storage Loop (1-2 weeks)
- Staff computer UI inside datacenter: interact to open shop catalog, buy items
- Storage building in yard: purchased items appear as package boxes on shelves
- pickupFromStorage + carried-item visual follow
- Optional: laptop as purchasable item (portable shop access)
- **Deliverable:** Buy a rack from computer, walk to storage, pick up box, carry it around

### Sprint 4: Rack Placement (1-2 weeks)
- Placement zones on datacenter floor
- placeRack validation and world persistence
- Render placed rack as world object with collision
- **Deliverable:** Place a rack onto the datacenter floor

### Sprint 5: Device Install Loop (1-2 weeks)
- Device listing in shop computer, buy, pick up from storage, carry device
- Rack interaction for installing device
- Reuse existing server PLACE_DEVICE logic behind installDevice
- **Deliverable:** Rack + one installed server/switch

### Sprint 6: UX Pass (1-2 weeks)
- Minimal HUD in UIScene
- Objective flow: "use computer, buy rack, walk to storage, pick up box, place rack, install device"
- Audio pass, screen transitions, interaction polish
- Remove/disable obsolete React panels
- **Deliverable:** First end-to-end playable vertical slice

### Sprint 7 (optional): Close-Up Rack View
- RackInstallScene or modal subscene
- Show installed hardware visually
- **Deliverable:** Better install readability

---

## Art / Asset Requirements

### Needed (placeholders OK):
**Tiles:**
- Checkpoint / gate area
- Yard ground (asphalt/concrete, fencing)
- Storage building exterior + interior (shelving, delivery zone)
- Front-facing datacenter building facade
- Building entrance / door sprite
- Interior datacenter floor tiles (raised floor, cable trenches)
- Staff area tiles (desk, computer)
- Wall tiles + collision markers

**Sprites:**
- Player sprite sheet: idle/walk in 4 directions
- Empty rack (world-scale)
- Package box (on shelf + carried)
- Installed device (rack close-up or front)
- Storage shelves with packages
- Placement zone highlight decal
- Staff computer / desk
- Laptop (purchasable item)

**Props:**
- Cart, desk, cable spool, lamp, delivery boxes, shelving, fence, gate

**Audio:**
- Exterior ambience
- Indoor HVAC hum
- Footsteps
- Purchase confirm
- Pickup/place sounds
- Door open sound

### Placeholder strategy:
- Use procedural/simple placeholder art first (extend TextureGenerator.ts approach)
- Cheap placeholder tileset or block colors with strong readability
- Prioritize collision readability and silhouette over beauty
