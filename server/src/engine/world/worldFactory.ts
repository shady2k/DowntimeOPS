import type {
  WorldState,
  Room,
  ShopState,
  PlayerState,
  Interactable,
  PlacementZone,
} from "@downtime-ops/shared";
import { EQUIPMENT_CATALOG } from "../config/equipment";

/**
 * Tile size in pixels — all world positions are in pixels.
 * The tilemap uses 32x32 tiles.
 */
export const TILE_SIZE = 32;

/**
 * World layout constants (in tiles).
 * The world is a single continuous space with rooms defined as zones.
 */
export const WORLD_LAYOUT = {
  // Total world size
  worldWidth: 60, // tiles
  worldHeight: 40, // tiles

  // Exterior: top portion of the map
  exterior: {
    x: 0,
    y: 0,
    width: 60,
    height: 12,
  },

  // Lobby / shop area: left side of the building interior
  lobby: {
    x: 8,
    y: 14,
    width: 20,
    height: 24,
  },

  // Datacenter room: right side of the building interior
  datacenter: {
    x: 30,
    y: 14,
    width: 26,
    height: 24,
  },

  // Door from exterior into lobby
  exteriorDoor: {
    x: 18,
    y: 12,
    width: 2,
    height: 2,
  },

  // Door from lobby into datacenter
  lobbyToDcDoor: {
    x: 28,
    y: 24,
    width: 2,
    height: 2,
  },
} as const;

function tileToPixel(tileX: number, tileY: number) {
  return {
    x: tileX * TILE_SIZE + TILE_SIZE / 2,
    y: tileY * TILE_SIZE + TILE_SIZE / 2,
  };
}

function createRooms(): Record<string, Room> {
  const L = WORLD_LAYOUT;

  const exteriorRoom: Room = {
    id: "exterior",
    kind: "exterior",
    name: "Outside",
    widthTiles: L.exterior.width,
    heightTiles: L.exterior.height,
    spawnPoints: {
      default: tileToPixel(L.exteriorDoor.x, L.exterior.y + 4),
    },
    placementZones: {},
    interactables: {
      "door-to-lobby": {
        id: "door-to-lobby",
        kind: "door",
        roomId: "exterior",
        position: tileToPixel(L.exteriorDoor.x, L.exteriorDoor.y),
        size: { w: L.exteriorDoor.width * TILE_SIZE, h: L.exteriorDoor.height * TILE_SIZE },
        enabled: true,
        data: { targetRoom: "lobby", spawnPoint: "from-exterior" },
      },
    },
  };

  // Build shop interactables from equipment catalog
  const shopInteractables: Record<string, Interactable> = {
    "door-to-exterior": {
      id: "door-to-exterior",
      kind: "door",
      roomId: "lobby",
      position: tileToPixel(L.exteriorDoor.x, L.lobby.y),
      size: { w: L.exteriorDoor.width * TILE_SIZE, h: 2 * TILE_SIZE },
      enabled: true,
      data: { targetRoom: "exterior", spawnPoint: "from-lobby" },
    },
    "door-to-datacenter": {
      id: "door-to-datacenter",
      kind: "door",
      roomId: "lobby",
      position: tileToPixel(L.lobbyToDcDoor.x, L.lobbyToDcDoor.y),
      size: { w: L.lobbyToDcDoor.width * TILE_SIZE, h: L.lobbyToDcDoor.height * TILE_SIZE },
      enabled: true,
      data: { targetRoom: "datacenter", spawnPoint: "from-lobby" },
    },
    "shop-counter": {
      id: "shop-counter",
      kind: "shop_counter",
      roomId: "lobby",
      position: tileToPixel(L.lobby.x + 4, L.lobby.y + 6),
      size: { w: 6 * TILE_SIZE, h: 2 * TILE_SIZE },
      enabled: true,
      data: {},
    },
  };

  const lobbyRoom: Room = {
    id: "lobby",
    kind: "lobby",
    name: "Lobby & Shop",
    widthTiles: L.lobby.width,
    heightTiles: L.lobby.height,
    spawnPoints: {
      "from-exterior": tileToPixel(L.exteriorDoor.x, L.lobby.y + 2),
      default: tileToPixel(L.lobby.x + 10, L.lobby.y + 12),
    },
    placementZones: {},
    interactables: shopInteractables,
  };

  // Datacenter placement zones — 6 rack slots on the floor
  const dcPlacementZones: Record<string, PlacementZone> = {};
  const rackSlotStartX = L.datacenter.x + 3;
  const rackSlotStartY = L.datacenter.y + 4;
  const rackSlotSpacing = 4; // tiles apart

  for (let i = 0; i < 6; i++) {
    const zoneId = `rack-slot-${i}`;
    dcPlacementZones[zoneId] = {
      id: zoneId,
      roomId: "datacenter",
      kind: "rack_slot",
      position: tileToPixel(
        rackSlotStartX + (i % 3) * rackSlotSpacing,
        rackSlotStartY + Math.floor(i / 3) * 8,
      ),
      size: { w: 3 * TILE_SIZE, h: 6 * TILE_SIZE },
      occupiedByItemId: null,
    };
  }

  const datacenterRoom: Room = {
    id: "datacenter",
    kind: "datacenter",
    name: "Datacenter Floor",
    widthTiles: L.datacenter.width,
    heightTiles: L.datacenter.height,
    spawnPoints: {
      "from-lobby": tileToPixel(L.lobbyToDcDoor.x, L.datacenter.y + 2),
      default: tileToPixel(L.datacenter.x + 10, L.datacenter.y + 10),
    },
    placementZones: dcPlacementZones,
    interactables: {
      "door-to-lobby": {
        id: "door-to-lobby",
        kind: "door",
        roomId: "datacenter",
        position: tileToPixel(L.lobbyToDcDoor.x, L.datacenter.y),
        size: { w: L.lobbyToDcDoor.width * TILE_SIZE, h: 2 * TILE_SIZE },
        enabled: true,
        data: { targetRoom: "lobby", spawnPoint: "from-datacenter" },
      },
    },
  };

  return {
    exterior: exteriorRoom,
    lobby: lobbyRoom,
    datacenter: datacenterRoom,
  };
}

function createShop(): ShopState {
  const listings: ShopState["listings"] = {
    "shop-rack-42u": {
      id: "shop-rack-42u",
      model: "rack_42u",
      itemKind: "rack",
      name: "42U Server Rack",
      price: 5000,
      stock: null,
    },
  };

  // Add equipment catalog items as device listings
  for (const [model, template] of Object.entries(EQUIPMENT_CATALOG)) {
    listings[`shop-${model}`] = {
      id: `shop-${model}`,
      model,
      itemKind: "device",
      name: template.name,
      price: template.cost,
      stock: null,
    };
  }

  return { listings };
}

function createPlayer(): PlayerState {
  const L = WORLD_LAYOUT;
  return {
    roomId: "exterior",
    position: tileToPixel(L.exteriorDoor.x, L.exterior.y + 6),
    facing: "down",
    carryingItemId: null,
  };
}

export function createInitialWorld(): WorldState {
  return {
    rooms: createRooms(),
    player: createPlayer(),
    items: {},
    shop: createShop(),
  };
}
