import { useGameStore } from "../../store/gameStore";
import { THEME } from "../theme";

/**
 * Rack scene — unified workstation layout (split into two layers).
 *
 * RackWorkstationBg: background image, rendered BEHIND the Phaser canvas.
 * RackWorkstationUI: interactive overlays, rendered ABOVE the Phaser canvas.
 *
 * The background image (workstation-bg.png) depicts the entire workspace as one
 * continuous physical room — bay opening, shelves, diagnostics console.
 * Phaser renders the rack/devices/cables into the bay opening area.
 * React content fills the shelf and diagnostics "holes" in the art.
 */

/** Background layer — sits BEHIND the Phaser canvas */
export function RackWorkstationBg() {
  const activeView = useGameStore((s) => s.activeView);
  if (activeView !== "rack") return null;

  return <div style={bgLayerStyle} />;
}

/** UI overlay layer — sits ABOVE the Phaser canvas */
export function RackWorkstationUI() {
  const activeView = useGameStore((s) => s.activeView);
  const rackMode = useGameStore((s) => s.rackMode);
  const workFocusDeviceId = useGameStore((s) => s.workFocusDeviceId);
  const state = useGameStore((s) => s.state);
  const enterOverviewMode = useGameStore((s) => s.enterOverviewMode);

  if (activeView !== "rack") return null;

  const isWork = rackMode === "work";
  const deviceName =
    isWork && workFocusDeviceId && state
      ? (state.devices[workFocusDeviceId]?.name ?? "Device")
      : null;

  return (
    <div style={overlayStyle}>
      {/* Mode indicator — top-left over the bay */}
      <div style={modeIndicatorStyle}>
        <div
          onClick={isWork ? enterOverviewMode : undefined}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            background: isWork ? THEME.colors.accentBg : "rgba(30, 24, 20, 0.8)",
            border: `1px solid ${isWork ? THEME.colors.accentDim : THEME.colors.borderDark}`,
            borderRadius: THEME.radius.sm,
            cursor: isWork ? "pointer" : "default",
            userSelect: "none" as const,
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
              textTransform: "uppercase" as const,
            }}
          >
            {isWork ? `Work: ${deviceName}` : "Overview"}
          </span>
        </div>
        <span
          style={{
            fontSize: 8,
            fontFamily: THEME.fonts.body,
            color: THEME.colors.textDim,
            marginTop: 2,
          }}
        >
          {isWork ? "ESC to overview" : "Double-click device \u00b7 ESC to exit"}
        </span>
      </div>

      {/* Economy widget — bottom-left */}
      <EconomyWidget />

      {/* Equipment shelf content zone */}
      <div style={shelfZoneStyle}>
        <div style={placeholderStyle}>
          <span style={placeholderTextStyle}>Drag devices to rack</span>
        </div>
      </div>

      {/* Diagnostics screen content zone */}
      <div style={diagnosticsZoneStyle}>
        <div style={placeholderStyle}>
          <span style={placeholderTextStyle}>Select a device to inspect</span>
        </div>
      </div>
    </div>
  );
}

function EconomyWidget() {
  const state = useGameStore((s) => s.state);
  if (!state) return null;

  const { money, world } = state;
  const cs = world.cableStock;

  return (
    <div style={economyStyle}>
      <span style={{ color: THEME.colors.success, fontWeight: 700 }}>
        ${formatMoney(money)}
      </span>
      <span style={econSepStyle}>{"\u00b7"}</span>
      <CableCount label="6" count={cs.cat6} color="#7ab87a" />
      <CableCount label="6a" count={cs.cat6a} color="#5a9aaa" />
      <CableCount label="F" count={cs.om3_fiber} color="#c48adf" />
      <CableCount label="S" count={cs.os2_fiber} color="#e0c040" />
    </div>
  );
}

function CableCount({ label, count, color }: { label: string; count: number; color: string }) {
  const dim = count === 0;
  return (
    <span style={{ opacity: dim ? 0.35 : 1 }}>
      <span style={{ color: THEME.colors.textDim, fontSize: 8 }}>{label}</span>
      <span style={{ color, fontWeight: 700, marginLeft: 1 }}>{count}</span>
    </span>
  );
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

// ── Styles ────────────────────────────────────────────────────

const bgLayerStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundImage: "url('/assets/backgrounds/workstation-bg.png')",
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  zIndex: 0,
  pointerEvents: "none",
};

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  pointerEvents: "none",
  zIndex: 100,
};

const modeIndicatorStyle: React.CSSProperties = {
  position: "absolute",
  top: 8,
  left: 8,
  display: "flex",
  flexDirection: "column",
  gap: 2,
  pointerEvents: "auto",
};

const economyStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 8,
  left: 8,
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 10px",
  background: "rgba(30, 24, 20, 0.85)",
  border: `1px solid ${THEME.colors.borderDark}`,
  borderRadius: THEME.radius.sm,
  fontSize: 11,
  fontFamily: THEME.fonts.mono,
  pointerEvents: "auto",
};

const econSepStyle: React.CSSProperties = {
  color: THEME.colors.textDim,
  margin: "0 2px",
};

// Shelf content zone — positioned over the empty shelves in workstation-bg.png.
const shelfZoneStyle: React.CSSProperties = {
  position: "absolute",
  left: "57%",
  top: "3%",
  width: "39%",
  height: "38%",
  display: "flex",
  flexDirection: "column",
  padding: "12px 16px",
  pointerEvents: "auto",
  overflow: "hidden",
};

// Diagnostics screen zone — positioned over the empty screen in workstation-bg.png.
const diagnosticsZoneStyle: React.CSSProperties = {
  position: "absolute",
  left: "60%",
  top: "48%",
  width: "35%",
  height: "38%",
  display: "flex",
  flexDirection: "column",
  padding: "16px 20px",
  pointerEvents: "auto",
  overflow: "hidden",
};

const placeholderStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const placeholderTextStyle: React.CSSProperties = {
  color: THEME.colors.textDim,
  fontSize: 10,
  fontFamily: THEME.fonts.mono,
};
