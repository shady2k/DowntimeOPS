import { useEffect, useState, useRef } from "react";
import { useGameStore } from "../../store/gameStore";
import { THEME } from "../theme";
import type { Milestone } from "@downtime-ops/shared";

/**
 * Shows a toast notification when a milestone unlocks.
 * Appears in the bottom-left corner, auto-dismisses after 4 seconds.
 * Queues multiple unlocks if they happen close together.
 */
export function MilestoneUnlockOverlay() {
  const milestones = useGameStore((s) => s.state?.progression?.milestones);
  const [queue, setQueue] = useState<Milestone[]>([]);
  const [current, setCurrent] = useState<Milestone | null>(null);
  const shownRef = useRef<Set<string>>(new Set());

  // Detect newly completed milestones
  useEffect(() => {
    if (!milestones) return;

    const newUnlocks: Milestone[] = [];
    for (const m of milestones) {
      if (m.completed && !shownRef.current.has(m.id)) {
        shownRef.current.add(m.id);
        newUnlocks.push(m);
      }
    }

    if (newUnlocks.length > 0) {
      setQueue((prev) => [...prev, ...newUnlocks]);
    }
  }, [milestones]);

  // Show next in queue
  useEffect(() => {
    if (current || queue.length === 0) return;

    const next = queue[0];
    setCurrent(next);
    setQueue((prev) => prev.slice(1));

    const timer = setTimeout(() => setCurrent(null), 4000);
    return () => clearTimeout(timer);
  }, [current, queue]);

  if (!current) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        left: 20,
        zIndex: 500,
        pointerEvents: "auto",
        animation: "slideInLeft 0.3s ease-out",
      }}
      onClick={() => setCurrent(null)}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 18px",
          background: THEME.colors.bgDark,
          border: `1px solid ${THEME.colors.accent}`,
          borderRadius: THEME.radius.lg,
          boxShadow: THEME.shadows.glow(THEME.colors.accent),
          fontFamily: THEME.fonts.body,
          minWidth: 240,
          maxWidth: 340,
        }}
      >
        {/* Trophy icon */}
        <div style={{ fontSize: 24, flexShrink: 0 }}>
          {"\u{1F3C6}"}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 9,
            color: THEME.colors.accent,
            textTransform: "uppercase",
            letterSpacing: 1.5,
            fontWeight: 700,
            marginBottom: 2,
          }}>
            Achievement Unlocked
          </div>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: THEME.colors.text,
          }}>
            {current.title}
          </div>
          <div style={{
            fontSize: 10,
            color: THEME.colors.textMuted,
            marginTop: 1,
          }}>
            {current.description}
          </div>
          {current.reward && (
            <div style={{
              fontSize: 10,
              color: THEME.colors.success,
              marginTop: 3,
              fontWeight: 600,
            }}>
              {current.reward}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
