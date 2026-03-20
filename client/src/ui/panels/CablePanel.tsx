import { useGameStore } from "../../store/gameStore";
import { rpcClient } from "../../rpc/client";
import { THEME, headingStyle, cardStyle, buttonStyle } from "../theme";

export function CablePanel() {
  const state = useGameStore((s) => s.state);
  const cablingFrom = useGameStore((s) => s.cablingFrom);
  const cancelCabling = useGameStore((s) => s.cancelCabling);

  if (!state) return null;

  return (
    <div style={{ padding: 12 }}>
      <h3 style={headingStyle()}>
        CABLING
      </h3>

      {cablingFrom ? (
        <div
          style={{
            ...cardStyle(THEME.colors.accent),
            marginBottom: 8,
            fontSize: 11,
          }}
        >
          <div style={{ fontFamily: THEME.fonts.body }}>
            Cabling from:{" "}
            <strong>
              {state.devices[cablingFrom.deviceId]?.name} p
              {cablingFrom.portIndex}
            </strong>
          </div>
          <div style={{ color: THEME.colors.textMuted, fontSize: 10, marginTop: 2, fontFamily: THEME.fonts.body }}>
            Click a port on another device to connect, or press Esc to cancel.
          </div>
          <button
            onClick={() => cancelCabling()}
            style={{
              marginTop: 4,
              ...buttonStyle("danger", true),
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 10, color: THEME.colors.textDim, lineHeight: 1.5, fontFamily: THEME.fonts.body }}>
          Click any available port in the rack to start cabling. Then click a
          port on another device to connect them.
        </p>
      )}

      <h4 style={headingStyle("h4")}>
        Active Cables ({Object.keys(state.links).length})
      </h4>
      {Object.values(state.links).map((link) => {
        const devA = state.devices[link.portA.deviceId];
        const devB = state.devices[link.portB.deviceId];
        return (
          <div
            key={link.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 6px",
              marginBottom: 2,
              background: THEME.colors.bgCard,
              borderRadius: THEME.radius.sm,
              fontSize: 10,
              boxShadow: THEME.shadows.card,
            }}
          >
            <span style={{ flex: 1, fontFamily: THEME.fonts.mono }}>
              {devA?.name}:p{link.portA.portIndex} ↔ {devB?.name}:p
              {link.portB.portIndex}
            </span>
            <span style={{ color: THEME.colors.textDim, fontFamily: THEME.fonts.mono }}>
              {link.currentLoadMbps.toFixed(0)}/{link.maxBandwidthMbps}Mbps
            </span>
            <button
              onClick={() =>
                rpcClient
                  .call("disconnectPorts", { linkId: link.id })
                  .catch(() => {})
              }
              style={buttonStyle("danger", true)}
            >
              X
            </button>
          </div>
        );
      })}
    </div>
  );
}
