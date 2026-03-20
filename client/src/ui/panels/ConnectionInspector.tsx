import { useGameStore } from "../../store/gameStore";
import { THEME, cardStyle, headingStyle } from "../theme";

export function ConnectionInspector() {
  const state = useGameStore((s) => s.state);
  if (!state) return null;

  const connections = Object.values(state.connections);
  const active = connections.filter((c) => c.status === "active");
  const degraded = connections.filter((c) => c.status === "degraded");
  const terminated = connections.filter((c) => c.status === "terminated");

  return (
    <div style={{ padding: 12, fontFamily: THEME.fonts.body }}>
      <h3 style={headingStyle()}>
        CONNECTIONS
      </h3>

      <div style={{ fontSize: 10, marginBottom: 8, color: THEME.colors.textMuted }}>
        <span style={{ color: THEME.colors.success }}>{active.length} active</span>
        {" | "}
        <span style={{ color: THEME.colors.warning }}>{degraded.length} degraded</span>
        {" | "}
        <span style={{ color: THEME.colors.danger }}>{terminated.length} terminated</span>
      </div>

      {connections.slice(0, 30).map((conn) => {
        const client = state.clients[conn.clientId];
        const statusColor =
          conn.status === "active"
            ? THEME.colors.success
            : conn.status === "degraded"
              ? THEME.colors.warning
              : THEME.colors.danger;

        return (
          <div
            key={conn.id}
            style={{
              ...cardStyle(statusColor),
              padding: 4,
              marginBottom: 2,
              fontSize: 10,
            }}
          >
            <div style={{ color: THEME.colors.text, fontFamily: THEME.fonts.mono }}>
              {conn.srcIp}:{conn.srcPort} → {conn.dstIp}:{conn.dstPort}
            </div>
            <div style={{ color: THEME.colors.textDim }}>
              {conn.bandwidthMbps.toFixed(1)} Mbps | {conn.path.length} hops |{" "}
              {client?.name || "Unknown"} |{" "}
              <span style={{ color: statusColor }}>{conn.status}</span>
            </div>
          </div>
        );
      })}

      {connections.length > 30 && (
        <p style={{ fontSize: 10, color: THEME.colors.textDim }}>
          ... and {connections.length - 30} more
        </p>
      )}
    </div>
  );
}
