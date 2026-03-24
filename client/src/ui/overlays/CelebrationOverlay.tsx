import { useEffect, useState } from "react";
import { useGameStore } from "../../store/gameStore";
import { THEME } from "../theme";

/**
 * Shows a celebration overlay when the player earns first revenue.
 * Triggers once when monthlyRevenue transitions from 0 to >0.
 */
export function CelebrationOverlay() {
  const revenue = useGameStore((s) => s.state?.monthlyRevenue ?? 0);
  const quests = useGameStore((s) => s.state?.quests);
  const [shown, setShown] = useState(false);
  const [visible, setVisible] = useState(false);
  const [prevRevenue, setPrevRevenue] = useState(0);

  useEffect(() => {
    if (prevRevenue === 0 && revenue > 0 && !shown && quests && !quests.tutorialComplete) {
      setShown(true);
      setVisible(true);
      // Auto-dismiss after 4 seconds
      const timer = setTimeout(() => setVisible(false), 4000);
      return () => clearTimeout(timer);
    }
    setPrevRevenue(revenue);
  }, [revenue, prevRevenue, shown, quests]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 200,
      }}
    >
      <div
        style={{
          padding: "24px 40px",
          background: THEME.colors.overlay,
          border: `2px solid ${THEME.colors.accent}`,
          borderRadius: THEME.radius.xl,
          textAlign: "center",
          fontFamily: THEME.fonts.heading,
          boxShadow: THEME.shadows.glow(THEME.colors.accent),
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: "bold",
            color: THEME.colors.accent,
            marginBottom: 8,
          }}
        >
          FIRST REVENUE
        </div>
        <div style={{ fontSize: 14, color: THEME.colors.textMuted, marginBottom: 4 }}>
          Your datacenter is making money!
        </div>
        <div style={{ fontSize: 18, color: THEME.colors.success, fontWeight: "bold" }}>
          +${revenue.toFixed(0)}/mo
        </div>
        <div style={{ fontSize: 10, color: THEME.colors.textDim, marginTop: 8 }}>
          Keep building to attract bigger clients
        </div>
      </div>
    </div>
  );
}
