import type { ShopListing } from "@downtime-ops/shared";
import { THEME, cardStyle, buttonStyle } from "../theme";

const PORT_TYPE_LABELS: Record<string, string> = {
  copper_1g: "1GbE",
  copper_10g: "10GbE",
  sfp_10g: "10G SFP+",
  sfp_25g: "25G SFP28",
  qsfp_40g: "40G QSFP+",
};

const DEVICE_COLORS: Record<string, string> = {
  server: THEME.colors.server,
  switch: THEME.colors.switch,
  router: THEME.colors.router,
  firewall: THEME.colors.firewall,
};

interface Props {
  listing: ShopListing;
  canAfford: boolean;
  cartQty: number;
  onAddToCart: () => void;
}

export function ShopProductCard({ listing, canAfford, cartQty, onAddToCart }: Props) {
  const color = DEVICE_COLORS[listing.specs.type] || THEME.colors.textMuted;

  return (
    <div style={{ ...cardStyle(color), padding: "12px 14px", position: "relative" }}>
      {/* Brand */}
      <div
        style={{
          fontSize: 9,
          color: THEME.colors.textDim,
          fontFamily: THEME.fonts.body,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 2,
        }}
      >
        {listing.brand}
      </div>

      {/* Name */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: THEME.colors.text,
          fontFamily: THEME.fonts.heading,
          marginBottom: 4,
        }}
      >
        {listing.name}
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 10,
          color: THEME.colors.textMuted,
          fontFamily: THEME.fonts.body,
          marginBottom: 8,
          lineHeight: 1.4,
        }}
      >
        {listing.description}
      </div>

      {/* Specs grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "3px 12px",
          fontSize: 10,
          color: THEME.colors.textMuted,
          fontFamily: THEME.fonts.mono,
          marginBottom: 10,
        }}
      >
        {listing.specs.uHeight > 0 && (
          <div>{listing.specs.uHeight}U height</div>
        )}
        {listing.specs.powerDrawWatts > 0 && (
          <div>{listing.specs.powerDrawWatts}W power</div>
        )}
        {listing.specs.heatOutput > 0 && (
          <div>{listing.specs.heatOutput} BTU heat</div>
        )}
        {listing.specs.ports.map((p, i) => (
          <div key={i}>
            {p.count}x {PORT_TYPE_LABELS[p.type] || p.type}
          </div>
        ))}
      </div>

      {/* Price + Add to Cart */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            fontFamily: THEME.fonts.heading,
            color: canAfford ? THEME.colors.success : THEME.colors.danger,
          }}
        >
          ${listing.price.toLocaleString()}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {cartQty > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: THEME.colors.accent,
                fontFamily: THEME.fonts.mono,
              }}
            >
              x{cartQty}
            </span>
          )}
          <button
            onClick={onAddToCart}
            style={buttonStyle("primary", true)}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
