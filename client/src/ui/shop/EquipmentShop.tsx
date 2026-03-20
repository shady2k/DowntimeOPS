import { useGameStore } from "../../store/gameStore";

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
  const tutorial = useGameStore((s) => s.state?.tutorial);
  const placingModel = useGameStore((s) => s.placingModel);
  const startPlacing = useGameStore((s) => s.startPlacing);
  const cancelPlacing = useGameStore((s) => s.cancelPlacing);

  if (!state) return null;

  const rackId = Object.keys(state.racks)[0];
  if (!rackId) return null;

  // Determine tutorial hint based on placed devices
  const devices = Object.values(state.devices ?? {});
  const hasRouter = devices.some((d) => d.model === "router_1u");
  const hasSwitch = devices.some((d) => d.model === "switch_24p");
  const hasServer = devices.some((d) => d.model === "server_1u");

  let shopHint: string | null = null;
  if (tutorial && !tutorial.tutorialComplete) {
    if (!hasRouter) {
      shopHint = "Start by buying a Router \u2014 it connects you to the internet.";
    } else if (!hasSwitch) {
      shopHint = "Next, buy a Switch to connect multiple devices.";
    } else if (!hasServer) {
      shopHint = "Now buy a Server to host client services.";
    } else {
      shopHint =
        "Great! Now click a port on one device, then click a port on another to cable them.";
    }
  }

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#95a5a6" }}>
        EQUIPMENT SHOP
      </h3>
      {shopHint && (
        <div
          style={{
            padding: "6px 10px",
            marginBottom: 8,
            background: "#2c3e50",
            borderLeft: "3px solid #3498db",
            borderRadius: 3,
            fontSize: 11,
            color: "#bdc3c7",
            lineHeight: 1.4,
          }}
        >
          {shopHint}
        </div>
      )}

      {placingModel && (
        <div
          style={{
            padding: "6px 10px",
            marginBottom: 8,
            background: "#1a3a2a",
            borderLeft: "3px solid #2ecc71",
            borderRadius: 3,
            fontSize: 11,
            color: "#2ecc71",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ flex: 1 }}>
            Click a rack slot to place{" "}
            {EQUIPMENT.find((e) => e.model === placingModel)?.name}
          </span>
          <button
            onClick={() => cancelPlacing()}
            style={{
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
      )}

      {EQUIPMENT.map((eq) => {
        const isPlacing = placingModel === eq.model;
        return (
          <div
            key={eq.model}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              marginBottom: 4,
              background: isPlacing ? "#1a3a2a" : "#1a1a2e",
              borderRadius: 4,
              borderLeft: `3px solid ${eq.color}`,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: "bold" }}>{eq.name}</div>
              <div style={{ fontSize: 10, color: "#95a5a6" }}>{eq.desc}</div>
            </div>
            <button
              onClick={() =>
                isPlacing ? cancelPlacing() : startPlacing(eq.model)
              }
              disabled={state.money < eq.cost && !isPlacing}
              style={{
                padding: "3px 10px",
                background: isPlacing
                  ? "#e67e22"
                  : state.money >= eq.cost
                    ? "#2ecc71"
                    : "#555",
                color: "#fff",
                border: "none",
                borderRadius: 3,
                cursor:
                  state.money >= eq.cost || isPlacing ? "pointer" : "default",
                fontSize: 11,
              }}
            >
              {isPlacing ? "Placing..." : `$${eq.cost}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}
