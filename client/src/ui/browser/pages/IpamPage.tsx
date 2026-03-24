import { useEffect } from "react";
import { useGameStore } from "../../../store/gameStore";
import { rpcClient } from "../../../rpc/client";
import { useBrowserStore } from "../browserStore";
import { networkAddress, hostCount } from "@downtime-ops/shared";
import type { GameState, InterfaceConfig } from "@downtime-ops/shared";
import { THEME } from "../../theme";

interface IpamPageProps {
  subpage?: string;
}

// --- Auto-discovery types ---

interface DiscoveredAllocation {
  ip: string;
  mask: number;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  portDescription: string;
  conflict: boolean;
}

interface DiscoveredSubnet {
  networkKey: string;
  network: string;
  mask: number;
  gateway: string | null;
  allocations: DiscoveredAllocation[];
}

// --- Auto-discovery logic ---

function discoverSubnets(state: GameState): DiscoveredSubnet[] {
  const rawAllocations: Array<Omit<DiscoveredAllocation, "conflict">> = [];

  for (const device of Object.values(state.devices)) {
    if (device.type === "router" || device.type === "firewall") {
      const cfg = device.config as { interfaces: Record<number, InterfaceConfig> };
      for (const [portIdx, iface] of Object.entries(cfg.interfaces)) {
        if (iface.ip && iface.mask !== null) {
          const portLabel = device.type === "router"
            ? (Number(portIdx) === 0 ? "WAN" : `LAN ${portIdx}`)
            : `eth${portIdx}`;
          rawAllocations.push({
            ip: iface.ip,
            mask: iface.mask,
            deviceId: device.id,
            deviceName: device.name,
            deviceType: device.type,
            portDescription: iface.description || portLabel,
          });
        }
      }
    } else if (device.type === "server") {
      const cfg = device.config as { ip: string | null; mask: number | null };
      if (cfg.ip && cfg.mask !== null) {
        rawAllocations.push({
          ip: cfg.ip,
          mask: cfg.mask,
          deviceId: device.id,
          deviceName: device.name,
          deviceType: device.type,
          portDescription: "eth0",
        });
      }
    } else if (device.type === "switch") {
      const cfg = device.config as { managementIp: string | null; managementMask: number | null };
      if (cfg.managementIp && cfg.managementMask !== null) {
        rawAllocations.push({
          ip: cfg.managementIp,
          mask: cfg.managementMask,
          deviceId: device.id,
          deviceName: device.name,
          deviceType: device.type,
          portDescription: "mgmt",
        });
      }
    }
  }

  // Group by network address
  const subnetMap = new Map<string, DiscoveredAllocation[]>();

  for (const alloc of rawAllocations) {
    const net = networkAddress(alloc.ip, alloc.mask);
    const key = `${net}/${alloc.mask}`;

    if (!subnetMap.has(key)) subnetMap.set(key, []);
    subnetMap.get(key)!.push({ ...alloc, conflict: false });
  }

  // Detect IP conflicts within each subnet
  for (const allocations of subnetMap.values()) {
    const ipCounts = new Map<string, number>();
    for (const a of allocations) {
      ipCounts.set(a.ip, (ipCounts.get(a.ip) || 0) + 1);
    }
    for (const a of allocations) {
      if ((ipCounts.get(a.ip) || 0) > 1) {
        a.conflict = true;
      }
    }
  }

  // Build result
  const subnets: DiscoveredSubnet[] = [];
  for (const [key, allocations] of subnetMap) {
    const [net, maskStr] = key.split("/");
    const mask = Number(maskStr);

    // Gateway = router interface in this subnet
    const routerAlloc = allocations.find((a) => a.deviceType === "router" || a.deviceType === "firewall");

    subnets.push({
      networkKey: key.replace("/", "-"),
      network: net,
      mask,
      gateway: routerAlloc?.ip ?? null,
      allocations: allocations.sort((a, b) => ipSortKey(a.ip) - ipSortKey(b.ip)),
    });
  }

  return subnets.sort((a, b) => ipSortKey(a.network) - ipSortKey(b.network));
}

// --- Page component ---

export function IpamPage({ subpage }: IpamPageProps) {
  const state = useGameStore((s) => s.state);

  useEffect(() => {
    rpcClient.call("reportPageVisit", { page: "ipam" }).catch(() => {});
  }, []);

  if (!state) return null;

  const subnets = discoverSubnets(state);

  if (subpage) {
    const subnet = subnets.find((s) => s.networkKey === subpage);
    if (subnet) return <SubnetDetail subnet={subnet} />;
  }

  return <SubnetOverview subnets={subnets} />;
}

// --- Overview ---

function SubnetOverview({ subnets }: { subnets: DiscoveredSubnet[] }) {
  const navigate = useBrowserStore((s) => s.navigate);

  const totalIps = subnets.reduce((sum, s) => sum + s.allocations.length, 0);

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
          IPAM — Network Overview
        </div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Auto-Discovered Subnets</div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Stats */}
        <div style={{ fontSize: 10, color: THEME.colors.textDim, marginBottom: 12 }}>
          {subnets.length} subnet{subnets.length !== 1 ? "s" : ""} | {totalIps} address{totalIps !== 1 ? "es" : ""} in use
        </div>

        {subnets.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: THEME.colors.textDim }}>
            No IP addresses configured on any devices yet.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {subnets.map((subnet) => {
            const total = hostCount(subnet.mask);
            const used = subnet.allocations.length;
            const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
            const hasConflicts = subnet.allocations.some((a) => a.conflict);

            return (
              <button
                key={subnet.networkKey}
                onClick={() => navigate({ type: "ipam", subpage: subnet.networkKey })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  background: THEME.colors.bgCard,
                  border: `1px solid ${hasConflicts ? THEME.colors.danger : THEME.colors.border}`,
                  borderRadius: THEME.radius.md,
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  fontFamily: THEME.fonts.body,
                  color: THEME.colors.text,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = THEME.colors.info; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = hasConflicts ? THEME.colors.danger : THEME.colors.border; }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: THEME.fonts.mono, fontSize: 12, fontWeight: 600, marginBottom: 2 }}>
                    {subnet.network}/{subnet.mask}
                  </div>
                  {subnet.gateway && (
                    <div style={{ fontSize: 9, color: THEME.colors.textDim }}>
                      Gateway: {subnet.gateway}
                    </div>
                  )}
                </div>

                {hasConflicts && (
                  <span style={{
                    fontSize: 8,
                    padding: "1px 6px",
                    borderRadius: 3,
                    background: `${THEME.colors.danger}22`,
                    border: `1px solid ${THEME.colors.danger}44`,
                    color: THEME.colors.danger,
                    fontWeight: 700,
                  }}>
                    CONFLICT
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
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- Subnet Detail ---

function SubnetDetail({ subnet }: { subnet: DiscoveredSubnet }) {
  const navigate = useBrowserStore((s) => s.navigate);

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
            IPAM — Subnet Detail
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: THEME.fonts.mono }}>
            {subnet.network}/{subnet.mask}
          </div>
          {subnet.gateway && (
            <div style={{ fontSize: 10, color: THEME.colors.textMuted }}>
              Gateway: {subnet.gateway}
            </div>
          )}
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 10, color: THEME.colors.textDim }}>
            {subnet.allocations.length}/{hostCount(subnet.mask)} allocated
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
              <Th>Type</Th>
              <Th>Interface</Th>
            </tr>
          </thead>
          <tbody>
            {subnet.allocations.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 8, textAlign: "center", color: THEME.colors.textDim }}>
                  No allocations
                </td>
              </tr>
            )}
            {subnet.allocations.map((alloc, i) => (
              <tr
                key={`${alloc.ip}-${alloc.deviceId}-${i}`}
                style={{
                  borderBottom: `1px solid ${THEME.colors.borderDark}`,
                  background: alloc.conflict ? `${THEME.colors.danger}11` : undefined,
                }}
              >
                <td style={{ padding: "6px 8px", fontFamily: THEME.fonts.mono }}>
                  {alloc.ip}
                  {alloc.conflict && (
                    <span style={{
                      marginLeft: 6,
                      fontSize: 8,
                      padding: "0 4px",
                      background: THEME.colors.danger,
                      color: "#fff",
                      borderRadius: 2,
                      fontWeight: 700,
                      fontFamily: THEME.fonts.body,
                    }}>
                      CONFLICT
                    </span>
                  )}
                </td>
                <td style={{ padding: "6px 8px" }}>
                  <button
                    onClick={() => navigate({ type: "console", deviceId: alloc.deviceId })}
                    style={{
                      background: "none",
                      border: "none",
                      color: THEME.colors.info,
                      cursor: "pointer",
                      fontFamily: THEME.fonts.body,
                      fontSize: 10,
                      padding: 0,
                      textDecoration: "underline",
                    }}
                  >
                    {alloc.deviceName}
                  </button>
                </td>
                <td style={{ padding: "6px 8px", color: THEME.colors.textMuted, textTransform: "capitalize" }}>
                  {alloc.deviceType}
                </td>
                <td style={{ padding: "6px 8px", color: THEME.colors.textMuted }}>
                  {alloc.portDescription}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
