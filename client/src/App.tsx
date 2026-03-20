import { useEffect, useState } from "react";
import { setupReconciler } from "./sync/reconciler";
import { useGameStore } from "./store/gameStore";
import { Layout } from "./ui/Layout";
import { TopBar } from "./ui/hud/TopBar";
import { AlertBar } from "./ui/hud/AlertBar";
import { PhaserGame } from "./renderer/PhaserGame";
import { EquipmentShop } from "./ui/shop/EquipmentShop";
import { DevicePanel } from "./ui/panels/DevicePanel";
import { CablePanel } from "./ui/panels/CablePanel";
import { ClientPanel } from "./ui/panels/ClientPanel";
import { TracerPanel } from "./ui/panels/TracerPanel";
import { ConnectionInspector } from "./ui/panels/ConnectionInspector";
import { EventLog } from "./ui/panels/EventLog";
import { SaveLoadPanel } from "./ui/panels/SaveLoadPanel";
import { ObjectivePanel } from "./ui/objectives/ObjectivePanel";
import { TutorialOverlay } from "./ui/overlays/TutorialOverlay";
import { CelebrationOverlay } from "./ui/overlays/CelebrationOverlay";
import { THEME } from "./ui/theme";

type SideTab =
  | "shop"
  | "device"
  | "cable"
  | "clients"
  | "tracer"
  | "connections"
  | "log"
  | "save";

function App() {
  const connected = useGameStore((s) => s.connected);
  const state = useGameStore((s) => s.state);
  const selectedDeviceId = useGameStore((s) => s.selectedDeviceId);
  const cablingFrom = useGameStore((s) => s.cablingFrom);
  const placingModel = useGameStore((s) => s.placingModel);
  const tutorial = useGameStore((s) => s.state?.tutorial);
  const [sideTab, setSideTab] = useState<SideTab>("shop");

  useEffect(() => {
    setupReconciler();
  }, []);

  // Auto-switch tabs based on context
  useEffect(() => {
    if (selectedDeviceId) setSideTab("device");
  }, [selectedDeviceId]);

  useEffect(() => {
    if (cablingFrom) setSideTab("cable");
  }, [cablingFrom]);

  useEffect(() => {
    if (placingModel) setSideTab("shop");
  }, [placingModel]);

  if (!connected || !state) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: THEME.colors.bgDarkest,
          color: THEME.colors.text,
          fontFamily: THEME.fonts.heading,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ color: THEME.colors.accent, fontWeight: 800, fontSize: 28, marginBottom: 12 }}>DowntimeOPS</h1>
          <p style={{ color: THEME.colors.textMuted, fontSize: 14 }}>
            {connected ? "Loading game state..." : "Connecting to server..."}
          </p>
        </div>
      </div>
    );
  }

  // Tab definitions — show fewer tabs during tutorial
  const isTutorial = tutorial && !tutorial.tutorialComplete;
  const tabs: Array<[SideTab, string]> = isTutorial
    ? [
        ["shop", "Shop"],
        ["device", "Device"],
        ["cable", "Cable"],
        ["clients", "Clients"],
      ]
    : [
        ["shop", "Shop"],
        ["device", "Device"],
        ["cable", "Cable"],
        ["clients", "Clients"],
        ["connections", "Conns"],
        ["tracer", "Tracer"],
        ["log", "Log"],
        ["save", "Save"],
      ];

  return (
    <Layout
      topBar={<TopBar />}
      canvas={
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <PhaserGame />
          <TutorialOverlay />
          <CelebrationOverlay />
        </div>
      }
      sidePanel={
        <>
          <ObjectivePanel />
          <div
            style={{
              display: "flex",
              borderBottom: `1px solid ${THEME.colors.borderDark}`,
              fontSize: 11,
              background: THEME.colors.bgPanel,
            }}
          >
            {tabs.map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setSideTab(tab)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  background: sideTab === tab ? THEME.colors.bgCard : "transparent",
                  color: sideTab === tab ? THEME.colors.text : THEME.colors.textDim,
                  border: "none",
                  borderBottom:
                    sideTab === tab
                      ? `2px solid ${THEME.colors.accent}`
                      : "2px solid transparent",
                  cursor: "pointer",
                  fontSize: 11,
                  fontFamily: THEME.fonts.body,
                  fontWeight: sideTab === tab ? 700 : 400,
                  transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            style={{
              overflow: "auto",
              flex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {sideTab === "shop" && <EquipmentShop />}
            {sideTab === "device" && <DevicePanel />}
            {sideTab === "cable" && <CablePanel />}
            {sideTab === "clients" && <ClientPanel />}
            {sideTab === "connections" && <ConnectionInspector />}
            {sideTab === "tracer" && <TracerPanel />}
            {sideTab === "log" && <EventLog />}
            {sideTab === "save" && <SaveLoadPanel />}
          </div>
        </>
      }
      bottomBar={<AlertBar />}
    />
  );
}

export default App;
