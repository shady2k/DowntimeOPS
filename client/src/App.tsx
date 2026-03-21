import { useEffect } from "react";
import { setupReconciler } from "./sync/reconciler";
import { useGameStore } from "./store/gameStore";
import { PhaserGame } from "./renderer/PhaserGame";
import { ShopBrowser } from "./ui/shop/ShopBrowser";
import { InventoryHUD } from "./ui/hud/InventoryHUD";
import { RackModeIndicator } from "./ui/hud/RackModeIndicator";
import { RackWorkstationBg, RackWorkstationUI } from "./ui/rack/RackWorkstation";
import { MainMenu } from "./ui/MainMenu";
import { THEME } from "./ui/theme";

function App() {
  const appMode = useGameStore((s) => s.appMode);
  const pauseMenuOpen = useGameStore((s) => s.pauseMenuOpen);
  const togglePauseMenu = useGameStore((s) => s.togglePauseMenu);

  useEffect(() => {
    setupReconciler();
  }, []);

  // ESC toggles menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && appMode === "playing") {
        // Don't open pause menu when closing rack view — RackScene handles its own ESC
        const view = useGameStore.getState().activeView;
        if (view === "rack") return;
        e.preventDefault();
        togglePauseMenu();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [appMode, togglePauseMenu]);

  if (appMode === "connecting") {
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
            Connecting to server...
          </p>
        </div>
      </div>
    );
  }

  if (appMode === "menu") {
    return <MainMenu />;
  }

  // appMode === "playing"
  // Layer order: RackWorkstationBg (z:0) → PhaserGame (z:1) → UI overlays (z:100+)
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>
      <RackWorkstationBg />
      <PhaserGame />
      <InventoryHUD />
      <RackModeIndicator />
      <RackWorkstationUI />
      <ShopBrowser />
      {pauseMenuOpen && <MainMenu />}
    </div>
  );
}

export default App;
