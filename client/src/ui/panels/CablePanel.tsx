import { useGameStore } from "../../store/gameStore";
import { rpcClient } from "../../rpc/client";

export function CablePanel() {
  const state = useGameStore((s) => s.state);
  const cablingFrom = useGameStore((s) => s.cablingFrom);
  const cancelCabling = useGameStore((s) => s.cancelCabling);

  if (!state) return null;

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#95a5a6" }}>
        CABLING
      </h3>

      {cablingFrom ? (
        <div
          style={{
            padding: 6,
            marginBottom: 8,
            background: "#2c3e50",
            borderLeft: "3px solid #f1c40f",
            borderRadius: 4,
            fontSize: 11,
          }}
        >
          <div>
            Cabling from:{" "}
            <strong>
              {state.devices[cablingFrom.deviceId]?.name} p
              {cablingFrom.portIndex}
            </strong>
          </div>
          <div style={{ color: "#95a5a6", fontSize: 10, marginTop: 2 }}>
            Click a port on another device to connect, or press Esc to cancel.
          </div>
          <button
            onClick={() => cancelCabling()}
            style={{
              marginTop: 4,
              padding: "2px 8px",
              background: "#e74c3c",
              color: "#fff",
              border: "none",
              borderRadius: 2,
              cursor: "pointer",
              fontSize: 9,
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 10, color: "#555", lineHeight: 1.5 }}>
          Click any available port in the rack to start cabling. Then click a
          port on another device to connect them.
        </p>
      )}

      <h4 style={{ margin: "12px 0 4px", fontSize: 11, color: "#666" }}>
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
              background: "#1a1a2e",
              borderRadius: 3,
              fontSize: 10,
            }}
          >
            <span style={{ flex: 1 }}>
              {devA?.name}:p{link.portA.portIndex} ↔ {devB?.name}:p
              {link.portB.portIndex}
            </span>
            <span style={{ color: "#666" }}>
              {link.currentLoadMbps.toFixed(0)}/{link.maxBandwidthMbps}Mbps
            </span>
            <button
              onClick={() =>
                rpcClient
                  .call("disconnectPorts", { linkId: link.id })
                  .catch(() => {})
              }
              style={{
                padding: "1px 4px",
                background: "#e74c3c",
                color: "#fff",
                border: "none",
                borderRadius: 2,
                cursor: "pointer",
                fontSize: 9,
              }}
            >
              X
            </button>
          </div>
        );
      })}
    </div>
  );
}
