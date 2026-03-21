import { useState } from "react";
import type { ShopListing } from "@downtime-ops/shared";
import { useGameStore } from "../../store/gameStore";
import { useShopCartStore } from "./shopStore";
import { ShopProductCard } from "./ShopProductCard";
import { THEME } from "../theme";

type CategoryFilter = "all" | "rack" | "server" | "switch" | "router" | "cable";

const CATEGORIES: { key: CategoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "rack", label: "Racks" },
  { key: "server", label: "Servers" },
  { key: "switch", label: "Switches" },
  { key: "router", label: "Routers" },
  { key: "cable", label: "Cables" },
];

function matchesCategory(listing: ShopListing, filter: CategoryFilter): boolean {
  if (filter === "all") return true;
  if (filter === "rack") return listing.itemKind === "rack";
  if (filter === "cable") return listing.itemKind === "cable";
  return listing.specs.type === filter;
}

export function ShopCatalog() {
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const money = useGameStore((s) => s.state?.money ?? 0);
  const listings = useGameStore((s) => s.state?.world.shop.listings ?? {});
  const cableStock = useGameStore((s) => s.state?.world.cableStock);
  const cartItems = useShopCartStore((s) => s.items);
  const addItem = useShopCartStore((s) => s.addItem);

  const filtered = Object.values(listings).filter((l) => matchesCategory(l, filter));

  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Category tabs */}
      <div
        style={{
          display: "flex",
          gap: 2,
          padding: "8px 12px",
          borderBottom: `1px solid ${THEME.colors.border}`,
          background: THEME.colors.bgDark,
        }}
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setFilter(cat.key)}
            style={{
              padding: "4px 10px",
              border: "none",
              borderRadius: THEME.radius.sm,
              cursor: "pointer",
              fontSize: 10,
              fontFamily: THEME.fonts.body,
              fontWeight: 600,
              background: filter === cat.key ? THEME.colors.accent : "transparent",
              color: filter === cat.key ? THEME.colors.textInverse : THEME.colors.textMuted,
              transition: "background 0.15s",
            }}
          >
            {cat.label}
          </button>
        ))}

        {/* Money display */}
        <div
          style={{
            marginLeft: "auto",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: THEME.fonts.mono,
            color: THEME.colors.success,
            alignSelf: "center",
          }}
        >
          ${money.toLocaleString()}
        </div>
      </div>

      {/* Product grid */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: 12,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 10,
          alignContent: "start",
        }}
      >
        {filtered.map((listing) => {
          const cartItem = cartItems.find((c) => c.listingId === listing.id);
          return (
            <ShopProductCard
              key={listing.id}
              listing={listing}
              canAfford={money >= listing.price}
              cartQty={cartItem?.quantity ?? 0}
              onAddToCart={() => addItem(listing.id)}
              cableStock={cableStock}
            />
          );
        })}
        {filtered.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              color: THEME.colors.textDim,
              fontSize: 12,
              padding: 40,
            }}
          >
            No items in this category
          </div>
        )}
      </div>
    </div>
  );
}
