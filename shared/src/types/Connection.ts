export interface ConnectionHop {
  deviceId: string;
  ingressPortIndex: number;
  egressPortIndex: number;
  linkId: string;
}

export interface Connection {
  id: string;
  srcIp: string;
  dstIp: string;
  protocol: "tcp" | "udp";
  srcPort: number;
  dstPort: number;
  bandwidthMbps: number;
  clientId: string;
  path: ConnectionHop[];
  status: "active" | "rejected" | "degraded" | "terminated";
}
