import type { PacketHop } from "../types/TracerPacket";

export interface StateDiffNotification {
  method: "stateDiff";
  params: {
    tick: number;
    diff: Record<string, unknown>;
    hash?: string;
  };
}

export interface AlertNotification {
  method: "alert";
  params: {
    type: string;
    deviceId?: string;
    portIndex?: number;
    message?: string;
  };
}

export interface TracerStepNotification {
  method: "tracerStep";
  params: {
    tracerId: string;
    hop: PacketHop;
  };
}

export type ServerNotification =
  | StateDiffNotification
  | AlertNotification
  | TracerStepNotification;

export type ServerNotificationMethod = ServerNotification["method"];
