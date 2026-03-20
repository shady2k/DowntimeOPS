import { useGameStore } from "../../store/gameStore";

/**
 * Tutorial spotlight overlay. Shows contextual callouts based on tutorial
 * state — points the player to the right part of the UI.
 */
export function TutorialOverlay() {
  const tutorial = useGameStore((s) => s.state?.tutorial);
  const cablingFrom = useGameStore((s) => s.cablingFrom);
  const placingModel = useGameStore((s) => s.placingModel);

  if (!tutorial || tutorial.tutorialComplete) return null;

  const currentObj = tutorial.objectives[tutorial.currentObjectiveIndex];
  if (!currentObj) return null;

  // Determine which callout to show based on current objective + state
  let callout: { message: string; position: "rack" | "sidebar" | "top" } | null =
    null;

  switch (currentObj.id) {
    case "buy_router":
    case "buy_switch":
    case "buy_server":
      if (placingModel) {
        callout = {
          message: "Click an empty slot in the rack to place your device",
          position: "rack",
        };
      } else {
        callout = {
          message: "Open the Shop tab and buy the highlighted equipment",
          position: "sidebar",
        };
      }
      break;
    case "connect_router_switch":
    case "connect_switch_server":
      if (cablingFrom) {
        callout = {
          message: "Now click a port on the other device to complete the cable",
          position: "rack",
        };
      } else {
        callout = {
          message: "Click a green port on a device to start cabling",
          position: "rack",
        };
      }
      break;
    case "accept_client":
      callout = {
        message: "Switch to the Clients tab and accept the waiting contract",
        position: "sidebar",
      };
      break;
    case "first_revenue":
      callout = {
        message: "Traffic is flowing! Watch the cables light up as revenue comes in",
        position: "top",
      };
      break;
    case "survive_incident":
      callout = {
        message:
          "An incident will happen soon. Click the red port to repair it when it does",
        position: "rack",
      };
      break;
    default:
      break;
  }

  if (!callout) return null;

  const positionStyles: Record<string, React.CSSProperties> = {
    rack: {
      position: "absolute",
      bottom: 60,
      left: "50%",
      transform: "translateX(-70%)",
    },
    sidebar: {
      position: "absolute",
      top: 80,
      right: 360,
    },
    top: {
      position: "absolute",
      top: 50,
      left: "50%",
      transform: "translateX(-50%)",
    },
  };

  return (
    <div
      style={{
        ...positionStyles[callout.position],
        padding: "8px 14px",
        background: "rgba(52, 152, 219, 0.9)",
        color: "#fff",
        borderRadius: 6,
        fontSize: 11,
        fontFamily: "monospace",
        maxWidth: 300,
        textAlign: "center",
        pointerEvents: "none",
        zIndex: 100,
        boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
      }}
    >
      {callout.message}
    </div>
  );
}
