import type {
  GameState,
  TracerPacket,
  PacketHop,
  HopDecision,
  Device,
} from "@downtime-ops/shared";
import { getDeviceIp } from "@downtime-ops/shared";

/** Find a device by its assigned IP */
function findDeviceByIp(state: GameState, ip: string): Device | null {
  for (const device of Object.values(state.devices)) {
    if (getDeviceIp(device) === ip) return device;
  }
  return null;
}

/** Find all active links connected to a device */
function getDeviceLinks(
  state: GameState,
  deviceId: string,
): Array<{ linkId: string; portIndex: number; neighborId: string; neighborPort: number }> {
  const results: Array<{
    linkId: string;
    portIndex: number;
    neighborId: string;
    neighborPort: number;
  }> = [];

  for (const link of Object.values(state.links)) {
    if (link.status === "cut") continue;

    if (link.portA.deviceId === deviceId) {
      results.push({
        linkId: link.id,
        portIndex: link.portA.portIndex,
        neighborId: link.portB.deviceId,
        neighborPort: link.portB.portIndex,
      });
    } else if (link.portB.deviceId === deviceId) {
      results.push({
        linkId: link.id,
        portIndex: link.portB.portIndex,
        neighborId: link.portA.deviceId,
        neighborPort: link.portA.portIndex,
      });
    }
  }

  return results;
}

/** Check if an IP is in the local Phase 1 subnet */
function isLocalIp(ip: string): boolean {
  return ip.startsWith("10.0.0.");
}

export function startTracer(
  state: GameState,
  params: {
    srcIp: string;
    dstIp: string;
    protocol: string;
    srcPort: number;
    dstPort: number;
  },
): TracerPacket {
  const srcDevice = findDeviceByIp(state, params.srcIp);

  return {
    id: `tracer-${crypto.randomUUID()}`,
    srcIp: params.srcIp,
    dstIp: params.dstIp,
    protocol: params.protocol,
    srcPort: params.srcPort,
    dstPort: params.dstPort,
    vlanTag: null,
    size: 64,
    ttl: 64,
    currentDeviceId: srcDevice?.id || "",
    currentPortIndex: 0,
    status: srcDevice ? "in_transit" : "dropped",
    hops: srcDevice
      ? []
      : [
          {
            deviceId: "",
            portIn: -1,
            portOut: -1,
            action: `Source device not found for IP ${params.srcIp}`,
            decision: { type: "drop", reason: "Source device not found" },
            timestamp: state.tick,
          },
        ],
  };
}

export function stepTracer(
  state: GameState,
  packet: TracerPacket,
): TracerPacket {
  if (packet.status !== "in_transit") return packet;

  const device = state.devices[packet.currentDeviceId];
  if (!device) {
    return addHopAndDrop(packet, state.tick, {
      deviceId: packet.currentDeviceId,
      action: "Device not found",
      reason: "Device no longer exists",
    });
  }

  // Decrement TTL
  if (packet.ttl <= 0) {
    return addHopAndDrop(packet, state.tick, {
      deviceId: device.id,
      action: "TTL expired",
      reason: "TTL reached 0",
    });
  }

  switch (device.type) {
    case "server":
      return stepServer(state, packet, device);
    case "switch":
      return stepSwitch(state, packet, device);
    case "router":
      return stepRouter(state, packet, device);
    default:
      return addHopAndDrop(packet, state.tick, {
        deviceId: device.id,
        action: `Unsupported device type: ${device.type}`,
        reason: "Cannot forward",
      });
  }
}

function stepServer(
  state: GameState,
  packet: TracerPacket,
  device: Device,
): TracerPacket {
  // Check if this is the destination
  if (getDeviceIp(device) === packet.dstIp) {
    const hop: PacketHop = {
      deviceId: device.id,
      portIn: packet.currentPortIndex,
      portOut: -1,
      action: `Packet delivered to ${device.name} (${packet.dstIp})`,
      decision: { type: "forward", matchedRule: "destination reached" },
      timestamp: state.tick,
    };
    return {
      ...packet,
      status: "delivered",
      hops: [...packet.hops, hop],
    };
  }

  // Originating or forwarding — find an active link out
  const links = getDeviceLinks(state, device.id);
  for (const link of links) {
    const port = device.ports[link.portIndex];
    if (!port || port.status !== "up") continue;

    const hop: PacketHop = {
      deviceId: device.id,
      portIn: packet.currentPortIndex,
      portOut: link.portIndex,
      action: `Sending via port ${link.portIndex} toward ${state.devices[link.neighborId]?.name || link.neighborId}`,
      decision: { type: "forward" },
      timestamp: state.tick,
    };

    return {
      ...packet,
      ttl: packet.ttl - 1,
      currentDeviceId: link.neighborId,
      currentPortIndex: link.neighborPort,
      hops: [...packet.hops, hop],
    };
  }

  return addHopAndDrop(packet, state.tick, {
    deviceId: device.id,
    action: "No active link found on server",
    reason: "No connected uplink port",
  });
}

function stepSwitch(
  state: GameState,
  packet: TracerPacket,
  device: Device,
): TracerPacket {
  const links = getDeviceLinks(state, device.id);

  // Phase 1 flat network: find the port that leads toward the destination
  const dstDevice = findDeviceByIp(state, packet.dstIp);

  // If destination is directly connected, forward there
  if (dstDevice) {
    for (const link of links) {
      if (link.neighborId === dstDevice.id) {
        const port = device.ports[link.portIndex];
        if (!port || port.status !== "up") {
          return addHopAndDrop(packet, state.tick, {
            deviceId: device.id,
            action: `Egress port ${link.portIndex} is down`,
            reason: `Port ${link.portIndex} is down`,
          });
        }

        const hop: PacketHop = {
          deviceId: device.id,
          portIn: packet.currentPortIndex,
          portOut: link.portIndex,
          action: `Forwarding to port ${link.portIndex} → ${dstDevice.name}`,
          decision: {
            type: "mac_lookup",
            matchedRule: `destination ${packet.dstIp} → port ${link.portIndex}`,
          },
          timestamp: state.tick,
        };

        return {
          ...packet,
          currentDeviceId: link.neighborId,
          currentPortIndex: link.neighborPort,
          hops: [...packet.hops, hop],
        };
      }
    }
  }

  // Not directly connected — forward toward the router (default gateway)
  for (const link of links) {
    const neighbor = state.devices[link.neighborId];
    if (!neighbor) continue;
    if (neighbor.type === "router") {
      const port = device.ports[link.portIndex];
      if (!port || port.status !== "up") {
        return addHopAndDrop(packet, state.tick, {
          deviceId: device.id,
          action: `Egress port ${link.portIndex} toward router is down`,
          reason: `Port ${link.portIndex} is down`,
        });
      }

      const hop: PacketHop = {
        deviceId: device.id,
        portIn: packet.currentPortIndex,
        portOut: link.portIndex,
        action: `Forwarding to port ${link.portIndex} → router (default gateway)`,
        decision: {
          type: "mac_lookup",
          matchedRule: "default gateway",
        },
        timestamp: state.tick,
      };

      return {
        ...packet,
        currentDeviceId: link.neighborId,
        currentPortIndex: link.neighborPort,
        hops: [...packet.hops, hop],
      };
    }
  }

  // Forward to the first available port that isn't the ingress
  for (const link of links) {
    if (link.portIndex === packet.currentPortIndex) continue;
    const port = device.ports[link.portIndex];
    if (!port || port.status !== "up") continue;

    const hop: PacketHop = {
      deviceId: device.id,
      portIn: packet.currentPortIndex,
      portOut: link.portIndex,
      action: `Flooding to port ${link.portIndex} → ${state.devices[link.neighborId]?.name || "unknown"}`,
      decision: { type: "mac_lookup", matchedRule: "flood (unknown destination)" },
      timestamp: state.tick,
    };

    return {
      ...packet,
      currentDeviceId: link.neighborId,
      currentPortIndex: link.neighborPort,
      hops: [...packet.hops, hop],
    };
  }

  return addHopAndDrop(packet, state.tick, {
    deviceId: device.id,
    action: "No egress port available on switch",
    reason: "All ports down or no links",
  });
}

function stepRouter(
  state: GameState,
  packet: TracerPacket,
  device: Device,
): TracerPacket {
  const links = getDeviceLinks(state, device.id);

  // Check if destination is local
  if (isLocalIp(packet.dstIp)) {
    // Route back toward LAN — find the switch
    for (const link of links) {
      const neighbor = state.devices[link.neighborId];
      if (!neighbor) continue;
      if (neighbor.type === "switch") {
        const port = device.ports[link.portIndex];
        if (!port || port.status !== "up") {
          return addHopAndDrop(packet, state.tick, {
            deviceId: device.id,
            action: `LAN port ${link.portIndex} is down`,
            reason: `Port ${link.portIndex} is down`,
          });
        }

        const decision: HopDecision = {
          type: "route_lookup",
          matchedRule: `10.0.0.0/24 → LAN (port ${link.portIndex})`,
          allRules: [
            `10.0.0.0/24 → LAN (port ${link.portIndex})`,
            "0.0.0.0/0 → uplink",
          ],
        };

        const hop: PacketHop = {
          deviceId: device.id,
          portIn: packet.currentPortIndex,
          portOut: link.portIndex,
          action: `Routing ${packet.dstIp} to LAN via port ${link.portIndex}`,
          decision,
          timestamp: state.tick,
        };

        return {
          ...packet,
          ttl: packet.ttl - 1,
          currentDeviceId: link.neighborId,
          currentPortIndex: link.neighborPort,
          hops: [...packet.hops, hop],
        };
      }
    }
  }

  // External destination — check uplink
  const uplink = state.uplinks.find((u) => u.deviceId === device.id);
  if (uplink && uplink.status === "active") {
    const decision: HopDecision = {
      type: "route_lookup",
      matchedRule: `0.0.0.0/0 → uplink (${uplink.name})`,
      allRules: [
        "10.0.0.0/24 → LAN",
        `0.0.0.0/0 → uplink (${uplink.name})`,
      ],
    };

    const hop: PacketHop = {
      deviceId: device.id,
      portIn: packet.currentPortIndex,
      portOut: uplink.portIndex,
      action: `Routing ${packet.dstIp} to uplink (${uplink.name})`,
      decision,
      timestamp: state.tick,
    };

    return {
      ...packet,
      status: "delivered",
      hops: [...packet.hops, hop],
    };
  }

  return addHopAndDrop(packet, state.tick, {
    deviceId: device.id,
    action: "No route to destination — uplink down or missing",
    reason: "No default route / uplink unavailable",
  });
}

function addHopAndDrop(
  packet: TracerPacket,
  tick: number,
  info: { deviceId: string; action: string; reason: string },
): TracerPacket {
  const hop: PacketHop = {
    deviceId: info.deviceId,
    portIn: packet.currentPortIndex,
    portOut: -1,
    action: info.action,
    decision: { type: "drop", reason: info.reason },
    timestamp: tick,
  };

  return {
    ...packet,
    status: "dropped",
    hops: [...packet.hops, hop],
  };
}
