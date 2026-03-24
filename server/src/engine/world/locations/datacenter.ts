import type { Room } from "@downtime-ops/shared";
import { TILE_SIZE, tileToPixel } from "../worldFactory";

export const DATACENTER_LAYOUT = {
  x: 0,
  y: 0,
  width: 40,
  height: 24,
} as const;

/** Maximum racks the datacenter can hold (visual slots defined in background JSON) */
const MAX_RACKS = 6;

/** Staff area config */
const STAFF_COMPUTER_X = 6;
const STAFF_COMPUTER_Y = 6;

export function createDatacenterRoom(): Room {
  const L = DATACENTER_LAYOUT;

  return {
    id: "datacenter",
    kind: "datacenter",
    name: "Datacenter",
    widthTiles: L.width,
    heightTiles: L.height,
    maxRacks: MAX_RACKS,
    spawnPoints: {
      "from-yard": tileToPixel(2, L.height / 2),
      default: tileToPixel(L.width / 4, L.height / 2),
    },
    placementZones: {},
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
