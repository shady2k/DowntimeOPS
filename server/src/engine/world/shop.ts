import type { ShopState } from "@downtime-ops/shared";
import { EQUIPMENT_CATALOG } from "../config/equipment";

export function createShop(): ShopState {
  const listings: ShopState["listings"] = {
    "shop-rack-42u": {
      id: "shop-rack-42u",
      model: "rack_42u",
      itemKind: "rack",
      name: "42U Server Rack",
      brand: "RackPro",
      description: "Standard 42U floor-standing server rack with cable management and ventilation.",
      specs: {
        type: "server",
        powerDrawWatts: 0,
        heatOutput: 0,
        uHeight: 42,
        ports: [],
        packageSize: { w: 90, h: 110 },
      },
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
      brand: template.brand,
      description: template.description,
      specs: {
        type: template.type,
        powerDrawWatts: template.powerDrawWatts,
        heatOutput: template.heatOutput,
        uHeight: template.uHeight,
        ports: template.ports,
        packageSize: template.packageSize,
      },
      price: template.cost,
      stock: null,
    };
  }

  return { listings };
}
