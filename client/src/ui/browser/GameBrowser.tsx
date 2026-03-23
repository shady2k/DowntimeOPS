import { useEffect, useCallback } from "react";
import { useBrowserStore, ZOOM_STEPS } from "./browserStore";
import { BrowserChrome } from "./BrowserChrome";
import { PageRouter } from "./PageRouter";
import { THEME } from "../theme";

export function GameBrowser() {
  const open = useBrowserStore((s) => s.open);
  const closeBrowser = useBrowserStore((s) => s.closeBrowser);
  const zoomIndex = useBrowserStore((s) => s.zoomIndex);
  const zoomIn = useBrowserStore((s) => s.zoomIn);
  const zoomOut = useBrowserStore((s) => s.zoomOut);
  const zoom = ZOOM_STEPS[zoomIndex];

  const handleClose = useCallback(() => {
    closeBrowser();
  }, [closeBrowser]);

  // ESC to close, Ctrl+=/- to zoom
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        zoomIn();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        e.preventDefault();
        zoomOut();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, handleClose, zoomIn, zoomOut]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        background: THEME.colors.bgDarkest,
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <BrowserChrome />

      {/* Viewport */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          background: THEME.colors.bgPanel,
        }}
      >
        <div
          style={{
            fontSize: `${zoom * 100}%`,
            transformOrigin: "top left",
            minHeight: "100%",
          }}
        >
          <PageRouter />
        </div>
      </div>
    </div>
  );
}
