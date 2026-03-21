import { create } from "zustand";
import type { GameState } from "@downtime-ops/shared";

export type AppMode = "connecting" | "menu" | "playing";

export interface CablingSource {
  deviceId: string;
  portIndex: number;
}

export type RackMode = "overview" | "work";

export interface GameStore {
  // Server-synced state
  state: GameState | null;
  connected: boolean;
  appMode: AppMode;

  // Ephemeral UI state
  selectedDeviceId: string | null;
  selectedPortId: string | null;
  activeView: "rack" | "room" | "trace" | "map" | "world" | "shop";

  // Pause menu
  pauseMenuOpen: boolean;

  // Rack interaction state
  openRackItemId: string | null;
  rackMode: RackMode;
  workFocusDeviceId: string | null;
  cablingFrom: CablingSource | null;
  placingModel: string | null;
  selectedClientId: string | null;
  highlightedAlertId: string | null;

  // State sync actions
  applyDiff: (diff: Record<string, unknown>) => void;
  applySnapshot: (snapshot: GameState) => void;
  setConnected: (connected: boolean) => void;
  returnToMenu: () => void;
  togglePauseMenu: () => void;

  // UI actions
  selectDevice: (deviceId: string | null) => void;
  selectPort: (portId: string | null) => void;
  setView: (view: GameStore["activeView"]) => void;

  // Shop actions
  openShop: () => void;
  closeShop: () => void;

  // Rack panel actions
  openRack: (itemId: string) => void;
  closeRack: () => void;

  // Rack mode actions
  enterWorkMode: (deviceId: string) => void;
  enterOverviewMode: () => void;

  // Rack interaction actions
  startCabling: (source: CablingSource) => void;
  cancelCabling: () => void;
  startPlacing: (model: string) => void;
  cancelPlacing: () => void;
  selectClient: (clientId: string | null) => void;
  highlightAlert: (alertId: string | null) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  // Server-synced state
  state: null,
  connected: false,
  appMode: "connecting",

  // Ephemeral UI state
  selectedDeviceId: null,
  selectedPortId: null,
  activeView: "world",

  // Pause menu
  pauseMenuOpen: false,

  // Rack interaction state
  openRackItemId: null,
  rackMode: "overview",
  workFocusDeviceId: null,
  cablingFrom: null,
  placingModel: null,
  selectedClientId: null,
  highlightedAlertId: null,

  // State sync actions
  applyDiff: (diff) =>
    set((store) => {
      if (!store.state) return store;
      return { state: { ...store.state, ...diff } as GameState };
    }),

  applySnapshot: (snapshot) => set({ state: snapshot, appMode: "playing", pauseMenuOpen: false }),

  setConnected: (connected) =>
    set(() => {
      if (connected) {
        // Connected — stay on "connecting" until server sends snapshot or noSession
        return { connected, appMode: "connecting" };
      }
      // Disconnected — show connecting screen
      return { connected, appMode: "connecting" };
    }),

  returnToMenu: () =>
    set({
      state: null,
      appMode: "menu",
      pauseMenuOpen: false,
      // Reset all ephemeral UI state
      selectedDeviceId: null,
      selectedPortId: null,
      activeView: "world",
      openRackItemId: null,
      rackMode: "overview",
      workFocusDeviceId: null,
      cablingFrom: null,
      placingModel: null,
      selectedClientId: null,
      highlightedAlertId: null,
    }),

  togglePauseMenu: () =>
    set((store) => ({ pauseMenuOpen: !store.pauseMenuOpen })),

  // UI actions
  selectDevice: (deviceId) =>
    set({ selectedDeviceId: deviceId, selectedPortId: null }),

  selectPort: (portId) => set({ selectedPortId: portId }),

  setView: (view) => set({ activeView: view }),

  // Shop actions
  openShop: () => set({ activeView: "shop" }),
  closeShop: () => set({ activeView: "world" }),

  // Rack panel actions
  openRack: (itemId) => set({ activeView: "rack", openRackItemId: itemId }),
  closeRack: () =>
    set({
      activeView: "world",
      openRackItemId: null,
      rackMode: "overview",
      workFocusDeviceId: null,
    }),

  // Rack mode actions
  enterWorkMode: (deviceId) =>
    set({ rackMode: "work", workFocusDeviceId: deviceId, selectedDeviceId: deviceId }),

  enterOverviewMode: () =>
    set({ rackMode: "overview", workFocusDeviceId: null }),

  // Rack interaction actions
  startCabling: (source) =>
    set({ cablingFrom: source, placingModel: null }),

  cancelCabling: () => set({ cablingFrom: null }),

  startPlacing: (model) =>
    set({ placingModel: model, cablingFrom: null }),

  cancelPlacing: () => set({ placingModel: null }),

  selectClient: (clientId) => set({ selectedClientId: clientId }),

  highlightAlert: (alertId) => set({ highlightedAlertId: alertId }),
}));
