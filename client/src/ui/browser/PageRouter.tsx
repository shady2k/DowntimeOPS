import { useBrowserStore } from "./browserStore";
import type { BrowserRoute } from "./browserStore";
import { useGameStore } from "../../store/gameStore";
import { getDeviceIp } from "@downtime-ops/shared";
import type { GameState, Device } from "@downtime-ops/shared";
import { HomePage } from "./pages/HomePage";
import { RouterManagementPage } from "./pages/RouterManagementPage";
import { SwitchManagementPage } from "./pages/SwitchManagementPage";
import { ServerManagementPage } from "./pages/ServerManagementPage";
import { ErrorPage } from "./pages/ErrorPage";
import { ShopPage } from "./pages/ShopPage";
import { DocsPage } from "./pages/DocsPage";
import { IpamPage } from "./pages/IpamPage";
import { ClientPanel } from "../panels/ClientPanel";
import { THEME } from "../theme";

export function PageRouter() {
  const route = useBrowserStore((s) => s.route);
  const state = useGameStore((s) => s.state);

  if (!state) {
    return <ErrorPage code="not_found" message="No game state" />;
  }

  return renderRoute(route, state);
}

function renderRoute(route: BrowserRoute, state: GameState) {
  switch (route.type) {
    case "home":
      return <HomePage />;

    case "console": {
      const device = state.devices[route.deviceId];
      if (!device) {
        return <ErrorPage code="not_found" message={`Device not found: ${route.deviceId}`} />;
      }
      return renderDeviceManagement(device, route.subpage);
    }

    case "device": {
      // Use resolved deviceId if available (from resolveBrowserTarget), otherwise fallback to IP scan
      const device = route.deviceId
        ? state.devices[route.deviceId]
        : findDeviceByIp(state, route.ip);
      if (!device) {
        return <ErrorPage code="not_found" message={`No device found at ${route.ip}`} />;
      }
      return renderDeviceManagement(device, route.subpage);
    }

    case "shop":
      return <ShopPage />;

    case "clients":
      return <ClientPanel />;

    case "docs":
      return <DocsPage article={route.article} />;

    case "ipam":
      return <IpamPage subpage={route.subpage} />;

    case "error":
      return <ErrorPage code={route.code} message={route.message} />;
  }
}

function renderDeviceManagement(device: Device, _subpage?: string) {
  switch (device.type) {
    case "router":
      return <RouterManagementPage deviceId={device.id} />;
    case "switch":
      return <SwitchManagementPage deviceId={device.id} />;
    case "server":
      return <ServerManagementPage deviceId={device.id} />;
    case "firewall":
      return (
        <div style={{ padding: 20, color: THEME.colors.textMuted, fontFamily: THEME.fonts.body, fontSize: 12 }}>
          Firewall management UI — coming soon
        </div>
      );
    default:
      return <ErrorPage code="not_found" message={`No management interface for ${device.type}`} />;
  }
}

function findDeviceByIp(state: GameState, ip: string): Device | null {
  for (const device of Object.values(state.devices)) {
    if (getDeviceIp(device) === ip) return device;
  }
  return null;
}
