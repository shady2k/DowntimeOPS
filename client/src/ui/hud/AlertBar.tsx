import { useGameStore } from "../../store/gameStore";
import { THEME } from "../theme";

/** Map system alert types to player-facing language */
function friendlyMessage(type: string, message: string): string {
  switch (type) {
    case "port_down":
      return message
        .replace(/port \d+ on device .+/i, (m) => m)
        .replace("Port", "A network port")
        .replace("went down", "has failed — traffic is disrupted");
    case "connection_down":
      return message.includes("Connection")
        ? message.replace("Connection", "A client connection") +
            " — check your cables"
        : message;
    case "sla_violation":
      return message.includes("SLA")
        ? message.replace("SLA violation", "Service level breach") +
            " — client may leave"
        : message;
    default:
      return message;
  }
}

function severityLabel(severity: string): string {
  switch (severity) {
    case "critical":
      return "OUTAGE";
    case "warning":
      return "ALERT";
    default:
      return "INFO";
  }
}

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
        padding: "5px 16px",
        background: THEME.colors.bgPanel,
        borderTop: `1px solid ${THEME.colors.borderDark}`,
        fontSize: 11,
        fontFamily: THEME.fonts.body,
        display: "flex",
        gap: 16,
        overflow: "hidden",
      }}
    >
      {recent.map((alert) => {
        const isActive = highlightedAlertId === alert.id;
        const color =
          alert.severity === "critical"
            ? THEME.colors.danger
            : alert.severity === "warning"
              ? THEME.colors.warning
              : THEME.colors.textMuted;

        return (
          <span
            key={alert.id}
            onClick={() => highlightAlert(isActive ? null : alert.id)}
            style={{
              color,
              whiteSpace: "nowrap",
              cursor: alert.deviceId ? "pointer" : "default",
              opacity: isActive ? 1 : 0.8,
              padding: "2px 6px",
              background: isActive ? THEME.colors.dangerBg : "transparent",
              borderRadius: THEME.radius.sm,
              fontWeight: isActive ? 600 : 400,
            }}
          >
            [{severityLabel(alert.severity)}]{" "}
            {friendlyMessage(alert.type, alert.message)}
          </span>
        );
      })}
    </div>
  );
}
