import type { EdgeExit } from "@downtime-ops/shared";

/**
 * Location map — defines auto-transitions at screen edges.
 *
 * Door interactables (position, size, label) stay in each location file
 * because they're tied to that location's geometry.
 *
 * Edge exits are defined here because they represent the graph
 * of connections between locations, not a specific interactable.
 */

export const EDGE_EXITS: Record<string, { left?: EdgeExit; right?: EdgeExit }> = {
  yard: {
    left: { targetRoom: "checkpoint", spawnPoint: "default" },
  },
  storage: {
    right: { targetRoom: "yard", spawnPoint: "from-storage" },
  },
  datacenter: {
    left: { targetRoom: "yard", spawnPoint: "from-datacenter" },
  },
};

/**
 * Apply edge exits to rooms.
 * Called by worldFactory after creating rooms.
 */
export function applyEdgeExits(
  rooms: Record<string, { edgeExits?: { left?: EdgeExit; right?: EdgeExit } }>,
): void {
  for (const [roomId, exits] of Object.entries(EDGE_EXITS)) {
    const room = rooms[roomId];
    if (!room) continue;
    room.edgeExits = exits;
  }
}
