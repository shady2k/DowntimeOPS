import type { WorldState, Vec2 } from "@downtime-ops/shared";
import { createCheckpointRoom } from "./locations/checkpoint";
import { createYardRoom } from "./locations/yard";
import { createStorageRoom } from "./locations/storage";
import { createDatacenterRoom } from "./locations/datacenter";
import { createShop } from "./shop";
import { createPlayer } from "./player";
import { applyEdgeExits } from "./locationMap";

/**
 * Tile size in pixels — all world positions are in pixels.
 * The tilemap uses 32x32 tiles.
 */
export const TILE_SIZE = 32;

export function tileToPixel(tileX: number, tileY: number): Vec2 {
  return {
    x: tileX * TILE_SIZE + TILE_SIZE / 2,
    y: tileY * TILE_SIZE + TILE_SIZE / 2,
  };
}

export function createInitialWorld(): WorldState {
  const rooms = {
    checkpoint: createCheckpointRoom(),
    yard: createYardRoom(),
    storage: createStorageRoom(),
    datacenter: createDatacenterRoom(),
  };

  applyEdgeExits(rooms);

  return {
    rooms,
    player: createPlayer(),
    items: {},
    shop: createShop(),
    storage: { packages: {} },
  };
}
