import { useState, useEffect, useRef } from "react";
import { rpcClient } from "../../rpc/client";
import { useGameStore } from "../../store/gameStore";

const AUTOSAVE_INTERVAL_MS = 60_000; // 1 minute

export function SaveLoadPanel() {
  const state = useGameStore((s) => s.state);
  const [saveName, setSaveName] = useState("quicksave");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [lastAutoSave, setLastAutoSave] = useState<number | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Autosave
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      if (!state) return;
      rpcClient
        .call("saveGame", { name: "autosave" })
        .then(() => {
          setLastAutoSave(Date.now());
        })
        .catch(() => {});
    }, AUTOSAVE_INTERVAL_MS);

    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [state]);

  const handleSave = () => {
    if (!saveName.trim()) return;
    setSaveStatus("Saving...");
    rpcClient
      .call("saveGame", { name: saveName.trim() })
      .then(() => setSaveStatus("Saved!"))
      .catch(() => setSaveStatus("Save failed"))
      .finally(() => setTimeout(() => setSaveStatus(null), 2000));
  };

  const handleLoad = (saveId: string) => {
    setSaveStatus("Loading...");
    rpcClient
      .call("loadGame", { saveId })
      .then(() => setSaveStatus("Loaded!"))
      .catch(() => setSaveStatus("Load failed"))
      .finally(() => setTimeout(() => setSaveStatus(null), 2000));
  };

  const autoSaveAge = lastAutoSave
    ? Math.floor((Date.now() - lastAutoSave) / 1000)
    : null;

  return (
    <div style={{ padding: 12, fontFamily: "monospace" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#95a5a6" }}>
        SAVE / LOAD
      </h3>

      {/* Autosave indicator */}
      <div
        style={{
          padding: "4px 8px",
          marginBottom: 8,
          background: "#1a1a2e",
          borderRadius: 3,
          fontSize: 10,
          color: "#555",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: lastAutoSave ? "#2ecc71" : "#444",
            display: "inline-block",
          }}
        />
        Autosave: {autoSaveAge !== null ? `${autoSaveAge}s ago` : "pending"}
      </div>

      {/* Manual save */}
      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        <input
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="Save name"
          style={{
            flex: 1,
            padding: "3px 6px",
            background: "#0a0a16",
            border: "1px solid #333",
            borderRadius: 3,
            color: "#ecf0f1",
            fontSize: 10,
            fontFamily: "monospace",
          }}
        />
        <button
          onClick={handleSave}
          style={{
            padding: "3px 10px",
            background: "#3498db",
            color: "#fff",
            border: "none",
            borderRadius: 3,
            cursor: "pointer",
            fontSize: 10,
          }}
        >
          Save
        </button>
      </div>

      {/* Load buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {["quicksave", "autosave"].map((id) => (
          <button
            key={id}
            onClick={() => handleLoad(id)}
            style={{
              padding: "4px 10px",
              background: "#252540",
              color: "#bbb",
              border: "1px solid #333",
              borderRadius: 3,
              cursor: "pointer",
              fontSize: 10,
              textAlign: "left",
              fontFamily: "monospace",
            }}
          >
            Load: {id}
          </button>
        ))}
      </div>

      {/* Status */}
      {saveStatus && (
        <div
          style={{
            marginTop: 8,
            padding: "4px 8px",
            background:
              saveStatus.includes("failed") ? "#2a1a1a" : "#1a2a1a",
            borderRadius: 3,
            fontSize: 10,
            color: saveStatus.includes("failed") ? "#e74c3c" : "#2ecc71",
          }}
        >
          {saveStatus}
        </div>
      )}
    </div>
  );
}
