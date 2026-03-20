import { useGameStore } from "../../store/gameStore";

export function ObjectivePanel() {
  const tutorial = useGameStore((s) => s.state?.tutorial);

  if (!tutorial || tutorial.tutorialComplete) return null;

  const currentObj = tutorial.objectives[tutorial.currentObjectiveIndex];

  return (
    <div
      style={{
        padding: "12px 16px",
        background: "#1a1a2e",
        borderBottom: "1px solid #333",
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: 11,
          color: "#666",
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 8,
        }}
      >
        Getting Started
      </div>

      {/* Current objective - highlighted */}
      {currentObj && (
        <div
          style={{
            padding: "8px 12px",
            background: "#2c3e50",
            borderLeft: "3px solid #3498db",
            borderRadius: 3,
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: "bold", color: "#ecf0f1" }}>
            {currentObj.title}
          </div>
          <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
            {currentObj.description}
          </div>
        </div>
      )}

      {/* Progress checklist */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {tutorial.objectives.map((obj, i) => (
          <div
            key={obj.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11,
              color: obj.completed
                ? "#2ecc71"
                : i === tutorial.currentObjectiveIndex
                  ? "#ecf0f1"
                  : "#555",
            }}
          >
            <span style={{ fontSize: 12, width: 16, textAlign: "center" }}>
              {obj.completed
                ? "\u2713"
                : i === tutorial.currentObjectiveIndex
                  ? "\u25B6"
                  : "\u25CB"}
            </span>
            <span
              style={{
                textDecoration: obj.completed ? "line-through" : "none",
                opacity: obj.completed ? 0.6 : 1,
              }}
            >
              {obj.title}
            </span>
          </div>
        ))}
      </div>

      {/* Network readiness indicator */}
      <div
        style={{
          marginTop: 12,
          padding: "6px 10px",
          background: tutorial.networkReady ? "#1a3a2a" : "#2a1a1a",
          borderRadius: 3,
          fontSize: 11,
          color: tutorial.networkReady ? "#2ecc71" : "#e74c3c",
        }}
      >
        Network: {tutorial.networkReady ? "READY" : "NOT READY"}
      </div>
    </div>
  );
}
