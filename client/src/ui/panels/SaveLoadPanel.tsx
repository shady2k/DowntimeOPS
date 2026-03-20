import { useState, useEffect, useRef } from "react";
import { rpcClient } from "../../rpc/client";
import { useGameStore } from "../../store/gameStore";
import { THEME, headingStyle, inputStyle, buttonStyle, cardStyle, statusDot } from "../theme";

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
    <div style={{ padding: 12, fontFamily: THEME.fonts.body }}>
      <h3 style={headingStyle()}>
        SAVE / LOAD
      </h3>

      {/* Autosave indicator */}
      <div
        style={{
          ...cardStyle(),
          marginBottom: 8,
          fontSize: 10,
          color: THEME.colors.textDim,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={statusDot(lastAutoSave ? THEME.colors.success : THEME.colors.textDim)}
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
            ...inputStyle(),
            flex: 1,
          }}
        />
        <button
          onClick={handleSave}
          style={buttonStyle("primary")}
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
              ...buttonStyle("ghost"),
              textAlign: "left",
              fontFamily: THEME.fonts.mono,
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
              saveStatus.includes("failed") ? THEME.colors.dangerBg : THEME.colors.successBg,
            borderRadius: THEME.radius.sm,
            fontSize: 10,
            color: saveStatus.includes("failed") ? THEME.colors.danger : THEME.colors.success,
          }}
        >
          {saveStatus}
        </div>
      )}
    </div>
  );
}
