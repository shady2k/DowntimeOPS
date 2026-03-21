import { useState } from "react";
import { useGameStore } from "../../store/gameStore";
import { useShopCartStore } from "./shopStore";
import { rpcClient } from "../../rpc/client";
import { THEME, buttonStyle } from "../theme";

export function ShopCart() {
  const money = useGameStore((s) => s.state?.money ?? 0);
  const listings = useGameStore((s) => s.state?.world.shop.listings ?? {});
  const cartItems = useShopCartStore((s) => s.items);
  const updateQuantity = useShopCartStore((s) => s.updateQuantity);
  const removeItem = useShopCartStore((s) => s.removeItem);
  const clearCart = useShopCartStore((s) => s.clearCart);

  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message?: string }>({
    type: "idle",
  });
  const [ordering, setOrdering] = useState(false);

  const totalCost = cartItems.reduce((sum, ci) => {
    const listing = listings[ci.listingId];
    return sum + (listing ? listing.price * ci.quantity : 0);
  }, 0);

  const canAfford = money >= totalCost;

  async function handleCheckout() {
    if (cartItems.length === 0 || !canAfford || ordering) return;
    setOrdering(true);
    setStatus({ type: "idle" });

    try {
      await rpcClient.call("buyCartItems", {
        items: cartItems.map((ci) => ({ listingId: ci.listingId, quantity: ci.quantity })),
      });
      clearCart();
      setStatus({ type: "success", message: "Order placed! Pick up from Storage." });
      setTimeout(() => setStatus({ type: "idle" }), 4000);
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Order failed" });
    } finally {
      setOrdering(false);
    }
  }

  return (
    <div
      style={{
        width: 200,
        borderLeft: `1px solid ${THEME.colors.border}`,
        background: THEME.colors.bgDark,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 10px",
          borderBottom: `1px solid ${THEME.colors.border}`,
          fontSize: 11,
          fontWeight: 700,
          fontFamily: THEME.fonts.heading,
          color: THEME.colors.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        Cart ({cartItems.length})
      </div>

      {/* Cart items */}
      <div style={{ flex: 1, overflow: "auto", padding: "6px 8px" }}>
        {cartItems.length === 0 && (
          <div
            style={{
              color: THEME.colors.textDim,
              fontSize: 10,
              textAlign: "center",
              padding: "20px 0",
            }}
          >
            Cart is empty
          </div>
        )}
        {cartItems.map((ci) => {
          const listing = listings[ci.listingId];
          if (!listing) return null;
          return (
            <div
              key={ci.listingId}
              style={{
                padding: "6px 0",
                borderBottom: `1px solid ${THEME.colors.borderDark}`,
                fontSize: 10,
                fontFamily: THEME.fonts.body,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                  marginBottom: 4,
                }}
              >
                <span style={{ color: THEME.colors.text, fontWeight: 600, flex: 1 }}>
                  {listing.name}
                </span>
                <button
                  onClick={() => removeItem(ci.listingId)}
                  style={{
                    background: "none",
                    border: "none",
                    color: THEME.colors.textDim,
                    cursor: "pointer",
                    fontSize: 10,
                    padding: "0 2px",
                    lineHeight: 1,
                  }}
                >
                  x
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={() => updateQuantity(ci.listingId, ci.quantity - 1)}
                  style={{
                    ...buttonStyle("ghost", true),
                    padding: "0 4px",
                    fontSize: 11,
                    lineHeight: "16px",
                  }}
                >
                  -
                </button>
                <span
                  style={{
                    fontFamily: THEME.fonts.mono,
                    color: THEME.colors.text,
                    minWidth: 16,
                    textAlign: "center",
                  }}
                >
                  {ci.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(ci.listingId, ci.quantity + 1)}
                  style={{
                    ...buttonStyle("ghost", true),
                    padding: "0 4px",
                    fontSize: 11,
                    lineHeight: "16px",
                  }}
                >
                  +
                </button>
                <span
                  style={{
                    marginLeft: "auto",
                    fontFamily: THEME.fonts.mono,
                    color: THEME.colors.textMuted,
                  }}
                >
                  ${(listing.price * ci.quantity).toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: total + checkout */}
      <div
        style={{
          padding: "8px 10px",
          borderTop: `1px solid ${THEME.colors.border}`,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {/* Status message */}
        {status.type !== "idle" && (
          <div
            style={{
              fontSize: 10,
              fontFamily: THEME.fonts.body,
              padding: "4px 6px",
              borderRadius: THEME.radius.sm,
              background: status.type === "success" ? THEME.colors.successBg : THEME.colors.dangerBg,
              color: status.type === "success" ? THEME.colors.success : THEME.colors.danger,
              border: `1px solid ${status.type === "success" ? THEME.colors.successBorder : THEME.colors.dangerBorder}`,
            }}
          >
            {status.message}
          </div>
        )}

        {/* Total */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: THEME.colors.textMuted,
              fontFamily: THEME.fonts.body,
            }}
          >
            Total
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              fontFamily: THEME.fonts.mono,
              color: canAfford ? THEME.colors.success : THEME.colors.danger,
            }}
          >
            ${totalCost.toLocaleString()}
          </span>
        </div>

        {!canAfford && totalCost > 0 && (
          <div style={{ fontSize: 9, color: THEME.colors.danger, fontFamily: THEME.fonts.body }}>
            Insufficient funds
          </div>
        )}

        {/* Buttons */}
        <button
          onClick={handleCheckout}
          disabled={cartItems.length === 0 || !canAfford || ordering}
          style={{
            ...buttonStyle("primary"),
            width: "100%",
            opacity: cartItems.length === 0 || !canAfford || ordering ? 0.5 : 1,
            cursor: cartItems.length === 0 || !canAfford || ordering ? "not-allowed" : "pointer",
          }}
        >
          {ordering ? "Ordering..." : "Place Order"}
        </button>

        {cartItems.length > 0 && (
          <button onClick={clearCart} style={{ ...buttonStyle("ghost", true), width: "100%" }}>
            Clear Cart
          </button>
        )}
      </div>
    </div>
  );
}
