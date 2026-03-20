export interface Route {
  id: string;
  deviceId: string;
  destination: string;
  nextHop: string;
  interface: string;
  metric: number;
  source: "static" | "connected" | "ospf" | "bgp";
}
