import type { GameState } from "@downtime-ops/shared";

export function hashState(state: GameState): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(
    JSON.stringify({
      tick: state.tick,
      money: state.money,
      reputation: state.reputation,
      devices: Object.keys(state.devices).sort(),
      links: Object.keys(state.links).sort(),
      connections: Object.keys(state.connections).sort(),
      clients: Object.keys(state.clients).sort(),
    }),
  );
  return hasher.digest("hex");
}
