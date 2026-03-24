import { useEffect, useState, useRef } from "react";
import { useGameStore } from "../../store/gameStore";
import { THEME } from "../theme";
import type { Quest } from "@downtime-ops/shared";

/**
 * Shows a celebration overlay when a quest transitions to "completed".
 * Stays visible for 6 seconds or until clicked.
 */
export function QuestCompleteOverlay() {
  const quests = useGameStore((s) => s.state?.quests);
  const [completedQuest, setCompletedQuest] = useState<Quest | null>(null);
  const [visible, setVisible] = useState(false);
  const shownQuestsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!quests) return;

    for (const quest of Object.values(quests.quests)) {
      if (quest.status === "completed" && !shownQuestsRef.current.has(quest.id)) {
        shownQuestsRef.current.add(quest.id);
        setCompletedQuest(quest);
        setVisible(true);

        const timer = setTimeout(() => setVisible(false), 6000);
        return () => clearTimeout(timer);
      }
    }
  }, [quests]);

  if (!visible || !completedQuest) return null;

  const stepsCompleted = completedQuest.steps.filter((s) => s.completed).length;

  // Figure out if there's a next quest
  const nextQuest = quests
    ? Object.values(quests.quests).find((q) => q.status === "active" && q.id !== completedQuest.id)
    : null;

  return (
    <div
      onClick={() => setVisible(false)}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "auto",
        zIndex: 600,
      }}
    >
      <div
        style={{
          padding: "28px 44px",
          background: THEME.colors.overlay,
          border: `2px solid ${THEME.colors.success}`,
          borderRadius: THEME.radius.xl,
          textAlign: "center",
          fontFamily: THEME.fonts.heading,
          boxShadow: THEME.shadows.glow(THEME.colors.success),
          maxWidth: 400,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontSize: 11,
            color: THEME.colors.success,
            textTransform: "uppercase",
            letterSpacing: 2,
            marginBottom: 6,
          }}
        >
          Quest Complete
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: THEME.colors.accent,
            marginBottom: 10,
          }}
        >
          {completedQuest.title}
        </div>
        <div style={{ fontSize: 12, color: THEME.colors.textMuted, marginBottom: 6 }}>
          {stepsCompleted} steps completed
        </div>

        {nextQuest && (
          <div
            style={{
              marginTop: 14,
              padding: "8px 14px",
              background: THEME.colors.accentBg,
              border: `1px solid ${THEME.colors.accent}44`,
              borderRadius: THEME.radius.md,
              fontSize: 11,
              color: THEME.colors.accent,
            }}
          >
            Next: {nextQuest.title}
          </div>
        )}

        <div style={{ fontSize: 9, color: THEME.colors.textDim, marginTop: 12 }}>
          Click anywhere to dismiss
        </div>
      </div>
    </div>
  );
}
