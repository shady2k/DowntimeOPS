import type {
  GameState,
  Vec2,
  Facing,
  ItemInstance,
  PlayerState,
  StoragePackage,
  CableStock,
} from "@downtime-ops/shared";
import type { EngineResult } from "../index";
import { TILE_SIZE } from "./worldFactory";
import { CABLE_CATALOG } from "./shop";

// --- Bespoke result type for batch purchase ---

export interface BuyCartResult {
  state: GameState;
  purchasedItemIds: string[];
  totalCost: number;
  error?: string;
}

function genId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nextRackNumber(state: GameState): number {
  let max = 0;
  for (const rack of Object.values(state.racks)) {
    const match = rack.name.match(/^Rack (\d+)$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

// --- World action types ---

export type WorldAction =
  | { type: "MOVE_PLAYER"; position: Vec2; facing: Facing }
  | { type: "ENTER_DOOR"; interactableId: string }
  | { type: "EDGE_EXIT"; side: "left" | "right" }
  | { type: "BUY_ITEM"; listingId: string }
  | { type: "PICKUP_ITEM"; itemId: string }
  | { type: "DROP_ITEM"; position: Vec2 }
  | { type: "PLACE_RACK"; itemId: string; slotIndex: number }
  | { type: "INSTALL_DEVICE"; itemId: string; rackItemId: string; slotU: number }
  | { type: "PICKUP_FROM_STORAGE"; shelfId: string }
  | { type: "INSTALL_DEVICE_FROM_STORAGE"; itemId: string; rackItemId: string; slotU: number };

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
      return placeRack(state, action.itemId, action.slotIndex);
    case "INSTALL_DEVICE":
      return installDevice(state, action.itemId, action.rackItemId, action.slotU);
    case "PICKUP_FROM_STORAGE":
      return pickupFromStorage(state, action.shelfId);
    case "INSTALL_DEVICE_FROM_STORAGE":
      return installDeviceFromStorage(state, action.itemId, action.rackItemId, action.slotU);
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
    rackSlotIndex: null,
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

  // Proximity check — racks don't have a position, skip for them
  if (item.position) {
    const distX = Math.abs(item.position.x - player.position.x);
    if (distX > TILE_SIZE * 6) {
      return { state, error: "Too far away" };
    }
  }

  // If picking up a rack, remove it from state.racks and uninstall devices to storage
  let newRacks = state.racks;
  let newDevices = state.devices;
  const newItems = { ...state.world.items };
  if (item.kind === "rack" && item.installedInRackId) {
    const oldRackId = item.installedInRackId;
    const { [oldRackId]: _removed, ...restRacks } = state.racks;
    newRacks = restRacks;

    // Uninstall all devices in this rack back to storage
    const updatedDevices = { ...state.devices };
    for (const [devId, device] of Object.entries(updatedDevices)) {
      if (device.rackId !== oldRackId) continue;
      // Remove device from devices map
      delete updatedDevices[devId];
      // Find the item for this device and mark it as stored
      for (const [iid, itm] of Object.entries(newItems)) {
        if (itm.kind === "device" && itm.state === "installed" &&
            itm.installedInRackId === oldRackId && itm.installedAtSlotU === device.slotU) {
          newItems[iid] = {
            ...itm,
            state: "in_storage",
            installedInRackId: null,
            installedAtSlotU: null,
          };
          break;
        }
      }
    }
    newDevices = updatedDevices;
  }

  return {
    state: {
      ...state,
      racks: newRacks,
      devices: newDevices,
      world: {
        ...state.world,
        player: { ...player, carryingItemId: itemId },
        items: {
          ...newItems,
          [itemId]: {
            ...item,
            state: "carried",
            position: player.position,
            rackSlotIndex: null,
            installedInRackId: null,
          },
        },
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
  slotIndex: number,
): EngineResult {
  const player = state.world.player;

  if (player.carryingItemId !== itemId) {
    return { state, error: "Not carrying this item" };
  }

  const item = state.world.items[itemId];
  if (!item) return { state, error: "Item not found" };
  if (item.kind !== "rack") return { state, error: "Item is not a rack" };

  const room = state.world.rooms[player.roomId];
  if (!room) return { state, error: "Room not found" };

  if (slotIndex < 0 || slotIndex >= room.maxRacks) {
    return { state, error: "Invalid rack slot" };
  }

  // Check slot is not already occupied
  const slotOccupied = Object.values(state.world.items).some(
    (i) => i.kind === "rack" && i.roomId === player.roomId && i.rackSlotIndex === slotIndex,
  );
  if (slotOccupied) return { state, error: "Rack slot is already occupied" };

  const rackId = genId("rack");

  return {
    state: {
      ...state,
      racks: {
        ...state.racks,
        [rackId]: {
          id: rackId,
          name: `Rack ${nextRackNumber(state)}`,
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
            position: null,
            installedInRackId: rackId,
            rackSlotIndex: slotIndex,
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

/**
 * INSTALL_DEVICE_FROM_STORAGE: pick item directly from storage and install in rack.
 * Combines pickup-from-storage + install in one atomic action.
 * The caller (engine/index.ts) chains with PLACE_DEVICE for simulation layer.
 */
function installDeviceFromStorage(
  state: GameState,
  itemId: string,
  rackItemId: string,
  slotU: number,
): EngineResult {
  const item = state.world.items[itemId];
  if (!item) return { state, error: "Item not found" };
  if (item.kind !== "device") return { state, error: "Item is not a device" };
  if (item.state !== "in_storage") return { state, error: "Item is not in storage" };

  const rackItem = state.world.items[rackItemId];
  if (!rackItem) return { state, error: "Rack item not found" };
  if (!rackItem.installedInRackId) return { state, error: "Rack has no simulation rack" };

  const rackId = rackItem.installedInRackId;

  // Remove from storage packages
  const newPackages = { ...state.world.storage.packages };
  delete newPackages[itemId];

  // Free the shelf this item occupies (if any)
  const storageRoom = state.world.rooms["storage"];
  let updatedRooms = state.world.rooms;

  if (storageRoom) {
    let updatedZones = { ...storageRoom.placementZones };
    for (const [zoneId, zone] of Object.entries(updatedZones)) {
      if (zone.kind === "storage_shelf" && zone.occupiedByItemId === itemId) {
        updatedZones[zoneId] = { ...zone, occupiedByItemId: null };

        // Auto-promote next queued package onto freed shelf
        const shelvesWithItems = new Set(
          Object.values(updatedZones)
            .filter((z) => z.kind === "storage_shelf" && z.occupiedByItemId)
            .map((z) => z.occupiedByItemId),
        );
        const unshelfedPackage = Object.values(newPackages).find(
          (pkg) => !shelvesWithItems.has(pkg.itemId),
        );
        if (unshelfedPackage) {
          updatedZones = {
            ...updatedZones,
            [zoneId]: { ...updatedZones[zoneId], occupiedByItemId: unshelfedPackage.itemId },
          };
        }
        break;
      }
    }
    updatedRooms = {
      ...state.world.rooms,
      storage: { ...storageRoom, placementZones: updatedZones },
    };
  }

  return {
    state: {
      ...state,
      world: {
        ...state.world,
        items: {
          ...state.world.items,
          [itemId]: {
            ...item,
            state: "installed",
            roomId: rackItem.roomId,
            position: rackItem.position,
            installedInRackId: rackId,
            installedAtSlotU: slotU,
          },
        },
        storage: { packages: newPackages },
        rooms: updatedRooms,
      },
    },
  };
}

// --- Batch purchase (bespoke, not in action pipeline) ---

export function buyCartItems(
  state: GameState,
  items: Array<{ listingId: string; quantity: number }>,
): BuyCartResult {
  // Normalize: aggregate duplicates, validate quantities
  const normalized = new Map<string, number>();
  for (const { listingId, quantity } of items) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { state, purchasedItemIds: [], totalCost: 0, error: `Invalid quantity for ${listingId}` };
    }
    normalized.set(listingId, (normalized.get(listingId) || 0) + quantity);
  }

  // Validate all listings exist and calculate total cost
  let totalCost = 0;
  for (const [listingId, qty] of normalized) {
    const listing = state.world.shop.listings[listingId];
    if (!listing) {
      return { state, purchasedItemIds: [], totalCost: 0, error: `Listing ${listingId} not found` };
    }
    if (listing.stock !== null && listing.stock < qty) {
      return { state, purchasedItemIds: [], totalCost: 0, error: `${listing.name} out of stock` };
    }
    totalCost += listing.price * qty;
  }

  if (state.money < totalCost) {
    return { state, purchasedItemIds: [], totalCost: 0, error: "Not enough money" };
  }

  // Find available storage shelves
  const storageRoom = state.world.rooms["storage"];
  const updatedZones = storageRoom ? { ...storageRoom.placementZones } : {};
  const availableShelves: string[] = [];
  for (const [zoneId, zone] of Object.entries(updatedZones)) {
    if (zone.kind === "storage_shelf" && !zone.occupiedByItemId) {
      availableShelves.push(zoneId);
    }
  }

  // Create items and storage packages
  const purchasedItemIds: string[] = [];
  const newItems = { ...state.world.items };
  const newPackages: Record<string, StoragePackage> = { ...state.world.storage.packages };
  const newListings = { ...state.world.shop.listings };
  const newCableStock: CableStock = { ...state.world.cableStock };
  let shelfIdx = 0;
  let cablesPurchased = 0;

  for (const [listingId, qty] of normalized) {
    const listing = state.world.shop.listings[listingId];

    // Cables go directly to cable stock (no physical item / storage)
    if (listing.itemKind === "cable") {
      const cableData = CABLE_CATALOG[listing.model];
      if (cableData) {
        newCableStock[cableData.cableType] += cableData.quantity * qty;
        cablesPurchased += cableData.quantity * qty;
      }
      if (listing.stock !== null) {
        newListings[listingId] = { ...listing, stock: listing.stock - qty };
      }
      continue;
    }

    for (let i = 0; i < qty; i++) {
      const itemId = genId("item");
      purchasedItemIds.push(itemId);

      const item: ItemInstance = {
        id: itemId,
        kind: listing.itemKind,
        model: listing.model,
        state: "in_storage",
        roomId: "storage",
        position: null,
        installedInRackId: null,
        installedAtSlotU: null,
        rackSlotIndex: null,
      };
      newItems[itemId] = item;
      newPackages[itemId] = { itemId, purchasedAt: state.tick };

      // Assign to shelf if available
      if (shelfIdx < availableShelves.length) {
        const shelfId = availableShelves[shelfIdx];
        updatedZones[shelfId] = { ...updatedZones[shelfId], occupiedByItemId: itemId };
        shelfIdx++;
      }
    }

    // Update stock if limited
    if (listing.stock !== null) {
      newListings[listingId] = { ...listing, stock: listing.stock - qty };
    }
  }

  // Build updated rooms
  let newRooms = state.world.rooms;
  if (storageRoom) {
    newRooms = {
      ...newRooms,
      storage: { ...storageRoom, placementZones: updatedZones },
    };
  }

  // Build log message
  const logParts: string[] = [];
  if (purchasedItemIds.length > 0) {
    logParts.push(`${purchasedItemIds.length} item(s) delivered to storage`);
  }
  if (cablesPurchased > 0) {
    logParts.push(`${cablesPurchased} cable(s) added to supplies`);
  }

  const newState: GameState = {
    ...state,
    money: state.money - totalCost,
    world: {
      ...state.world,
      items: newItems,
      storage: { packages: newPackages },
      shop: { ...state.world.shop, listings: newListings },
      rooms: newRooms,
      cableStock: newCableStock,
    },
    log: [
      ...state.log,
      {
        id: genId("log"),
        tick: state.tick,
        message: `Ordered for $${totalCost} — ${logParts.join(", ")}`,
        category: "system" as const,
      },
    ],
  };

  return { state: newState, purchasedItemIds, totalCost };
}

// --- Pickup from storage shelf ---

function pickupFromStorage(
  state: GameState,
  shelfId: string,
): EngineResult {
  const player = state.world.player;

  if (player.carryingItemId) {
    return { state, error: "Already carrying something" };
  }

  const storageRoom = state.world.rooms["storage"];
  if (!storageRoom) return { state, error: "Storage room not found" };

  const zone = storageRoom.placementZones[shelfId];
  if (!zone) return { state, error: "Shelf not found" };
  if (zone.kind !== "storage_shelf") return { state, error: "Not a storage shelf" };
  if (!zone.occupiedByItemId) return { state, error: "Shelf is empty" };

  const itemId = zone.occupiedByItemId;
  const item = state.world.items[itemId];
  if (!item) return { state, error: "Item not found" };

  // Remove from storage packages
  const newPackages = { ...state.world.storage.packages };
  delete newPackages[itemId];

  // Clear shelf
  let updatedZones = {
    ...storageRoom.placementZones,
    [shelfId]: { ...zone, occupiedByItemId: null },
  };

  // Auto-promote: move next queued package (without a shelf) onto the freed shelf
  const shelvesWithItems = new Set(
    Object.values(updatedZones)
      .filter((z) => z.kind === "storage_shelf" && z.occupiedByItemId)
      .map((z) => z.occupiedByItemId),
  );
  const unshelfedPackage = Object.values(newPackages).find(
    (pkg) => !shelvesWithItems.has(pkg.itemId),
  );
  if (unshelfedPackage) {
    updatedZones = {
      ...updatedZones,
      [shelfId]: { ...updatedZones[shelfId], occupiedByItemId: unshelfedPackage.itemId },
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
          [itemId]: {
            ...item,
            state: "carried",
            roomId: player.roomId,
            position: player.position,
          },
        },
        storage: { packages: newPackages },
        rooms: {
          ...state.world.rooms,
          storage: { ...storageRoom, placementZones: updatedZones },
        },
      },
    },
  };
}
