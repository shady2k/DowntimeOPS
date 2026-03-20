import { useGameStore } from "../../store/gameStore";
import { THEME, cardStyle, buttonStyle, headingStyle } from "../theme";

const EQUIPMENT = [
  {
    model: "server_1u",
    name: "1U Server",
    cost: 2000,
    desc: "2x 1GbE, 300W",
    color: THEME.colors.server,
  },
  {
    model: "switch_24p",
    name: "24-Port Switch",
    cost: 1500,
    desc: "24x 1GbE, 150W",
    color: THEME.colors.switch,
  },
  {
    model: "router_1u",
    name: "Router / Gateway",
    cost: 3000,
    desc: "4x 1GbE, 200W",
    color: THEME.colors.router,
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
      <h3 style={headingStyle()}>
        Equipment Shop
      </h3>
      {shopHint && (
        <div
          style={{
            ...cardStyle(THEME.colors.info),
            marginBottom: 8,
            fontSize: 11,
            color: THEME.colors.textMuted,
            lineHeight: 1.4,
          }}
        >
          {shopHint}
        </div>
      )}

      {placingModel && (
        <div
          style={{
            ...cardStyle(THEME.colors.success),
            marginBottom: 8,
            fontSize: 11,
            color: THEME.colors.success,
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
            style={buttonStyle("danger", true)}
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
              padding: "8px 10px",
              marginBottom: 6,
              background: isPlacing ? THEME.colors.successBg : THEME.colors.bgCard,
              borderRadius: THEME.radius.md,
              borderLeft: `3px solid ${eq.color}`,
              boxShadow: THEME.shadows.card,
              transition: "background 0.15s",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: THEME.fonts.heading }}>{eq.name}</div>
              <div style={{ fontSize: 10, color: THEME.colors.textMuted, fontFamily: THEME.fonts.mono }}>{eq.desc}</div>
            </div>
            <button
              onClick={() =>
                isPlacing ? cancelPlacing() : startPlacing(eq.model)
              }
              disabled={state.money < eq.cost && !isPlacing}
              style={{
                padding: "4px 12px",
                background: isPlacing
                  ? THEME.colors.warning
                  : state.money >= eq.cost
                    ? THEME.colors.success
                    : THEME.colors.bgCard,
                color: isPlacing || state.money >= eq.cost ? "#fff" : THEME.colors.textDim,
                border: "none",
                borderRadius: THEME.radius.sm,
                cursor:
                  state.money >= eq.cost || isPlacing ? "pointer" : "default",
                fontSize: 11,
                fontWeight: 700,
                fontFamily: THEME.fonts.mono,
                boxShadow: state.money >= eq.cost ? THEME.shadows.button : "none",
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
