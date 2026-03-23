import { useState } from "react";
import { useGameStore } from "../../../store/gameStore";
import { rpcClient } from "../../../rpc/client";
import type { ServerConfig } from "@downtime-ops/shared";
import { THEME } from "../../theme";

interface ServerManagementPageProps {
  deviceId: string;
}

export function ServerManagementPage({ deviceId }: ServerManagementPageProps) {
  const state = useGameStore((s) => s.state);
  const device = state?.devices[deviceId];
  const [activeTab, setActiveTab] = useState<"network" | "services" | "system">("network");

  if (!device || device.type !== "server") return null;

  const config = device.config as ServerConfig;

  return (
    <div style={{ fontFamily: THEME.fonts.body, fontSize: 11, color: THEME.colors.text }}>
      {/* Device header */}
      <div
        style={{
          padding: "12px 16px",
          background: `linear-gradient(135deg, ${THEME.colors.server}22, ${THEME.colors.bgPanel})`,
          borderBottom: `2px solid ${THEME.colors.server}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 9, color: THEME.colors.server, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
            ServerOS
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
        <Tab label="Network" active={activeTab === "network"} onClick={() => setActiveTab("network")} />
        <Tab label="Services" active={activeTab === "services"} onClick={() => setActiveTab("services")} />
        <Tab label="System" active={activeTab === "system"} onClick={() => setActiveTab("system")} />
      </div>

      {/* Tab content */}
      <div style={{ padding: 16 }}>
        {activeTab === "network" && (
          <NetworkTab deviceId={deviceId} config={config} />
        )}
        {activeTab === "services" && (
          <ServicesTab deviceId={deviceId} config={config} />
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
        borderBottom: active ? `2px solid ${THEME.colors.server}` : "2px solid transparent",
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

// --- Network Tab ---

function NetworkTab({ deviceId, config }: { deviceId: string; config: ServerConfig }) {
  const [ipVal, setIpVal] = useState(config.ip || "");
  const [maskVal, setMaskVal] = useState(config.mask?.toString() || "24");
  const [gatewayVal, setGatewayVal] = useState(config.gateway || "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setError(null);
    setSaved(false);
    try {
      await rpcClient.call("configureServerNetwork", {
        deviceId,
        ip: ipVal || null,
        mask: ipVal ? Number(maskVal) : null,
        gateway: gatewayVal || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={{ fontSize: 10, color: THEME.colors.textMuted, display: "block", marginBottom: 4 }}>IP Address</label>
          <input
            value={ipVal}
            onChange={(e) => setIpVal(e.target.value)}
            placeholder="10.0.0.10"
            style={{ ...inputStyle, width: 200 }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          />
        </div>
        <div>
          <label style={{ fontSize: 10, color: THEME.colors.textMuted, display: "block", marginBottom: 4 }}>Subnet Mask</label>
          <input
            value={maskVal}
            onChange={(e) => setMaskVal(e.target.value)}
            placeholder="24"
            style={{ ...inputStyle, width: 200 }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          />
        </div>
        <div>
          <label style={{ fontSize: 10, color: THEME.colors.textMuted, display: "block", marginBottom: 4 }}>Gateway</label>
          <input
            value={gatewayVal}
            onChange={(e) => setGatewayVal(e.target.value)}
            placeholder="10.0.0.1"
            style={{ ...inputStyle, width: 200 }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          />
        </div>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 6, alignItems: "center" }}>
        <SmallButton label="Save" color={THEME.colors.success} onClick={handleSave} />
        {saved && <span style={{ fontSize: 9, color: THEME.colors.success }}>Saved</span>}
      </div>
      {error && <div style={{ fontSize: 9, color: THEME.colors.danger, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

// --- Services Tab ---

function ServicesTab({ deviceId, config }: { deviceId: string; config: ServerConfig }) {
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async (serviceIndex: number, currentEnabled: boolean) => {
    setError(null);
    try {
      await rpcClient.call("toggleService", { deviceId, serviceIndex, enabled: !currentEnabled });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!config.services || config.services.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 20, color: THEME.colors.textDim, fontSize: 11 }}>
        No services configured
      </div>
    );
  }

  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${THEME.colors.border}` }}>
            <Th>Service</Th>
            <Th>Port</Th>
            <Th>Status</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {config.services.map((service, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${THEME.colors.borderDark}` }}>
              <td style={{ padding: "6px 8px", fontFamily: THEME.fonts.mono }}>{service.name}</td>
              <td style={{ padding: "6px 8px", fontFamily: THEME.fonts.mono }}>{service.port}</td>
              <td style={{ padding: "6px 8px" }}>
                <span style={{ color: service.enabled ? THEME.colors.success : THEME.colors.danger, fontSize: 9 }}>
                  {service.enabled ? "ENABLED" : "DISABLED"}
                </span>
              </td>
              <td style={{ padding: "6px 4px", textAlign: "right" }}>
                <SmallButton
                  label={service.enabled ? "Disable" : "Enable"}
                  color={service.enabled ? THEME.colors.danger : THEME.colors.success}
                  onClick={() => handleToggle(i, service.enabled)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && <div style={{ fontSize: 9, color: THEME.colors.danger, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

// --- System Tab ---

function SystemTab({ deviceId, config }: { deviceId: string; config: ServerConfig }) {
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
        <div>Firmware: ServerOS v1.0</div>
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
