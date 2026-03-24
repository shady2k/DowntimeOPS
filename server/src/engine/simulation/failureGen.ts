import type { GameState } from "@downtime-ops/shared";


export function generateFailures(
  state: GameState,
  _rng: () => number = Math.random,
): GameState {
  // Random port failures disabled for now
  return state;
}
