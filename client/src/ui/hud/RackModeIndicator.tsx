import { useGameStore } from "../../store/gameStore";
import { THEME } from "../theme";

export function RackModeIndicator() {
  const activeView = useGameStore((s) => s.activeView);
  const rackMode = useGameStore((s) => s.rackMode);
  const workFocusDeviceId = useGameStore((s) => s.workFocusDeviceId);
  const state = useGameStore((s) => s.state);
  const enterOverviewMode = useGameStore((s) => s.enterOverviewMode);

  // RackWorkstation now handles the mode indicator
  return null;
  if (activeView !== "rack") return null;

  const isWork = rackMode === "work";
  const deviceName = isWork && workFocusDeviceId && state
    ? state.devices[workFocusDeviceId]?.name ?? "Device"
    : null;

  return (
    <div
      style={{
        position: "absolute",
        top: 28,
        left: 8,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        zIndex: 100,
        pointerEvents: "auto",
      }}
    >
      {/* Mode pill */}
      <div
        onClick={isWork ? enterOverviewMode : undefined}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 10px",
          background: isWork ? THEME.colors.accentBg : THEME.colors.bgPanel,
          border: `1px solid ${isWork ? THEME.colors.accentDim : THEME.colors.border}`,
          borderRadius: THEME.radius.sm,
          cursor: isWork ? "pointer" : "default",
          userSelect: "none",
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: isWork ? THEME.colors.accent : THEME.colors.textDim,
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontFamily: THEME.fonts.mono,
            fontWeight: 700,
            color: isWork ? THEME.colors.accent : THEME.colors.textMuted,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          {isWork ? `Work: ${deviceName}` : "Overview"}
        </span>
      </div>

      {/* Hint */}
      <span
        style={{
          fontSize: 8,
          fontFamily: THEME.fonts.body,
          color: THEME.colors.textDim,
          paddingLeft: 4,
        }}
      >
        {isWork ? "ESC to overview" : "Double-click device · ESC to exit"}
      </span>
    </div>
  );
}
