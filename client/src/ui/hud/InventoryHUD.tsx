import { useGameStore } from "../../store/gameStore";
import { THEME } from "../theme";

export function InventoryHUD() {
  const activeView = useGameStore((s) => s.activeView);
  const state = useGameStore((s) => s.state);
  if (!state) return null;
  // In rack view, RackWorkstation handles the economy display
  if (activeView !== "world") return null;

  const { world, money } = state;
  const cs = world.cableStock;

  // Count items in storage
  const storageCount = Object.values(world.items).filter(
    (item) => item.state === "in_storage",
  ).length;

  // Count placed racks
  const racksPlaced = Object.values(world.items).filter(
    (item) => item.kind === "rack" && item.state === "placed",
  ).length;

  // Count installed devices
  const devicesInstalled = Object.keys(state.devices).length;

  // Carried item
  const carriedItem = world.player.carryingItemId
    ? world.items[world.player.carryingItemId]
    : null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        display: "flex",
        alignItems: "center",
        gap: 0,
        zIndex: 100,
        pointerEvents: "none",
        height: 28,
      }}
    >
      {/* Carried item indicator (left side, separate) */}
      {carriedItem && (
        <div style={{
          ...cellStyle,
          background: "rgba(60, 45, 20, 0.9)",
          borderColor: THEME.colors.accent,
          color: THEME.colors.accent,
          marginRight: 4,
        }}>
          <Icon char={carriedItem.kind === "rack" ? "\u2610" : "\u25A3"} color={THEME.colors.accent} />
          <span style={valueStyle}>{ITEM_NAMES[carriedItem.model] || carriedItem.model}</span>
        </div>
      )}

      {/* Resource cells — WC3-style right-aligned bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        background: "rgba(30, 24, 20, 0.92)",
        borderBottom: `1px solid ${THEME.colors.borderDark}`,
        borderLeft: `1px solid ${THEME.colors.borderDark}`,
        borderBottomLeftRadius: 6,
      }}>
        <Cell icon="$" color={THEME.colors.success} value={formatMoney(money)} />
        <Sep />
        <Cell icon={"\u25A7"} color={THEME.colors.server} value={String(racksPlaced)} label="racks" />
        <Cell icon={"\u25A3"} color={THEME.colors.switch} value={String(devicesInstalled)} label="devices" />
        <Cell icon={"\u2750"} color={THEME.colors.warning} value={String(storageCount)} label="stored" />
        <Sep />
        <Cell icon={"\u2500"} color="#7ab87a" value={String(cs.cat6)} label="Cat6" dim={cs.cat6 === 0} />
        <Cell icon={"\u2550"} color="#5a9aaa" value={String(cs.cat6a)} label="6a" dim={cs.cat6a === 0} />
        <Cell icon={"\u2261"} color="#c48adf" value={String(cs.om3_fiber)} label="OM3" dim={cs.om3_fiber === 0} />
        <Cell icon={"\u2263"} color="#e0c040" value={String(cs.os2_fiber)} label="OS2" dim={cs.os2_fiber === 0} />
      </div>
    </div>
  );
}

const ITEM_NAMES: Record<string, string> = {
  rack_42u: "42U Rack",
  server_1u: "1U Server",
  switch_24p: "24P Switch",
  router_1u: "Router",
};

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

const cellStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 3,
  padding: "4px 8px",
  fontSize: 11,
  fontFamily: "'JetBrains Mono', monospace",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const valueStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
};

function Icon({ char, color }: { char: string; color: string }) {
  return (
    <span style={{ fontSize: 13, color, lineHeight: 1 }}>{char}</span>
  );
}

function Sep() {
  return (
    <div style={{
      width: 1,
      height: 16,
      background: THEME.colors.borderDark,
      margin: "0 2px",
    }} />
  );
}

function Cell({
  icon,
  color,
  value,
  label,
  dim,
}: {
  icon: string;
  color: string;
  value: string;
  label?: string;
  dim?: boolean;
}) {
  const alpha = dim ? 0.35 : 1;
  return (
    <div style={{ ...cellStyle, opacity: alpha }}>
      <Icon char={icon} color={color} />
      <span style={{ ...valueStyle, color }}>{value}</span>
      {label && (
        <span style={{ fontSize: 8, color: THEME.colors.textDim, marginLeft: -1 }}>
          {label}
        </span>
      )}
    </div>
  );
}
