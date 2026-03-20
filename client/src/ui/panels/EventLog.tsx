import { useState } from "react";
import { useGameStore } from "../../store/gameStore";
import { THEME, headingStyle, buttonStyle } from "../theme";

export function EventLog() {
  const alerts = useGameStore((s) => s.state?.alerts ?? []);
  const log = useGameStore((s) => s.state?.log ?? []);
  const [expanded, setExpanded] = useState(false);

  // Merge alerts and log into unified feed, sorted by tick desc
  const feed = [
    ...alerts.map((a) => ({
      id: a.id,
      tick: a.tick,
      type: "alert" as const,
      severity: a.severity,
      message: a.message,
    })),
    ...log.map((l) => ({
      id: l.id,
      tick: l.tick,
      type: "log" as const,
      severity: "info" as const,
      message: l.message,
    })),
  ]
    .sort((a, b) => b.tick - a.tick)
    .slice(0, expanded ? 50 : 10);

  return (
    <div style={{ padding: 12, fontFamily: THEME.fonts.body }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <h3 style={headingStyle()}>
          OPS LOG
        </h3>
        <button
          onClick={() => setExpanded(!expanded)}
          style={buttonStyle("ghost", true)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      </div>

      {feed.length === 0 && (
        <p style={{ fontSize: 10, color: THEME.colors.textDim }}>No events yet.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {feed.map((entry) => (
          <div
            key={entry.id}
            style={{
              display: "flex",
              gap: 6,
              fontSize: 10,
              padding: "2px 4px",
              borderRadius: THEME.radius.sm,
              fontFamily: THEME.fonts.mono,
              background:
                entry.type === "alert" && entry.severity === "critical"
                  ? THEME.colors.dangerBg
                  : "transparent",
            }}
          >
            <span style={{ color: THEME.colors.textDim, minWidth: 36, textAlign: "right" }}>
              t{entry.tick}
            </span>
            <span
              style={{
                color:
                  entry.severity === "critical"
                    ? THEME.colors.danger
                    : entry.severity === "warning"
                      ? THEME.colors.warning
                      : THEME.colors.textDim,
              }}
            >
              {entry.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
