import type { ReactNode } from "react";
import { THEME } from "./theme";

interface LayoutProps {
  topBar: ReactNode;
  canvas: ReactNode;
  sidePanel: ReactNode;
  bottomBar: ReactNode;
}

export function Layout({ topBar, canvas, sidePanel, bottomBar }: LayoutProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: THEME.colors.bgDarkest,
        color: THEME.colors.text,
        fontFamily: THEME.fonts.body,
      }}
    >
      <div style={{ flexShrink: 0 }}>{topBar}</div>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: 1, overflow: "hidden" }}>{canvas}</div>
        <div
          style={{
            width: 350,
            flexShrink: 0,
            borderLeft: `1px solid ${THEME.colors.borderDark}`,
            background: THEME.colors.bgDark,
            overflow: "auto",
            boxShadow: "-4px 0 16px rgba(0,0,0,0.3)",
          }}
        >
          {sidePanel}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>{bottomBar}</div>
    </div>
  );
}
