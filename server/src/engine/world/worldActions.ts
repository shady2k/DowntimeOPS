import type {
  GameState,
  Vec2,
  Facing,
  ItemInstance,
  PlayerState,
} from "@downtime-ops/shared";
import type { EngineResult } from "../index";
import { TILE_SIZE } from "./worldFactory";

function genId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

// --- World action types ---

export type WorldAction =
  | { type: "MOVE_PLAYER"; position: Vec2; facing: Facing }
  | { type: "ENTER_DOOR"; interactableId: string }
  | { type: "EDGE_EXIT"; side: "left" | "right" }
  | { type: "BUY_ITEM"; listingId: string }
  | { type: "PICKUP_ITEM"; itemId: string }
  | { type: "DROP_ITEM"; position: Vec2 }
  | { type: "PLACE_RACK"; itemId: string; zoneId: string }
  | { type: "INSTALL_DEVICE"; itemId: string; rackItemId: string; slotU: number };

// --- Action dispatcher ---

export function applyWorldAction(
  state: GameState,
  action: WorldAction,
): EngineResult {
  switch (action.type) {
    case "MOVE_PLAYER":
      return movePlayer(state, action.position, action.facing);
    case "ENTER_DOOR":
      return enterDoor(state, action.interactableId);
    case "EDGE_EXIT":
      return edgeExit(state, action.side);
    case "BUY_ITEM":
      return buyItem(state, action.listingId);
    case "PICKUP_ITEM":
      return pickupItem(state, action.itemId);
    case "DROP_ITEM":
      return dropItem(state, action.position);
    case "PLACE_RACK":
      return placeRack(state, action.itemId, action.zoneId);
    case "INSTALL_DEVICE":
      return installDevice(state, action.itemId, action.rackItemId, action.slotU);
    default: {
      const _exhaustive: never = action;
      return { state, error: `Unknown world action type: ${(_exhaustive as { type: string }).type}` };
    }
  }
}

// --- Handlers ---

function movePlayer(
  state: GameState,
  position: Vec2,
  facing: Facing,
): EngineResult {
  const player = state.world.player;
  const room = state.world.rooms[player.roomId];
  if (!room) return { state, error: "Player is in unknown room" };

  const newPlayer: PlayerState = {
    ...player,
    position,
    facing,
  };

  // If carrying an item, update item position too
  let newItems = state.world.items;
  if (player.carryingItemId) {
    const item = newItems[player.carryingItemId];
    if (item) {
      newItems = {
        ...newItems,
        [item.id]: { ...item, position },
      };
    }
  }

  return {
    state: {
      ...state,
      world: {
        ...state.world,
        player: newPlayer,
        items: newItems,
      },
    },
  };
}

function enterDoor(
  state: GameState,
  interactableId: string,
): EngineResult {
  const player = state.world.player;
  const room = state.world.rooms[player.roomId];
  if (!room) return { state, error: "Player room not found" };

  const door = room.interactables[interactableId];
  if (!door) return { state, error: "Interactable not found" };
  if (door.kind !== "door") return { state, error: "Not a door" };
  if (!door.enabled) return { state, error: "Door is locked" };

  const targetRoomId = door.data.targetRoom as string;
  const spawnPoint = door.data.spawnPoint as string;

  const targetRoom = state.world.rooms[targetRoomId];
  if (!targetRoom) return { state, error: `Target room ${targetRoomId} not found` };

  const spawnPos = targetRoom.spawnPoints[spawnPoint] || targetRoom.spawnPoints["default"];
  if (!spawnPos) return { state, error: "No spawn point in target room" };

  const newPlayer: PlayerState = {
    ...player,
    roomId: targetRoomId,
    position: spawnPos,
    facing: "down",
  };

  // Move carried item to new room
  let newItems = state.world.items;
  if (player.carryingItemId) {
    const item = newItems[player.carryingItemId];
    if (item) {
      newItems = {
        ...newItems,
        [item.id]: { ...item, roomId: targetRoomId, position: spawnPos },
      };
    }
  }

  return {
    state: {
      ...state,
      world: {
        ...state.world,
        player: newPlayer,
        items: newItems,
      },
    },
  };
}

function edgeExit(
  state: GameState,
  side: "left" | "right",
): EngineResult {
  const player = state.world.player;
  const room = state.world.rooms[player.roomId];
  if (!room) return { state, error: "Player room not found" };

  const exit = room.edgeExits?.[side];
  if (!exit) return { state, error: `No edge exit on ${side} side` };

  const targetRoom = state.world.rooms[exit.targetRoom];
  if (!targetRoom) return { state, error: `Target room ${exit.targetRoom} not found` };

  const spawnPos = targetRoom.spawnPoints[exit.spawnPoint] || targetRoom.spawnPoints["default"];
  if (!spawnPos) return { state, error: "No spawn point in target room" };

  const newPlayer: PlayerState = {
    ...player,
    roomId: exit.targetRoom,
    position: spawnPos,
    facing: side === "left" ? "left" : "right",
  };

  // Move carried item to new room
  let newItems = state.world.items;
  if (player.carryingItemId) {
    const item = newItems[player.carryingItemId];
    if (item) {
      newItems = {
        ...newItems,
        [item.id]: { ...item, roomId: exit.targetRoom, position: spawnPos },
      };
    }
  }

  return {
    state: {
      ...state,
      world: {
        ...state.world,
        player: newPlayer,
        items: newItems,
      },
    },
  };
}

function buyItem(
  state: GameState,
  listingId: string,
): EngineResult {
  const listing = state.world.shop.listings[listingId];
  if (!listing) return { state, error: "Listing not found" };

  if (state.money < listing.price) {
    return { state, error: "Not enough money" };
  }

  if (listing.stock !== null && listing.stock <= 0) {
    return { state, error: "Out of stock" };
  }

  // Create an item instance in "carried" state — player grabs it immediately
  const itemId = genId("item");
  const player = state.world.player;

  const item: ItemInstance = {
    id: itemId,
    kind: listing.itemKind,
    model: listing.model,
    state: "carried",
    roomId: player.roomId,
    position: player.position,
    installedInRackId: null,
    installedAtSlotU: null,
  };

  // Update stock if limited
  let newListings = state.world.shop.listings;
  if (listing.stock !== null) {
    newListings = {
      ...newListings,
      [listingId]: { ...listing, stock: listing.stock - 1 },
    };
  }

  return {
    state: {
      ...state,
      money: state.money - listing.price,
      world: {
        ...state.world,
        player: { ...player, carryingItemId: itemId },
        items: { ...state.world.items, [itemId]: item },
        shop: { ...state.world.shop, listings: newListings },
      },
      log: [
        ...state.log,
        {
          id: genId("log"),
          tick: state.tick,
          message: `Bought ${listing.name} for $${listing.price}`,
          category: "system" as const,
        },
      ],
    },
  };
}

function pickupItem(
  state: GameState,
  itemId: string,
): EngineResult {
  const player = state.world.player;

  if (player.carryingItemId) {
    return { state, error: "Already carrying something" };
  }

  const item = state.world.items[itemId];
  if (!item) return { state, error: "Item not found" };
  if (item.state !== "placed") return { state, error: "Can only pick up placed items" };
  if (item.roomId !== player.roomId) return { state, error: "Item is in another room" };

  // Check proximity (within 2 tiles)
  const dist = Math.hypot(
    item.position!.x - player.position.x,
    item.position!.y - player.position.y,
  );
  if (dist > TILE_SIZE * 3) {
    return { state, error: "Too far away" };
  }

  // If this was on a placement zone, free the zone
  let newRooms = state.world.rooms;
  const room = newRooms[player.roomId];
  if (room) {
    const updatedZones = { ...room.placementZones };
    for (const [zoneId, zone] of Object.entries(updatedZones)) {
      if (zone.occupiedByItemId === itemId) {
        updatedZones[zoneId] = { ...zone, occupiedByItemId: null };
      }
    }
    newRooms = {
      ...newRooms,
      [player.roomId]: { ...room, placementZones: updatedZones },
    };
  }

  return {
    state: {
      ...state,
      world: {
        ...state.world,
        player: { ...player, carryingItemId: itemId },
        items: {
          ...state.world.items,
          [itemId]: { ...item, state: "carried", position: player.position },
        },
        rooms: newRooms,
      },
    },
  };
}

function dropItem(
  state: GameState,
  position: Vec2,
): EngineResult {
  const player = state.world.player;

  if (!player.carryingItemId) {
    return { state, error: "Not carrying anything" };
  }

  const item = state.world.items[player.carryingItemId];
  if (!item) return { state, error: "Carried item not found" };

  return {
    state: {
      ...state,
      world: {
        ...state.world,
        player: { ...player, carryingItemId: null },
        items: {
          ...state.world.items,
          [item.id]: {
            ...item,
            state: "placed",
            roomId: player.roomId,
            position,
          },
        },
      },
    },
  };
}

function placeRack(
  state: GameState,
  itemId: string,
  zoneId: string,
): EngineResult {
  const player = state.world.player;

  // Must be carrying this item
  if (player.carryingItemId !== itemId) {
    return { state, error: "Not carrying this item" };
  }

  const item = state.world.items[itemId];
  if (!item) return { state, error: "Item not found" };
  if (item.kind !== "rack") return { state, error: "Item is not a rack" };

  const room = state.world.rooms[player.roomId];
  if (!room) return { state, error: "Room not found" };

  const zone = room.placementZones[zoneId];
  if (!zone) return { state, error: "Placement zone not found" };
  if (zone.occupiedByItemId) return { state, error: "Zone is already occupied" };
  if (zone.kind !== "rack_slot") return { state, error: "Zone is not a rack slot" };

  // Check proximity
  const dist = Math.hypot(
    zone.position.x - player.position.x,
    zone.position.y - player.position.y,
  );
  if (dist > TILE_SIZE * 4) {
    return { state, error: "Too far from placement zone" };
  }

  // Also create a corresponding Rack in the simulation state
  const rackId = genId("rack");

  return {
    state: {
      ...state,
      racks: {
        ...state.racks,
        [rackId]: {
          id: rackId,
          name: `Rack ${Object.keys(state.racks).length + 1}`,
          totalU: 42,
          devices: {},
          powerBudgetWatts: 5000,
          currentPowerWatts: 0,
        },
      },
      world: {
        ...state.world,
        player: { ...player, carryingItemId: null },
        items: {
          ...state.world.items,
          [itemId]: {
            ...item,
            state: "placed",
            roomId: player.roomId,
            position: zone.position,
            installedInRackId: rackId,
          },
        },
        rooms: {
          ...state.world.rooms,
          [player.roomId]: {
            ...room,
            placementZones: {
              ...room.placementZones,
              [zoneId]: { ...zone, occupiedByItemId: itemId },
            },
          },
        },
      },
      log: [
        ...state.log,
        {
          id: genId("log"),
          tick: state.tick,
          message: `Placed rack on datacenter floor`,
          category: "system" as const,
        },
      ],
    },
  };
}

/**
 * INSTALL_DEVICE only validates and updates world state.
 * The caller (engine/index.ts) chains this with PLACE_DEVICE
 * to also create the simulation-layer device.
 */
function installDevice(
  state: GameState,
  itemId: string,
  rackItemId: string,
  _slotU: number,
): EngineResult {
  const player = state.world.player;

  if (player.carryingItemId !== itemId) {
    return { state, error: "Not carrying this item" };
  }

  const item = state.world.items[itemId];
  if (!item) return { state, error: "Item not found" };
  if (item.kind !== "device") return { state, error: "Item is not a device" };

  const rackItem = state.world.items[rackItemId];
  if (!rackItem) return { state, error: "Rack item not found" };
  if (!rackItem.installedInRackId) return { state, error: "Rack has no simulation rack" };

  const rackId = rackItem.installedInRackId;

  // Only update world layer — the caller will chain PLACE_DEVICE
  return {
    state: {
      ...state,
      world: {
        ...state.world,
        player: { ...player, carryingItemId: null },
        items: {
          ...state.world.items,
          [itemId]: {
            ...item,
            state: "installed",
            roomId: player.roomId,
            position: rackItem.position,
            installedInRackId: rackId,
            installedAtSlotU: _slotU,
          },
        },
      },
    },
  };
}
