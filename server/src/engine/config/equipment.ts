import type { DeviceType, PortType } from "@downtime-ops/shared";

export interface EquipmentTemplate {
  model: string;
  name: string;
  brand: string;
  description: string;
  type: DeviceType;
  uHeight: number;
  cost: number;
  powerDrawWatts: number;
  heatOutput: number;
  ports: Array<{ type: PortType; count: number }>;
  /** Package box dimensions in pixels when shown in storage */
  packageSize: { w: number; h: number };
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
    brand: "NetCore",
    description: "Entry-level 1U compute node for small deployments. Dual gigabit NICs for redundant connectivity.",
    type: "server",
    uHeight: 1,
    cost: 2000,
    powerDrawWatts: 300,
    heatOutput: 250,
    ports: [{ type: "copper_1g", count: 2 }],
    packageSize: { w: 70, h: 45 },
  },
  switch_24p: {
    model: "switch_24p",
    name: "24-Port Gigabit Switch",
    brand: "SwitchTek",
    description: "Managed Layer 2 switch with 24 copper gigabit ports. Ideal for rack-level connectivity.",
    type: "switch",
    uHeight: 1,
    cost: 1500,
    powerDrawWatts: 150,
    heatOutput: 100,
    ports: [{ type: "copper_1g", count: 24 }],
    packageSize: { w: 75, h: 45 },
  },
  router_1u: {
    model: "router_1u",
    name: "Basic Router / Uplink Gateway",
    brand: "NetCore",
    description: "Edge router with 4 gigabit ports. Handles NAT, routing, and uplink to the internet.",
    type: "router",
    uHeight: 1,
    cost: 3000,
    powerDrawWatts: 200,
    heatOutput: 150,
    ports: [{ type: "copper_1g", count: 4 }],
    packageSize: { w: 60, h: 40 },
  },
};
