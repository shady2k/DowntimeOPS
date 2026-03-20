import { useGameStore } from "../../store/gameStore";
import { rpcClient } from "../../rpc/client";

const EQUIPMENT = [
  {
    model: "server_1u",
    name: "1U Server",
    cost: 2000,
    desc: "2x 1GbE, 300W",
    color: "#2ecc71",
  },
  {
    model: "switch_24p",
    name: "24-Port Switch",
    cost: 1500,
    desc: "24x 1GbE, 150W",
    color: "#3498db",
  },
  {
    model: "router_1u",
    name: "Router / Gateway",
    cost: 3000,
    desc: "4x 1GbE, 200W",
    color: "#e67e22",
  },
];

export function EquipmentShop() {
  const state = useGameStore((s) => s.state);
  if (!state) return null;

  const rackId = Object.keys(state.racks)[0];
  if (!rackId) return null;

  const rack = state.racks[rackId];

  // Find first available slot
  const findEmptySlot = (): number | null => {
    for (let u = 1; u <= rack.totalU; u++) {
      if (!rack.devices[u]) return u;
    }
    return null;
  };

  const placeDevice = (model: string) => {
    const slot = findEmptySlot();
    if (slot === null) return;
    rpcClient
      .call("placeDevice", { rackId, slotU: slot, model })
      .catch(() => {});
  };

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#95a5a6" }}>
        EQUIPMENT SHOP
      </h3>
      {EQUIPMENT.map((eq) => (
        <div
          key={eq.model}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 8px",
            marginBottom: 4,
            background: "#1a1a2e",
            borderRadius: 4,
            borderLeft: `3px solid ${eq.color}`,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: "bold" }}>{eq.name}</div>
            <div style={{ fontSize: 10, color: "#95a5a6" }}>{eq.desc}</div>
          </div>
          <button
            onClick={() => placeDevice(eq.model)}
            disabled={state.money < eq.cost}
            style={{
              padding: "3px 10px",
              background: state.money >= eq.cost ? "#2ecc71" : "#555",
              color: "#fff",
              border: "none",
              borderRadius: 3,
              cursor: state.money >= eq.cost ? "pointer" : "default",
              fontSize: 11,
            }}
          >
            ${eq.cost}
          </button>
        </div>
      ))}
    </div>
  );
}
