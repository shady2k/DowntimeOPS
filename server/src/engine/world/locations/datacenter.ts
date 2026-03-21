import type { Room, PlacementZone } from "@downtime-ops/shared";
import { TILE_SIZE, tileToPixel } from "../worldFactory";

export const DATACENTER_LAYOUT = {
  x: 0,
  y: 0,
  width: 40,
  height: 24,
} as const;

/** Rack placement grid config */
const RACK_COLS = 3;
const RACK_ROWS = 2;
const RACK_START_X = 20; // server floor area, right of staff desk
const RACK_START_Y = 5;
const RACK_SPACING_X = 5;
const RACK_SPACING_Y = 8;

/** Staff area config */
const STAFF_COMPUTER_X = 6;
const STAFF_COMPUTER_Y = 6;

export function createDatacenterRoom(): Room {
  const L = DATACENTER_LAYOUT;

  // Rack placement zones on the server floor (right side)
  const rackSlots: Record<string, PlacementZone> = {};
  for (let row = 0; row < RACK_ROWS; row++) {
    for (let col = 0; col < RACK_COLS; col++) {
      const i = row * RACK_COLS + col;
      const zoneId = `rack-slot-${i}`;
      rackSlots[zoneId] = {
        id: zoneId,
        roomId: "datacenter",
        kind: "rack_slot",
        position: tileToPixel(
          RACK_START_X + col * RACK_SPACING_X,
          RACK_START_Y + row * RACK_SPACING_Y,
        ),
        size: { w: 3 * TILE_SIZE, h: 6 * TILE_SIZE },
        occupiedByItemId: null,
      };
    }
  }

  return {
    id: "datacenter",
    kind: "datacenter",
    name: "Datacenter",
    widthTiles: L.width,
    heightTiles: L.height,
    spawnPoints: {
      "from-yard": tileToPixel(2, L.height / 2),
      default: tileToPixel(L.width / 4, L.height / 2),
    },
    placementZones: rackSlots,
    interactables: {
      "staff-computer": {
        id: "staff-computer",
        kind: "staff_computer",
        roomId: "datacenter",
        position: tileToPixel(STAFF_COMPUTER_X, STAFF_COMPUTER_Y),
        size: { w: 3 * TILE_SIZE, h: 2 * TILE_SIZE },
        enabled: true,
        label: "Use Computer",
        data: {},
      },
    },
  };
}
