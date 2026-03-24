import { useEffect } from "react";
import { setupReconciler } from "./sync/reconciler";
import { useGameStore } from "./store/gameStore";
import { useBrowserStore } from "./ui/browser/browserStore";
import { PhaserGame } from "./renderer/PhaserGame";
import { GameBrowser } from "./ui/browser/GameBrowser";
import { InventoryHUD } from "./ui/hud/InventoryHUD";
import { MainMenu } from "./ui/MainMenu";
import { QuestDetailOverlay } from "./ui/quests/QuestDetailOverlay";
import { THEME } from "./ui/theme";

function App() {
  const appMode = useGameStore((s) => s.appMode);
  const pauseMenuOpen = useGameStore((s) => s.pauseMenuOpen);
  const togglePauseMenu = useGameStore((s) => s.togglePauseMenu);

  useEffect(() => {
    setupReconciler();
  }, []);

  // ESC toggles menu, J toggles quest detail
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (appMode !== "playing") return;

      if (e.key === "Escape") {
        // Close quest detail first if open
        if (useGameStore.getState().questDetailOpen) {
          useGameStore.getState().closeQuestDetail();
          e.preventDefault();
          return;
        }
        // Don't open pause menu when browser or rack is open
        if (useBrowserStore.getState().open) return;
        const view = useGameStore.getState().activeView;
        if (view === "rack") return;
        e.preventDefault();
        togglePauseMenu();
        return;
      }

      if (e.key === "j" || e.key === "J") {
        // Don't toggle when typing in browser address bar
        if (useBrowserStore.getState().open) return;
        const store = useGameStore.getState();
        if (store.questDetailOpen) {
          store.closeQuestDetail();
        } else {
          store.openQuestDetail();
        }
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
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>
      <PhaserGame />
      <InventoryHUD />
      <GameBrowser />
      <QuestDetailOverlay />
      {pauseMenuOpen && <MainMenu />}
    </div>
  );
}

export default App;
