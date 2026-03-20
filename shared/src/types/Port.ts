export type PortType =
  | "copper_1g"
  | "copper_10g"
  | "sfp_10g"
  | "sfp_25g"
  | "qsfp_40g";

export type PortStatus = "up" | "down" | "err_disabled";

export interface Port {
  id: string;
  deviceId: string;
  index: number;
  type: PortType;
  status: PortStatus;
  linkId: string | null;
  speed: number;
  vlanMode: "access" | "trunk";
  accessVlan: number;
  trunkAllowedVlans: number[];
  txBps: number;
  rxBps: number;
  txErrors: number;
  rxErrors: number;
}
