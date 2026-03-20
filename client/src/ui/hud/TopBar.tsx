import { useGameStore } from "../../store/gameStore";
import { rpcClient } from "../../rpc/client";
import { THEME } from "../theme";

export function TopBar() {
  const state = useGameStore((s) => s.state);
  const highlightedAlertId = useGameStore((s) => s.highlightedAlertId);
  if (!state) return null;

  const net = state.monthlyRevenue - state.monthlyExpenses;
  const netColor = net > 0 ? THEME.colors.success : net < 0 ? THEME.colors.danger : THEME.colors.textDim;
  const activeIncidents = state.alerts.filter(
    (a) => !a.acknowledged && a.severity === "critical",
  ).length;

  const setSpeed = (speed: number) => {
    rpcClient.call("setSpeed", { speed }).catch(() => {});
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        background: THEME.colors.bgPanel,
        borderBottom: `1px solid ${THEME.colors.borderDark}`,
        fontSize: 12,
        fontFamily: THEME.fonts.body,
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      }}
    >
      {/* Logo */}
      <img
        src="assets/ui/logo.png"
        alt="DowntimeOPS"
        style={{ height: 22, marginRight: 8, imageRendering: "auto" }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />

      {/* Primary: Net cashflow */}
      <div
        style={{
          padding: "3px 10px",
          background: net > 0 ? THEME.colors.successBg : net < 0 ? THEME.colors.dangerBg : THEME.colors.bgCard,
          borderRadius: THEME.radius.sm,
          border: `1px solid ${net > 0 ? THEME.colors.successBorder : net < 0 ? THEME.colors.dangerBorder : THEME.colors.border}`,
        }}
      >
        <span style={{ color: netColor, fontWeight: 700, fontFamily: THEME.fonts.mono, fontSize: 12 }}>
          {net >= 0 ? "+" : ""}${net.toFixed(0)}/mo
        </span>
      </div>

      {/* Balance */}
      <span style={{ color: THEME.colors.success, fontSize: 12, fontFamily: THEME.fonts.mono, fontWeight: 600 }}>
        ${state.money.toFixed(0)}
      </span>

      {/* Runway warning */}
      {net < 0 && state.money > 0 && (
        <span
          style={{
            color: THEME.colors.warning,
            fontSize: 10,
            padding: "2px 8px",
            background: THEME.colors.warningBg,
            borderRadius: THEME.radius.sm,
            fontWeight: 600,
          }}
        >
          Runway: {Math.floor(state.money / Math.abs(net))}mo
        </span>
      )}

      {/* Separator */}
      <span style={{ color: THEME.colors.borderDark, margin: "0 2px" }}>|</span>

      {/* Reputation */}
      <span style={{ fontSize: 11, color: THEME.colors.textMuted }}>
        Rep: {state.reputation.toFixed(0)}
      </span>

      {/* Incident count */}
      {activeIncidents > 0 && (
        <span
          style={{
            color: THEME.colors.danger,
            fontSize: 10,
            padding: "2px 8px",
            background: highlightedAlertId ? THEME.colors.dangerBg : THEME.colors.dangerBg,
            borderRadius: THEME.radius.sm,
            fontWeight: 700,
            border: `1px solid ${THEME.colors.dangerBorder}`,
            animation: "pulse 1.5s infinite",
          }}
        >
          {activeIncidents} INCIDENT{activeIncidents > 1 ? "S" : ""}
        </span>
      )}

      {/* Speed controls — right aligned */}
      <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: 10, color: THEME.colors.textDim, marginRight: 4, fontFamily: THEME.fonts.mono }}>
          Tick {state.tick}
        </span>
        {[0, 1, 2, 3].map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            style={{
              padding: "3px 8px",
              background: state.speed === s ? THEME.colors.accent : THEME.colors.bgCard,
              color: state.speed === s ? THEME.colors.textInverse : THEME.colors.textMuted,
              border: `1px solid ${state.speed === s ? THEME.colors.accent : THEME.colors.border}`,
              borderRadius: THEME.radius.sm,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: state.speed === s ? 700 : 400,
              fontFamily: THEME.fonts.body,
              boxShadow: state.speed === s ? THEME.shadows.glow(THEME.colors.accent) : "none",
              transition: "all 0.15s",
            }}
          >
            {s === 0 ? "||" : `${s}x`}
          </button>
        ))}
      </div>
    </div>
  );
}
