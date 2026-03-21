import { useEffect, useCallback } from "react";
import { useGameStore } from "../../store/gameStore";
import { useShopCartStore } from "./shopStore";
import { ShopCatalog } from "./ShopCatalog";
import { ShopCart } from "./ShopCart";
import { THEME } from "../theme";

export function ShopBrowser() {
  const activeView = useGameStore((s) => s.activeView);
  const closeShop = useGameStore((s) => s.closeShop);
  const clearCart = useShopCartStore((s) => s.clearCart);

  const handleClose = useCallback(() => {
    clearCart();
    closeShop();
  }, [clearCart, closeShop]);

  // ESC to close
  useEffect(() => {
    if (activeView !== "shop") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [activeView, handleClose]);

  if (activeView !== "shop") return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.6)",
      }}
      onClick={handleClose}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* Browser window */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "80%",
          maxWidth: 800,
          height: "75%",
          maxHeight: 540,
          display: "flex",
          flexDirection: "column",
          borderRadius: THEME.radius.lg,
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          border: `1px solid ${THEME.colors.border}`,
        }}
      >
        {/* Title bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "6px 10px",
            background: THEME.colors.bgDarkest,
            borderBottom: `1px solid ${THEME.colors.borderDark}`,
            gap: 8,
          }}
        >
          {/* Window dots */}
          <div style={{ display: "flex", gap: 5 }}>
            <div
              onClick={handleClose}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: THEME.colors.danger,
                cursor: "pointer",
              }}
            />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: THEME.colors.warning, opacity: 0.4 }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: THEME.colors.success, opacity: 0.4 }} />
          </div>
          <span
            style={{
              fontSize: 10,
              color: THEME.colors.textDim,
              fontFamily: THEME.fonts.body,
              fontWeight: 600,
            }}
          >
            DataCenter Supply Co.
          </span>
          <button
            onClick={handleClose}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              color: THEME.colors.textDim,
              cursor: "pointer",
              fontSize: 14,
              fontFamily: THEME.fonts.mono,
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            x
          </button>
        </div>

        {/* Address bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "4px 10px",
            background: THEME.colors.bgDarkest,
            borderBottom: `1px solid ${THEME.colors.border}`,
            gap: 6,
          }}
        >
          {/* Nav buttons */}
          <span style={{ fontSize: 10, color: THEME.colors.textDim, userSelect: "none" }}>
            {"<"} {">"}
          </span>
          {/* URL bar */}
          <div
            style={{
              flex: 1,
              padding: "3px 8px",
              background: THEME.colors.bgInput,
              borderRadius: THEME.radius.sm,
              border: `1px solid ${THEME.colors.borderDark}`,
              fontSize: 10,
              fontFamily: THEME.fonts.mono,
              color: THEME.colors.textMuted,
              userSelect: "none",
            }}
          >
            <span style={{ color: THEME.colors.success }}>https://</span>
            datacenter-supply.net/shop
          </div>
        </div>

        {/* Content area: catalog + cart */}
        <div
          style={{
            flex: 1,
            display: "flex",
            overflow: "hidden",
            background: THEME.colors.bgPanel,
          }}
        >
          <ShopCatalog />
          <ShopCart />
        </div>
      </div>
    </div>
  );
}
