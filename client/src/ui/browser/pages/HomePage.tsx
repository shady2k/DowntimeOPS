import { useBrowserStore } from "../browserStore";
import { THEME } from "../../theme";

export function HomePage() {
  const bookmarks = useBrowserStore((s) => s.bookmarks);
  const navigate = useBrowserStore((s) => s.navigate);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: 40,
        fontFamily: THEME.fonts.body,
      }}
    >
      <h1
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: THEME.colors.accent,
          marginBottom: 4,
          fontFamily: THEME.fonts.heading,
        }}
      >
        DowntimeOPS Browser
      </h1>
      <p style={{ fontSize: 11, color: THEME.colors.textDim, marginBottom: 30 }}>
        Your management workstation
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {bookmarks.map((bm) => (
          <button
            key={bm.label}
            onClick={() => navigate(bm.route)}
            style={{
              background: THEME.colors.bgCard,
              border: `1px solid ${THEME.colors.border}`,
              borderRadius: THEME.radius.md,
              padding: "14px 16px",
              color: THEME.colors.text,
              cursor: "pointer",
              fontFamily: THEME.fonts.body,
              fontSize: 11,
              fontWeight: 600,
              minWidth: 80,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = THEME.colors.bgCardHover;
              (e.currentTarget as HTMLElement).style.borderColor = THEME.colors.accent;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = THEME.colors.bgCard;
              (e.currentTarget as HTMLElement).style.borderColor = THEME.colors.border;
            }}
          >
            <span style={{ fontSize: 20 }}>{bm.icon}</span>
            <span>{bm.label}</span>
          </button>
        ))}
      </div>

      <p style={{ fontSize: 9, color: THEME.colors.textDim, marginTop: 30 }}>
        Click a device's console port to configure it, or type an IP address above.
      </p>
    </div>
  );
}
