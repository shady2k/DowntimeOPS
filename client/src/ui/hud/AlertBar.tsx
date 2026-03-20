import { useGameStore } from "../../store/gameStore";

export function AlertBar() {
  const alerts = useGameStore((s) => s.state?.alerts ?? []);

  const recent = alerts
    .filter((a) => !a.acknowledged)
    .slice(-5)
    .reverse();

  if (recent.length === 0) return null;

  return (
    <div
      style={{
        padding: "4px 16px",
        background: "#1a1a2e",
        borderTop: "1px solid #333",
        fontSize: 11,
        display: "flex",
        gap: 12,
        overflow: "hidden",
      }}
    >
      {recent.map((alert) => (
        <span
          key={alert.id}
          style={{
            color:
              alert.severity === "critical"
                ? "#e74c3c"
                : alert.severity === "warning"
                  ? "#f39c12"
                  : "#95a5a6",
            whiteSpace: "nowrap",
          }}
        >
          [{alert.severity.toUpperCase()}] {alert.message}
        </span>
      ))}
    </div>
  );
}
