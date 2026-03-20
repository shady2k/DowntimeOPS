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

type SideTab = "shop" | "device" | "cable" | "clients" | "tracer" | "connections";

function App() {
  const connected = useGameStore((s) => s.connected);
  const state = useGameStore((s) => s.state);
  const selectedDeviceId = useGameStore((s) => s.selectedDeviceId);
  const [sideTab, setSideTab] = useState<SideTab>("shop");

  useEffect(() => {
    setupReconciler();
  }, []);

  // Auto-switch to device panel when a device is selected
  useEffect(() => {
    if (selectedDeviceId) setSideTab("device");
  }, [selectedDeviceId]);

  if (!connected || !state) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0f0f1a",
          color: "#ecf0f1",
          fontFamily: "monospace",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1>DowntimeOPS</h1>
          <p>{connected ? "Loading game state..." : "Connecting to server..."}</p>
        </div>
      </div>
    );
  }

  return (
    <Layout
      topBar={<TopBar />}
      canvas={<PhaserGame />}
      sidePanel={
        <>
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid #333",
              fontSize: 10,
            }}
          >
            {(
              [
                ["shop", "Shop"],
                ["device", "Device"],
                ["cable", "Cable"],
                ["clients", "Clients"],
                ["connections", "Conns"],
                ["tracer", "Tracer"],
              ] as [SideTab, string][]
            ).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setSideTab(tab)}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  background: sideTab === tab ? "#2c3e50" : "transparent",
                  color: sideTab === tab ? "#ecf0f1" : "#666",
                  border: "none",
                  borderBottom:
                    sideTab === tab ? "2px solid #3498db" : "2px solid transparent",
                  cursor: "pointer",
                  fontSize: 10,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ overflow: "auto", flex: 1 }}>
            {sideTab === "shop" && <EquipmentShop />}
            {sideTab === "device" && <DevicePanel />}
            {sideTab === "cable" && <CablePanel />}
            {sideTab === "clients" && <ClientPanel />}
            {sideTab === "connections" && <ConnectionInspector />}
            {sideTab === "tracer" && <TracerPanel />}
          </div>
        </>
      }
      bottomBar={<AlertBar />}
    />
  );
}

export default App;
