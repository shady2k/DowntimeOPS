import type { JsonRpcNotification, GameState } from "@downtime-ops/shared";
import { useGameStore } from "../store/gameStore";
import { rpcClient } from "../rpc/client";

let localHash: string | null = null;
let initialized = false;

export function setupReconciler() {
  if (initialized) return;
  initialized = true;
  const store = useGameStore.getState();

  rpcClient.onConnection((connected) => {
    store.setConnected(connected);
  });

  rpcClient.onNotification((notification: JsonRpcNotification) => {
    const { method, params } = notification;

    switch (method) {
      case "snapshot": {
        const p = params as { state: GameState };
        useGameStore.getState().applySnapshot(p.state);
        localHash = null;
        break;
      }

      case "noSession": {
        useGameStore.getState().returnToMenu();
        localHash = null;
        break;
      }

      case "stateDiff": {
        const p = params as {
          tick: number;
          diff: Record<string, unknown>;
          hash?: string;
        };
        useGameStore.getState().applyDiff(p.diff);

        // If server sent a hash, verify integrity
        if (p.hash) {
          // For now, store the hash. Full verification would
          // re-hash local state and compare.
          localHash = p.hash;
        }
        break;
      }

      case "alert": {
        // Alerts are included in state diffs, no separate handling needed
        break;
      }

      case "tracerStep": {
        // Handled by tracer UI components directly
        break;
      }
    }
  });

  rpcClient.connect();
}

export function getLocalHash(): string | null {
  return localHash;
}
