import { useGameStore } from "../../store/gameStore";

export function ObjectivePanel() {
  const state = useGameStore((s) => s.state);
  const tutorial = state?.tutorial;

  // Always show — even after tutorial complete, show as a compact status bar
  if (!tutorial) return null;

  // Post-tutorial: milestone progress
  if (tutorial.tutorialComplete) {
    const progression = state!.progression;
    const activeClients = Object.values(state!.clients).filter(
      (c) => c.status === "active" || c.status === "warning",
    ).length;
    const incidents = state!.alerts.filter(
      (a) => !a.acknowledged && a.severity === "critical",
    ).length;
    const completedMilestones = progression.milestones.filter(
      (m) => m.completed,
    ).length;
    const nextMilestone = progression.milestones.find((m) => !m.completed);

    return (
      <div
        style={{
          padding: "10px 16px",
          background: "#1a1a2e",
          borderBottom: "1px solid #333",
          fontFamily: "monospace",
        }}
      >
        {/* Status bar */}
        <div
          style={{
            display: "flex",
            gap: 12,
            fontSize: 10,
            color: "#666",
            marginBottom: nextMilestone ? 6 : 0,
          }}
        >
          <span style={{ color: "#2ecc71" }}>
            {activeClients} client{activeClients !== 1 ? "s" : ""}
          </span>
          {incidents > 0 && (
            <span style={{ color: "#e74c3c" }}>
              {incidents} incident{incidents !== 1 ? "s" : ""}
            </span>
          )}
          <span>Rep: {state!.reputation.toFixed(0)}</span>
          <span style={{ marginLeft: "auto", color: "#555" }}>
            {completedMilestones}/{progression.milestones.length} milestones
          </span>
        </div>

        {/* Next milestone */}
        {nextMilestone && (
          <div
            style={{
              padding: "4px 8px",
              background: "#1a1a28",
              borderLeft: "2px solid #9b59b6",
              borderRadius: 2,
              fontSize: 10,
            }}
          >
            <span style={{ color: "#9b59b6" }}>Next: </span>
            <span style={{ color: "#bbb" }}>{nextMilestone.title}</span>
            <span style={{ color: "#555" }}>
              {" "}— {nextMilestone.description}
            </span>
          </div>
        )}
      </div>
    );
  }

  const currentObj = tutorial.objectives[tutorial.currentObjectiveIndex];

  // Find current blockers
  const blockers: string[] = [];
  if (!tutorial.networkReady) {
    const devices = Object.values(state!.devices);
    if (!devices.some((d) => d.type === "router"))
      blockers.push("Need a router");
    else if (!devices.some((d) => d.type === "switch"))
      blockers.push("Need a switch");
    else if (!devices.some((d) => d.type === "server"))
      blockers.push("Need a server");
    else blockers.push("Cable your devices together");
  }

  const prospects = Object.values(state!.clients).filter(
    (c) => c.status === "prospect",
  );
  const starterProspect = prospects.find((c) => c.id === "client-starter");

  return (
    <div
      style={{
        padding: "12px 16px",
        background: "#1a1a2e",
        borderBottom: "1px solid #333",
        fontFamily: "monospace",
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
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>Getting Started</span>
        <span style={{ fontSize: 9, color: "#444" }}>
          {tutorial.objectives.filter((o) => o.completed).length}/
          {tutorial.objectives.length}
        </span>
      </div>

      {/* Current objective — highlighted */}
      {currentObj && (
        <div
          style={{
            padding: "8px 12px",
            background: "#1a2a3a",
            borderLeft: "3px solid #3498db",
            borderRadius: 3,
            marginBottom: 10,
          }}
        >
          <div
            style={{ fontSize: 12, fontWeight: "bold", color: "#ecf0f1" }}
          >
            {currentObj.title}
          </div>
          <div style={{ fontSize: 10, color: "#8899aa", marginTop: 3, lineHeight: 1.4 }}>
            {currentObj.description}
          </div>
        </div>
      )}

      {/* Blockers */}
      {blockers.length > 0 && (
        <div
          style={{
            padding: "6px 10px",
            background: "#2a1a1a",
            borderLeft: "3px solid #e67e22",
            borderRadius: 3,
            marginBottom: 10,
            fontSize: 10,
            color: "#e67e22",
            lineHeight: 1.4,
          }}
        >
          {blockers[0]}
        </div>
      )}

      {/* Starter contract callout */}
      {starterProspect && tutorial.networkReady && (
        <div
          style={{
            padding: "6px 10px",
            background: "#1a2a1a",
            borderLeft: "3px solid #2ecc71",
            borderRadius: 3,
            marginBottom: 10,
            fontSize: 10,
            color: "#2ecc71",
            lineHeight: 1.4,
          }}
        >
          Your first client <strong>{starterProspect.name}</strong> is waiting!
          Go to the Clients tab to accept their contract.
        </div>
      )}

      {/* Progress checklist */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {tutorial.objectives.map((obj, i) => (
          <div
            key={obj.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 10,
              color: obj.completed
                ? "#2ecc71"
                : i === tutorial.currentObjectiveIndex
                  ? "#ecf0f1"
                  : "#444",
            }}
          >
            <span style={{ fontSize: 11, width: 14, textAlign: "center" }}>
              {obj.completed
                ? "\u2713"
                : i === tutorial.currentObjectiveIndex
                  ? "\u25B6"
                  : "\u25CB"}
            </span>
            <span
              style={{
                textDecoration: obj.completed ? "line-through" : "none",
                opacity: obj.completed ? 0.5 : 1,
              }}
            >
              {obj.title}
            </span>
          </div>
        ))}
      </div>

      {/* Network readiness */}
      <div
        style={{
          marginTop: 10,
          padding: "4px 10px",
          background: tutorial.networkReady ? "#1a2a1a" : "#2a1a1a",
          borderRadius: 3,
          fontSize: 10,
          color: tutorial.networkReady ? "#2ecc71" : "#e74c3c",
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
            background: tutorial.networkReady ? "#2ecc71" : "#e74c3c",
            display: "inline-block",
          }}
        />
        Network: {tutorial.networkReady ? "READY" : "NOT READY"}
      </div>
    </div>
  );
}
