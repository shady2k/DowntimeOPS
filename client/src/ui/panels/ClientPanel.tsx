import { useGameStore } from "../../store/gameStore";
import { rpcClient } from "../../rpc/client";

export function ClientPanel() {
  const state = useGameStore((s) => s.state);
  const selectedClientId = useGameStore((s) => s.selectedClientId);
  const selectClient = useGameStore((s) => s.selectClient);
  if (!state) return null;

  const clients = Object.values(state.clients);
  const prospects = clients.filter((c) => c.status === "prospect");
  const active = clients.filter(
    (c) => c.status === "active" || c.status === "warning",
  );

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#95a5a6" }}>
        CLIENTS
      </h3>

      {prospects.length === 0 && (
        <p style={{ fontSize: 10, color: "#555", lineHeight: 1.5 }}>
          No prospects yet. Build your network (router + switch + server, all
          cabled) and clients will come knocking.
        </p>
      )}

      {prospects.length > 0 && (
        <>
          <h4 style={{ margin: "0 0 4px", fontSize: 11, color: "#f39c12" }}>
            Prospects ({prospects.length})
          </h4>
          {prospects.map((client) => (
            <div
              key={client.id}
              style={{
                padding: 6,
                marginBottom: 4,
                background: "#1a1a2e",
                borderRadius: 4,
                borderLeft: "3px solid #f39c12",
                fontSize: 10,
              }}
            >
              <div style={{ fontWeight: "bold", fontSize: 11 }}>
                {client.name}
              </div>
              <div style={{ color: "#95a5a6" }}>
                {client.contract.bandwidthMbps} Mbps |{" "}
                {client.contract.uptimeSla}% SLA | $
                {client.contract.monthlyRevenue}/mo
              </div>
              <div style={{ marginTop: 4, display: "flex", gap: 4 }}>
                <button
                  onClick={() =>
                    rpcClient
                      .call("acceptClient", { clientId: client.id })
                      .catch(() => {})
                  }
                  style={{
                    padding: "2px 10px",
                    background: "#2ecc71",
                    color: "#fff",
                    border: "none",
                    borderRadius: 3,
                    cursor: "pointer",
                    fontSize: 10,
                  }}
                >
                  Accept
                </button>
                <button
                  onClick={() =>
                    rpcClient
                      .call("rejectClient", { clientId: client.id })
                      .catch(() => {})
                  }
                  style={{
                    padding: "2px 10px",
                    background: "#e74c3c",
                    color: "#fff",
                    border: "none",
                    borderRadius: 3,
                    cursor: "pointer",
                    fontSize: 10,
                  }}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      <h4 style={{ margin: "12px 0 4px", fontSize: 11, color: "#2ecc71" }}>
        Active Contracts ({active.length})
      </h4>
      {active.length === 0 && (
        <p style={{ fontSize: 10, color: "#555" }}>
          {prospects.length > 0
            ? "Accept a prospect above to start earning revenue!"
            : "No active contracts"}
        </p>
      )}
      {active.map((client) => {
        const connCount = Object.values(state.connections).filter(
          (c) => c.clientId === client.id,
        ).length;
        const activeConns = Object.values(state.connections).filter(
          (c) => c.clientId === client.id && c.status === "active",
        ).length;

        const isSelected = selectedClientId === client.id;
        return (
          <div
            key={client.id}
            onClick={() => selectClient(isSelected ? null : client.id)}
            style={{
              padding: 6,
              marginBottom: 4,
              background: isSelected ? "#1a2a1a" : "#1a1a2e",
              borderRadius: 4,
              borderLeft: `3px solid ${isSelected ? "#f1c40f" : client.status === "warning" ? "#f39c12" : "#2ecc71"}`,
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: "bold", fontSize: 11 }}>
              {client.name}
              {isSelected && (
                <span style={{ color: "#f1c40f", marginLeft: 6, fontSize: 9 }}>
                  SHOWING PATH
                </span>
              )}
              {!isSelected && client.status === "warning" && (
                <span style={{ color: "#f39c12", marginLeft: 6 }}>
                  WARNING
                </span>
              )}
            </div>
            <div style={{ color: "#95a5a6" }}>
              {client.contract.bandwidthMbps} Mbps | $
              {client.contract.monthlyRevenue}/mo | Satisfaction:{" "}
              {client.satisfaction}%
            </div>
            <div style={{ color: "#666" }}>
              Connections: {activeConns}/{connCount} active
            </div>
          </div>
        );
      })}
    </div>
  );
}
