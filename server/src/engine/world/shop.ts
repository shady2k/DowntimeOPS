import type { ShopState } from "@downtime-ops/shared";
import { EQUIPMENT_CATALOG } from "../config/equipment";

export function createShop(): ShopState {
  const listings: ShopState["listings"] = {
    "shop-rack-42u": {
      id: "shop-rack-42u",
      model: "rack_42u",
      itemKind: "rack",
      name: "42U Server Rack",
      price: 5000,
      stock: null,
    },
  };

  // Add equipment catalog items as device listings
  for (const [model, template] of Object.entries(EQUIPMENT_CATALOG)) {
    listings[`shop-${model}`] = {
      id: `shop-${model}`,
      model,
      itemKind: "device",
      name: template.name,
      price: template.cost,
      stock: null,
    };
  }

  return { listings };
}
