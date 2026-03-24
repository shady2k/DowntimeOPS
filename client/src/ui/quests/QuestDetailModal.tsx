import { useEffect } from "react";
import type { Quest } from "@downtime-ops/shared";
import { THEME, cardStyle } from "../theme";

interface Props {
  quest: Quest;
  onClose: () => void;
}

export function QuestDetailModal({ quest, onClose }: Props) {
  // Capture ESC before App.tsx pause menu handler
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
    };
    // Use capture phase to intercept before App's handler
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [onClose]);

  const completedCount = quest.steps.filter((s) => s.completed).length;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: THEME.colors.overlay,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        pointerEvents: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 480,
          maxHeight: "80vh",
          overflow: "auto",
          background: THEME.colors.bgDark,
          border: `1px solid ${THEME.colors.border}`,
          borderRadius: THEME.radius.lg,
          padding: "20px 24px",
          fontFamily: THEME.fonts.body,
          boxShadow: THEME.shadows.panel,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 800,
              color: THEME.colors.accent,
              fontFamily: THEME.fonts.heading,
            }}>
              {quest.title}
            </h2>
            <div style={{ fontSize: 12, color: THEME.colors.textDim, marginTop: 2 }}>
              Requested by: {quest.giver}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: THEME.colors.textDim,
              fontSize: 18,
              cursor: "pointer",
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Description */}
        <div
          style={{
            ...cardStyle(),
            fontSize: 13,
            color: THEME.colors.textMuted,
            lineHeight: 1.5,
            marginBottom: 16,
          }}
        >
          {quest.description}
        </div>

        {/* Progress */}
        <div style={{
          fontSize: 12,
          color: THEME.colors.textDim,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 10,
        }}>
          Progress: {completedCount}/{quest.steps.length}
        </div>

        {/* Step list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {quest.steps.map((step, i) => {
            const isCurrent = i === quest.currentStepIndex && quest.status === "active";
            const isCompleted = step.completed;
            const isPending = !isCompleted && !isCurrent;

            return (
              <div
                key={step.id}
                style={{
                  display: "flex",
                  gap: 8,
                  padding: isCurrent ? "6px 8px" : "3px 8px",
                  background: isCurrent ? THEME.colors.accentBg : "transparent",
                  borderRadius: THEME.radius.sm,
                  borderLeft: isCurrent ? `3px solid ${THEME.colors.accent}` : "3px solid transparent",
                  opacity: isPending ? 0.4 : 1,
                }}
              >
                {/* Icon */}
                <span style={{
                  fontSize: 12,
                  width: 16,
                  textAlign: "center",
                  flexShrink: 0,
                  color: isCompleted
                    ? THEME.colors.success
                    : isCurrent
                      ? THEME.colors.accent
                      : THEME.colors.textDim,
                }}>
                  {isCompleted ? "\u2713" : isCurrent ? "\u25B6" : "\u25CB"}
                </span>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: isCurrent ? 700 : 400,
                    color: isCompleted
                      ? THEME.colors.success
                      : isCurrent
                        ? THEME.colors.accent
                        : THEME.colors.textDim,
                    textDecoration: isCompleted ? "line-through" : "none",
                  }}>
                    {step.title}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: isCurrent ? THEME.colors.textMuted : THEME.colors.textDim,
                    marginTop: 3,
                    lineHeight: 1.5,
                  }}>
                    {step.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Status */}
        {quest.status === "completed" && (
          <div style={{
            marginTop: 16,
            padding: "8px 12px",
            background: THEME.colors.successBg,
            border: `1px solid ${THEME.colors.successBorder}`,
            borderRadius: THEME.radius.sm,
            fontSize: 11,
            color: THEME.colors.success,
            textAlign: "center",
            fontWeight: 700,
          }}>
            QUEST COMPLETE
          </div>
        )}
      </div>
    </div>
  );
}
