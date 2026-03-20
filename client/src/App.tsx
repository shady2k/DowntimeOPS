import { useEffect } from "react";
import { setupReconciler } from "./sync/reconciler";
import { useGameStore } from "./store/gameStore";

function App() {
  const connected = useGameStore((s) => s.connected);
  const state = useGameStore((s) => s.state);

  useEffect(() => {
    setupReconciler();
  }, []);

  if (!connected) {
    return (
      <div style={{ padding: 20 }}>
        <h1>DowntimeOPS</h1>
        <p>Connecting to server...</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div style={{ padding: 20 }}>
        <h1>DowntimeOPS</h1>
        <p>Loading game state...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>DowntimeOPS</h1>
      <p>
        Tick: {state.tick} | Money: ${state.money.toFixed(0)} | Speed:{" "}
        {state.speed}x | Devices: {Object.keys(state.devices).length} | Links:{" "}
        {Object.keys(state.links).length} | Clients:{" "}
        {Object.keys(state.clients).length}
      </p>
    </div>
  );
}

export default App;
