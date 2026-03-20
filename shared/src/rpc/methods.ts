import type { GameState } from "../types/GameState";
import type { CableType } from "../types/Link";
import type { TracerPacket } from "../types/TracerPacket";

// --- Param types ---

export interface PlaceDeviceParams {
  rackId: string;
  slotU: number;
  model: string;
}

export interface RemoveDeviceParams {
  deviceId: string;
}

export interface ConnectPortsParams {
  portA: string;
  portB: string;
  cableType: CableType;
}

export interface DisconnectPortsParams {
  linkId: string;
}

export interface RepairPortParams {
  deviceId: string;
  portIndex: number;
}

export interface AcceptClientParams {
  clientId: string;
}

export interface RejectClientParams {
  clientId: string;
}

export interface StartTracerParams {
  srcIp: string;
  dstIp: string;
  protocol: string;
  dstPort: number;
}

export interface StepTracerParams {
  tracerId: string;
}

export interface SetSpeedParams {
  speed: number;
}

export interface SaveGameParams {
  name: string;
}

export interface LoadGameParams {
  saveId: string;
}

// --- Result types ---

export interface PlaceDeviceResult {
  deviceId: string;
}

export interface ConnectPortsResult {
  linkId: string;
}

export interface StartTracerResult {
  tracerId: string;
}

export interface StepTracerResult {
  packet: TracerPacket;
}

export interface GetSnapshotResult {
  state: GameState;
}

// --- Method map for type-safe dispatch ---

export interface RpcMethods {
  placeDevice: { params: PlaceDeviceParams; result: PlaceDeviceResult };
  removeDevice: { params: RemoveDeviceParams; result: void };
  connectPorts: { params: ConnectPortsParams; result: ConnectPortsResult };
  disconnectPorts: { params: DisconnectPortsParams; result: void };
  repairPort: { params: RepairPortParams; result: void };
  acceptClient: { params: AcceptClientParams; result: void };
  rejectClient: { params: RejectClientParams; result: void };
  startTracer: { params: StartTracerParams; result: StartTracerResult };
  stepTracer: { params: StepTracerParams; result: StepTracerResult };
  setSpeed: { params: SetSpeedParams; result: void };
  pause: { params: void; result: void };
  getSnapshot: { params: void; result: GetSnapshotResult };
  saveGame: { params: SaveGameParams; result: void };
  loadGame: { params: LoadGameParams; result: void };
}

export type RpcMethodName = keyof RpcMethods;
