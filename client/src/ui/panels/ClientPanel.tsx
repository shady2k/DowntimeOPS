import { useGameStore } from "../../store/gameStore";
import { rpcClient } from "../../rpc/client";
import { THEME, cardStyle, buttonStyle, headingStyle } from "../theme";

const PROSPECT_EXPIRE_TICKS = 240; // match server BALANCE

function clientTypeBadge(type: string): { label: string; color: string } {
  switch (type) {
    case "startup":
      return { label: "Startup", color: THEME.colors.startup };
    case "smb":
      return { label: "SMB", color: THEME.colors.smb };
    case "enterprise":
      return { label: "Enterprise", color: THEME.colors.enterprise };
    case "bank":
      return { label: "Finance", color: THEME.colors.bank };
    default:
      return { label: type, color: THEME.colors.textDim };
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
    <div style={{ padding: 12, fontFamily: THEME.fonts.body }}>
      <h3 style={headingStyle()}>
        CLIENTS
      </h3>

      {/* Revenue summary */}
      {active.length > 0 && (
        <div
          style={{
            padding: "4px 8px",
            marginBottom: 8,
            background: THEME.colors.successBg,
            borderRadius: THEME.radius.sm,
            fontSize: 10,
            color: THEME.colors.success,
          }}
        >
          {active.length} active — ${totalRevenue}/mo revenue
        </div>
      )}

      {/* No prospects explanation */}
      {prospects.length === 0 && active.length === 0 && (
        <div
          style={{
            ...cardStyle(THEME.colors.textDim),
            fontSize: 10,
            color: THEME.colors.textDim,
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
              color: THEME.colors.warning,
              fontFamily: THEME.fonts.heading,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Prospects ({prospects.length})
            <span style={{ fontSize: 9, color: THEME.colors.textDim, fontWeight: "normal" }}>
              — accept before they leave
            </span>
          </h4>
          {prospects.map((client) => {
            const badge = clientTypeBadge(client.type);
            const ticksLeft =
              client.prospectTick !== null
                ? Math.max(
                    0,
                    PROSPECT_EXPIRE_TICKS - (state.tick - client.prospectTick),
                  )
                : null;
            const expiryPct =
              ticksLeft !== null ? ticksLeft / PROSPECT_EXPIRE_TICKS : 1;
            const expiryColor =
              expiryPct > 0.5 ? THEME.colors.warning : expiryPct > 0.2 ? THEME.colors.warning : THEME.colors.danger;

            return (
              <div
                key={client.id}
                style={{
                  ...cardStyle(THEME.colors.warning),
                  marginBottom: 4,
                  fontSize: 10,
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
                  <span style={{ fontWeight: "bold", fontSize: 11, color: THEME.colors.text }}>
                    {client.name}
                  </span>
                  <span
                    style={{
                      fontSize: 8,
                      padding: "1px 4px",
                      background: badge.color,
                      color: THEME.colors.textInverse,
                      borderRadius: THEME.radius.sm,
                    }}
                  >
                    {badge.label}
                  </span>
                  {ticksLeft !== null && (
                    <span
                      style={{
                        fontSize: 8,
                        color: expiryColor,
                        marginLeft: "auto",
                      }}
                    >
                      {Math.ceil(ticksLeft / 60)}m left
                    </span>
                  )}
                </div>
                {/* Flavor text */}
                {client.flavor && (
                  <div
                    style={{
                      fontSize: 9,
                      color: THEME.colors.textDim,
                      fontStyle: "italic",
                      marginBottom: 4,
                      lineHeight: 1.3,
                    }}
                  >
                    {client.flavor}
                  </div>
                )}
                {/* Expiry bar */}
                {ticksLeft !== null && (
                  <div
                    style={{
                      height: 2,
                      background: THEME.colors.border,
                      borderRadius: 1,
                      marginBottom: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${expiryPct * 100}%`,
                        height: "100%",
                        background: expiryColor,
                        transition: "width 1s linear",
                      }}
                    />
                  </div>
                )}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "2px 12px",
                    color: THEME.colors.textMuted,
                    fontSize: 10,
                    marginBottom: 6,
                  }}
                >
                  <span>Bandwidth: {client.contract.bandwidthMbps} Mbps</span>
                  <span>
                    Revenue:{" "}
                    <strong style={{ color: THEME.colors.success }}>
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
                    <span style={{ color: THEME.colors.warning }}>Isolation required</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() =>
                      rpcClient
                        .call("acceptClient", { clientId: client.id })
                        .catch(() => {})
                    }
                    style={buttonStyle("primary")}
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
                      ...buttonStyle("ghost"),
                      color: THEME.colors.danger,
                      borderColor: THEME.colors.danger,
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
      <h4 style={{ margin: "12px 0 4px", fontSize: 11, color: THEME.colors.success, fontFamily: THEME.fonts.heading }}>
        Active Contracts ({active.length})
      </h4>
      {active.length === 0 && prospects.length > 0 && (
        <div
          style={{
            ...cardStyle(THEME.colors.success),
            fontSize: 10,
            color: THEME.colors.success,
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
              ...cardStyle(isSelected ? THEME.colors.accent : client.status === "warning" ? THEME.colors.warning : THEME.colors.success),
              marginBottom: 4,
              background: isSelected ? THEME.colors.successBg : THEME.colors.bgCard,
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
              <span style={{ fontWeight: "bold", fontSize: 11, color: THEME.colors.text }}>
                {client.name}
              </span>
              <span
                style={{
                  fontSize: 8,
                  padding: "1px 4px",
                  background: badge.color,
                  color: THEME.colors.textInverse,
                  borderRadius: THEME.radius.sm,
                  opacity: 0.7,
                }}
              >
                {badge.label}
              </span>
              {isSelected && (
                <span
                  style={{ color: THEME.colors.accent, fontSize: 9, marginLeft: "auto" }}
                >
                  SHOWING PATH
                </span>
              )}
              {!isSelected && client.status === "warning" && (
                <span
                  style={{ color: THEME.colors.warning, fontSize: 9, marginLeft: "auto" }}
                >
                  AT RISK
                </span>
              )}
            </div>
            <div style={{ color: THEME.colors.textMuted }}>
              ${client.contract.monthlyRevenue}/mo |{" "}
              {client.contract.bandwidthMbps} Mbps | Satisfaction:{" "}
              {client.satisfaction}%
            </div>
            <div style={{ color: THEME.colors.textDim }}>
              Connections: {activeConns}/{connCount} active
              {activeConns < connCount && connCount > 0 && (
                <span style={{ color: THEME.colors.danger, marginLeft: 4 }}>
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
