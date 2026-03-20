# Migration Plan: Explorable Physical World (Uncle Chop Style)

## Goal
Transform DowntimeOPS from "React panels + Phaser rack view" into an explorable physical-space game where the player walks around, picks up equipment, carries it, and physically installs it. Phaser-first, React-minimal.

---

## Vertical Slice Scope

Prove one thing: **walking around and physically doing datacenter work feels better than clicking panels.**

What's in the slice:
- Exterior approach: one building facade, one door, short walk-in
- Interior: one small lobby/shop corner + one datacenter room
- One player avatar with 8-direction movement
- Buy one empty rack from the shop
- Carry rack to a highlighted floor slot, place it
- Buy one server/switch, carry it to the rack, install it
- Money decreases, installed item appears, audio feedback
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
| `WorldScene` | Main explorable map — exterior, lobby/shop, datacenter floor in one tilemap |
| `UIScene` | Screen-space HUD only — money, objective, interaction prompt, pause |
| `RackInstallScene` | Optional close-up for rack/device install |

### World approach:
- One tilemap for the slice (no scene-swapping between rooms)
- Rooms = zones inside a single map
- Camera follow on player with deadzone and bounds
- World size: ~80x50 to 120x70 tiles (16x16 or 32x32)
- Collision layers: walls, counters, placed racks, blocked tiles
- Interaction zones: doors, shop counter, rack placement pads, installed rack hotspots
- Door transitions: fade, reposition player, adjust ambience (same scene)

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
  kind: "exterior" | "lobby" | "shop" | "datacenter" | "office";
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
  kind: "rack_slot" | "floor_item" | "shop_display";
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
  state: "shop" | "reserved" | "placed" | "carried" | "installed";
  roomId: RoomId | null;
  position: Vec2 | null;
  owner: "world" | "player" | "shop" | "rack";
  ownerRef: string | null;
}
```

### `Shop.ts`
```ts
export interface ShopListing {
  id: string;
  model: string;
  itemKind: "rack" | "device";
  price: number;
  stock: number | null;
  displayInteractableId: string;
}

export interface ShopState {
  listings: Record<string, ShopListing>;
}
```

### `Interactable.ts`
```ts
export interface Interactable {
  id: InteractableId;
  kind: "door" | "shop_counter" | "shop_display" | "rack_pad" | "rack" | "terminal";
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
shop: ShopState
```

**Key modeling rule:** Keep `Rack` and `Device` as simulation/business entities. `ItemInstance` is the spatial layer that points to rack/device IDs. Don't overload `Rack` with floor transform data.

---

## New Server RPC Actions

```ts
{ type: "MOVE_PLAYER"; position: Vec2; facing: Facing; seq: number }
{ type: "INTERACT"; interactableId: string }
{ type: "BUY_ITEM"; listingId: string }
{ type: "PICKUP_ITEM"; itemId: string }
{ type: "DROP_ITEM"; roomId: string; position: Vec2 }
{ type: "PLACE_RACK"; itemId: string; zoneId: string }
{ type: "INSTALL_DEVICE"; itemId: string; rackId: string; slotU: number }
{ type: "ENTER_DOOR"; interactableId: string }
```

JSON-RPC methods: `movePlayer`, `interact`, `buyItem`, `pickupItem`, `dropItem`, `placeRack`, `installDevice`, `enterDoor`

**Authority:** Server validates purchases, carrying state, room membership, zone occupancy, placement, install legality. Client can predict movement locally.

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
- EquipmentShop, DevicePanel, CablePanel, tutorial overlays

---

## Sprint Breakdown

### Sprint 1: World Foundation (1-2 weeks)
- Add new shared spatial types
- Extend server state factory with world map, player, shop, items
- Add WorldScene, tilemap loading, player spawn, camera follow
- Add collision and door/interactable zones
- **Deliverable:** Walk from exterior into interior

### Sprint 2: Interaction Framework (1-2 weeks)
- Input system, interaction prompts, overlap detection
- Server actions: movePlayer, interact, enterDoor
- Ambience/audio region switching
- **Deliverable:** Fully traversable slice with prompts and room transitions

### Sprint 3: Shop & Carry Loop (1-2 weeks)
- Shop listings/state and buyItem
- Spawn purchased item into shop pickup area
- pickupItem + carried-item visual follow
- **Deliverable:** Buy a rack and carry it around

### Sprint 4: Rack Placement (1-2 weeks)
- Placement zones on datacenter floor
- placeRack validation and world persistence
- Render placed rack as world object with collision
- **Deliverable:** Place a rack onto the datacenter floor

### Sprint 5: Device Install Loop (1-2 weeks)
- Device listing, buy/carry device
- Rack interaction for installing device
- Reuse existing server PLACE_DEVICE logic behind installDevice
- **Deliverable:** Rack + one installed server/switch

### Sprint 6: UX Pass (1-2 weeks)
- Minimal HUD in UIScene
- Objective flow: "buy rack, place rack, install device"
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
- Exterior building facade
- Door sprite / doorway tiles
- Interior floor tiles (lobby/shop + datacenter)
- Wall tiles + collision markers

**Sprites:**
- Player sprite sheet: idle/walk in 4 directions
- Empty rack (world-scale)
- Device crate/box (carried)
- Installed device (rack close-up or front)
- Shop counter/display
- Placement zone highlight decal

**Props:**
- Cart, desk, cable spool, lamp, boxes

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
