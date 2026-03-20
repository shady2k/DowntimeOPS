import { useGameStore } from "../../store/gameStore";
import { rpcClient } from "../../rpc/client";

export function TopBar() {
  const state = useGameStore((s) => s.state);
  const highlightedAlertId = useGameStore((s) => s.highlightedAlertId);
  if (!state) return null;

  const net = state.monthlyRevenue - state.monthlyExpenses;
  const netColor = net > 0 ? "#2ecc71" : net < 0 ? "#e74c3c" : "#666";
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
        gap: 6,
        padding: "6px 16px",
        background: "#1a1a2e",
        borderBottom: "1px solid #333",
        fontSize: 12,
        fontFamily: "monospace",
      }}
    >
      {/* Logo */}
      <span style={{ fontWeight: "bold", color: "#3498db", marginRight: 8 }}>
        DowntimeOPS
      </span>

      {/* Primary: Net cashflow */}
      <div
        style={{
          padding: "2px 10px",
          background: net > 0 ? "#1a2a1a" : net < 0 ? "#2a1a1a" : "#1a1a20",
          borderRadius: 3,
          border: `1px solid ${net > 0 ? "#2a4a2a" : net < 0 ? "#4a2a2a" : "#2a2a3a"}`,
        }}
      >
        <span style={{ color: netColor, fontWeight: "bold" }}>
          {net >= 0 ? "+" : ""}${net.toFixed(0)}/mo
        </span>
      </div>

      {/* Balance */}
      <span style={{ color: "#2ecc71", fontSize: 11 }}>
        ${state.money.toFixed(0)}
      </span>

      {/* Runway warning */}
      {net < 0 && state.money > 0 && (
        <span
          style={{
            color: "#e67e22",
            fontSize: 10,
            padding: "1px 6px",
            background: "#2a1a0a",
            borderRadius: 2,
          }}
        >
          Runway: {Math.floor(state.money / Math.abs(net))}mo
        </span>
      )}

      {/* Separator */}
      <span style={{ color: "#333", margin: "0 2px" }}>|</span>

      {/* Reputation */}
      <span style={{ fontSize: 11, color: "#95a5a6" }}>
        Rep: {state.reputation.toFixed(0)}
      </span>

      {/* Incident count */}
      {activeIncidents > 0 && (
        <span
          style={{
            color: "#e74c3c",
            fontSize: 10,
            padding: "1px 6px",
            background: highlightedAlertId ? "#3a1a1a" : "#2a1a1a",
            borderRadius: 2,
            fontWeight: "bold",
            animation: "pulse 1.5s infinite",
          }}
        >
          {activeIncidents} INCIDENT{activeIncidents > 1 ? "S" : ""}
        </span>
      )}

      {/* Speed controls — right aligned */}
      <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
        <span style={{ fontSize: 10, color: "#555", alignSelf: "center", marginRight: 4 }}>
          Tick {state.tick}
        </span>
        {[0, 1, 2, 3].map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            style={{
              padding: "2px 7px",
              background: state.speed === s ? "#3498db" : "#252540",
              color: state.speed === s ? "#fff" : "#888",
              border: `1px solid ${state.speed === s ? "#3498db" : "#333"}`,
              borderRadius: 3,
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            {s === 0 ? "||" : `${s}x`}
          </button>
        ))}
      </div>
    </div>
  );
}
