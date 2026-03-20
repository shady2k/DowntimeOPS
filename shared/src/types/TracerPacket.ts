export interface HopDecision {
  type:
    | "route_lookup"
    | "mac_lookup"
    | "vlan_check"
    | "firewall_eval"
    | "forward"
    | "drop";
  matchedRule?: string;
  allRules?: string[];
  reason?: string;
}

export interface PacketHop {
  deviceId: string;
  portIn: number;
  portOut: number;
  action: string;
  decision: HopDecision;
  timestamp: number;
}

export interface TracerPacket {
  id: string;
  srcIp: string;
  dstIp: string;
  protocol: string;
  srcPort: number;
  dstPort: number;
  vlanTag: number | null;
  size: number;
  ttl: number;
  currentDeviceId: string;
  currentPortIndex: number;
  status: "in_transit" | "delivered" | "dropped" | "expired";
  hops: PacketHop[];
}
