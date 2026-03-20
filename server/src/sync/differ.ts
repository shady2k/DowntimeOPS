import type { GameState } from "@downtime-ops/shared";

export type StateDiff = Record<string, unknown>;

/**
 * Shallow diff between two game states.
 * Returns only top-level keys that changed.
 */
export function diffStates(prev: GameState, next: GameState): StateDiff {
  const diff: StateDiff = {};
  const keys = Object.keys(next) as (keyof GameState)[];

  for (const key of keys) {
    if (prev[key] !== next[key]) {
      diff[key] = next[key];
    }
  }

  return diff;
}

export function isDiffEmpty(diff: StateDiff): boolean {
  return Object.keys(diff).length === 0;
}
