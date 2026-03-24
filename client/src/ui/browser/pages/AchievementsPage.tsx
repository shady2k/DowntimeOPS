import { useGameStore } from "../../../store/gameStore";
import { THEME } from "../../theme";

export function AchievementsPage() {
  const progression = useGameStore((s) => s.state?.progression);
  if (!progression) return null;

  const { milestones } = progression;
  const completedCount = milestones.filter((m) => m.completed).length;

  return (
    <div style={{ fontFamily: THEME.fonts.body, fontSize: 11, color: THEME.colors.text }}>
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          background: `linear-gradient(135deg, ${THEME.colors.accent}22, ${THEME.colors.bgPanel})`,
          borderBottom: `2px solid ${THEME.colors.accent}`,
        }}
      >
        <div style={{ fontSize: 9, color: THEME.colors.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
          Achievements
        </div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          {completedCount}/{milestones.length} Unlocked
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Progress bar */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ height: 6, background: THEME.colors.bgInput, borderRadius: 3 }}>
            <div
              style={{
                height: "100%",
                width: `${(completedCount / milestones.length) * 100}%`,
                background: THEME.colors.accent,
                borderRadius: 3,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>

        {/* Achievement cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {milestones.map((milestone) => {
            const unlocked = milestone.completed;

            return (
              <div
                key={milestone.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  background: unlocked ? THEME.colors.bgCard : THEME.colors.bgDarkest,
                  border: `1px solid ${unlocked ? THEME.colors.accent + "44" : THEME.colors.borderDark}`,
                  borderRadius: THEME.radius.md,
                  opacity: unlocked ? 1 : 0.6,
                }}
              >
                {/* Icon */}
                <div style={{
                  fontSize: 22,
                  width: 36,
                  textAlign: "center",
                  flexShrink: 0,
                  filter: unlocked ? "none" : "grayscale(1)",
                }}>
                  {unlocked ? "\u{1F3C6}" : "\u{1F512}"}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: unlocked ? THEME.colors.text : THEME.colors.textDim,
                    marginBottom: 1,
                  }}>
                    {milestone.title}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: unlocked ? THEME.colors.textMuted : THEME.colors.textDim,
                  }}>
                    {milestone.description}
                  </div>
                  {milestone.reward && (
                    <div style={{
                      fontSize: 9,
                      color: unlocked ? THEME.colors.success : THEME.colors.textDim,
                      marginTop: 3,
                      fontWeight: 600,
                    }}>
                      {unlocked ? "\u2713" : "\u{1F512}"} {milestone.reward}
                    </div>
                  )}
                </div>

                {/* Status badge */}
                {unlocked && (
                  <div style={{
                    fontSize: 8,
                    padding: "2px 8px",
                    background: THEME.colors.accent + "22",
                    border: `1px solid ${THEME.colors.accent}44`,
                    borderRadius: 3,
                    color: THEME.colors.accent,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    flexShrink: 0,
                  }}>
                    Unlocked
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
