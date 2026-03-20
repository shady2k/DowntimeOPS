import type {
  GameState,
  Connection,
  ConnectionHop,
  Link,
  Device,
} from "@downtime-ops/shared";
import { BALANCE } from "../config/balance";

/** Build adjacency list from active links with up ports */
function buildAdjacency(
  state: GameState,
): Map<string, Array<{ neighborId: string; linkId: string; localPort: number; remotePort: number }>> {
  const adj = new Map<
    string,
    Array<{ neighborId: string; linkId: string; localPort: number; remotePort: number }>
  >();

  for (const link of Object.values(state.links)) {
    if (link.status === "cut") continue;

    const devA = state.devices[link.portA.deviceId];
    const devB = state.devices[link.portB.deviceId];
    if (!devA || !devB) continue;

    const portA = devA.ports[link.portA.portIndex];
    const portB = devB.ports[link.portB.portIndex];
    if (!portA || !portB) continue;
    if (portA.status !== "up" || portB.status !== "up") continue;

    if (!adj.has(devA.id)) adj.set(devA.id, []);
    if (!adj.has(devB.id)) adj.set(devB.id, []);

    adj.get(devA.id)!.push({
      neighborId: devB.id,
      linkId: link.id,
      localPort: link.portA.portIndex,
      remotePort: link.portB.portIndex,
    });
    adj.get(devB.id)!.push({
      neighborId: devA.id,
      linkId: link.id,
      localPort: link.portB.portIndex,
      remotePort: link.portA.portIndex,
    });
  }

  return adj;
}

/** BFS path resolution for Phase 1 flat network */
export function resolvePath(
  state: GameState,
  srcDeviceId: string,
  dstDeviceId: string,
): ConnectionHop[] | null {
  if (srcDeviceId === dstDeviceId) return [];

  const adj = buildAdjacency(state);
  const visited = new Set<string>();
  const parent = new Map<
    string,
    { from: string; linkId: string; fromPort: number; toPort: number }
  >();
  const queue: string[] = [srcDeviceId];
  visited.add(srcDeviceId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adj.get(current) || [];

    for (const edge of neighbors) {
      if (visited.has(edge.neighborId)) continue;
      visited.add(edge.neighborId);
      parent.set(edge.neighborId, {
        from: current,
        linkId: edge.linkId,
        fromPort: edge.localPort,
        toPort: edge.remotePort,
      });

      if (edge.neighborId === dstDeviceId) {
        // Reconstruct path
        const hops: ConnectionHop[] = [];
        let node = dstDeviceId;

        while (parent.has(node)) {
          const p = parent.get(node)!;
          hops.unshift({
            deviceId: p.from,
            ingressPortIndex: -1, // filled below
            egressPortIndex: p.fromPort,
            linkId: p.linkId,
          });
          node = p.from;
        }

        // Fix ingress ports: each hop's ingress is the previous hop's remote port
        for (let i = 0; i < hops.length; i++) {
          if (i === 0) {
            hops[i].ingressPortIndex = hops[i].egressPortIndex; // source device
          } else {
            // The ingress port of hop[i] is the remote port of the link from hop[i-1]
            const prevLink = state.links[hops[i - 1].linkId];
            if (prevLink) {
              if (prevLink.portA.deviceId === hops[i].deviceId) {
                hops[i].ingressPortIndex = prevLink.portA.portIndex;
              } else {
                hops[i].ingressPortIndex = prevLink.portB.portIndex;
              }
            }
          }
        }

        return hops;
      }

      queue.push(edge.neighborId);
    }
  }

  return null;
}

/** Find a router device in the game state */
export function findRouter(state: GameState): Device | null {
  for (const device of Object.values(state.devices)) {
    if (device.type === "router" && device.status !== "failed") return device;
  }
  return null;
}

/** Find a server with available capacity */
export function findAvailableServer(state: GameState): Device | null {
  for (const device of Object.values(state.devices)) {
    if (device.type === "server" && device.status === "online") return device;
  }
  return null;
}

/** Check if path has sufficient bandwidth on all links */
function pathHasBandwidth(
  state: GameState,
  path: ConnectionHop[],
  bandwidthMbps: number,
): boolean {
  for (const hop of path) {
    const link = state.links[hop.linkId];
    if (!link) return false;
    if (link.currentLoadMbps + bandwidthMbps > link.maxBandwidthMbps) {
      return false;
    }
  }
  return true;
}

/** Create a connection for a client */
export function createConnection(
  state: GameState,
  clientId: string,
  bandwidthMbps: number,
): { state: GameState; connectionId: string | null; error?: string } {
  const server = findAvailableServer(state);
  if (!server) {
    return { state, connectionId: null, error: "No available server" };
  }

  const router = findRouter(state);
  if (!router) {
    return { state, connectionId: null, error: "No router connected" };
  }

  const path = resolvePath(state, server.id, router.id);
  if (!path) {
    return {
      state,
      connectionId: null,
      error: "No network path from server to router",
    };
  }

  if (!pathHasBandwidth(state, path, bandwidthMbps)) {
    return { state, connectionId: null, error: "Insufficient bandwidth" };
  }

  const connId = `conn-${crypto.randomUUID()}`;
  const srcIp = (server.config.ip as string) || "10.0.0.10";
  const dstIp = `203.0.113.${Math.floor(Math.random() * 254) + 1}`;

  const connection: Connection = {
    id: connId,
    srcIp,
    dstIp,
    protocol: "tcp",
    srcPort: 1024 + Math.floor(Math.random() * 64000),
    dstPort: 443,
    bandwidthMbps,
    clientId,
    path,
    status: "active",
  };

  // Add connection to state and update link loads
  const newConnections = { ...state.connections, [connId]: connection };
  const newLinks = { ...state.links };

  for (const hop of path) {
    const link = newLinks[hop.linkId];
    if (link) {
      newLinks[hop.linkId] = {
        ...link,
        activeConnectionIds: [...link.activeConnectionIds, connId],
        currentLoadMbps: link.currentLoadMbps + bandwidthMbps,
      };
    }
  }

  return {
    state: { ...state, connections: newConnections, links: newLinks },
    connectionId: connId,
  };
}

/** Terminate a single connection and remove from links */
export function terminateConnection(
  state: GameState,
  connectionId: string,
): GameState {
  const conn = state.connections[connectionId];
  if (!conn || conn.status === "terminated") return state;

  const newLinks = { ...state.links };
  for (const hop of conn.path) {
    const link = newLinks[hop.linkId];
    if (link) {
      newLinks[hop.linkId] = {
        ...link,
        activeConnectionIds: link.activeConnectionIds.filter(
          (id) => id !== connectionId,
        ),
        currentLoadMbps: Math.max(0, link.currentLoadMbps - conn.bandwidthMbps),
      };
    }
  }

  return {
    ...state,
    connections: {
      ...state.connections,
      [connectionId]: { ...conn, status: "terminated" },
    },
    links: newLinks,
  };
}

/** Check all connections and terminate those with broken paths */
export function updateConnectionHealth(state: GameState): GameState {
  let newState = state;
  const newAlerts = [...state.alerts];
  const newLog = [...state.log];

  for (const conn of Object.values(state.connections)) {
    if (conn.status !== "active" && conn.status !== "degraded") continue;

    let broken = false;
    for (const hop of conn.path) {
      const link = state.links[hop.linkId];
      if (!link || link.status === "cut") {
        broken = true;
        break;
      }

      const device = state.devices[hop.deviceId];
      if (!device) {
        broken = true;
        break;
      }

      const ingressPort = device.ports[hop.ingressPortIndex];
      if (ingressPort && ingressPort.status !== "up") {
        broken = true;
        break;
      }

      const egressPort = device.ports[hop.egressPortIndex];
      if (egressPort && egressPort.status !== "up") {
        broken = true;
        break;
      }
    }

    if (broken) {
      newState = terminateConnection(newState, conn.id);
      newAlerts.push({
        id: `alert-${crypto.randomUUID()}`,
        type: "connection_down",
        severity: "warning",
        message: `Connection ${conn.id.slice(0, 8)} terminated — path broken`,
        tick: state.tick,
        acknowledged: false,
      });
    }
  }

  return { ...newState, alerts: newAlerts, log: newLog };
}

/** Recalculate link utilization from active connections */
export function updateLinkUtilization(state: GameState): GameState {
  const newLinks: Record<string, Link> = {};

  for (const [linkId, link] of Object.entries(state.links)) {
    let load = 0;
    const activeConns: string[] = [];

    for (const connId of link.activeConnectionIds) {
      const conn = state.connections[connId];
      if (conn && conn.status === "active") {
        load += conn.bandwidthMbps;
        activeConns.push(connId);
      }
    }

    const linkStatus: Link["status"] =
      link.status === "cut"
        ? "cut"
        : load > link.maxBandwidthMbps * BALANCE.CONGESTION_THRESHOLD
          ? "degraded"
          : "active";

    newLinks[linkId] = {
      ...link,
      currentLoadMbps: load,
      activeConnectionIds: activeConns,
      status: linkStatus,
    };
  }

  return { ...state, links: newLinks };
}

/** Try to re-establish terminated connections for affected clients */
export function reestablishConnections(state: GameState): GameState {
  let newState = state;

  for (const conn of Object.values(state.connections)) {
    if (conn.status !== "terminated") continue;

    const server = state.devices[
      conn.path[0]?.deviceId || ""
    ];
    const router = findRouter(state);
    if (!server || !router) continue;

    const path = resolvePath(newState, server.id, router.id);
    if (!path) continue;
    if (!pathHasBandwidth(newState, path, conn.bandwidthMbps)) continue;

    // Re-activate with new path
    const newLinks = { ...newState.links };
    for (const hop of path) {
      const link = newLinks[hop.linkId];
      if (link) {
        newLinks[hop.linkId] = {
          ...link,
          activeConnectionIds: [...link.activeConnectionIds, conn.id],
          currentLoadMbps: link.currentLoadMbps + conn.bandwidthMbps,
        };
      }
    }

    newState = {
      ...newState,
      connections: {
        ...newState.connections,
        [conn.id]: { ...conn, status: "active", path },
      },
      links: newLinks,
    };
  }

  return newState;
}
