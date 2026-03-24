import { create } from "zustand";
import { rpcClient } from "../../rpc/client";

// --- Route types ---

export type BrowserRoute =
  | { type: "home" }
  | { type: "console"; deviceId: string; subpage?: string }
  | { type: "device"; ip: string; deviceId: string; subpage?: string }
  | { type: "shop" }
  | { type: "clients" }
  | { type: "ipam"; subpage?: string }
  | { type: "docs"; article?: string }
  | { type: "error"; code: "not_found" | "unreachable" | "no_ip"; message: string };

export interface Bookmark {
  label: string;
  route: BrowserRoute;
}

function routeToDisplayUrl(route: BrowserRoute): string {
  switch (route.type) {
    case "home":
      return "about://home";
    case "console":
      return `console://${route.deviceId}${route.subpage ? `/${route.subpage}` : ""}`;
    case "device":
      return `http://${route.ip}${route.subpage ? `/${route.subpage}` : ""}`;
    case "shop":
      return "https://datacenter-supply.net/shop";
    case "clients":
      return "clients://contracts";
    case "ipam":
      return `ipam://${route.subpage || ""}`;
    case "docs":
      return `docs://${route.article || ""}`;
    case "error":
      return `error://${route.code}`;
  }
}

// --- Store ---

const ZOOM_STEPS = [0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0] as const;
const DEFAULT_ZOOM_INDEX = 2; // 1.0

interface BrowserStore {
  open: boolean;
  route: BrowserRoute;
  addressBarText: string;
  history: BrowserRoute[];
  forwardStack: BrowserRoute[];
  accessMode: "console" | "network";
  loading: boolean;
  bookmarks: Bookmark[];

  // Actions
  openBrowser: (mode: "console" | "network", deviceId?: string) => void;
  closeBrowser: () => void;
  navigate: (route: BrowserRoute) => void;
  goBack: () => void;
  goForward: () => void;
  setAddressBarText: (text: string) => void;
  setLoading: (loading: boolean) => void;
  zoomIn: (currentIndex: number) => void;
  zoomOut: (currentIndex: number) => void;
  resetZoom: () => void;
}

export { ZOOM_STEPS };

const DEFAULT_BOOKMARKS: Bookmark[] = [
  { label: "Shop", route: { type: "shop" } },
  { label: "Clients", route: { type: "clients" } },
  { label: "IPAM", route: { type: "ipam" } },
  { label: "Docs", route: { type: "docs" } },
];

export const useBrowserStore = create<BrowserStore>((set, get) => ({
  open: false,
  route: { type: "home" },
  addressBarText: "about://home",
  history: [],
  forwardStack: [],
  accessMode: "network",
  loading: false,
  bookmarks: DEFAULT_BOOKMARKS,

  openBrowser: (mode, deviceId) => {
    const route: BrowserRoute = mode === "console" && deviceId
      ? { type: "console", deviceId }
      : { type: "home" };

    set({
      open: true,
      accessMode: mode,
      route,
      addressBarText: routeToDisplayUrl(route),
      history: [],
      forwardStack: [],
      loading: false,
    });
  },

  closeBrowser: () => set({ open: false }),

  navigate: (route) => {
    const { route: currentRoute } = get();
    set({
      history: [...get().history, currentRoute],
      route,
      addressBarText: routeToDisplayUrl(route),
      forwardStack: [],
      loading: false,
    });
  },

  goBack: () => {
    const { history, route } = get();
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    set({
      history: history.slice(0, -1),
      forwardStack: [route, ...get().forwardStack],
      route: prev,
      addressBarText: routeToDisplayUrl(prev),
    });
  },

  goForward: () => {
    const { forwardStack, route } = get();
    if (forwardStack.length === 0) return;
    const next = forwardStack[0];
    set({
      forwardStack: forwardStack.slice(1),
      history: [...get().history, route],
      route: next,
      addressBarText: routeToDisplayUrl(next),
    });
  },

  setAddressBarText: (text) => set({ addressBarText: text }),
  setLoading: (loading) => set({ loading }),

  zoomIn: (currentIndex: number) => {
    const next = Math.min(currentIndex + 1, ZOOM_STEPS.length - 1);
    if (next !== currentIndex) rpcClient.call("setBrowserZoom", { zoomIndex: next }).catch(() => {});
  },
  zoomOut: (currentIndex: number) => {
    const next = Math.max(currentIndex - 1, 0);
    if (next !== currentIndex) rpcClient.call("setBrowserZoom", { zoomIndex: next }).catch(() => {});
  },
  resetZoom: () => {
    rpcClient.call("setBrowserZoom", { zoomIndex: DEFAULT_ZOOM_INDEX }).catch(() => {});
  },
}));

export { routeToDisplayUrl };
