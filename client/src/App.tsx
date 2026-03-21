import { useEffect } from "react";
import { setupReconciler } from "./sync/reconciler";
import { useGameStore } from "./store/gameStore";
import { PhaserGame } from "./renderer/PhaserGame";
import { ShopBrowser } from "./ui/shop/ShopBrowser";
import { THEME } from "./ui/theme";

function App() {
  const connected = useGameStore((s) => s.connected);
  const state = useGameStore((s) => s.state);

  useEffect(() => {
    setupReconciler();
  }, []);

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

  // Full-screen Phaser with React overlays
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>
      <PhaserGame />
      <ShopBrowser />
    </div>
  );
}

export default App;
