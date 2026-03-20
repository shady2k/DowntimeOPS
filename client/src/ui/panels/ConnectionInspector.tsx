import { useGameStore } from "../../store/gameStore";

export function ConnectionInspector() {
  const state = useGameStore((s) => s.state);
  if (!state) return null;

  const connections = Object.values(state.connections);
  const active = connections.filter((c) => c.status === "active");
  const degraded = connections.filter((c) => c.status === "degraded");
  const terminated = connections.filter((c) => c.status === "terminated");

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#95a5a6" }}>
        CONNECTIONS
      </h3>

      <div style={{ fontSize: 10, marginBottom: 8, color: "#95a5a6" }}>
        <span style={{ color: "#2ecc71" }}>{active.length} active</span>
        {" | "}
        <span style={{ color: "#f39c12" }}>{degraded.length} degraded</span>
        {" | "}
        <span style={{ color: "#e74c3c" }}>{terminated.length} terminated</span>
      </div>

      {connections.slice(0, 30).map((conn) => {
        const client = state.clients[conn.clientId];
        const statusColor =
          conn.status === "active"
            ? "#2ecc71"
            : conn.status === "degraded"
              ? "#f39c12"
              : "#e74c3c";

        return (
          <div
            key={conn.id}
            style={{
              padding: 4,
              marginBottom: 2,
              background: "#1a1a2e",
              borderRadius: 3,
              borderLeft: `3px solid ${statusColor}`,
              fontSize: 10,
            }}
          >
            <div>
              {conn.srcIp}:{conn.srcPort} → {conn.dstIp}:{conn.dstPort}
            </div>
            <div style={{ color: "#666" }}>
              {conn.bandwidthMbps.toFixed(1)} Mbps | {conn.path.length} hops |{" "}
              {client?.name || "Unknown"} |{" "}
              <span style={{ color: statusColor }}>{conn.status}</span>
            </div>
          </div>
        );
      })}

      {connections.length > 30 && (
        <p style={{ fontSize: 10, color: "#555" }}>
          ... and {connections.length - 30} more
        </p>
      )}
    </div>
  );
}
