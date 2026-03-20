import { useGameStore } from "../../store/gameStore";
import { rpcClient } from "../../rpc/client";

function clientTypeBadge(type: string): { label: string; color: string } {
  switch (type) {
    case "startup":
      return { label: "Startup", color: "#3498db" };
    case "smb":
      return { label: "SMB", color: "#2ecc71" };
    case "enterprise":
      return { label: "Enterprise", color: "#9b59b6" };
    case "bank":
      return { label: "Finance", color: "#e67e22" };
    default:
      return { label: type, color: "#666" };
  }
}

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

  const totalRevenue = active.reduce(
    (sum, c) => sum + c.contract.monthlyRevenue,
    0,
  );

  return (
    <div style={{ padding: 12, fontFamily: "monospace" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#95a5a6" }}>
        CLIENTS
      </h3>

      {/* Revenue summary */}
      {active.length > 0 && (
        <div
          style={{
            padding: "4px 8px",
            marginBottom: 8,
            background: "#1a2a1a",
            borderRadius: 3,
            fontSize: 10,
            color: "#2ecc71",
          }}
        >
          {active.length} active — ${totalRevenue}/mo revenue
        </div>
      )}

      {/* No prospects explanation */}
      {prospects.length === 0 && active.length === 0 && (
        <div
          style={{
            padding: "8px 10px",
            background: "#1a1a28",
            borderLeft: "3px solid #555",
            borderRadius: 3,
            fontSize: 10,
            color: "#666",
            lineHeight: 1.5,
          }}
        >
          No one is knocking yet. Clients need a working network: a router
          connected to a switch connected to a server. Cable them up and
          prospects will appear.
        </div>
      )}

      {/* Prospects */}
      {prospects.length > 0 && (
        <>
          <h4
            style={{
              margin: "0 0 4px",
              fontSize: 11,
              color: "#f39c12",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Prospects ({prospects.length})
            <span style={{ fontSize: 9, color: "#666", fontWeight: "normal" }}>
              — accept before they leave
            </span>
          </h4>
          {prospects.map((client) => {
            const badge = clientTypeBadge(client.type);
            return (
              <div
                key={client.id}
                style={{
                  padding: "8px 10px",
                  marginBottom: 4,
                  background: "#1a1a2e",
                  borderRadius: 4,
                  borderLeft: "3px solid #f39c12",
                  fontSize: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontWeight: "bold", fontSize: 11 }}>
                    {client.name}
                  </span>
                  <span
                    style={{
                      fontSize: 8,
                      padding: "1px 4px",
                      background: badge.color,
                      color: "#fff",
                      borderRadius: 2,
                    }}
                  >
                    {badge.label}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "2px 12px",
                    color: "#95a5a6",
                    fontSize: 10,
                    marginBottom: 6,
                  }}
                >
                  <span>Bandwidth: {client.contract.bandwidthMbps} Mbps</span>
                  <span>
                    Revenue:{" "}
                    <strong style={{ color: "#2ecc71" }}>
                      ${client.contract.monthlyRevenue}/mo
                    </strong>
                  </span>
                  <span>SLA: {client.contract.uptimeSla}% uptime</span>
                  <span>
                    Penalty: ${client.contract.penaltyPerViolation}/violation
                  </span>
                  <span>
                    Duration: {client.contract.durationMonths} months
                  </span>
                  {client.contract.isolationRequired && (
                    <span style={{ color: "#e67e22" }}>Isolation required</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() =>
                      rpcClient
                        .call("acceptClient", { clientId: client.id })
                        .catch(() => {})
                    }
                    style={{
                      padding: "3px 12px",
                      background: "#2ecc71",
                      color: "#fff",
                      border: "none",
                      borderRadius: 3,
                      cursor: "pointer",
                      fontSize: 10,
                      fontWeight: "bold",
                    }}
                  >
                    Accept Contract
                  </button>
                  <button
                    onClick={() =>
                      rpcClient
                        .call("rejectClient", { clientId: client.id })
                        .catch(() => {})
                    }
                    style={{
                      padding: "3px 12px",
                      background: "transparent",
                      color: "#e74c3c",
                      border: "1px solid #e74c3c",
                      borderRadius: 3,
                      cursor: "pointer",
                      fontSize: 10,
                    }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Active contracts */}
      <h4 style={{ margin: "12px 0 4px", fontSize: 11, color: "#2ecc71" }}>
        Active Contracts ({active.length})
      </h4>
      {active.length === 0 && prospects.length > 0 && (
        <div
          style={{
            padding: "6px 10px",
            background: "#1a2a1a",
            borderLeft: "3px solid #2ecc71",
            borderRadius: 3,
            fontSize: 10,
            color: "#2ecc71",
            lineHeight: 1.4,
          }}
        >
          Accept a prospect above to start earning revenue!
        </div>
      )}
      {active.map((client) => {
        const connCount = Object.values(state.connections).filter(
          (c) => c.clientId === client.id,
        ).length;
        const activeConns = Object.values(state.connections).filter(
          (c) => c.clientId === client.id && c.status === "active",
        ).length;
        const badge = clientTypeBadge(client.type);
        const isSelected = selectedClientId === client.id;

        return (
          <div
            key={client.id}
            onClick={() => selectClient(isSelected ? null : client.id)}
            style={{
              padding: "6px 10px",
              marginBottom: 4,
              background: isSelected ? "#1a2a1a" : "#1a1a2e",
              borderRadius: 4,
              borderLeft: `3px solid ${isSelected ? "#f1c40f" : client.status === "warning" ? "#f39c12" : "#2ecc71"}`,
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 2,
              }}
            >
              <span style={{ fontWeight: "bold", fontSize: 11 }}>
                {client.name}
              </span>
              <span
                style={{
                  fontSize: 8,
                  padding: "1px 4px",
                  background: badge.color,
                  color: "#fff",
                  borderRadius: 2,
                  opacity: 0.7,
                }}
              >
                {badge.label}
              </span>
              {isSelected && (
                <span
                  style={{ color: "#f1c40f", fontSize: 9, marginLeft: "auto" }}
                >
                  SHOWING PATH
                </span>
              )}
              {!isSelected && client.status === "warning" && (
                <span
                  style={{ color: "#f39c12", fontSize: 9, marginLeft: "auto" }}
                >
                  AT RISK
                </span>
              )}
            </div>
            <div style={{ color: "#95a5a6" }}>
              ${client.contract.monthlyRevenue}/mo |{" "}
              {client.contract.bandwidthMbps} Mbps | Satisfaction:{" "}
              {client.satisfaction}%
            </div>
            <div style={{ color: "#555" }}>
              Connections: {activeConns}/{connCount} active
              {activeConns < connCount && connCount > 0 && (
                <span style={{ color: "#e74c3c", marginLeft: 4 }}>
                  — service disrupted
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
