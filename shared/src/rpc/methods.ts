import type { GameState } from "../types/GameState";
import type { SaveInfo } from "../types/Common";
import type { CableType } from "../types/Link";
import type { TracerPacket } from "../types/TracerPacket";
import type { Vec2, Facing } from "../types/World";

// --- Param types ---

export interface PlaceDeviceParams {
  rackId: string;
  slotU: number;
  model: string;
}

export interface RemoveDeviceParams {
  deviceId: string;
}

export interface UninstallDeviceParams {
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

export interface DeleteSaveParams {
  saveId: string;
}

export interface ListSavesResult {
  saves: SaveInfo[];
}

// --- World action params ---

export interface MovePlayerParams {
  position: Vec2;
  facing: Facing;
}

export interface EnterDoorParams {
  interactableId: string;
}

export interface EdgeExitParams {
  side: "left" | "right";
}

export interface BuyItemParams {
  listingId: string;
}

export interface PickupItemParams {
  itemId: string;
}

export interface DropItemParams {
  position: Vec2;
}

export interface PlaceRackParams {
  itemId: string;
  zoneId: string;
}

export interface InstallDeviceWorldParams {
  itemId: string;
  rackItemId: string;
  slotU: number;
}

export interface BuyCartItemsParams {
  items: Array<{ listingId: string; quantity: number }>;
}

export interface PickupFromStorageParams {
  shelfId: string;
}

export interface InstallDeviceFromStorageParams {
  itemId: string;
  rackItemId: string;
  slotU: number;
}

// --- Device configuration params ---

export interface ConfigureInterfaceParams {
  deviceId: string;
  portIndex: number;
  ip: string | null;
  mask: number | null;
  enabled: boolean;
}

export interface AddStaticRouteParams {
  deviceId: string;
  destination: string;
  nextHop: string;
  metric: number;
}

export interface RemoveRouteParams {
  routeId: string;
}

export interface SetDeviceHostnameParams {
  deviceId: string;
  hostname: string;
}

export interface AddStaticRouteResult {
  routeId: string;
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

export interface BuyCartItemsResult {
  purchasedItemIds: string[];
  totalCost: number;
}

// --- Method map for type-safe dispatch ---

export interface RpcMethods {
  placeDevice: { params: PlaceDeviceParams; result: PlaceDeviceResult };
  removeDevice: { params: RemoveDeviceParams; result: void };
  uninstallDevice: { params: UninstallDeviceParams; result: void };
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
  newGame: { params: void; result: void };
  listSaves: { params: void; result: ListSavesResult };
  deleteSave: { params: DeleteSaveParams; result: void };
  exitToMenu: { params: void; result: void };

  // World actions
  movePlayer: { params: MovePlayerParams; result: void };
  enterDoor: { params: EnterDoorParams; result: void };
  edgeExit: { params: EdgeExitParams; result: void };
  buyItem: { params: BuyItemParams; result: void };
  pickupItem: { params: PickupItemParams; result: void };
  dropItem: { params: DropItemParams; result: void };
  placeRack: { params: PlaceRackParams; result: void };
  installDevice: { params: InstallDeviceWorldParams; result: void };
  buyCartItems: { params: BuyCartItemsParams; result: BuyCartItemsResult };
  pickupFromStorage: { params: PickupFromStorageParams; result: void };
  installDeviceFromStorage: { params: InstallDeviceFromStorageParams; result: void };

  // Device configuration
  configureInterface: { params: ConfigureInterfaceParams; result: void };
  addStaticRoute: { params: AddStaticRouteParams; result: AddStaticRouteResult };
  removeRoute: { params: RemoveRouteParams; result: void };
  setDeviceHostname: { params: SetDeviceHostnameParams; result: void };
}

export type RpcMethodName = keyof RpcMethods;
