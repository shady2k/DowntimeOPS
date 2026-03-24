import { useGameStore } from "../../store/gameStore";
import { THEME } from "../theme";

/**
 * Quest spotlight overlay. Shows contextual callouts based on current
 * quest step — points the player to the right part of the UI.
 */
export function TutorialOverlay() {
  const quests = useGameStore((s) => s.state?.quests);
  const cablingFrom = useGameStore((s) => s.cablingFrom);
  const placingModel = useGameStore((s) => s.placingModel);

  if (!quests || quests.tutorialComplete) return null;

  const quest = quests.quests.first_contract;
  if (!quest || quest.status === "completed") return null;

  const currentStep = quest.steps[quest.currentStepIndex];
  if (!currentStep) return null;

  // Determine which callout to show based on current step + state
  let callout: { message: string; position: "rack" | "sidebar" | "top" } | null =
    null;

  switch (currentStep.id) {
    case "install_router":
    case "install_switch":
    case "install_server":
      if (placingModel) {
        callout = {
          message: "Click an empty slot in the rack to place your device",
          position: "rack",
        };
      }
      break;
    case "connect_uplink":
      callout = {
        message: "Click the router's WAN port (blue, leftmost) to connect the ISP cable",
        position: "rack",
      };
      break;
    case "cable_router_switch":
    case "cable_switch_server":
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
    case "accept_contract":
      callout = {
        message: "Use the staff computer and open the Clients page to accept PicoApp's contract",
        position: "sidebar",
      };
      break;
    case "first_revenue":
      callout = {
        message: "Traffic is flowing! Watch the cables light up as revenue comes in",
        position: "top",
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
        background: "rgba(232, 168, 64, 0.92)",
        color: "#fff",
        borderRadius: THEME.radius.lg,
        fontSize: 11,
        fontFamily: THEME.fonts.body,
        maxWidth: 300,
        textAlign: "center",
        pointerEvents: "none",
        zIndex: 100,
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        border: "1px solid rgba(255,255,255,0.15)",
      }}
    >
      {callout.message}
    </div>
  );
}
