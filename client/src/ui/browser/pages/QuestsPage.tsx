import { useState, useEffect } from "react";
import { useGameStore } from "../../../store/gameStore";
import { rpcClient } from "../../../rpc/client";
import { THEME } from "../../theme";
import type { Quest } from "@downtime-ops/shared";

type Tab = "active" | "completed";

export function QuestsPage() {
  const quests = useGameStore((s) => s.state?.quests);
  const [tab, setTab] = useState<Tab>("active");

  // Report page visit for quest tracking
  useEffect(() => {
    rpcClient.call("reportPageVisit", { page: "quests" }).catch(() => {});
  }, []);

  if (!quests) return null;

  const questList = Object.values(quests.quests) as Quest[];
  const activeQuests = questList.filter((q) => q.status === "active");
  const completedQuests = questList.filter((q) => q.status === "completed");
  const displayed = tab === "active" ? activeQuests : completedQuests;

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
        {/* Tabs */}
        <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
          <TabButton
            label="Active"
            count={activeQuests.length}
            active={tab === "active"}
            onClick={() => setTab("active")}
          />
          <TabButton
            label="Completed"
            count={completedQuests.length}
            active={tab === "completed"}
            onClick={() => setTab("completed")}
          />
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {displayed.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: THEME.colors.textDim }}>
            {tab === "active"
              ? "No active quests right now. Check back later!"
              : "No completed quests yet."}
          </div>
        )}

        {displayed.map((quest) => (
          <QuestCard key={quest.id} quest={quest} />
        ))}
      </div>
    </div>
  );
}

function TabButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        borderBottom: active ? `2px solid ${THEME.colors.accent}` : "2px solid transparent",
        padding: "4px 2px",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: THEME.fonts.body,
        color: active ? THEME.colors.text : THEME.colors.textDim,
        cursor: "pointer",
        transition: "color 0.15s",
      }}
    >
      {label}
      {count > 0 && (
        <span
          style={{
            marginLeft: 4,
            fontSize: 9,
            fontFamily: THEME.fonts.mono,
            color: active ? THEME.colors.accent : THEME.colors.textDim,
          }}
        >
          ({count})
        </span>
      )}
    </button>
  );
}

function QuestCard({ quest }: { quest: Quest }) {
  const completedCount = quest.steps.filter((s) => s.completed).length;
  const isComplete = quest.status === "completed";

  return (
    <div
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
}
