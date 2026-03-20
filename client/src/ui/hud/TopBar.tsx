import { useGameStore } from "../../store/gameStore";
import { rpcClient } from "../../rpc/client";

export function TopBar() {
  const state = useGameStore((s) => s.state);
  if (!state) return null;

  const setSpeed = (speed: number) => {
    rpcClient.call("setSpeed", { speed }).catch(() => {});
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "8px 16px",
        background: "#1a1a2e",
        borderBottom: "1px solid #333",
        fontSize: 13,
      }}
    >
      <span style={{ fontWeight: "bold", color: "#3498db" }}>DowntimeOPS</span>
      <span>Tick: {state.tick}</span>
      <span style={{ color: "#2ecc71" }}>${state.money.toFixed(0)}</span>
      <span>
        Rev: ${state.monthlyRevenue.toFixed(0)}/mo | Exp: $
        {state.monthlyExpenses.toFixed(0)}/mo
      </span>
      <span>Rep: {state.reputation.toFixed(0)}</span>

      {/* Net cashflow */}
      {(() => {
        const net = state.monthlyRevenue - state.monthlyExpenses;
        const color = net > 0 ? "#2ecc71" : net < 0 ? "#e74c3c" : "#666";
        return (
          <span style={{ color }}>
            Net: {net >= 0 ? "+" : ""}${net.toFixed(0)}/mo
          </span>
        );
      })()}

      {/* Runway warning */}
      {state.monthlyRevenue < state.monthlyExpenses && state.money > 0 && (
        <span style={{ color: "#e67e22", fontSize: 11 }}>
          Runway:{" "}
          {Math.floor(
            state.money / (state.monthlyExpenses - state.monthlyRevenue),
          )}
          mo
        </span>
      )}

      <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
        {[0, 1, 2, 3].map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            style={{
              padding: "2px 8px",
              background: state.speed === s ? "#3498db" : "#333",
              color: "#fff",
              border: "none",
              borderRadius: 3,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {s === 0 ? "⏸" : `${s}x`}
          </button>
        ))}
      </div>
    </div>
  );
}
