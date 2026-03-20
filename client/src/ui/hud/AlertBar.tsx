import { useGameStore } from "../../store/gameStore";

export function AlertBar() {
  const alerts = useGameStore((s) => s.state?.alerts ?? []);
  const highlightedAlertId = useGameStore((s) => s.highlightedAlertId);
  const highlightAlert = useGameStore((s) => s.highlightAlert);

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
          onClick={() =>
            highlightAlert(
              highlightedAlertId === alert.id ? null : alert.id,
            )
          }
          style={{
            color:
              alert.severity === "critical"
                ? "#e74c3c"
                : alert.severity === "warning"
                  ? "#f39c12"
                  : "#95a5a6",
            whiteSpace: "nowrap",
            cursor: alert.deviceId ? "pointer" : "default",
            textDecoration:
              highlightedAlertId === alert.id ? "underline" : "none",
            opacity: highlightedAlertId === alert.id ? 1 : 0.8,
          }}
        >
          [{alert.severity.toUpperCase()}] {alert.message}
        </span>
      ))}
    </div>
  );
}
