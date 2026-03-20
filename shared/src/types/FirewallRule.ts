export interface FirewallRule {
  id: string;
  deviceId: string;
  order: number;
  action: "allow" | "deny";
  srcNetwork: string;
  dstNetwork: string;
  protocol: "tcp" | "udp" | "icmp" | "any";
  dstPort: number | "any";
  description: string;
  hitCount: number;
}
