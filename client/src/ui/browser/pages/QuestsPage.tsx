import { useEffect } from "react";
import { useGameStore } from "../../../store/gameStore";
import { rpcClient } from "../../../rpc/client";
import { THEME } from "../../theme";

export function QuestsPage() {
  const quests = useGameStore((s) => s.state?.quests);

  // Report page visit for quest tracking
  useEffect(() => {
    rpcClient.call("reportPageVisit", { page: "quests" }).catch(() => {});
  }, []);

  if (!quests) return null;

  const questList = Object.values(quests.quests);

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
          Quest Board
        </div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Active Tasks</div>
      </div>

      <div style={{ padding: 16 }}>
        {questList.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: THEME.colors.textDim }}>
            No quests available right now. Check back later!
          </div>
        )}

        {questList.map((quest) => {
          const completedCount = quest.steps.filter((s) => s.completed).length;
          const isComplete = quest.status === "completed";

          return (
            <div
              key={quest.id}
              style={{
                marginBottom: 16,
                background: THEME.colors.bgCard,
                border: `1px solid ${isComplete ? THEME.colors.successBorder : THEME.colors.border}`,
                borderRadius: THEME.radius.md,
                overflow: "hidden",
              }}
            >
              {/* Quest header */}
              <div
                style={{
                  padding: "10px 14px",
                  borderBottom: `1px solid ${THEME.colors.borderDark}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isComplete ? THEME.colors.success : THEME.colors.accent }}>
                    {quest.title}
                  </div>
                  <div style={{ fontSize: 10, color: THEME.colors.textDim, marginTop: 2 }}>
                    From: {quest.giver}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{
                    fontSize: 10,
                    color: isComplete ? THEME.colors.success : THEME.colors.textMuted,
                    fontWeight: 600,
                  }}>
                    {completedCount}/{quest.steps.length}
                  </div>
                  {isComplete && (
                    <div style={{ fontSize: 9, color: THEME.colors.success, fontWeight: 700 }}>
                      COMPLETE
                    </div>
                  )}
                </div>
              </div>

              {/* Quest description */}
              <div style={{ padding: "8px 14px", fontSize: 11, color: THEME.colors.textMuted, lineHeight: 1.5 }}>
                {quest.description}
              </div>

              {/* Progress bar */}
              <div style={{ padding: "0 14px 8px" }}>
                <div style={{ height: 4, background: THEME.colors.bgInput, borderRadius: 2 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${(completedCount / quest.steps.length) * 100}%`,
                      background: isComplete ? THEME.colors.success : THEME.colors.accent,
                      borderRadius: 2,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>

              {/* Step list */}
              <div style={{ padding: "0 14px 12px" }}>
                {quest.steps.map((step, i) => {
                  const isCurrent = i === quest.currentStepIndex && quest.status === "active";
                  const isStepComplete = step.completed;
                  const isPending = !isStepComplete && !isCurrent;

                  return (
                    <div
                      key={step.id}
                      style={{
                        display: "flex",
                        gap: 8,
                        padding: isCurrent ? "5px 8px" : "3px 8px",
                        background: isCurrent ? THEME.colors.accentBg : "transparent",
                        borderRadius: THEME.radius.sm,
                        borderLeft: isCurrent ? `3px solid ${THEME.colors.accent}` : "3px solid transparent",
                        opacity: isPending ? 0.4 : 1,
                        marginBottom: 1,
                      }}
                    >
                      <span style={{
                        fontSize: 11,
                        width: 14,
                        textAlign: "center",
                        flexShrink: 0,
                        color: isStepComplete
                          ? THEME.colors.success
                          : isCurrent
                            ? THEME.colors.accent
                            : THEME.colors.textDim,
                      }}>
                        {isStepComplete ? "\u2713" : isCurrent ? "\u25B6" : "\u25CB"}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 11,
                          fontWeight: isCurrent ? 700 : 400,
                          color: isStepComplete
                            ? THEME.colors.success
                            : isCurrent
                              ? THEME.colors.accent
                              : THEME.colors.textDim,
                          textDecoration: isStepComplete ? "line-through" : "none",
                        }}>
                          {step.title}
                        </div>
                        {isCurrent && (
                          <div style={{ fontSize: 10, color: THEME.colors.textMuted, marginTop: 2, lineHeight: 1.4 }}>
                            {step.description}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
