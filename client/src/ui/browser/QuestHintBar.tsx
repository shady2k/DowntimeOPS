import { useBrowserStore } from "./browserStore";
import { useGameStore } from "../../store/gameStore";
import { THEME } from "../theme";
import type { Quest } from "@downtime-ops/shared";

export function QuestHintBar() {
  const quests = useGameStore((s) => s.state?.quests);
  const navigate = useBrowserStore((s) => s.navigate);

  if (!quests || !quests.activeQuestId) return null;

  const quest: Quest | undefined = quests.quests[quests.activeQuestId];
  if (!quest || quest.status === "completed") return null;

  // Find first incomplete step (fallback to currentStepIndex in case of race)
  const currentStep = quest.steps.find((s) => !s.completed) ?? quest.steps[quest.currentStepIndex];
  if (!currentStep || currentStep.completed) return null;

  const completedCount = quest.steps.filter((s) => s.completed).length;

  return (
    <div
      onClick={() => navigate({ type: "quests" })}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        background: THEME.colors.bgDarkest,
        borderTop: `1px solid ${THEME.colors.border}`,
        cursor: "pointer",
        fontSize: 12,
        fontFamily: THEME.fonts.body,
        flexShrink: 0,
      }}
    >
      <span style={{ color: THEME.colors.accent, fontWeight: 700, flexShrink: 0 }}>
        {currentStep.title}
      </span>
      <span style={{ color: THEME.colors.textDim }}>|</span>
      <span style={{ color: THEME.colors.textMuted, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {currentStep.description}
      </span>
      <span style={{ color: THEME.colors.textDim, fontFamily: THEME.fonts.mono, flexShrink: 0 }}>
        {completedCount}/{quest.steps.length}
      </span>
    </div>
  );
}
