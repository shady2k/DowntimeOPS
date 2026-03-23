import { useState } from "react";
import { useGameStore } from "../../../store/gameStore";
import { rpcClient } from "../../../rpc/client";
import { useBrowserStore } from "../browserStore";
import { hostCount } from "@downtime-ops/shared";
import { THEME } from "../../theme";

interface IpamPageProps {
  subpage?: string;
}

export function IpamPage({ subpage }: IpamPageProps) {
  const state = useGameStore((s) => s.state);
  if (!state) return null;

  // If subpage is a subnet ID, show detail view
  if (subpage && state.ipam.subnets[subpage]) {
    return <SubnetDetail subnetId={subpage} />;
  }

  return <SubnetOverview />;
}

// --- Overview ---

function SubnetOverview() {
  const state = useGameStore((s) => s.state);
  const navigate = useBrowserStore((s) => s.navigate);
  const subnets = state ? Object.values(state.ipam.subnets) : [];

  const [network, setNetwork] = useState("");
  const [mask, setMask] = useState("24");
  const [name, setName] = useState("");
  const [vlanId, setVlanId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    try {
      await rpcClient.call("createSubnet", {
        network,
        mask: Number(mask),
        name,
        vlanId: vlanId ? Number(vlanId) : undefined,
      });
      setNetwork("");
      setMask("24");
      setName("");
      setVlanId("");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async (subnetId: string) => {
    try {
      await rpcClient.call("deleteSubnet", { subnetId });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const vlans = state ? Object.values(state.vlans) : [];

  return (
    <div style={{ fontFamily: THEME.fonts.body, fontSize: 11, color: THEME.colors.text }}>
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          background: `linear-gradient(135deg, ${THEME.colors.info}22, ${THEME.colors.bgPanel})`,
          borderBottom: `2px solid ${THEME.colors.info}`,
        }}
      >
        <div style={{ fontSize: 9, color: THEME.colors.info, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
          IPAM — IP Address Manager
        </div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Subnet Overview</div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Subnet list */}
        {subnets.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: THEME.colors.textDim }}>
            No subnets configured. Create one to start planning your IP space.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {subnets.map((subnet) => {
            const total = hostCount(subnet.mask);
            const used = Object.keys(subnet.allocations).length;
            const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
            const vlan = state?.vlans[subnet.vlanId ?? -1];

            return (
              <button
                key={subnet.id}
                onClick={() => navigate({ type: "ipam", subpage: subnet.id })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  background: THEME.colors.bgCard,
                  border: `1px solid ${THEME.colors.border}`,
                  borderRadius: THEME.radius.md,
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = THEME.colors.info; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = THEME.colors.border; }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: THEME.colors.text, marginBottom: 2 }}>
                    {subnet.name}
                  </div>
                  <div style={{ fontFamily: THEME.fonts.mono, fontSize: 10, color: THEME.colors.textMuted }}>
                    {subnet.network}/{subnet.mask}
                  </div>
                </div>

                {vlan && (
                  <span
                    style={{
                      fontSize: 9,
                      padding: "1px 6px",
                      borderRadius: 3,
                      background: `${vlan.color}22`,
                      border: `1px solid ${vlan.color}44`,
                      color: vlan.color,
                    }}
                  >
                    VLAN {vlan.id}
                  </span>
                )}

                {/* Usage bar */}
                <div style={{ width: 80 }}>
                  <div style={{ fontSize: 9, color: THEME.colors.textDim, marginBottom: 2, textAlign: "right" }}>
                    {used}/{total}
                  </div>
                  <div style={{ height: 4, background: THEME.colors.bgInput, borderRadius: 2 }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: pct > 80 ? THEME.colors.warning : THEME.colors.info,
                        borderRadius: 2,
                      }}
                    />
                  </div>
                </div>

                <SmallButton
                  label="Delete"
                  color={THEME.colors.danger}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(subnet.id);
                  }}
                />
              </button>
            );
          })}
        </div>

        {/* Add subnet form */}
        <div
          style={{
            padding: 12,
            background: THEME.colors.bgCard,
            borderRadius: THEME.radius.md,
            border: `1px solid ${THEME.colors.border}`,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 8, color: THEME.colors.textMuted }}>Add Subnet</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              placeholder="10.0.1.0"
              style={{ ...inputStyle, width: 110 }}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
            <span style={{ fontFamily: THEME.fonts.mono, color: THEME.colors.textDim }}>/</span>
            <input
              value={mask}
              onChange={(e) => setMask(e.target.value)}
              placeholder="24"
              style={{ ...inputStyle, width: 36 }}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              style={{ ...inputStyle, width: 100 }}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
            <select
              value={vlanId}
              onChange={(e) => setVlanId(e.target.value)}
              style={{ ...inputStyle, fontFamily: THEME.fonts.body }}
            >
              <option value="">No VLAN</option>
              {vlans.map((v) => (
                <option key={v.id} value={v.id}>VLAN {v.id} — {v.name}</option>
              ))}
            </select>
            <SmallButton label="Add" color={THEME.colors.success} onClick={handleCreate} />
          </div>
          {error && <div style={{ fontSize: 9, color: THEME.colors.danger, marginTop: 4 }}>{error}</div>}
        </div>
      </div>
    </div>
  );
}

// --- Subnet Detail ---

function SubnetDetail({ subnetId }: { subnetId: string }) {
  const state = useGameStore((s) => s.state);
  const navigate = useBrowserStore((s) => s.navigate);
  const subnet = state?.ipam.subnets[subnetId];

  const [ip, setIp] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!subnet || !state) return null;

  const allocations = Object.values(subnet.allocations);
  const total = hostCount(subnet.mask);
  const used = allocations.length;
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const vlan = state.vlans[subnet.vlanId ?? -1];
  const devices = Object.values(state.devices);

  const handleAllocate = async () => {
    setError(null);
    try {
      await rpcClient.call("allocateIp", {
        subnetId,
        ip,
        deviceId: deviceId || undefined,
        description,
      });
      setIp("");
      setDeviceId("");
      setDescription("");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleRelease = async (releaseIp: string) => {
    try {
      await rpcClient.call("releaseIp", { subnetId, ip: releaseIp });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div style={{ fontFamily: THEME.fonts.body, fontSize: 11, color: THEME.colors.text }}>
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          background: `linear-gradient(135deg, ${THEME.colors.info}22, ${THEME.colors.bgPanel})`,
          borderBottom: `2px solid ${THEME.colors.info}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 9, color: THEME.colors.info, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
            IPAM — IP Address Manager
          </div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{subnet.name}</div>
          <div style={{ fontSize: 10, fontFamily: THEME.fonts.mono, color: THEME.colors.textMuted }}>
            {subnet.network}/{subnet.mask}
            {vlan && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 9,
                  padding: "1px 6px",
                  borderRadius: 3,
                  background: `${vlan.color}22`,
                  border: `1px solid ${vlan.color}44`,
                  color: vlan.color,
                }}
              >
                VLAN {vlan.id}
              </span>
            )}
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 10, color: THEME.colors.textDim }}>{used}/{total} allocated</div>
          <div style={{ width: 80, height: 4, background: THEME.colors.bgInput, borderRadius: 2, marginTop: 2 }}>
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background: pct > 80 ? THEME.colors.warning : THEME.colors.info,
                borderRadius: 2,
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Back link */}
        <button
          onClick={() => navigate({ type: "ipam" })}
          style={{
            background: "none",
            border: "none",
            color: THEME.colors.info,
            cursor: "pointer",
            fontFamily: THEME.fonts.body,
            fontSize: 10,
            padding: 0,
            marginBottom: 12,
          }}
        >
          &larr; All Subnets
        </button>

        {/* Allocation table */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${THEME.colors.border}` }}>
              <Th>IP Address</Th>
              <Th>Device</Th>
              <Th>Description</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {allocations.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 8, textAlign: "center", color: THEME.colors.textDim }}>
                  No allocations yet
                </td>
              </tr>
            )}
            {allocations
              .sort((a, b) => ipSortKey(a.ip) - ipSortKey(b.ip))
              .map((alloc) => {
                const device = alloc.deviceId ? state.devices[alloc.deviceId] : null;
                return (
                  <tr key={alloc.ip} style={{ borderBottom: `1px solid ${THEME.colors.borderDark}` }}>
                    <td style={{ padding: "6px 8px", fontFamily: THEME.fonts.mono }}>
                      {alloc.ip}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      {device ? (
                        <span style={{ color: THEME.colors.text }}>{device.name}</span>
                      ) : (
                        <span style={{ color: THEME.colors.textDim }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "6px 8px", color: THEME.colors.textMuted }}>
                      {alloc.description}
                    </td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>
                      <SmallButton label="Release" color={THEME.colors.danger} onClick={() => handleRelease(alloc.ip)} />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {/* Allocate form */}
        <div
          style={{
            padding: 10,
            background: THEME.colors.bgCard,
            borderRadius: THEME.radius.md,
            border: `1px solid ${THEME.colors.border}`,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 6, color: THEME.colors.textMuted }}>Allocate IP</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder={`e.g. ${subnet.network.replace(/\.0$/, ".10")}`}
              style={{ ...inputStyle, width: 120 }}
              onKeyDown={(e) => { if (e.key === "Enter") handleAllocate(); }}
            />
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              style={{ ...inputStyle, fontFamily: THEME.fonts.body, width: 140 }}
            >
              <option value="">No device</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              style={{ ...inputStyle, flex: 1, minWidth: 80 }}
              onKeyDown={(e) => { if (e.key === "Enter") handleAllocate(); }}
            />
            <SmallButton label="Allocate" color={THEME.colors.success} onClick={handleAllocate} />
          </div>
          {error && <div style={{ fontSize: 9, color: THEME.colors.danger, marginTop: 4 }}>{error}</div>}
        </div>
      </div>
    </div>
  );
}

// --- Helpers ---

function ipSortKey(ip: string): number {
  const parts = ip.split(".");
  return ((Number(parts[0]) << 24) | (Number(parts[1]) << 16) | (Number(parts[2]) << 8) | Number(parts[3])) >>> 0;
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "6px 8px", color: THEME.colors.textDim, fontWeight: 600, fontSize: 9 }}>{children}</th>;
}

function SmallButton({ label, color, onClick }: { label: string; color: string; onClick: (e: React.MouseEvent) => void }) {
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
