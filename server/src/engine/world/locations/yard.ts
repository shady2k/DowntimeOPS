import type { Room } from "@downtime-ops/shared";
import { TILE_SIZE, tileToPixel } from "../worldFactory";

export const YARD_LAYOUT = {
  x: 0,
  y: 0,
  width: 60,
  height: 20,
} as const;

/** X positions for key landmarks in the yard (in tiles) */
const STORAGE_DOOR_X = 12;
const DC_DOOR_X = 45;

export function createYardRoom(): Room {
  const L = YARD_LAYOUT;

  return {
    id: "yard",
    kind: "yard",
    name: "Yard",
    widthTiles: L.width,
    heightTiles: L.height,
    spawnPoints: {
      "from-checkpoint": tileToPixel(2, L.height / 2),
      "from-storage": tileToPixel(STORAGE_DOOR_X, L.height / 2),
      "from-datacenter": tileToPixel(DC_DOOR_X, L.height / 2),
      default: tileToPixel(L.width / 2, L.height / 2),
    },
    maxRacks: 0,
    placementZones: {},
    interactables: {
      "door-to-storage": {
        id: "door-to-storage",
        kind: "door",
        roomId: "yard",
        position: tileToPixel(STORAGE_DOOR_X, L.height / 2 - 2),
        size: { w: 3 * TILE_SIZE, h: 3 * TILE_SIZE },
        enabled: true,
        label: "Enter Storage",
        data: { targetRoom: "storage", spawnPoint: "from-yard" },
      },
      "door-to-datacenter": {
        id: "door-to-datacenter",
        kind: "door",
        roomId: "yard",
        position: tileToPixel(DC_DOOR_X, L.height / 2 - 2),
        size: { w: 3 * TILE_SIZE, h: 3 * TILE_SIZE },
        enabled: true,
        label: "Enter Datacenter",
        data: { targetRoom: "datacenter", spawnPoint: "from-yard" },
      },
    },
  };
}
