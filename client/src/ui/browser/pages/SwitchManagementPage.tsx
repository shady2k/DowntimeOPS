import { useState } from "react";
import { useGameStore } from "../../../store/gameStore";
import { rpcClient } from "../../../rpc/client";
import type { SwitchConfig, Port } from "@downtime-ops/shared";
import { THEME } from "../../theme";

interface SwitchManagementPageProps {
  deviceId: string;
}

export function SwitchManagementPage({ deviceId }: SwitchManagementPageProps) {
  const state = useGameStore((s) => s.state);
  const device = state?.devices[deviceId];
  const [activeTab, setActiveTab] = useState<"ports" | "vlans" | "system">("ports");

  if (!device || device.type !== "switch") return null;

  const config = device.config as SwitchConfig;

  return (
    <div style={{ fontFamily: THEME.fonts.body, fontSize: 11, color: THEME.colors.text }}>
      {/* Device header */}
      <div
        style={{
          padding: "12px 16px",
          background: `linear-gradient(135deg, ${THEME.colors.switch}22, ${THEME.colors.bgPanel})`,
          borderBottom: `2px solid ${THEME.colors.switch}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 9, color: THEME.colors.switch, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
            NetCore SwitchOS
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
        <Tab label="Ports" active={activeTab === "ports"} onClick={() => setActiveTab("ports")} />
        <Tab label="VLANs" active={activeTab === "vlans"} onClick={() => setActiveTab("vlans")} />
        <Tab label="System" active={activeTab === "system"} onClick={() => setActiveTab("system")} />
      </div>

      {/* Tab content */}
      <div style={{ padding: 16 }}>
        {activeTab === "ports" && (
          <PortsTab deviceId={deviceId} ports={device.ports} />
        )}
        {activeTab === "vlans" && (
          <VlansTab deviceId={deviceId} ports={device.ports} />
        )}
        {activeTab === "system" && (
          <SystemTab deviceId={deviceId} config={config} model={device.model} />
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
        borderBottom: active ? `2px solid ${THEME.colors.switch}` : "2px solid transparent",
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

// --- Ports Tab ---

function PortsTab({ deviceId, ports }: { deviceId: string; ports: Port[] }) {
  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${THEME.colors.border}` }}>
            <Th>Port</Th>
            <Th>Status</Th>
            <Th>Mode</Th>
            <Th>VLAN(s)</Th>
            <Th>Link</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {ports.map((port, i) => (
            <PortRow key={port.id} deviceId={deviceId} portIndex={i} port={port} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PortRow({
  deviceId,
  portIndex,
  port,
}: {
  deviceId: string;
  portIndex: number;
  port: Port;
}) {
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<"access" | "trunk">(port.vlanMode);
  const [accessVlanVal, setAccessVlanVal] = useState(port.accessVlan.toString());
  const [trunkVlansVal, setTrunkVlansVal] = useState(port.trunkAllowedVlans.join(","));
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    try {
      if (mode === "access") {
        await rpcClient.call("setPortVlan", {
          deviceId,
          portIndex,
          mode: "access",
          accessVlan: Number(accessVlanVal),
        });
      } else {
        const vlans = trunkVlansVal
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => !isNaN(n) && n > 0);
        await rpcClient.call("setPortVlan", {
          deviceId,
          portIndex,
          mode: "trunk",
          trunkAllowedVlans: vlans,
        });
      }
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const isUp = port.status === "up";
  const hasLink = port.linkId !== null;

  const vlanDisplay =
    port.vlanMode === "access"
      ? `VLAN ${port.accessVlan}`
      : port.trunkAllowedVlans.length > 0
        ? port.trunkAllowedVlans.join(", ")
        : "none";

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
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "access" | "trunk")}
              style={{ ...inputStyle, padding: "2px 4px" }}
            >
              <option value="access">access</option>
              <option value="trunk">trunk</option>
            </select>
          ) : (
            <span style={{ fontFamily: THEME.fonts.mono }}>{port.vlanMode}</span>
          )}
        </td>
        <td style={{ padding: "6px 8px" }}>
          {editing ? (
            mode === "access" ? (
              <input
                value={accessVlanVal}
                onChange={(e) => setAccessVlanVal(e.target.value)}
                placeholder="1"
                style={{ ...inputStyle, width: 40 }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
              />
            ) : (
              <input
                value={trunkVlansVal}
                onChange={(e) => setTrunkVlansVal(e.target.value)}
                placeholder="1,10,20"
                style={{ ...inputStyle, width: 100 }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
              />
            )
          ) : (
            <span style={{ fontFamily: THEME.fonts.mono, color: THEME.colors.text }}>
              {vlanDisplay}
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
              setMode(port.vlanMode);
              setAccessVlanVal(port.accessVlan.toString());
              setTrunkVlansVal(port.trunkAllowedVlans.join(","));
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

// --- VLANs Tab ---

function VlansTab({ deviceId: _deviceId, ports }: { deviceId: string; ports: Port[] }) {
  const state = useGameStore((s) => s.state);
  const vlans = state?.vlans || {};

  const [addId, setAddId] = useState("");
  const [addName, setAddName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const getPortCount = (vlanId: number): number => {
    return ports.filter(
      (p) =>
        (p.vlanMode === "access" && p.accessVlan === vlanId) ||
        (p.vlanMode === "trunk" && p.trunkAllowedVlans.includes(vlanId))
    ).length;
  };

  const handleAdd = async () => {
    setError(null);
    try {
      await rpcClient.call("configureVlan", {
        vlanId: Number(addId),
        name: addName,
      });
      setAddId("");
      setAddName("");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async (vlanId: number) => {
    setError(null);
    try {
      await rpcClient.call("removeVlan", { vlanId });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${THEME.colors.border}` }}>
            <Th>ID</Th>
            <Th>Name</Th>
            <Th>Ports</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(vlans).length === 0 && (
            <tr><td colSpan={4} style={{ padding: "8px", color: THEME.colors.textDim, textAlign: "center" }}>No VLANs configured</td></tr>
          )}
          {Object.values(vlans).map((vlan) => (
            <tr key={vlan.id} style={{ borderBottom: `1px solid ${THEME.colors.borderDark}` }}>
              <td style={{ padding: "6px 8px", fontFamily: THEME.fonts.mono }}>{vlan.id}</td>
              <td style={{ padding: "6px 8px" }}>{vlan.name}</td>
              <td style={{ padding: "6px 8px", fontFamily: THEME.fonts.mono }}>{getPortCount(vlan.id)}</td>
              <td style={{ padding: "6px 4px", textAlign: "right" }}>
                {vlan.id !== 1 && (
                  <SmallButton label="Delete" color={THEME.colors.danger} onClick={() => handleDelete(vlan.id)} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add VLAN form */}
      <div
        style={{
          padding: 10,
          background: THEME.colors.bgCard,
          borderRadius: THEME.radius.md,
          border: `1px solid ${THEME.colors.border}`,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 6, color: THEME.colors.textMuted }}>Add VLAN</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            value={addId}
            onChange={(e) => setAddId(e.target.value)}
            placeholder="VLAN ID"
            style={{ ...inputStyle, width: 60 }}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Name"
            style={{ ...inputStyle, flex: 1 }}
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

function SystemTab({ deviceId, config, model }: { deviceId: string; config: SwitchConfig; model: string }) {
  const [hostname, setHostname] = useState(config.hostname);
  const [hostnameError, setHostnameError] = useState<string | null>(null);
  const [hostnameSaved, setHostnameSaved] = useState(false);

  const [mgmtIp, setMgmtIp] = useState(config.managementIp || "");
  const [mgmtMask, setMgmtMask] = useState(config.managementMask?.toString() || "");
  const [mgmtError, setMgmtError] = useState<string | null>(null);
  const [mgmtSaved, setMgmtSaved] = useState(false);

  const handleHostnameSave = async () => {
    setHostnameError(null);
    setHostnameSaved(false);
    try {
      await rpcClient.call("setDeviceHostname", { deviceId, hostname });
      setHostnameSaved(true);
      setTimeout(() => setHostnameSaved(false), 2000);
    } catch (e) {
      setHostnameError((e as Error).message);
    }
  };

  const handleMgmtSave = async () => {
    setMgmtError(null);
    setMgmtSaved(false);
    try {
      await rpcClient.call("configureSwitchManagement", {
        deviceId,
        managementIp: mgmtIp || null,
        managementMask: mgmtMask ? Number(mgmtMask) : null,
      });
      setMgmtSaved(true);
      setTimeout(() => setMgmtSaved(false), 2000);
    } catch (e) {
      setMgmtError((e as Error).message);
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
            onKeyDown={(e) => { if (e.key === "Enter") handleHostnameSave(); }}
          />
          <SmallButton label="Save" color={THEME.colors.success} onClick={handleHostnameSave} />
          {hostnameSaved && <span style={{ fontSize: 9, color: THEME.colors.success }}>Saved</span>}
          {hostnameError && <span style={{ fontSize: 9, color: THEME.colors.danger }}>{hostnameError}</span>}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 10, color: THEME.colors.textMuted, display: "block", marginBottom: 4 }}>Management IP</label>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            value={mgmtIp}
            onChange={(e) => setMgmtIp(e.target.value)}
            placeholder="10.0.0.1"
            style={{ ...inputStyle, width: 140 }}
            onKeyDown={(e) => { if (e.key === "Enter") handleMgmtSave(); }}
          />
          <span style={{ fontFamily: THEME.fonts.mono, fontSize: 10, color: THEME.colors.textDim }}>/</span>
          <input
            value={mgmtMask}
            onChange={(e) => setMgmtMask(e.target.value)}
            placeholder="24"
            style={{ ...inputStyle, width: 30 }}
            onKeyDown={(e) => { if (e.key === "Enter") handleMgmtSave(); }}
          />
          <SmallButton label="Save" color={THEME.colors.success} onClick={handleMgmtSave} />
          {mgmtSaved && <span style={{ fontSize: 9, color: THEME.colors.success }}>Saved</span>}
          {mgmtError && <span style={{ fontSize: 9, color: THEME.colors.danger }}>{mgmtError}</span>}
        </div>
      </div>

      <div style={{ fontSize: 10, color: THEME.colors.textDim }}>
        <div>Model: {model}</div>
        <div>Firmware: NetCore SwitchOS v1.0</div>
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
