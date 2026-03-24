import type {
  GameState,
  Device,
  Port,
  CableType,
  Link,
  TracerPacket,
  RouterConfig,
  SwitchConfig,
  ServerConfig,
  TypedDeviceConfig,
  InterfaceConfig,
  Route,
} from "@downtime-ops/shared";
import type { ResolveBrowserTargetResult } from "@downtime-ops/shared";
import {
  isValidIp,
  isIpInSubnet,
  isNetworkAddress,
  isBroadcastAddress,
  subnetsOverlap,
} from "@downtime-ops/shared";
import { BALANCE } from "./config/balance";
import {
  EQUIPMENT_CATALOG,
  PORT_SPEED,
  type EquipmentTemplate,
} from "./config/equipment";
import { processTick } from "./simulation/tick";
import {
  createConnection,
  terminateConnection,
  reestablishConnections,
} from "./simulation/connectionEngine";
import {
  startTracer as startTracerSim,
  stepTracer as stepTracerSim,
} from "./simulation/tracer";
import { createInitialQuests } from "./simulation/quests";
import { createInitialMilestones } from "./simulation/milestones";
import { createInitialWorld } from "./world/worldFactory";
import {
  applyWorldAction,
  type WorldAction,
} from "./world/worldActions";

// --- Re-exports ---

export { BALANCE } from "./config/balance";
export { EQUIPMENT_CATALOG, PORT_SPEED } from "./config/equipment";
export { processTick } from "./simulation/tick";

// --- ID generation ---

function genId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

// --- Action types ---

export type Action =
  | { type: "PLACE_DEVICE"; rackId: string; slotU: number; model: string }
  | { type: "REMOVE_DEVICE"; deviceId: string }
  | { type: "UNINSTALL_DEVICE"; deviceId: string }
  | {
      type: "CONNECT_PORTS";
      deviceIdA: string;
      portIndexA: number;
      deviceIdB: string;
      portIndexB: number;
      cableType: CableType;
    }
  | { type: "DISCONNECT_PORTS"; linkId: string }
  | { type: "REPAIR_PORT"; deviceId: string; portIndex: number }
  | { type: "ACCEPT_CLIENT"; clientId: string }
  | { type: "REJECT_CLIENT"; clientId: string }
  | { type: "SET_SPEED"; speed: number }
  | { type: "SET_BROWSER_ZOOM"; zoomIndex: number }
  | { type: "CONFIGURE_INTERFACE"; deviceId: string; portIndex: number; ip: string | null; mask: number | null; enabled: boolean }
  | { type: "ADD_STATIC_ROUTE"; deviceId: string; destination: string; nextHop: string; metric: number }
  | { type: "REMOVE_ROUTE"; routeId: string }
  | { type: "SET_HOSTNAME"; deviceId: string; hostname: string }
  | { type: "CONFIGURE_VLAN"; vlanId: number; name: string }
  | { type: "REMOVE_VLAN"; vlanId: number }
  | { type: "SET_PORT_VLAN"; deviceId: string; portIndex: number; mode: "access" | "trunk"; accessVlan?: number; trunkAllowedVlans?: number[] }
  | { type: "CONFIGURE_SERVER_NETWORK"; deviceId: string; ip: string | null; mask: number | null; gateway: string | null }
  | { type: "TOGGLE_SERVICE"; deviceId: string; serviceIndex: number; enabled: boolean }
  | { type: "CONFIGURE_SWITCH_MANAGEMENT"; deviceId: string; managementIp: string | null; managementMask: number | null }
  | { type: "CREATE_SUBNET"; network: string; mask: number; name: string; vlanId: number | null }
  | { type: "DELETE_SUBNET"; subnetId: string }
  | { type: "ALLOCATE_IP"; subnetId: string; ip: string; deviceId: string | null; description: string }
  | { type: "RELEASE_IP"; subnetId: string; ip: string }
  | { type: "CONNECT_UPLINK"; deviceId: string; portIndex: number }
  | { type: "TICK" }
  | WorldAction;

export interface EngineResult {
  state: GameState;
  error?: string;
}

export interface TracerResult {
  packet: TracerPacket;
}

// --- State factory ---

let nextServerIp = 10;

export function createInitialState(): GameState {
  nextServerIp = 10;

  return {
    tick: 0,
    speed: 1,
    money: BALANCE.STARTING_MONEY,
    reputation: BALANCE.STARTING_REPUTATION,
    phase: 1,

    // No starter rack — player buys and places racks in the world
    racks: {},
    devices: {},
    links: {},
    vlans: {
      1: { id: 1, name: "default", color: "#666666", subnet: null },
    },
    routes: [],
    firewallRules: [],
    clients: {
      "client-starter": {
        id: "client-starter",
        name: "PicoApp",
        type: "startup",
        contract: {
          bandwidthMbps: 10,
          uptimeSla: 99.0,
          isolationRequired: false,
          dedicatedHardware: false,
          monthlyRevenue: 150,
          penaltyPerViolation: 100,
          durationMonths: 6,
        },
        satisfaction: 100,
        status: "prospect",
        flavor: "A two-person team building a recipe app. Your first potential client!",
        prospectTick: null, // starter client doesn't expire
      },
    },
    connections: {},

    alerts: [],
    log: [
      {
        id: genId("log"),
        tick: 0,
        message: "Welcome to DowntimeOPS! Place equipment in your rack to get started.",
        category: "system",
      },
    ],

    uplinks: [
      {
        id: genId("uplink"),
        name: "ISP Alpha",
        bandwidthMbps: 100,
        monthlyCost: BALANCE.UPLINK_MONTHLY_COST,
        status: "active",
        deviceId: "",
        portIndex: -1,
      },
    ],
    monthlyExpenses: 0,
    monthlyRevenue: 0,

    quests: createInitialQuests(),
    progression: createInitialMilestones(),

    world: createInitialWorld(),

    ipam: { subnets: {} },

    browserZoomIndex: 2, // 1.0x (index into [0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0])
  };
}

// --- Action dispatcher ---

export function applyAction(state: GameState, action: Action): EngineResult {
  switch (action.type) {
    case "PLACE_DEVICE":
      return placeDevice(state, action.rackId, action.slotU, action.model);
    case "REMOVE_DEVICE":
      return removeDevice(state, action.deviceId);
    case "UNINSTALL_DEVICE":
      return uninstallDevice(state, action.deviceId);
    case "CONNECT_PORTS":
      return connectPorts(
        state,
        action.deviceIdA,
        action.portIndexA,
        action.deviceIdB,
        action.portIndexB,
        action.cableType,
      );
    case "DISCONNECT_PORTS":
      return disconnectPorts(state, action.linkId);
    case "REPAIR_PORT":
      return repairPort(state, action.deviceId, action.portIndex);
    case "ACCEPT_CLIENT":
      return acceptClient(state, action.clientId);
    case "REJECT_CLIENT":
      return rejectClient(state, action.clientId);
    case "SET_SPEED":
      return setSpeed(state, action.speed);
    case "SET_BROWSER_ZOOM":
      return setBrowserZoom(state, action.zoomIndex);
    case "CONFIGURE_INTERFACE":
      return configureInterface(state, action.deviceId, action.portIndex, action.ip, action.mask, action.enabled);
    case "ADD_STATIC_ROUTE":
      return addStaticRoute(state, action.deviceId, action.destination, action.nextHop, action.metric);
    case "REMOVE_ROUTE":
      return removeRoute(state, action.routeId);
    case "SET_HOSTNAME":
      return setHostname(state, action.deviceId, action.hostname);
    case "CONFIGURE_VLAN":
      return configureVlan(state, action.vlanId, action.name);
    case "REMOVE_VLAN":
      return removeVlanAction(state, action.vlanId);
    case "SET_PORT_VLAN":
      return setPortVlan(state, action.deviceId, action.portIndex, action.mode, action.accessVlan, action.trunkAllowedVlans);
    case "CONFIGURE_SERVER_NETWORK":
      return configureServerNetwork(state, action.deviceId, action.ip, action.mask, action.gateway);
    case "TOGGLE_SERVICE":
      return toggleService(state, action.deviceId, action.serviceIndex, action.enabled);
    case "CONFIGURE_SWITCH_MANAGEMENT":
      return configureSwitchManagement(state, action.deviceId, action.managementIp, action.managementMask);
    case "CREATE_SUBNET":
      return createSubnet(state, action.network, action.mask, action.name, action.vlanId);
    case "DELETE_SUBNET":
      return deleteSubnet(state, action.subnetId);
    case "ALLOCATE_IP":
      return allocateIp(state, action.subnetId, action.ip, action.deviceId, action.description);
    case "RELEASE_IP":
      return releaseIp(state, action.subnetId, action.ip);
    case "CONNECT_UPLINK":
      return connectUplink(state, action.deviceId, action.portIndex);
    case "TICK":
      return { state: processTick(state) };

    // World actions
    case "MOVE_PLAYER":
    case "ENTER_DOOR":
    case "EDGE_EXIT":
    case "BUY_ITEM":
    case "PICKUP_ITEM":
    case "DROP_ITEM":
    case "PLACE_RACK":
    case "PICKUP_FROM_STORAGE":
      return applyWorldAction(state, action);

    case "INSTALL_DEVICE":
    case "INSTALL_DEVICE_FROM_STORAGE": {
      // First validate & update world state
      const worldResult = applyWorldAction(state, action);
      if (worldResult.error) return worldResult;

      // Then chain with PLACE_DEVICE to create the simulation-layer device
      const rackItem = state.world.items[action.rackItemId];
      if (!rackItem?.installedInRackId) {
        return { state, error: "Rack not found" };
      }
      const item = state.world.items[action.itemId];
      if (!item) return { state, error: "Item not found" };

      return placeDevice(
        worldResult.state,
        rackItem.installedInRackId,
        action.slotU,
        item.model,
        true, // skipCost — already paid at shop
      );
    }

    default: {
      const _exhaustive: never = action;
      return { state, error: `Unknown action type: ${(_exhaustive as { type: string }).type}` };
    }
  }
}

// --- Tracer (separate from game state actions) ---

export function createTracer(
  state: GameState,
  params: {
    srcIp: string;
    dstIp: string;
    protocol: string;
    srcPort: number;
    dstPort: number;
  },
): TracerResult {
  return { packet: startTracerSim(state, params) };
}

export function advanceTracer(
  state: GameState,
  packet: TracerPacket,
): TracerResult {
  return { packet: stepTracerSim(state, packet) };
}

// --- Action handlers ---

function createDeviceConfig(
  template: EquipmentTemplate,
  ports: Port[],
): TypedDeviceConfig {
  switch (template.type) {
    case "router": {
      const interfaces: Record<number, { ip: string | null; mask: number | null; enabled: boolean; description: string }> = {};
      for (let i = 0; i < ports.length; i++) {
        // Auto-assign suggested IP on first interface for guided setup
        const suggestedIp = i === 0 ? "10.0.0.1" : null;
        const suggestedMask = i === 0 ? 24 : null;
        interfaces[i] = { ip: suggestedIp, mask: suggestedMask, enabled: true, description: "" };
      }
      return { hostname: template.name, interfaces } satisfies RouterConfig;
    }
    case "server": {
      const ip = `10.0.0.${nextServerIp}`;
      nextServerIp++;
      return { hostname: template.name, ip, mask: 24, gateway: "10.0.0.1", services: [] } satisfies ServerConfig;
    }
    case "switch":
      return { hostname: template.name, managementIp: null, managementMask: null } satisfies SwitchConfig;
    default:
      return {};
  }
}

function createPorts(
  deviceId: string,
  template: EquipmentTemplate,
): Port[] {
  const ports: Port[] = [];
  let index = 0;

  for (const spec of template.ports) {
    for (let i = 0; i < spec.count; i++) {
      ports.push({
        id: `${deviceId}-p${index}`,
        deviceId,
        index,
        type: spec.type,
        status: "up",
        linkId: null,
        speed: PORT_SPEED[spec.type],
        vlanMode: "access",
        accessVlan: 1,
        trunkAllowedVlans: [],
        txBps: 0,
        rxBps: 0,
        txErrors: 0,
        rxErrors: 0,
      });
      index++;
    }
  }

  return ports;
}

function placeDevice(
  state: GameState,
  rackId: string,
  slotU: number,
  model: string,
  skipCost = false,
): EngineResult {
  const template = EQUIPMENT_CATALOG[model];
  if (!template) return { state, error: `Unknown equipment model: ${model}` };

  const rack = state.racks[rackId];
  if (!rack) return { state, error: `Rack ${rackId} not found` };

  // Check slot availability
  for (let u = slotU; u < slotU + template.uHeight; u++) {
    if (u < 1 || u > rack.totalU) {
      return { state, error: `Slot ${u} is out of range (1-${rack.totalU})` };
    }
    if (rack.devices[u]) {
      return { state, error: `Slot ${u} is occupied` };
    }
  }

  // Check power budget
  if (rack.currentPowerWatts + template.powerDrawWatts > rack.powerBudgetWatts) {
    return { state, error: "Insufficient power budget" };
  }

  // Check money (skip when installing from inventory — already paid at shop)
  if (!skipCost && state.money < template.cost) {
    return { state, error: "Not enough money" };
  }

  const deviceId = genId("dev");
  const ports = createPorts(deviceId, template);
  const config = createDeviceConfig(template, ports);

  const device: Device = {
    id: deviceId,
    type: template.type,
    name: template.name,
    model: template.model,
    uHeight: template.uHeight,
    rackId,
    slotU,
    ports,
    powerDrawWatts: template.powerDrawWatts,
    heatOutput: template.heatOutput,
    status: "online",
    health: 100,
    config,
  };

  // Build new rack devices record
  const newRackDevices = { ...rack.devices };
  for (let u = slotU; u < slotU + template.uHeight; u++) {
    newRackDevices[u] = device;
  }

  const newState: GameState = {
    ...state,
    money: skipCost ? state.money : state.money - template.cost,
    devices: { ...state.devices, [deviceId]: device },
    racks: {
      ...state.racks,
      [rackId]: {
        ...rack,
        devices: newRackDevices,
        currentPowerWatts: rack.currentPowerWatts + template.powerDrawWatts,
      },
    },
    log: [
      ...state.log,
      {
        id: genId("log"),
        tick: state.tick,
        message: `Placed ${template.name} in ${rack.name} at U${slotU}`,
        category: "system",
      },
    ],
  };

  return { state: newState };
}

function removeDevice(state: GameState, deviceId: string): EngineResult {
  const device = state.devices[deviceId];
  if (!device) return { state, error: "Device not found" };

  let newState = state;

  // Disconnect all links on this device
  for (const port of device.ports) {
    if (port.linkId) {
      const result = disconnectPorts(newState, port.linkId);
      newState = result.state;
    }
  }

  // Remove from rack
  const rack = newState.racks[device.rackId];
  if (rack) {
    const newRackDevices = { ...rack.devices };
    for (let u = device.slotU; u < device.slotU + device.uHeight; u++) {
      delete newRackDevices[u];
    }
    newState = {
      ...newState,
      racks: {
        ...newState.racks,
        [device.rackId]: {
          ...rack,
          devices: newRackDevices,
          currentPowerWatts: rack.currentPowerWatts - device.powerDrawWatts,
        },
      },
    };
  }

  // Remove device
  const { [deviceId]: _removed, ...remainingDevices } = newState.devices;

  // Clear uplink reference if this was the router
  let newUplinks = newState.uplinks;
  if (device.type === "router") {
    newUplinks = newState.uplinks.map((u) =>
      u.deviceId === deviceId ? { ...u, deviceId: "", portIndex: -1 } : u,
    );
  }

  // Clear IPAM allocation references to this device
  const cleanedIpamSubnets: Record<string, typeof newState.ipam.subnets[string]> = {};
  for (const [sid, subnet] of Object.entries(newState.ipam.subnets)) {
    const cleanedAllocations: Record<string, typeof subnet.allocations[string]> = {};
    let changed = false;
    for (const [ip, alloc] of Object.entries(subnet.allocations)) {
      if (alloc.deviceId === deviceId) {
        cleanedAllocations[ip] = { ...alloc, deviceId: null };
        changed = true;
      } else {
        cleanedAllocations[ip] = alloc;
      }
    }
    cleanedIpamSubnets[sid] = changed ? { ...subnet, allocations: cleanedAllocations } : subnet;
  }

  return {
    state: {
      ...newState,
      devices: remainingDevices,
      uplinks: newUplinks,
      ipam: { ...newState.ipam, subnets: cleanedIpamSubnets },
      log: [
        ...newState.log,
        {
          id: genId("log"),
          tick: state.tick,
          message: `Removed ${device.name}`,
          category: "system",
        },
      ],
    },
  };
}

function uninstallDevice(state: GameState, deviceId: string): EngineResult {
  const device = state.devices[deviceId];
  if (!device) return { state, error: "Device not found" };

  const worldItemEntry = Object.entries(state.world.items).find(([, item]) =>
    item.kind === "device" &&
    item.state === "installed" &&
    item.model === device.model &&
    item.installedInRackId === device.rackId &&
    item.installedAtSlotU === device.slotU,
  );
  if (!worldItemEntry) {
    return { state, error: "Installed world item not found" };
  }

  const [itemId, worldItem] = worldItemEntry;
  const removedResult = removeDevice(state, deviceId);
  if (removedResult.error) return removedResult;

  const nextState = removedResult.state;
  const storageRoom = nextState.world.rooms.storage;
  const updatedZones = storageRoom ? { ...storageRoom.placementZones } : {};

  let shelfAssigned = false;
  for (const [zoneId, zone] of Object.entries(updatedZones)) {
    if (zone.kind === "storage_shelf" && !zone.occupiedByItemId) {
      updatedZones[zoneId] = { ...zone, occupiedByItemId: itemId };
      shelfAssigned = true;
      break;
    }
  }

  return {
    state: {
      ...nextState,
      world: {
        ...nextState.world,
        items: {
          ...nextState.world.items,
          [itemId]: {
            ...worldItem,
            state: "in_storage",
            roomId: "storage",
            position: null,
            installedInRackId: null,
            installedAtSlotU: null,
            rackSlotIndex: null,
          },
        },
        storage: {
          packages: {
            ...nextState.world.storage.packages,
            [itemId]: { itemId, purchasedAt: nextState.tick },
          },
        },
        rooms: storageRoom
          ? {
              ...nextState.world.rooms,
              storage: {
                ...storageRoom,
                placementZones: updatedZones,
              },
            }
          : nextState.world.rooms,
      },
      log: [
        ...nextState.log,
        {
          id: genId("log"),
          tick: nextState.tick,
          message: shelfAssigned
            ? `Returned ${device.name} to storage`
            : `Returned ${device.name} to storage queue`,
          category: "system",
        },
      ],
    },
  };
}

/** Determine the right cable type for a pair of port types */
function resolveCableType(portTypeA: string, portTypeB: string): CableType {
  // If either port is fiber, use fiber cable
  if (portTypeA.startsWith("sfp") || portTypeA.startsWith("qsfp") ||
      portTypeB.startsWith("sfp") || portTypeB.startsWith("qsfp")) {
    // High-speed fiber uses OS2, lower uses OM3
    if (portTypeA === "qsfp_40g" || portTypeB === "qsfp_40g" ||
        portTypeA === "sfp_25g" || portTypeB === "sfp_25g") {
      return "os2_fiber";
    }
    return "om3_fiber";
  }
  // Copper ports: 10G uses Cat6a, 1G uses Cat6
  if (portTypeA === "copper_10g" || portTypeB === "copper_10g") {
    return "cat6a";
  }
  return "cat6";
}

function connectPorts(
  state: GameState,
  deviceIdA: string,
  portIndexA: number,
  deviceIdB: string,
  portIndexB: number,
  _cableType: CableType,
): EngineResult {
  const devA = state.devices[deviceIdA];
  const devB = state.devices[deviceIdB];
  if (!devA) return { state, error: `Device ${deviceIdA} not found` };
  if (!devB) return { state, error: `Device ${deviceIdB} not found` };

  const portA = devA.ports[portIndexA];
  const portB = devB.ports[portIndexB];
  if (!portA) return { state, error: `Port ${portIndexA} not found on ${devA.name}` };
  if (!portB) return { state, error: `Port ${portIndexB} not found on ${devB.name}` };

  if (portA.linkId) return { state, error: `Port ${portIndexA} on ${devA.name} is already connected` };
  if (portB.linkId) return { state, error: `Port ${portIndexB} on ${devB.name} is already connected` };

  // Auto-resolve the appropriate cable type based on port types
  const resolvedCable = resolveCableType(portA.type, portB.type);

  // Check cable stock
  if (state.world.cableStock[resolvedCable] <= 0) {
    const cableNames: Record<CableType, string> = {
      cat6: "Cat6",
      cat6a: "Cat6a",
      om3_fiber: "OM3 Fiber",
      os2_fiber: "OS2 Fiber",
    };
    return { state, error: `No ${cableNames[resolvedCable]} cables in stock — buy from shop` };
  }

  const linkId = genId("link");
  const maxBandwidth = Math.min(
    PORT_SPEED[portA.type],
    PORT_SPEED[portB.type],
  );

  const link: Link = {
    id: linkId,
    type: resolvedCable,
    portA: { deviceId: deviceIdA, portIndex: portIndexA },
    portB: { deviceId: deviceIdB, portIndex: portIndexB },
    maxBandwidthMbps: maxBandwidth,
    currentLoadMbps: 0,
    activeConnectionIds: [],
    status: "active",
    lengthMeters: 1,
  };

  // Update ports with linkId
  const newPortsA = devA.ports.map((p, i) =>
    i === portIndexA ? { ...p, linkId } : p,
  );
  const newPortsB = devB.ports.map((p, i) =>
    i === portIndexB ? { ...p, linkId } : p,
  );

  // Consume one cable from stock
  const newCableStock = {
    ...state.world.cableStock,
    [resolvedCable]: state.world.cableStock[resolvedCable] - 1,
  };

  let newState: GameState = {
    ...state,
    links: { ...state.links, [linkId]: link },
    devices: {
      ...state.devices,
      [deviceIdA]: { ...devA, ports: newPortsA },
      [deviceIdB]: { ...devB, ports: newPortsB },
    },
    world: {
      ...state.world,
      cableStock: newCableStock,
    },
  };

  // Try to re-establish terminated connections
  newState = reestablishConnections(newState);

  return { state: newState };
}

function disconnectPorts(state: GameState, linkId: string): EngineResult {
  const link = state.links[linkId];
  if (!link) return { state, error: `Link ${linkId} not found` };

  let newState = state;

  // Terminate all connections on this link
  for (const connId of link.activeConnectionIds) {
    newState = terminateConnection(newState, connId);
  }

  // Clear linkId on both ports
  const devA = newState.devices[link.portA.deviceId];
  const devB = newState.devices[link.portB.deviceId];

  const newDevices = { ...newState.devices };
  if (devA) {
    newDevices[devA.id] = {
      ...devA,
      ports: devA.ports.map((p, i) =>
        i === link.portA.portIndex ? { ...p, linkId: null } : p,
      ),
    };
  }
  if (devB) {
    // Re-read devB in case it's the same device (loopback cable)
    const currentDevB = newDevices[link.portB.deviceId] || devB;
    newDevices[currentDevB.id] = {
      ...currentDevB,
      ports: currentDevB.ports.map((p, i) =>
        i === link.portB.portIndex ? { ...p, linkId: null } : p,
      ),
    };
  }

  // Remove link
  const { [linkId]: _removedLink, ...remainingLinks } = newState.links;

  return {
    state: {
      ...newState,
      devices: newDevices,
      links: remainingLinks,
    },
  };
}

function repairPort(
  state: GameState,
  deviceId: string,
  portIndex: number,
): EngineResult {
  const device = state.devices[deviceId];
  if (!device) return { state, error: "Device not found" };

  const port = device.ports[portIndex];
  if (!port) return { state, error: `Port ${portIndex} not found` };
  if (port.status === "up") return { state, error: "Port is already up" };

  if (state.money < BALANCE.REPAIR_COST) {
    return { state, error: "Not enough money for repair" };
  }

  const newPorts = device.ports.map((p, i) =>
    i === portIndex ? { ...p, status: "up" as const } : p,
  );

  let newState: GameState = {
    ...state,
    money: state.money - BALANCE.REPAIR_COST,
    devices: {
      ...state.devices,
      [deviceId]: { ...device, ports: newPorts },
    },
    log: [
      ...state.log,
      {
        id: genId("log"),
        tick: state.tick,
        message: `Repaired port ${portIndex} on ${device.name}`,
        category: "network",
      },
    ],
  };

  // Try to re-establish connections
  newState = reestablishConnections(newState);

  // Mark first_incident_resolved milestone if we have active clients
  const hasActiveClients = Object.values(newState.clients).some(
    (c) => c.status === "active" || c.status === "warning",
  );
  if (hasActiveClients) {
    const milestones = newState.progression.milestones.map((m) =>
      m.id === "first_incident_resolved" && !m.completed
        ? { ...m, completed: true, completedAtTick: newState.tick }
        : m,
    );
    if (milestones !== newState.progression.milestones) {
      newState = {
        ...newState,
        progression: { ...newState.progression, milestones },
      };
    }
  }

  return { state: newState };
}

function connectUplink(state: GameState, deviceId: string, portIndex: number): EngineResult {
  const device = state.devices[deviceId];
  if (!device) return { state, error: "Device not found" };
  if (device.type !== "router") return { state, error: "Only routers can connect to an uplink" };
  if (portIndex !== 0) return { state, error: "Uplink must connect to WAN port (port 0)" };

  const port = device.ports[portIndex];
  if (!port) return { state, error: "Port not found" };
  if (port.linkId) return { state, error: "Port is already connected" };

  // Find first unconnected uplink
  const uplinkIndex = state.uplinks.findIndex(
    (u) => u.status === "active" && (u.deviceId === "" || u.deviceId === "device-isp-demarc"),
  );
  if (uplinkIndex === -1) return { state, error: "No available uplink" };

  const uplink = state.uplinks[uplinkIndex];

  // Ensure ISP demarc device exists
  let devices = state.devices;
  const demarcId = "device-isp-demarc";
  if (!devices[demarcId]) {
    devices = {
      ...devices,
      [demarcId]: {
        id: demarcId,
        type: "patch_panel",
        name: "ISP Alpha - Wall Jack",
        model: "isp_demarc",
        uHeight: 0,
        rackId: "",
        slotU: -1,
        powerDrawWatts: 0,
        heatOutput: 0,
        status: "online",
        ports: [{
          id: `${demarcId}-p0`, deviceId: demarcId, index: 0, type: "copper_1g",
          status: "up", linkId: null, speed: 1000,
          vlanMode: "access", accessVlan: 1, trunkAllowedVlans: [],
          txBps: 0, rxBps: 0, txErrors: 0, rxErrors: 0,
        }],
        health: 100,
        config: {},
      } satisfies Device,
    };
  }

  const demarcDevice = devices[demarcId];
  const demarcPort = demarcDevice.ports[0];
  if (demarcPort.linkId) return { state, error: "ISP demarc port is already connected" };

  // Create link between demarc port 0 and router WAN port 0
  const linkId = genId("link");
  const link: Link = {
    id: linkId,
    type: "cat6",
    portA: { deviceId: demarcId, portIndex: 0 },
    portB: { deviceId: deviceId, portIndex: 0 },
    maxBandwidthMbps: Math.min(uplink.bandwidthMbps, port.speed),
    currentLoadMbps: 0,
    activeConnectionIds: [],
    status: "active",
    lengthMeters: 5,
  };

  // Update ports with linkId
  const updatedDemarc: Device = {
    ...demarcDevice,
    ports: demarcDevice.ports.map((p, i) =>
      i === 0 ? { ...p, linkId } : p,
    ),
  };

  const updatedRouter: Device = {
    ...device,
    ports: device.ports.map((p, i) =>
      i === portIndex ? { ...p, linkId } : p,
    ),
  };

  // Update uplink to point to the router
  const newUplinks = state.uplinks.map((u, i) =>
    i === uplinkIndex ? { ...u, deviceId: deviceId, portIndex: 0 } : u,
  );

  return {
    state: {
      ...state,
      devices: {
        ...devices,
        [demarcId]: updatedDemarc,
        [deviceId]: updatedRouter,
      },
      links: { ...state.links, [linkId]: link },
      uplinks: newUplinks,
      log: [
        ...state.log,
        {
          id: genId("log"),
          tick: state.tick,
          message: `Connected ISP uplink (${uplink.name}) to ${device.name} WAN port`,
          category: "network",
        },
      ],
    },
  };
}

function acceptClient(state: GameState, clientId: string): EngineResult {
  const client = state.clients[clientId];
  if (!client) return { state, error: "Client not found" };
  if (client.status !== "prospect") {
    return { state, error: "Client is not a prospect" };
  }

  // Require an active uplink connected to a router
  const hasActiveUplink = state.uplinks.some(
    (u) => u.status === "active" && u.deviceId !== "" && u.deviceId !== "device-isp-demarc",
  );
  if (!hasActiveUplink) {
    return { state, error: "No active internet uplink connected. Connect the ISP cable to your router's WAN port first." };
  }

  let newState: GameState = {
    ...state,
    clients: {
      ...state.clients,
      [clientId]: { ...client, status: "active", satisfaction: 100 },
    },
    log: [
      ...state.log,
      {
        id: genId("log"),
        tick: state.tick,
        message: `Accepted client: ${client.name} (${client.contract.bandwidthMbps} Mbps, $${client.contract.monthlyRevenue}/mo)`,
        category: "client",
      },
    ],
  };

  // Create connections for the client
  const numConnections = Math.max(
    1,
    Math.ceil(client.contract.bandwidthMbps / BALANCE.BANDWIDTH_PER_CONNECTION),
  );
  const bwPerConn = client.contract.bandwidthMbps / numConnections;

  for (let i = 0; i < numConnections; i++) {
    const result = createConnection(newState, clientId, bwPerConn);
    newState = result.state;
  }

  return { state: newState };
}

function rejectClient(state: GameState, clientId: string): EngineResult {
  const client = state.clients[clientId];
  if (!client) return { state, error: "Client not found" };
  if (client.status !== "prospect") {
    return { state, error: "Client is not a prospect" };
  }

  const { [clientId]: _removed, ...remainingClients } = state.clients;

  return {
    state: {
      ...state,
      clients: remainingClients,
      reputation: Math.max(0, state.reputation - BALANCE.REJECTION_REPUTATION_PENALTY),
      log: [
        ...state.log,
        {
          id: genId("log"),
          tick: state.tick,
          message: `Rejected prospect: ${client.name}`,
          category: "client",
        },
      ],
    },
  };
}

function setSpeed(state: GameState, speed: number): EngineResult {
  if (![0, 1, 2, 3].includes(speed)) {
    return { state, error: "Speed must be 0, 1, 2, or 3" };
  }
  return { state: { ...state, speed } };
}

function setBrowserZoom(state: GameState, zoomIndex: number): EngineResult {
  if (!Number.isInteger(zoomIndex) || zoomIndex < 0 || zoomIndex > 7) {
    return { state, error: "Invalid zoom index" };
  }
  return { state: { ...state, browserZoomIndex: zoomIndex } };
}

// --- Device configuration handlers ---

/** Check if an IP conflicts with any device (excluding excludeDeviceId) */
function hasIpConflict(state: GameState, ip: string, excludeDeviceId: string): Device | null {
  for (const dev of Object.values(state.devices)) {
    if (dev.id === excludeDeviceId) continue;
    const cfg = dev.config;
    if ("interfaces" in cfg) {
      const ifaces = cfg.interfaces as Record<number, InterfaceConfig>;
      for (const iface of Object.values(ifaces)) {
        if (iface.ip === ip) return dev;
      }
    }
    if ("ip" in cfg && cfg.ip === ip) return dev;
    if ("managementIp" in cfg && cfg.managementIp === ip) return dev;
  }
  return null;
}

function configureInterface(
  state: GameState,
  deviceId: string,
  portIndex: number,
  ip: string | null,
  mask: number | null,
  enabled: boolean,
): EngineResult {
  const device = state.devices[deviceId];
  if (!device) return { state, error: "Device not found" };

  if (device.type !== "router" && device.type !== "firewall") {
    return { state, error: `${device.type} does not support interface configuration` };
  }

  if (portIndex < 0 || portIndex >= device.ports.length) {
    return { state, error: `Port index ${portIndex} out of range` };
  }

  if (ip !== null) {
    if (!isValidIp(ip)) return { state, error: `Invalid IP address: ${ip}` };
    if (mask === null || mask < 0 || mask > 32) return { state, error: `Invalid subnet mask: ${mask}` };

    // Check for IP conflicts (another device already has this IP)
    const conflict = hasIpConflict(state, ip, deviceId);
    if (conflict) return { state, error: `IP ${ip} is already assigned to ${conflict.name}` };
  }

  const routerCfg = device.config as RouterConfig;
  const newInterfaces = { ...routerCfg.interfaces };
  newInterfaces[portIndex] = {
    ip,
    mask,
    enabled,
    description: newInterfaces[portIndex]?.description ?? "",
  };

  const newConfig: RouterConfig = { ...routerCfg, interfaces: newInterfaces };

  return {
    state: {
      ...state,
      devices: {
        ...state.devices,
        [deviceId]: { ...device, config: newConfig },
      },
      log: [
        ...state.log,
        {
          id: genId("log"),
          tick: state.tick,
          message: ip
            ? `Configured ${device.name} port ${portIndex}: ${ip}/${mask}`
            : `Cleared IP on ${device.name} port ${portIndex}`,
          category: "network",
        },
      ],
    },
  };
}

function addStaticRoute(
  state: GameState,
  deviceId: string,
  destination: string,
  nextHop: string,
  metric: number,
): EngineResult & { routeId?: string } {
  const device = state.devices[deviceId];
  if (!device) return { state, error: "Device not found" };

  if (device.type !== "router" && device.type !== "firewall") {
    return { state, error: `${device.type} does not support routing` };
  }

  // Validate CIDR destination
  const cidrParts = destination.split("/");
  if (cidrParts.length !== 2 || !isValidIp(cidrParts[0])) {
    return { state, error: `Invalid destination CIDR: ${destination}` };
  }
  const cidrMask = Number(cidrParts[1]);
  if (!Number.isInteger(cidrMask) || cidrMask < 0 || cidrMask > 32) {
    return { state, error: `Invalid destination mask: ${destination}` };
  }

  if (!isValidIp(nextHop)) {
    return { state, error: `Invalid next hop: ${nextHop}` };
  }

  const routeId = genId("route");
  const route: Route = {
    id: routeId,
    deviceId,
    destination,
    nextHop,
    interface: "",
    metric: metric || 1,
    source: "static",
  };

  return {
    state: {
      ...state,
      routes: [...state.routes, route],
      log: [
        ...state.log,
        {
          id: genId("log"),
          tick: state.tick,
          message: `Added route on ${device.name}: ${destination} via ${nextHop}`,
          category: "network",
        },
      ],
    },
    routeId,
  };
}

function removeRoute(state: GameState, routeId: string): EngineResult {
  const route = state.routes.find((r) => r.id === routeId);
  if (!route) return { state, error: "Route not found" };
  if (route.source !== "static") return { state, error: "Can only remove static routes" };

  return {
    state: {
      ...state,
      routes: state.routes.filter((r) => r.id !== routeId),
      log: [
        ...state.log,
        {
          id: genId("log"),
          tick: state.tick,
          message: `Removed route: ${route.destination} via ${route.nextHop}`,
          category: "network",
        },
      ],
    },
  };
}

function setHostname(
  state: GameState,
  deviceId: string,
  hostname: string,
): EngineResult {
  const device = state.devices[deviceId];
  if (!device) return { state, error: "Device not found" };

  if (!hostname || hostname.length > 64) {
    return { state, error: "Hostname must be 1-64 characters" };
  }

  const cfg = device.config;
  if (!("hostname" in cfg)) {
    return { state, error: `${device.type} does not support hostname configuration` };
  }

  const newConfig = { ...cfg, hostname } as TypedDeviceConfig;

  return {
    state: {
      ...state,
      devices: {
        ...state.devices,
        [deviceId]: { ...device, name: hostname, config: newConfig },
      },
    },
  };
}

// --- Phase 2: VLAN, switch, server configuration handlers ---

/** Deterministic color from VLAN ID */
function vlanColor(vlanId: number): string {
  const hue = (vlanId * 137) % 360;
  return `hsl(${hue}, 50%, 45%)`;
}

function configureVlan(
  state: GameState,
  vlanId: number,
  name: string,
): EngineResult {
  if (!Number.isInteger(vlanId) || vlanId < 1 || vlanId > 4094) {
    return { state, error: "VLAN ID must be 1-4094" };
  }
  if (!name || name.length > 32) {
    return { state, error: "VLAN name must be 1-32 characters" };
  }

  const existing = state.vlans[vlanId];
  const vlan = existing
    ? { ...existing, name }
    : { id: vlanId, name, color: vlanColor(vlanId), subnet: null };

  return {
    state: {
      ...state,
      vlans: { ...state.vlans, [vlanId]: vlan },
      log: [
        ...state.log,
        {
          id: genId("log"),
          tick: state.tick,
          message: existing
            ? `Renamed VLAN ${vlanId} to "${name}"`
            : `Created VLAN ${vlanId} "${name}"`,
          category: "network",
        },
      ],
    },
  };
}

function removeVlanAction(state: GameState, vlanId: number): EngineResult {
  if (vlanId === 1) return { state, error: "Cannot delete default VLAN 1" };
  if (!state.vlans[vlanId]) return { state, error: `VLAN ${vlanId} not found` };

  const { [vlanId]: _removed, ...remainingVlans } = state.vlans;

  // Cascade: reset ports referencing this VLAN
  const newDevices = { ...state.devices };
  for (const dev of Object.values(state.devices)) {
    if (dev.type !== "switch") continue;
    let portsChanged = false;
    const newPorts = dev.ports.map((port) => {
      if (port.vlanMode === "access" && port.accessVlan === vlanId) {
        portsChanged = true;
        return { ...port, accessVlan: 1 };
      }
      if (port.vlanMode === "trunk" && port.trunkAllowedVlans.includes(vlanId)) {
        portsChanged = true;
        const filtered = port.trunkAllowedVlans.filter((v) => v !== vlanId);
        if (filtered.length === 0) {
          // No VLANs left on trunk — reset to access mode on VLAN 1
          return { ...port, vlanMode: "access" as const, accessVlan: 1, trunkAllowedVlans: [] };
        }
        return { ...port, trunkAllowedVlans: filtered };
      }
      return port;
    });
    if (portsChanged) {
      newDevices[dev.id] = { ...dev, ports: newPorts };
    }
  }

  // Cascade: clear vlanId on IPAM subnets referencing this VLAN
  const newIpamSubnets = { ...state.ipam.subnets };
  for (const [sid, subnet] of Object.entries(newIpamSubnets)) {
    if (subnet.vlanId === vlanId) {
      newIpamSubnets[sid] = { ...subnet, vlanId: null };
    }
  }

  return {
    state: {
      ...state,
      vlans: remainingVlans,
      devices: newDevices,
      ipam: { ...state.ipam, subnets: newIpamSubnets },
      log: [
        ...state.log,
        {
          id: genId("log"),
          tick: state.tick,
          message: `Deleted VLAN ${vlanId}`,
          category: "network",
        },
      ],
    },
  };
}

function setPortVlan(
  state: GameState,
  deviceId: string,
  portIndex: number,
  mode: "access" | "trunk",
  accessVlan?: number,
  trunkAllowedVlans?: number[],
): EngineResult {
  const device = state.devices[deviceId];
  if (!device) return { state, error: "Device not found" };
  if (device.type !== "switch") return { state, error: "Only switches support port VLAN configuration" };

  if (portIndex < 0 || portIndex >= device.ports.length) {
    return { state, error: `Port index ${portIndex} out of range` };
  }

  if (mode === "access") {
    const vlan = accessVlan ?? 1;
    if (!state.vlans[vlan]) return { state, error: `VLAN ${vlan} does not exist` };

    const newPorts = device.ports.map((p, i) =>
      i === portIndex ? { ...p, vlanMode: "access" as const, accessVlan: vlan, trunkAllowedVlans: [] } : p,
    );
    return {
      state: {
        ...state,
        devices: { ...state.devices, [deviceId]: { ...device, ports: newPorts } },
        log: [
          ...state.log,
          {
            id: genId("log"),
            tick: state.tick,
            message: `Set ${device.name} port ${portIndex} to access VLAN ${vlan}`,
            category: "network",
          },
        ],
      },
    };
  }

  // Trunk mode
  const allowed = trunkAllowedVlans ?? [1];
  for (const v of allowed) {
    if (!state.vlans[v]) return { state, error: `VLAN ${v} does not exist` };
  }

  const newPorts = device.ports.map((p, i) =>
    i === portIndex ? { ...p, vlanMode: "trunk" as const, accessVlan: 1, trunkAllowedVlans: allowed } : p,
  );
  return {
    state: {
      ...state,
      devices: { ...state.devices, [deviceId]: { ...device, ports: newPorts } },
      log: [
        ...state.log,
        {
          id: genId("log"),
          tick: state.tick,
          message: `Set ${device.name} port ${portIndex} to trunk (VLANs: ${allowed.join(", ")})`,
          category: "network",
        },
      ],
    },
  };
}

function configureServerNetwork(
  state: GameState,
  deviceId: string,
  ip: string | null,
  mask: number | null,
  gateway: string | null,
): EngineResult {
  const device = state.devices[deviceId];
  if (!device) return { state, error: "Device not found" };
  if (device.type !== "server") return { state, error: "Only servers support network configuration" };

  if (ip !== null) {
    if (!isValidIp(ip)) return { state, error: `Invalid IP address: ${ip}` };
    if (mask === null || mask < 0 || mask > 32) return { state, error: `Invalid subnet mask: ${mask}` };

    const conflict = hasIpConflict(state, ip, deviceId);
    if (conflict) return { state, error: `IP ${ip} is already assigned to ${conflict.name}` };
  }

  if (gateway !== null) {
    if (!isValidIp(gateway)) return { state, error: `Invalid gateway: ${gateway}` };
    if (ip === null || mask === null) return { state, error: "IP and mask must be set before configuring a gateway" };
    if (gateway === ip) return { state, error: "Gateway cannot be the same as server IP" };
  }

  const serverCfg = device.config as ServerConfig;
  const newConfig: ServerConfig = { ...serverCfg, ip, mask, gateway };

  return {
    state: {
      ...state,
      devices: {
        ...state.devices,
        [deviceId]: { ...device, config: newConfig },
      },
      log: [
        ...state.log,
        {
          id: genId("log"),
          tick: state.tick,
          message: ip
            ? `Configured ${device.name} network: ${ip}/${mask}${gateway ? ` gw ${gateway}` : ""}`
            : `Cleared network config on ${device.name}`,
          category: "network",
        },
      ],
    },
  };
}

function toggleService(
  state: GameState,
  deviceId: string,
  serviceIndex: number,
  enabled: boolean,
): EngineResult {
  const device = state.devices[deviceId];
  if (!device) return { state, error: "Device not found" };
  if (device.type !== "server") return { state, error: "Only servers have services" };

  const serverCfg = device.config as ServerConfig;
  if (serviceIndex < 0 || serviceIndex >= serverCfg.services.length) {
    return { state, error: `Service index ${serviceIndex} out of range` };
  }

  const newServices = serverCfg.services.map((s, i) =>
    i === serviceIndex ? { ...s, enabled } : s,
  );
  const newConfig: ServerConfig = { ...serverCfg, services: newServices };

  return {
    state: {
      ...state,
      devices: {
        ...state.devices,
        [deviceId]: { ...device, config: newConfig },
      },
      log: [
        ...state.log,
        {
          id: genId("log"),
          tick: state.tick,
          message: `${enabled ? "Enabled" : "Disabled"} ${serverCfg.services[serviceIndex].name} on ${device.name}`,
          category: "network",
        },
      ],
    },
  };
}

function configureSwitchManagement(
  state: GameState,
  deviceId: string,
  managementIp: string | null,
  managementMask: number | null,
): EngineResult {
  const device = state.devices[deviceId];
  if (!device) return { state, error: "Device not found" };
  if (device.type !== "switch") return { state, error: "Only switches support management IP configuration" };

  if (managementIp !== null) {
    if (!isValidIp(managementIp)) return { state, error: `Invalid IP address: ${managementIp}` };
    if (managementMask === null || managementMask < 0 || managementMask > 32) {
      return { state, error: `Invalid subnet mask: ${managementMask}` };
    }

    const conflict = hasIpConflict(state, managementIp, deviceId);
    if (conflict) return { state, error: `IP ${managementIp} is already assigned to ${conflict.name}` };
  }

  const switchCfg = device.config as SwitchConfig;
  const newConfig: SwitchConfig = { ...switchCfg, managementIp, managementMask };

  return {
    state: {
      ...state,
      devices: {
        ...state.devices,
        [deviceId]: { ...device, config: newConfig },
      },
      log: [
        ...state.log,
        {
          id: genId("log"),
          tick: state.tick,
          message: managementIp
            ? `Set ${device.name} management IP: ${managementIp}/${managementMask}`
            : `Cleared management IP on ${device.name}`,
          category: "network",
        },
      ],
    },
  };
}

// --- Browser target resolution (query, not action) ---

/** Check if a device owns a specific IP address */
function deviceOwnsIp(device: Device, targetIp: string): boolean {
  const cfg = device.config;
  if ("interfaces" in cfg) {
    const ifaces = cfg.interfaces as Record<number, InterfaceConfig>;
    for (const iface of Object.values(ifaces)) {
      if (iface.ip === targetIp) return true;
    }
  }
  if ("ip" in cfg && cfg.ip === targetIp) return true;
  if ("managementIp" in cfg && cfg.managementIp === targetIp) return true;
  return false;
}

export function resolveBrowserTarget(
  state: GameState,
  targetIp: string,
): ResolveBrowserTargetResult {
  for (const device of Object.values(state.devices)) {
    if (deviceOwnsIp(device, targetIp)) {
      return { found: true, targetDeviceId: device.id, reason: "ok" };
    }
  }
  return { found: false, reason: "no_device" };
}

// --- IPAM handlers ---

function createSubnet(
  state: GameState,
  network: string,
  mask: number,
  name: string,
  vlanId: number | null,
): EngineResult {
  if (!isValidIp(network)) return { state, error: "Invalid network address" };
  if (!Number.isInteger(mask) || mask < 0 || mask > 32) return { state, error: "Mask must be 0–32" };
  if (!isNetworkAddress(network, mask)) {
    return { state, error: `${network} is not a valid network address for /${mask}` };
  }
  if (!name.trim()) return { state, error: "Subnet name is required" };

  // Check overlap with existing subnets
  for (const existing of Object.values(state.ipam.subnets)) {
    if (subnetsOverlap(network, mask, existing.network, existing.mask)) {
      return { state, error: `Overlaps with existing subnet ${existing.name} (${existing.network}/${existing.mask})` };
    }
  }

  // Validate VLAN exists if provided
  if (vlanId != null && !state.vlans[vlanId]) {
    return { state, error: `VLAN ${vlanId} not found` };
  }

  const subnetId = genId("subnet");
  return {
    state: {
      ...state,
      ipam: {
        ...state.ipam,
        subnets: {
          ...state.ipam.subnets,
          [subnetId]: {
            id: subnetId,
            network,
            mask,
            name: name.trim(),
            vlanId,
            allocations: {},
          },
        },
      },
      log: [
        ...state.log,
        {
          id: genId("log"),
          tick: state.tick,
          message: `IPAM: Created subnet ${name.trim()} (${network}/${mask})`,
          category: "network",
        },
      ],
    },
    subnetId,
  } as EngineResult & { subnetId: string };
}

function deleteSubnet(state: GameState, subnetId: string): EngineResult {
  const subnet = state.ipam.subnets[subnetId];
  if (!subnet) return { state, error: "Subnet not found" };

  const { [subnetId]: _removed, ...remainingSubnets } = state.ipam.subnets;
  return {
    state: {
      ...state,
      ipam: { ...state.ipam, subnets: remainingSubnets },
      log: [
        ...state.log,
        {
          id: genId("log"),
          tick: state.tick,
          message: `IPAM: Deleted subnet ${subnet.name} (${subnet.network}/${subnet.mask})`,
          category: "network",
        },
      ],
    },
  };
}

function allocateIp(
  state: GameState,
  subnetId: string,
  ip: string,
  deviceId: string | null,
  description: string,
): EngineResult {
  const subnet = state.ipam.subnets[subnetId];
  if (!subnet) return { state, error: "Subnet not found" };
  if (!isValidIp(ip)) return { state, error: "Invalid IP address" };
  if (!isIpInSubnet(ip, subnet.network, subnet.mask)) {
    return { state, error: `${ip} is not within ${subnet.network}/${subnet.mask}` };
  }
  if (isBroadcastAddress(ip, subnet.network, subnet.mask)) {
    return { state, error: `${ip} is the broadcast address` };
  }
  if (ip === subnet.network && subnet.mask < 31) {
    return { state, error: `${ip} is the network address` };
  }
  if (subnet.allocations[ip]) {
    return { state, error: `${ip} is already allocated` };
  }
  if (deviceId && !state.devices[deviceId]) {
    return { state, error: "Device not found" };
  }

  return {
    state: {
      ...state,
      ipam: {
        ...state.ipam,
        subnets: {
          ...state.ipam.subnets,
          [subnetId]: {
            ...subnet,
            allocations: {
              ...subnet.allocations,
              [ip]: { ip, deviceId: deviceId || null, description },
            },
          },
        },
      },
    },
  };
}

function releaseIp(state: GameState, subnetId: string, ip: string): EngineResult {
  const subnet = state.ipam.subnets[subnetId];
  if (!subnet) return { state, error: "Subnet not found" };
  if (!subnet.allocations[ip]) return { state, error: `No allocation for ${ip}` };

  const { [ip]: _removed, ...remainingAllocations } = subnet.allocations;
  return {
    state: {
      ...state,
      ipam: {
        ...state.ipam,
        subnets: {
          ...state.ipam.subnets,
          [subnetId]: { ...subnet, allocations: remainingAllocations },
        },
      },
    },
  };
}
