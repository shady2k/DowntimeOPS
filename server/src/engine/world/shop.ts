import type { ShopState, CableType } from "@downtime-ops/shared";
import { EQUIPMENT_CATALOG } from "../config/equipment";

export interface CableListingData {
  cableType: CableType;
  quantity: number; // cables per pack
  speedLabel: string;
}

export const CABLE_CATALOG: Record<string, CableListingData> = {
  cable_cat6: { cableType: "cat6", quantity: 10, speedLabel: "1 Gbps" },
  cable_cat6a: { cableType: "cat6a", quantity: 10, speedLabel: "10 Gbps" },
  cable_om3_fiber: { cableType: "om3_fiber", quantity: 5, speedLabel: "10 Gbps" },
  cable_os2_fiber: { cableType: "os2_fiber", quantity: 5, speedLabel: "25+ Gbps" },
};

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

  // Add cable listings
  listings["shop-cable_cat6"] = {
    id: "shop-cable_cat6",
    model: "cable_cat6",
    itemKind: "cable",
    name: "Cat6 Patch Cable (10-pack)",
    brand: "CablePro",
    description: "Standard Cat6 copper patch cables, 1m length. Supports up to 1 Gbps.",
    specs: { type: "server", powerDrawWatts: 0, heatOutput: 0, uHeight: 0, ports: [], packageSize: { w: 50, h: 35 } },
    price: 50,
    stock: null,
  };
  listings["shop-cable_cat6a"] = {
    id: "shop-cable_cat6a",
    model: "cable_cat6a",
    itemKind: "cable",
    name: "Cat6a Patch Cable (10-pack)",
    brand: "CablePro",
    description: "Shielded Cat6a copper patch cables, 1m length. Supports up to 10 Gbps.",
    specs: { type: "server", powerDrawWatts: 0, heatOutput: 0, uHeight: 0, ports: [], packageSize: { w: 50, h: 35 } },
    price: 150,
    stock: null,
  };
  listings["shop-cable_om3_fiber"] = {
    id: "shop-cable_om3_fiber",
    model: "cable_om3_fiber",
    itemKind: "cable",
    name: "OM3 Fiber Patch Cable (5-pack)",
    brand: "FiberLink",
    description: "Multimode OM3 fiber patch cables with LC connectors. Supports 10 Gbps.",
    specs: { type: "server", powerDrawWatts: 0, heatOutput: 0, uHeight: 0, ports: [], packageSize: { w: 45, h: 30 } },
    price: 250,
    stock: null,
  };
  listings["shop-cable_os2_fiber"] = {
    id: "shop-cable_os2_fiber",
    model: "cable_os2_fiber",
    itemKind: "cable",
    name: "OS2 Single-Mode Fiber (5-pack)",
    brand: "FiberLink",
    description: "Single-mode OS2 fiber patch cables with LC connectors. Supports 25 Gbps+.",
    specs: { type: "server", powerDrawWatts: 0, heatOutput: 0, uHeight: 0, ports: [], packageSize: { w: 45, h: 30 } },
    price: 500,
    stock: null,
  };

  return { listings };
}
