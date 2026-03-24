import { useGameStore } from "../../store/gameStore";
import { THEME } from "../theme";

/**
 * Quest spotlight overlay. Shows contextual callouts based on current
 * quest step — points the player to the right part of the UI.
 * Works for both the first_contract and network_fundamentals quests.
 */
export function TutorialOverlay() {
  const quests = useGameStore((s) => s.state?.quests);
  const cablingFrom = useGameStore((s) => s.cablingFrom);
  const placingModel = useGameStore((s) => s.placingModel);

  if (!quests || !quests.activeQuestId) return null;

  const quest = quests.quests[quests.activeQuestId];
  if (!quest || quest.status === "completed") return null;

  const currentStep = quest.steps[quest.currentStepIndex];
  if (!currentStep) return null;

  // Determine which callout to show based on current step + state
  let callout: { message: string; position: "rack" | "sidebar" | "top" } | null =
    null;

  switch (currentStep.id) {
    // --- First Contract quest ---
    case "open_quests":
      callout = {
        message: "Open the browser and click the Quests bookmark",
        position: "sidebar",
      };
      break;
    case "accept_contract":
      callout = {
        message: "Open the Contracts page and accept PicoApp's contract",
        position: "sidebar",
      };
      break;
    case "buy_rack":
    case "buy_equipment":
    case "buy_cables":
      callout = {
        message: "Open the browser and go to the Shop",
        position: "sidebar",
      };
      break;
    case "place_rack":
      callout = {
        message: "Pick up the rack from storage and drop it on an orange zone",
        position: "top",
      };
      break;
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
    case "verify_connectivity":
      callout = {
        message: "Check the Contracts page — PicoApp should show active connections",
        position: "sidebar",
      };
      break;
    case "first_revenue":
      callout = {
        message: "Traffic is flowing! Watch the cables light up as revenue comes in",
        position: "top",
      };
      break;

    // --- Network Fundamentals quest ---
    case "nf_open_console":
      callout = {
        message: "In the rack view, click a device's console icon to open its management page",
        position: "rack",
      };
      break;
    case "nf_configure_router_lan":
      callout = {
        message: "Set a LAN interface IP on the router (e.g. 10.0.1.1/24)",
        position: "sidebar",
      };
      break;
    case "nf_configure_server":
      callout = {
        message: "Set the server's IP to match the router's subnet (e.g. 10.0.1.10/24, gateway 10.0.1.1)",
        position: "sidebar",
      };
      break;
    case "nf_check_ipam":
      callout = {
        message: "Open the IPAM page to see your auto-discovered network",
        position: "sidebar",
      };
      break;
    case "nf_accept_second_client":
      callout = {
        message: "Accept a new client from the Contracts page",
        position: "sidebar",
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
