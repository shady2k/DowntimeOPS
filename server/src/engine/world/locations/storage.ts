import type { Room, PlacementZone } from "@downtime-ops/shared";
import { TILE_SIZE, tileToPixel } from "../worldFactory";

export const STORAGE_LAYOUT = {
  x: 0,
  y: 0,
  width: 30,
  height: 20,
} as const;

/** Number of shelf slots for package pickup */
const SHELF_COUNT = 4;

export function createStorageRoom(): Room {
  const L = STORAGE_LAYOUT;

  // Storage shelves where purchased packages appear
  const shelves: Record<string, PlacementZone> = {};
  for (let i = 0; i < SHELF_COUNT; i++) {
    const shelfId = `storage-shelf-${i}`;
    shelves[shelfId] = {
      id: shelfId,
      roomId: "storage",
      kind: "storage_shelf",
      position: tileToPixel(6 + i * 5, 4),
      size: { w: 3 * TILE_SIZE, h: 4 * TILE_SIZE },
      occupiedByItemId: null,
    };
  }

  return {
    id: "storage",
    kind: "storage",
    name: "Storage",
    widthTiles: L.width,
    heightTiles: L.height,
    spawnPoints: {
      "from-yard": tileToPixel(L.width - 2, L.height / 2),
      default: tileToPixel(L.width / 2, L.height / 2),
    },
    placementZones: shelves,
    interactables: {},
  };
}
