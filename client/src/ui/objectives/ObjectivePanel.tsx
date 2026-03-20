import { useGameStore } from "../../store/gameStore";
import { THEME, cardStyle, statusDot } from "../theme";

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
          background: THEME.colors.bgPanel,
          borderBottom: `1px solid ${THEME.colors.borderDark}`,
          fontFamily: THEME.fonts.body,
        }}
      >
        {/* Status bar */}
        <div
          style={{
            display: "flex",
            gap: 12,
            fontSize: 10,
            color: THEME.colors.textDim,
            marginBottom: nextMilestone ? 6 : 0,
          }}
        >
          <span style={{ color: THEME.colors.success }}>
            {activeClients} client{activeClients !== 1 ? "s" : ""}
          </span>
          {incidents > 0 && (
            <span style={{ color: THEME.colors.danger }}>
              {incidents} incident{incidents !== 1 ? "s" : ""}
            </span>
          )}
          <span>Rep: {state!.reputation.toFixed(0)}</span>
          <span style={{ marginLeft: "auto", color: THEME.colors.textDim }}>
            {completedMilestones}/{progression.milestones.length} milestones
          </span>
        </div>

        {/* Next milestone */}
        {nextMilestone && (
          <div
            style={{
              ...cardStyle(THEME.colors.purple),
              padding: "4px 8px",
              borderRadius: THEME.radius.sm,
              fontSize: 10,
            }}
          >
            <span style={{ color: THEME.colors.purple }}>Next: </span>
            <span style={{ color: THEME.colors.textMuted }}>{nextMilestone.title}</span>
            <span style={{ color: THEME.colors.textDim }}>
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
        background: THEME.colors.bgPanel,
        borderBottom: `1px solid ${THEME.colors.borderDark}`,
        fontFamily: THEME.fonts.body,
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: 11,
          color: THEME.colors.textDim,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>Getting Started</span>
        <span style={{ fontSize: 9, color: THEME.colors.textDim }}>
          {tutorial.objectives.filter((o) => o.completed).length}/
          {tutorial.objectives.length}
        </span>
      </div>

      {/* Current objective — highlighted */}
      {currentObj && (
        <div
          style={{
            ...cardStyle(THEME.colors.info),
            padding: "8px 12px",
            borderRadius: THEME.radius.sm,
            marginBottom: 10,
          }}
        >
          <div
            style={{ fontSize: 12, fontWeight: "bold", color: THEME.colors.text }}
          >
            {currentObj.title}
          </div>
          <div style={{ fontSize: 10, color: THEME.colors.textMuted, marginTop: 3, lineHeight: 1.4 }}>
            {currentObj.description}
          </div>
        </div>
      )}

      {/* Blockers */}
      {blockers.length > 0 && (
        <div
          style={{
            ...cardStyle(THEME.colors.warning),
            padding: "6px 10px",
            borderRadius: THEME.radius.sm,
            marginBottom: 10,
            fontSize: 10,
            color: THEME.colors.warning,
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
            ...cardStyle(THEME.colors.success),
            padding: "6px 10px",
            borderRadius: THEME.radius.sm,
            marginBottom: 10,
            fontSize: 10,
            color: THEME.colors.success,
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
                ? THEME.colors.success
                : i === tutorial.currentObjectiveIndex
                  ? THEME.colors.text
                  : THEME.colors.textDim,
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
          background: tutorial.networkReady ? THEME.colors.successBg : THEME.colors.dangerBg,
          borderRadius: THEME.radius.sm,
          fontSize: 10,
          color: tutorial.networkReady ? THEME.colors.success : THEME.colors.danger,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={statusDot(tutorial.networkReady ? THEME.colors.success : THEME.colors.danger)}
        />
        Network: {tutorial.networkReady ? "READY" : "NOT READY"}
      </div>
    </div>
  );
}
