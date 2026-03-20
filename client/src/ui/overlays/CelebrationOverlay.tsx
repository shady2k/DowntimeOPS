import { useEffect, useState } from "react";
import { useGameStore } from "../../store/gameStore";

/**
 * Shows a celebration overlay when the player earns first revenue.
 * Triggers once when monthlyRevenue transitions from 0 to >0.
 */
export function CelebrationOverlay() {
  const revenue = useGameStore((s) => s.state?.monthlyRevenue ?? 0);
  const tutorial = useGameStore((s) => s.state?.tutorial);
  const [shown, setShown] = useState(false);
  const [visible, setVisible] = useState(false);
  const [prevRevenue, setPrevRevenue] = useState(0);

  useEffect(() => {
    if (prevRevenue === 0 && revenue > 0 && !shown && tutorial && !tutorial.tutorialComplete) {
      setShown(true);
      setVisible(true);
      // Auto-dismiss after 4 seconds
      const timer = setTimeout(() => setVisible(false), 4000);
      return () => clearTimeout(timer);
    }
    setPrevRevenue(revenue);
  }, [revenue, prevRevenue, shown, tutorial]);

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
          background: "rgba(26, 42, 26, 0.95)",
          border: "2px solid #2ecc71",
          borderRadius: 12,
          textAlign: "center",
          fontFamily: "monospace",
          boxShadow: "0 0 40px rgba(46, 204, 113, 0.3)",
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: "bold",
            color: "#2ecc71",
            marginBottom: 8,
          }}
        >
          FIRST REVENUE
        </div>
        <div style={{ fontSize: 14, color: "#bdc3c7", marginBottom: 4 }}>
          Your datacenter is making money!
        </div>
        <div style={{ fontSize: 18, color: "#2ecc71", fontWeight: "bold" }}>
          +${revenue.toFixed(0)}/mo
        </div>
        <div style={{ fontSize: 10, color: "#666", marginTop: 8 }}>
          Keep building to attract bigger clients
        </div>
      </div>
    </div>
  );
}
