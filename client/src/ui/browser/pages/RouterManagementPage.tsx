import { useState } from "react";
import { useGameStore } from "../../../store/gameStore";
import { rpcClient } from "../../../rpc/client";
import type { RouterConfig, InterfaceConfig } from "@downtime-ops/shared";
import { THEME } from "../../theme";

interface RouterManagementPageProps {
  deviceId: string;
}

export function RouterManagementPage({ deviceId }: RouterManagementPageProps) {
  const state = useGameStore((s) => s.state);
  const device = state?.devices[deviceId];
  const [activeTab, setActiveTab] = useState<"interfaces" | "routing" | "system">("interfaces");

  if (!device || device.type !== "router") return null;

  const config = device.config as RouterConfig;

  return (
    <div style={{ fontFamily: THEME.fonts.body, fontSize: 11, color: THEME.colors.text }}>
      {/* Device header */}
      <div
        style={{
          padding: "12px 16px",
          background: `linear-gradient(135deg, ${THEME.colors.router}22, ${THEME.colors.bgPanel})`,
          borderBottom: `2px solid ${THEME.colors.router}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 9, color: THEME.colors.router, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
            NetCore RouterOS
          </div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{config.hostname}</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 9, color: THEME.colors.textDim }}>
          Model: {device.model} | Status: {device.status}
        </div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          borderBottom: `1px solid ${THEME.colors.border}`,
          background: THEME.colors.bgDark,
        }}
      >
        <Tab label="Interfaces" active={activeTab === "interfaces"} onClick={() => setActiveTab("interfaces")} />
        <Tab label="Routing" active={activeTab === "routing"} onClick={() => setActiveTab("routing")} />
        <Tab label="System" active={activeTab === "system"} onClick={() => setActiveTab("system")} />
      </div>

      {/* Tab content */}
      <div style={{ padding: 16 }}>
        {activeTab === "interfaces" && (
          <InterfacesTab deviceId={deviceId} config={config} ports={device.ports} />
        )}
        {activeTab === "routing" && (
          <RoutingTab deviceId={deviceId} />
        )}
        {activeTab === "system" && (
          <SystemTab deviceId={deviceId} config={config} />
        )}
      </div>
    </div>
  );
}

// --- Tabs ---

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px",
        background: "none",
        border: "none",
        borderBottom: active ? `2px solid ${THEME.colors.router}` : "2px solid transparent",
        color: active ? THEME.colors.text : THEME.colors.textDim,
        fontFamily: THEME.fonts.body,
        fontSize: 11,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

// --- Interfaces Tab ---

function InterfacesTab({
  deviceId,
  config,
  ports,
}: {
  deviceId: string;
  config: RouterConfig;
  ports: import("@downtime-ops/shared").Port[];
}) {
  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${THEME.colors.border}` }}>
            <Th>Port</Th>
            <Th>Status</Th>
            <Th>IP Address</Th>
            <Th>Mask</Th>
            <Th>Link</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {ports.map((port, i) => (
            <InterfaceRow
              key={port.id}
              deviceId={deviceId}
              portIndex={i}
              port={port}
              iface={config.interfaces[i]}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InterfaceRow({
  deviceId,
  portIndex,
  port,
  iface,
}: {
  deviceId: string;
  portIndex: number;
  port: import("@downtime-ops/shared").Port;
  iface?: InterfaceConfig;
}) {
  const [editing, setEditing] = useState(false);
  const [ipVal, setIpVal] = useState(iface?.ip || "");
  const [maskVal, setMaskVal] = useState(iface?.mask?.toString() || "24");
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    try {
      await rpcClient.call("configureInterface", {
        deviceId,
        portIndex,
        ip: ipVal || null,
        mask: ipVal ? Number(maskVal) : null,
        enabled: iface?.enabled !== false,
      });
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const isUp = port.status === "up";
  const hasLink = port.linkId !== null;

  return (
    <>
      <tr style={{ borderBottom: `1px solid ${THEME.colors.borderDark}` }}>
        <td style={{ padding: "6px 8px", fontFamily: THEME.fonts.mono }}>
          eth{portIndex}
        </td>
        <td style={{ padding: "6px 8px" }}>
          <span style={{ color: isUp ? THEME.colors.success : THEME.colors.danger }}>
            {isUp ? "UP" : port.status.toUpperCase()}
          </span>
        </td>
        <td style={{ padding: "6px 8px" }}>
          {editing ? (
            <input
              value={ipVal}
              onChange={(e) => setIpVal(e.target.value)}
              placeholder="10.0.0.1"
              style={inputStyle}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            />
          ) : (
            <span style={{ fontFamily: THEME.fonts.mono, color: iface?.ip ? THEME.colors.text : THEME.colors.textDim }}>
              {iface?.ip || "—"}
            </span>
          )}
        </td>
        <td style={{ padding: "6px 8px" }}>
          {editing ? (
            <span style={{ fontFamily: THEME.fonts.mono }}>/
              <input
                value={maskVal}
                onChange={(e) => setMaskVal(e.target.value)}
                style={{ ...inputStyle, width: 30 }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
              />
            </span>
          ) : (
            <span style={{ fontFamily: THEME.fonts.mono, color: THEME.colors.textDim }}>
              {iface?.mask != null ? `/${iface.mask}` : ""}
            </span>
          )}
        </td>
        <td style={{ padding: "6px 8px" }}>
          <span style={{ color: hasLink ? THEME.colors.success : THEME.colors.textDim, fontSize: 9 }}>
            {hasLink ? "connected" : "no cable"}
          </span>
        </td>
        <td style={{ padding: "6px 4px", textAlign: "right" }}>
          {editing ? (
            <span style={{ display: "flex", gap: 4 }}>
              <SmallButton label="Save" color={THEME.colors.success} onClick={handleSave} />
              <SmallButton label="Cancel" color={THEME.colors.textDim} onClick={() => setEditing(false)} />
            </span>
          ) : (
            <SmallButton label="Edit" color={THEME.colors.info} onClick={() => {
              setIpVal(iface?.ip || "");
              setMaskVal(iface?.mask?.toString() || "24");
              setEditing(true);
            }} />
          )}
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={6} style={{ padding: "2px 8px", fontSize: 9, color: THEME.colors.danger }}>
            {error}
          </td>
        </tr>
      )}
    </>
  );
}

// --- Routing Tab ---

function RoutingTab({ deviceId }: { deviceId: string }) {
  const state = useGameStore((s) => s.state);
  const routes = state?.routes.filter((r) => r.deviceId === deviceId) || [];

  const [addDest, setAddDest] = useState("");
  const [addNextHop, setAddNextHop] = useState("");
  const [addMetric, setAddMetric] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    setError(null);
    try {
      await rpcClient.call("addStaticRoute", {
        deviceId,
        destination: addDest,
        nextHop: addNextHop,
        metric: Number(addMetric) || 1,
      });
      setAddDest("");
      setAddNextHop("");
      setAddMetric("1");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleRemove = async (routeId: string) => {
    try {
      await rpcClient.call("removeRoute", { routeId });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${THEME.colors.border}` }}>
            <Th>Destination</Th>
            <Th>Next Hop</Th>
            <Th>Metric</Th>
            <Th>Source</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {routes.length === 0 && (
            <tr><td colSpan={5} style={{ padding: "8px", color: THEME.colors.textDim, textAlign: "center" }}>No routes configured</td></tr>
          )}
          {routes.map((route) => (
            <tr key={route.id} style={{ borderBottom: `1px solid ${THEME.colors.borderDark}` }}>
              <td style={{ padding: "6px 8px", fontFamily: THEME.fonts.mono }}>{route.destination}</td>
              <td style={{ padding: "6px 8px", fontFamily: THEME.fonts.mono }}>{route.nextHop}</td>
              <td style={{ padding: "6px 8px" }}>{route.metric}</td>
              <td style={{ padding: "6px 8px" }}>
                <span style={{ color: route.source === "static" ? THEME.colors.info : THEME.colors.textDim, fontSize: 9 }}>
                  {route.source}
                </span>
              </td>
              <td style={{ padding: "6px 4px", textAlign: "right" }}>
                {route.source === "static" && (
                  <SmallButton label="Delete" color={THEME.colors.danger} onClick={() => handleRemove(route.id)} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add route form */}
      <div
        style={{
          padding: 10,
          background: THEME.colors.bgCard,
          borderRadius: THEME.radius.md,
          border: `1px solid ${THEME.colors.border}`,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 6, color: THEME.colors.textMuted }}>Add Static Route</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            value={addDest}
            onChange={(e) => setAddDest(e.target.value)}
            placeholder="0.0.0.0/0"
            style={{ ...inputStyle, flex: 1 }}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <span style={{ fontSize: 9, color: THEME.colors.textDim }}>via</span>
          <input
            value={addNextHop}
            onChange={(e) => setAddNextHop(e.target.value)}
            placeholder="10.0.0.1"
            style={{ ...inputStyle, flex: 1 }}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <span style={{ fontSize: 9, color: THEME.colors.textDim }}>metric</span>
          <input
            value={addMetric}
            onChange={(e) => setAddMetric(e.target.value)}
            style={{ ...inputStyle, width: 30 }}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <SmallButton label="Add" color={THEME.colors.success} onClick={handleAdd} />
        </div>
        {error && <div style={{ fontSize: 9, color: THEME.colors.danger, marginTop: 4 }}>{error}</div>}
      </div>
    </div>
  );
}

// --- System Tab ---

function SystemTab({ deviceId, config }: { deviceId: string; config: RouterConfig }) {
  const [hostname, setHostname] = useState(config.hostname);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setError(null);
    setSaved(false);
    try {
      await rpcClient.call("setDeviceHostname", { deviceId, hostname });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 10, color: THEME.colors.textMuted, display: "block", marginBottom: 4 }}>Hostname</label>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            style={{ ...inputStyle, width: 200 }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          />
          <SmallButton label="Save" color={THEME.colors.success} onClick={handleSave} />
          {saved && <span style={{ fontSize: 9, color: THEME.colors.success }}>Saved</span>}
          {error && <span style={{ fontSize: 9, color: THEME.colors.danger }}>{error}</span>}
        </div>
      </div>

      <div style={{ fontSize: 10, color: THEME.colors.textDim }}>
        <div>Model: {deviceId.slice(0, 16)}</div>
        <div>Firmware: NetCore RouterOS v1.0</div>
      </div>
    </div>
  );
}

// --- Shared UI helpers ---

function Th({ children }: { children?: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "6px 8px", color: THEME.colors.textDim, fontWeight: 600, fontSize: 9 }}>{children}</th>;
}

function SmallButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: `1px solid ${color}44`,
        borderRadius: THEME.radius.sm,
        color,
        fontSize: 9,
        padding: "2px 8px",
        cursor: "pointer",
        fontFamily: THEME.fonts.body,
      }}
      onMouseEnter={(e) => { (e.target as HTMLElement).style.background = `${color}11`; }}
      onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "none"; }}
    >
      {label}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "3px 6px",
  background: THEME.colors.bgInput,
  border: `1px solid ${THEME.colors.borderDark}`,
  borderRadius: THEME.radius.sm,
  color: THEME.colors.text,
  fontFamily: THEME.fonts.mono,
  fontSize: 10,
  outline: "none",
};
