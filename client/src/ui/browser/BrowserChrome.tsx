import { useState, useCallback } from "react";
import { useBrowserStore, routeToDisplayUrl, ZOOM_STEPS } from "./browserStore";
import type { BrowserRoute } from "./browserStore";
import { rpcClient } from "../../rpc/client";
import { useGameStore } from "../../store/gameStore";
import { THEME } from "../theme";

export function BrowserChrome() {
  const route = useBrowserStore((s) => s.route);
  const addressBarText = useBrowserStore((s) => s.addressBarText);
  const history = useBrowserStore((s) => s.history);
  const forwardStack = useBrowserStore((s) => s.forwardStack);
  const bookmarks = useBrowserStore((s) => s.bookmarks);
  const accessMode = useBrowserStore((s) => s.accessMode);
  const closeBrowser = useBrowserStore((s) => s.closeBrowser);
  const goBack = useBrowserStore((s) => s.goBack);
  const goForward = useBrowserStore((s) => s.goForward);
  const navigate = useBrowserStore((s) => s.navigate);
  const setAddressBarText = useBrowserStore((s) => s.setAddressBarText);
  const zoomIndex = useGameStore((s) => s.state?.browserZoomIndex ?? 2);
  const zoomIn = useBrowserStore((s) => s.zoomIn);
  const zoomOut = useBrowserStore((s) => s.zoomOut);
  const resetZoom = useBrowserStore((s) => s.resetZoom);
  const zoomPct = Math.round(ZOOM_STEPS[zoomIndex] * 100);

  const [editing, setEditing] = useState(false);

  const handleAddressSubmit = useCallback(async () => {
    setEditing(false);
    const store = useBrowserStore.getState();
    const text = store.addressBarText.trim();

    // Parse the address bar text into a route
    const route = parseAddressBarInput(text);
    if (!route) {
      navigate({ type: "error", code: "not_found", message: `Cannot resolve: ${text}` });
      return;
    }

    // For device routes in network mode, resolve via server
    if (route.type === "device" && store.accessMode === "network") {
      try {
        const result = await rpcClient.call("resolveBrowserTarget", { targetIp: route.ip });
        if (!result.found) {
          navigate({ type: "error", code: "not_found", message: `No device found at ${route.ip}` });
          return;
        }
        navigate({ ...route, deviceId: result.targetDeviceId! });
      } catch (e) {
        navigate({ type: "error", code: "not_found", message: (e as Error).message });
      }
      return;
    }

    navigate(route);
  }, [navigate]);

  const title = getRouteTitle(route, accessMode);

  return (
    <>
      {/* Title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 10px",
          background: THEME.colors.bgDarkest,
          borderBottom: `1px solid ${THEME.colors.borderDark}`,
          gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 5 }}>
          <div
            onClick={closeBrowser}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: THEME.colors.danger,
              cursor: "pointer",
            }}
          />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: THEME.colors.warning, opacity: 0.4 }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: THEME.colors.success, opacity: 0.4 }} />
        </div>
        <span
          style={{
            fontSize: 10,
            color: THEME.colors.textDim,
            fontFamily: THEME.fonts.body,
            fontWeight: 600,
          }}
        >
          {title}
        </span>
        <button
          onClick={closeBrowser}
          style={{
            marginLeft: "auto",
            background: "none",
            border: "none",
            color: THEME.colors.textDim,
            cursor: "pointer",
            fontSize: 14,
            fontFamily: THEME.fonts.mono,
            padding: "0 4px",
            lineHeight: 1,
          }}
        >
          x
        </button>
      </div>

      {/* Address bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "4px 10px",
          background: THEME.colors.bgDarkest,
          borderBottom: `1px solid ${THEME.colors.border}`,
          gap: 6,
        }}
      >
        {/* Nav buttons */}
        <NavButton label="<" disabled={history.length === 0} onClick={goBack} />
        <NavButton label=">" disabled={forwardStack.length === 0} onClick={goForward} />

        {/* URL bar */}
        {editing ? (
          <input
            autoFocus
            value={addressBarText}
            onChange={(e) => setAddressBarText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddressSubmit();
              if (e.key === "Escape") {
                setEditing(false);
                setAddressBarText(routeToDisplayUrl(route));
              }
            }}
            onBlur={() => {
              setEditing(false);
              setAddressBarText(routeToDisplayUrl(route));
            }}
            style={{
              flex: 1,
              padding: "3px 8px",
              background: THEME.colors.bgInput,
              borderRadius: THEME.radius.sm,
              border: `1px solid ${THEME.colors.accent}`,
              fontSize: 10,
              fontFamily: THEME.fonts.mono,
              color: THEME.colors.text,
              outline: "none",
            }}
          />
        ) : (
          <div
            onClick={() => {
              if (accessMode === "network") setEditing(true);
            }}
            style={{
              flex: 1,
              padding: "3px 8px",
              background: THEME.colors.bgInput,
              borderRadius: THEME.radius.sm,
              border: `1px solid ${THEME.colors.borderDark}`,
              fontSize: 10,
              fontFamily: THEME.fonts.mono,
              color: THEME.colors.textMuted,
              cursor: accessMode === "network" ? "text" : "default",
              userSelect: "none",
            }}
          >
            <AddressBarDisplay url={addressBarText} />
          </div>
        )}

        {/* Zoom controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: 4 }}>
          <NavButton label="-" disabled={zoomIndex === 0} onClick={() => zoomOut(zoomIndex)} />
          <span
            onClick={resetZoom}
            style={{
              fontSize: 9,
              fontFamily: THEME.fonts.mono,
              color: zoomPct === 100 ? THEME.colors.textDim : THEME.colors.textMuted,
              cursor: "pointer",
              padding: "0 2px",
              minWidth: 28,
              textAlign: "center",
              userSelect: "none",
            }}
          >
            {zoomPct}%
          </span>
          <NavButton label="+" disabled={zoomIndex === ZOOM_STEPS.length - 1} onClick={() => zoomIn(zoomIndex)} />
        </div>
      </div>

      {/* Bookmarks bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "3px 10px",
          background: THEME.colors.bgDarkest,
          borderBottom: `1px solid ${THEME.colors.border}`,
          gap: 4,
        }}
      >
        {bookmarks.map((bm) => (
          <button
            key={bm.label}
            onClick={() => navigate(bm.route)}
            style={{
              background: "none",
              border: "none",
              color: THEME.colors.textMuted,
              cursor: "pointer",
              fontSize: 9,
              fontFamily: THEME.fonts.body,
              padding: "2px 6px",
              borderRadius: THEME.radius.sm,
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = THEME.colors.bgCard;
              (e.target as HTMLElement).style.color = THEME.colors.text;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = "none";
              (e.target as HTMLElement).style.color = THEME.colors.textMuted;
            }}
          >
            {bm.icon} {bm.label}
          </button>
        ))}
      </div>
    </>
  );
}

function NavButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "none",
        border: "none",
        fontSize: 12,
        color: disabled ? THEME.colors.textDim : THEME.colors.textMuted,
        cursor: disabled ? "default" : "pointer",
        padding: "0 2px",
        fontFamily: THEME.fonts.mono,
        userSelect: "none",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
    </button>
  );
}

function AddressBarDisplay({ url }: { url: string }) {
  const protocolEnd = url.indexOf("://");
  if (protocolEnd === -1) return <>{url}</>;

  const protocol = url.slice(0, protocolEnd + 3);
  const rest = url.slice(protocolEnd + 3);

  let color: string = THEME.colors.textDim;
  if (protocol.startsWith("https")) color = THEME.colors.success;
  else if (protocol.startsWith("console")) color = THEME.colors.warning;

  return (
    <>
      <span style={{ color }}>{protocol}</span>
      {rest}
    </>
  );
}

function getRouteTitle(route: BrowserRoute, _accessMode: string): string {
  switch (route.type) {
    case "home":
      return "Home";
    case "console":
      return `Console — ${route.deviceId.slice(0, 12)}`;
    case "device":
      return `Device — ${route.ip}`;
    case "shop":
      return "DataCenter Supply Co.";
    case "clients":
      return "Contracts";
    case "quests":
      return "Quests";
    case "achievements":
      return "Achievements";
    case "ipam":
      return "IPAM";
    case "docs":
      return "Documentation";
    case "error":
      return "Error";
  }
}

function parseAddressBarInput(text: string): BrowserRoute | null {
  // Known internal schemes
  if (text === "about://home" || text === "") return { type: "home" };
  if (text.startsWith("docs://")) return { type: "docs", article: text.slice(7) || undefined };
  if (text.startsWith("ipam://")) return { type: "ipam", subpage: text.slice(7) || undefined };
  if (text.startsWith("quests://")) return { type: "quests" };
  if (text.startsWith("achievements://")) return { type: "achievements" };
  if (text.startsWith("clients://")) return { type: "clients" };

  // Shop URLs
  if (text.includes("datacenter-supply.net")) return { type: "shop" };

  // Console URLs
  if (text.startsWith("console://")) {
    const rest = text.slice(10);
    const [deviceId, ...subpageParts] = rest.split("/");
    return { type: "console", deviceId, subpage: subpageParts.join("/") || undefined };
  }

  // IP address — http://<ip> or just the IP
  const ipInput = text.replace(/^https?:\/\//, "");
  const ipMatch = ipInput.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
  if (ipMatch) {
    // Will be resolved by the page router via reachability check
    return { type: "device", ip: ipMatch[1], deviceId: "", subpage: undefined };
  }

  return null;
}
