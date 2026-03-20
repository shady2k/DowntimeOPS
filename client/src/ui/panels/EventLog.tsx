import { useState } from "react";
import { useGameStore } from "../../store/gameStore";

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
    <div style={{ padding: 12, fontFamily: "monospace" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 13, color: "#95a5a6" }}>
          OPS LOG
        </h3>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            padding: "1px 6px",
            background: "transparent",
            color: "#555",
            border: "1px solid #333",
            borderRadius: 2,
            cursor: "pointer",
            fontSize: 9,
          }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      </div>

      {feed.length === 0 && (
        <p style={{ fontSize: 10, color: "#444" }}>No events yet.</p>
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
              borderRadius: 2,
              background:
                entry.type === "alert" && entry.severity === "critical"
                  ? "#1a0a0a"
                  : "transparent",
            }}
          >
            <span style={{ color: "#444", minWidth: 36, textAlign: "right" }}>
              t{entry.tick}
            </span>
            <span
              style={{
                color:
                  entry.severity === "critical"
                    ? "#e74c3c"
                    : entry.severity === "warning"
                      ? "#f39c12"
                      : "#555",
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
