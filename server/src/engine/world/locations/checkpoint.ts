import type { Room } from "@downtime-ops/shared";
import { TILE_SIZE, tileToPixel } from "../worldFactory";

export const CHECKPOINT_LAYOUT = {
  x: 0,
  y: 0,
  width: 60,
  height: 12,
} as const;

export function createCheckpointRoom(): Room {
  const L = CHECKPOINT_LAYOUT;

  return {
    id: "checkpoint",
    kind: "checkpoint",
    name: "Security Checkpoint",
    widthTiles: L.width,
    heightTiles: L.height,
    spawnPoints: {
      default: tileToPixel(L.width / 2, L.height - 3),
    },
    maxRacks: 0,
    placementZones: {},
    interactables: {
      "door-to-yard": {
        id: "door-to-yard",
        kind: "door",
        roomId: "checkpoint",
        position: tileToPixel(35, L.height - 3),
        size: { w: 2 * TILE_SIZE, h: 2 * TILE_SIZE },
        enabled: true,
        label: "Enter Yard",
        data: { targetRoom: "yard", spawnPoint: "from-checkpoint" },
      },
    },
  };
}
