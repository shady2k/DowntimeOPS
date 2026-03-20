import type {
  GameState,
  Device,
  Port,
  CableType,
  Link,
  TracerPacket,
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
import { createInitialTutorial } from "./simulation/objectives";

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
  | { type: "TICK" };

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

  const rackId = genId("rack");

  return {
    tick: 0,
    speed: 1,
    money: BALANCE.STARTING_MONEY,
    reputation: BALANCE.STARTING_REPUTATION,
    phase: 1,

    racks: {
      [rackId]: {
        id: rackId,
        name: "Rack A",
        totalU: BALANCE.DEFAULT_RACK_U,
        devices: {},
        powerBudgetWatts: BALANCE.DEFAULT_RACK_POWER_BUDGET,
        currentPowerWatts: 0,
      },
    },
    devices: {},
    links: {},
    vlans: {},
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

    tutorial: createInitialTutorial(),
  };
}

// --- Action dispatcher ---

export function applyAction(state: GameState, action: Action): EngineResult {
  switch (action.type) {
    case "PLACE_DEVICE":
      return placeDevice(state, action.rackId, action.slotU, action.model);
    case "REMOVE_DEVICE":
      return removeDevice(state, action.deviceId);
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
    case "TICK":
      return { state: processTick(state) };
    default:
      return { state, error: "Unknown action type" };
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

function assignIp(deviceType: string): string | undefined {
  if (deviceType === "router") return "10.0.0.1";
  if (deviceType === "server") {
    const ip = `10.0.0.${nextServerIp}`;
    nextServerIp++;
    return ip;
  }
  return undefined;
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

  // Check money
  if (state.money < template.cost) {
    return { state, error: "Not enough money" };
  }

  const deviceId = genId("dev");
  const ip = assignIp(template.type);
  const ports = createPorts(deviceId, template);

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
    config: ip ? { ip } : {},
  };

  // Build new rack devices record
  const newRackDevices = { ...rack.devices };
  for (let u = slotU; u < slotU + template.uHeight; u++) {
    newRackDevices[u] = device;
  }

  // Auto-assign uplink to first router placed
  let newUplinks = state.uplinks;
  if (template.type === "router") {
    const hasRouter = Object.values(state.devices).some(
      (d) => d.type === "router",
    );
    if (!hasRouter && state.uplinks.length > 0) {
      const uplinkPortIndex = ports.length - 1; // last port
      newUplinks = state.uplinks.map((u, i) =>
        i === 0
          ? { ...u, deviceId: deviceId, portIndex: uplinkPortIndex }
          : u,
      );
    }
  }

  const newState: GameState = {
    ...state,
    money: state.money - template.cost,
    devices: { ...state.devices, [deviceId]: device },
    racks: {
      ...state.racks,
      [rackId]: {
        ...rack,
        devices: newRackDevices,
        currentPowerWatts: rack.currentPowerWatts + template.powerDrawWatts,
      },
    },
    uplinks: newUplinks,
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

  return {
    state: {
      ...newState,
      devices: remainingDevices,
      uplinks: newUplinks,
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

function connectPorts(
  state: GameState,
  deviceIdA: string,
  portIndexA: number,
  deviceIdB: string,
  portIndexB: number,
  cableType: CableType,
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

  const linkId = genId("link");
  const maxBandwidth = Math.min(
    PORT_SPEED[portA.type],
    PORT_SPEED[portB.type],
  );

  const link: Link = {
    id: linkId,
    type: cableType,
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

  let newState: GameState = {
    ...state,
    links: { ...state.links, [linkId]: link },
    devices: {
      ...state.devices,
      [deviceIdA]: { ...devA, ports: newPortsA },
      [deviceIdB]: { ...devB, ports: newPortsB },
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

  // Mark survive_incident objective if tutorial is active and we have active clients
  if (!newState.tutorial.tutorialComplete) {
    const hasActiveClients = Object.values(newState.clients).some(
      (c) => c.status === "active" || c.status === "warning",
    );
    if (hasActiveClients) {
      const objectives = newState.tutorial.objectives.map((o) =>
        o.id === "survive_incident" && !o.completed
          ? { ...o, completed: true, completedAtTick: newState.tick }
          : o,
      );
      const currentObjectiveIndex = objectives.findIndex(
        (o) => !o.completed,
      );
      newState = {
        ...newState,
        tutorial: {
          ...newState.tutorial,
          objectives,
          currentObjectiveIndex:
            currentObjectiveIndex === -1
              ? objectives.length - 1
              : currentObjectiveIndex,
          tutorialComplete: objectives.every((o) => o.completed),
        },
      };
    }
  }

  return { state: newState };
}

function acceptClient(state: GameState, clientId: string): EngineResult {
  const client = state.clients[clientId];
  if (!client) return { state, error: "Client not found" };
  if (client.status !== "prospect") {
    return { state, error: "Client is not a prospect" };
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
