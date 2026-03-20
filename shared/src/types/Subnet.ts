export interface Subnet {
  network: string;
  mask: number;
  gateway: string;
  dhcpRange?: { start: string; end: string };
}
