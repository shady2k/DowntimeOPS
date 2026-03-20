import type { DeviceType, PortType } from "@downtime-ops/shared";

export interface EquipmentTemplate {
  model: string;
  name: string;
  type: DeviceType;
  uHeight: number;
  cost: number;
  powerDrawWatts: number;
  heatOutput: number;
  ports: Array<{ type: PortType; count: number }>;
}

export const PORT_SPEED: Record<PortType, number> = {
  copper_1g: 1000,
  copper_10g: 10000,
  sfp_10g: 10000,
  sfp_25g: 25000,
  qsfp_40g: 40000,
};

export const EQUIPMENT_CATALOG: Record<string, EquipmentTemplate> = {
  server_1u: {
    model: "server_1u",
    name: "Basic 1U Server",
    type: "server",
    uHeight: 1,
    cost: 2000,
    powerDrawWatts: 300,
    heatOutput: 250,
    ports: [{ type: "copper_1g", count: 2 }],
  },
  switch_24p: {
    model: "switch_24p",
    name: "24-Port Gigabit Switch",
    type: "switch",
    uHeight: 1,
    cost: 1500,
    powerDrawWatts: 150,
    heatOutput: 100,
    ports: [{ type: "copper_1g", count: 24 }],
  },
  router_1u: {
    model: "router_1u",
    name: "Basic Router / Uplink Gateway",
    type: "router",
    uHeight: 1,
    cost: 3000,
    powerDrawWatts: 200,
    heatOutput: 150,
    ports: [{ type: "copper_1g", count: 4 }],
  },
};
