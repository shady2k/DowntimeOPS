import { useState } from "react";
import { useGameStore } from "../../store/gameStore";
import { useBrowserStore } from "../../ui/browser/browserStore";
import { THEME } from "../theme";
import { QuestDetailModal } from "./QuestDetailModal";

export function QuestTracker() {
  const quests = useGameStore((s) => s.state?.quests);
  const activeView = useGameStore((s) => s.activeView);
  const browserOpen = useBrowserStore((s) => s.open);
  const [modalOpen, setModalOpen] = useState(false);

  if (!quests || !quests.activeQuestId) return null;
  // Hide during rack view or when browser is open to avoid click conflicts
  if (activeView === "rack") return null;
  if (browserOpen) return null;

  const quest = quests.quests[quests.activeQuestId];
  if (!quest) return null;

  const currentStep = quest.steps[quest.currentStepIndex];
  const completedCount = quest.steps.filter((s) => s.completed).length;

  // Post-tutorial: show compact status
  if (quest.status === "completed") {
    return (
      <div
        style={{
          position: "absolute",
          top: 40,
          right: 8,
          width: 200,
          padding: "6px 10px",
          background: THEME.colors.overlay,
          borderRadius: THEME.radius.md,
          fontFamily: THEME.fonts.body,
          fontSize: 10,
          color: THEME.colors.success,
          pointerEvents: "auto",
        }}
      >
        Quest Complete: {quest.title}
      </div>
    );
  }

  return (
    <>
      <div
        onClick={() => setModalOpen(true)}
        style={{
          position: "absolute",
          top: 40,
          right: 8,
          width: 220,
          padding: "8px 12px",
          background: THEME.colors.overlay,
          borderRadius: THEME.radius.md,
          fontFamily: THEME.fonts.body,
          cursor: "pointer",
          pointerEvents: "auto",
          border: `1px solid ${THEME.colors.borderDark}`,
          transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = THEME.colors.accent;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = THEME.colors.borderDark;
        }}
      >
        {/* Quest title */}
        <div
          style={{
            fontSize: 10,
            color: THEME.colors.textDim,
            textTransform: "uppercase",
            letterSpacing: 0.8,
            marginBottom: 4,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{quest.title}</span>
          <span style={{ fontSize: 9, color: THEME.colors.textDim }}>
            {completedCount}/{quest.steps.length}
          </span>
        </div>

        {/* Area hint */}
        {currentStep?.hint && (
          <div
            style={{
              fontSize: 9,
              color: THEME.colors.textDim,
              marginBottom: 3,
            }}
          >
            {currentStep.hint}
          </div>
        )}

        {/* Current step — gold text */}
        {currentStep && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: THEME.colors.accent,
              lineHeight: 1.3,
            }}
          >
            {currentStep.title}
          </div>
        )}
      </div>

      {modalOpen && (
        <QuestDetailModal
          quest={quest}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
