import { create } from "zustand";
import type { GameState } from "@downtime-ops/shared";

export interface GameStore {
  // Server-synced state
  state: GameState | null;
  connected: boolean;

  // Ephemeral UI state
  selectedDeviceId: string | null;
  selectedPortId: string | null;
  activeView: "rack" | "room" | "trace" | "map";

  // State sync actions
  applyDiff: (diff: Record<string, unknown>) => void;
  applySnapshot: (snapshot: GameState) => void;
  setConnected: (connected: boolean) => void;

  // UI actions
  selectDevice: (deviceId: string | null) => void;
  selectPort: (portId: string | null) => void;
  setView: (view: GameStore["activeView"]) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  // Server-synced state
  state: null,
  connected: false,

  // Ephemeral UI state
  selectedDeviceId: null,
  selectedPortId: null,
  activeView: "rack",

  // State sync actions
  applyDiff: (diff) =>
    set((store) => {
      if (!store.state) return store;
      return { state: { ...store.state, ...diff } as GameState };
    }),

  applySnapshot: (snapshot) => set({ state: snapshot }),

  setConnected: (connected) => set({ connected }),

  // UI actions
  selectDevice: (deviceId) =>
    set({ selectedDeviceId: deviceId, selectedPortId: null }),

  selectPort: (portId) => set({ selectedPortId: portId }),

  setView: (view) => set({ activeView: view }),
}));
