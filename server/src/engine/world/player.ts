import type { PlayerState } from "@downtime-ops/shared";
import { tileToPixel } from "./worldFactory";
import { CHECKPOINT_LAYOUT } from "./locations/checkpoint";

export function createPlayer(): PlayerState {
  const L = CHECKPOINT_LAYOUT;
  return {
    roomId: "checkpoint",
    position: tileToPixel(L.width / 2, L.height - 3),
    facing: "down",
    carryingItemId: null,
  };
}
