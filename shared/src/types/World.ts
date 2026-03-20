// --- Spatial primitives ---

export interface Vec2 {
  x: number;
  y: number;
}

export type Facing = "up" | "down" | "left" | "right";
export type RoomId = string;
export type ItemId = string;
export type InteractableId = string;

// --- Room ---

export type RoomKind = "exterior" | "lobby" | "shop" | "datacenter" | "office";

export interface Room {
  id: RoomId;
  kind: RoomKind;
  name: string;
  /** Width in tiles */
  widthTiles: number;
  /** Height in tiles */
  heightTiles: number;
  /** Named spawn points (e.g. "from-exterior", "from-datacenter") */
  spawnPoints: Record<string, Vec2>;
  placementZones: Record<string, PlacementZone>;
  interactables: Record<InteractableId, Interactable>;
}

// --- Placement zones (where racks/items can be placed on the floor) ---

export type PlacementKind = "rack_slot" | "floor_item" | "shop_display";

export interface PlacementZone {
  id: string;
  roomId: RoomId;
  kind: PlacementKind;
  /** Position in pixels (world coords) */
  position: Vec2;
  /** Size in pixels */
  size: { w: number; h: number };
  occupiedByItemId: string | null;
}

// --- Interactables (doors, shop counter, terminals, etc.) ---

export type InteractableKind =
  | "door"
  | "shop_counter"
  | "shop_display"
  | "rack_pad"
  | "rack"
  | "terminal";

export interface Interactable {
  id: InteractableId;
  kind: InteractableKind;
  roomId: RoomId;
  /** Position in pixels (world coords) */
  position: Vec2;
  /** Size in pixels */
  size: { w: number; h: number };
  enabled: boolean;
  /** Kind-specific data (e.g. door target room, shop listing ref) */
  data: Record<string, unknown>;
}

// --- Player ---

export interface PlayerState {
  roomId: RoomId;
  position: Vec2;
  facing: Facing;
  carryingItemId: ItemId | null;
}

// --- Items (physical objects in the world) ---

export type ItemKind = "rack" | "device" | "tool" | "decor";
export type ItemState = "shop" | "carried" | "placed" | "installed";

export interface ItemInstance {
  id: ItemId;
  kind: ItemKind;
  /** References equipment catalog model (e.g. "server_1u", "rack_42u") */
  model: string;
  state: ItemState;
  roomId: RoomId | null;
  /** World position when placed/shop; null when carried/installed */
  position: Vec2 | null;
  /** For installed devices: which rack ID */
  installedInRackId: string | null;
  /** For installed devices: which U slot */
  installedAtSlotU: number | null;
}

// --- Shop ---

export interface ShopListing {
  id: string;
  model: string;
  itemKind: ItemKind;
  name: string;
  price: number;
  /** null = unlimited stock */
  stock: number | null;
}

export interface ShopState {
  listings: Record<string, ShopListing>;
}

// --- World container ---

export interface WorldState {
  rooms: Record<RoomId, Room>;
  player: PlayerState;
  items: Record<ItemId, ItemInstance>;
  shop: ShopState;
}
