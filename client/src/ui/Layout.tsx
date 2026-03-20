import type { ReactNode } from "react";

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
        background: "#0f0f1a",
        color: "#ecf0f1",
        fontFamily: "monospace",
      }}
    >
      <div style={{ flexShrink: 0 }}>{topBar}</div>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: 1, overflow: "hidden" }}>{canvas}</div>
        <div
          style={{
            width: 350,
            flexShrink: 0,
            borderLeft: "1px solid #333",
            overflow: "auto",
          }}
        >
          {sidePanel}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>{bottomBar}</div>
    </div>
  );
}
