import type { DeviceType } from "./Device";
import type { PortType } from "./Port";

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

export type RoomKind = "checkpoint" | "yard" | "storage" | "datacenter" | "office";

// --- Storage (packages awaiting pickup) ---

export interface StoragePackage {
  itemId: ItemId;
  purchasedAt: number; // game tick
}

export interface StorageState {
  packages: Record<ItemId, StoragePackage>;
}

/** Auto-transition when player reaches a screen edge */
export interface EdgeExit {
  targetRoom: RoomId;
  spawnPoint: string;
}

export interface Room {
  id: RoomId;
  kind: RoomKind;
  name: string;
  /** Width in tiles */
  widthTiles: number;
  /** Height in tiles */
  heightTiles: number;
  /** Named spawn points (e.g. "from-checkpoint", "from-yard") */
  spawnPoints: Record<string, Vec2>;
  placementZones: Record<string, PlacementZone>;
  interactables: Record<InteractableId, Interactable>;
  /** Auto-transition at screen edges */
  edgeExits?: {
    left?: EdgeExit;
    right?: EdgeExit;
  };
}

// --- Placement zones (where racks/items can be placed on the floor) ---

export type PlacementKind = "rack_slot" | "floor_item" | "storage_shelf";

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
  | "rack_pad"
  | "rack"
  | "storage_shelf"
  | "staff_computer"
  | "laptop"
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
  /** Player-facing interaction prompt (e.g. "Enter Yard", "Use Computer") */
  label: string;
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
export type ItemState = "in_storage" | "carried" | "placed" | "installed";

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

export interface ShopListingSpecs {
  type: DeviceType;
  powerDrawWatts: number;
  heatOutput: number;
  uHeight: number;
  ports: Array<{ type: PortType; count: number }>;
  /** Package box dimensions in pixels for storage rendering */
  packageSize: { w: number; h: number };
}

export interface ShopListing {
  id: string;
  model: string;
  itemKind: ItemKind;
  name: string;
  brand: string;
  description: string;
  specs: ShopListingSpecs;
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
  storage: StorageState;
}
