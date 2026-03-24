import { useEffect, useState, useRef } from "react";
import { useGameStore } from "../../store/gameStore";
import { THEME } from "../theme";
import type { Quest } from "@downtime-ops/shared";

/**
 * Shows a toast notification when a quest transitions to "completed".
 * Auto-dismisses after 5 seconds, click to dismiss early.
 * Non-blocking — appears in bottom-right corner.
 */
export function QuestCompleteOverlay() {
  const quests = useGameStore((s) => s.state?.quests);
  const [completedQuest, setCompletedQuest] = useState<Quest | null>(null);
  const [visible, setVisible] = useState(false);
  const shownQuestsRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!quests) return;

    for (const quest of Object.values(quests.quests)) {
      if (quest.status === "completed" && !shownQuestsRef.current.has(quest.id)) {
        shownQuestsRef.current.add(quest.id);
        setCompletedQuest(quest);
        setVisible(true);

        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setVisible(false), 5000);
        break;
      }
    }
  }, [quests]);

  if (!visible || !completedQuest) return null;

  const stepsCompleted = completedQuest.steps.filter((s) => s.completed).length;

  const nextQuest = quests
    ? Object.values(quests.quests).find((q) => q.status === "active" && q.id !== completedQuest.id)
    : null;

  return (
    <div
      onClick={() => setVisible(false)}
      style={{
        position: "absolute",
        bottom: 20,
        right: 20,
        zIndex: 600,
        pointerEvents: "auto",
        cursor: "pointer",
        animation: "slideInRight 0.3s ease-out",
      }}
    >
      <div
        style={{
          padding: "16px 22px",
          background: THEME.colors.bgDark,
          border: `2px solid ${THEME.colors.success}`,
          borderRadius: THEME.radius.lg,
          textAlign: "center",
          fontFamily: THEME.fonts.heading,
          boxShadow: THEME.shadows.glow(THEME.colors.success),
          maxWidth: 320,
        }}
      >
        <div
          style={{
            fontSize: 9,
            color: THEME.colors.success,
            textTransform: "uppercase",
            letterSpacing: 2,
            marginBottom: 4,
          }}
        >
          Quest Complete
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: THEME.colors.accent,
            marginBottom: 6,
          }}
        >
          {completedQuest.title}
        </div>
        <div style={{ fontSize: 11, color: THEME.colors.textMuted }}>
          {stepsCompleted} steps completed
        </div>

        {nextQuest && (
          <div
            style={{
              marginTop: 10,
              padding: "6px 10px",
              background: THEME.colors.accentBg,
              border: `1px solid ${THEME.colors.accent}44`,
              borderRadius: THEME.radius.md,
              fontSize: 10,
              color: THEME.colors.accent,
            }}
          >
            Next: {nextQuest.title}
          </div>
        )}
      </div>
    </div>
  );
}
