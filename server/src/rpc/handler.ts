import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  TracerPacket,
  GameState,
  SaveInfo,
} from "@downtime-ops/shared";
import {
  applyAction,
  createTracer,
  advanceTracer,
  resolveBrowserTarget,
  type Action,
} from "../engine";
import { buyCartItems } from "../engine/world/worldActions";
import pino from "pino";

const log = pino({ name: "rpc" });

export interface GameServer {
  getState(): GameState | null;
  setState(state: GameState): void;
  broadcast(notification: JsonRpcNotification): void;
  saveGame(name: string): Promise<void>;
  loadGame(saveId: string): Promise<void>;
  newGame(): void;
  listSaves(): Promise<SaveInfo[]>;
  deleteSave(saveId: string): Promise<void>;
  exitToMenu(): Promise<void>;
}

// Active tracers stored outside game state
const activeTracers = new Map<string, TracerPacket>();

export function clearTracers() {
  activeTracers.clear();
}

function requireSession(server: GameServer, id: string | number): GameState | JsonRpcResponse {
  const state = server.getState();
  if (!state) {
    return rpcError(id, -32004, "No active session");
  }
  return state;
}

export function handleRpcRequest(
  request: JsonRpcRequest,
  server: GameServer,
): JsonRpcResponse | Promise<JsonRpcResponse> {
  const { method, params, id } = request;

  try {
    // --- Session management (no active session required) ---

    switch (method) {
      case "newGame": {
        server.newGame();
        return rpcSuccess(id, null);
      }

      case "listSaves": {
        return server.listSaves().then(
          (saves) => rpcSuccess(id, { saves }),
          (err) => rpcError(id, -32002, String(err)),
        );
      }

      case "deleteSave": {
        const saveId = (params as Record<string, unknown>).saveId as string;
        return server.deleteSave(saveId).then(
          () => rpcSuccess(id, null),
          (err) => rpcError(id, -32002, String(err)),
        );
      }

      case "loadGame": {
        const saveId = (params as Record<string, unknown>).saveId as string;
        return server.loadGame(saveId).then(
          () => rpcSuccess(id, null),
          (err) => rpcError(id, -32003, String(err)),
        );
      }

      case "exitToMenu": {
        return server.exitToMenu().then(
          () => rpcSuccess(id, null),
          (err) => rpcError(id, -32002, String(err)),
        );
      }
    }

    // --- All remaining methods require an active session ---

    const sessionCheck = requireSession(server, id);
    if ("error" in sessionCheck) return sessionCheck;

    switch (method) {
      case "placeDevice":
        return handleAction(server, id, {
          type: "PLACE_DEVICE",
          rackId: (params as Record<string, unknown>).rackId as string,
          slotU: (params as Record<string, unknown>).slotU as number,
          model: (params as Record<string, unknown>).model as string,
        });

      case "removeDevice":
        return handleAction(server, id, {
          type: "REMOVE_DEVICE",
          deviceId: (params as Record<string, unknown>).deviceId as string,
        });

      case "uninstallDevice":
        return handleAction(server, id, {
          type: "UNINSTALL_DEVICE",
          deviceId: (params as Record<string, unknown>).deviceId as string,
        });

      case "connectPorts":
        return handleAction(server, id, {
          type: "CONNECT_PORTS",
          deviceIdA: (params as Record<string, unknown>).deviceIdA as string,
          portIndexA: (params as Record<string, unknown>).portIndexA as number,
          deviceIdB: (params as Record<string, unknown>).deviceIdB as string,
          portIndexB: (params as Record<string, unknown>).portIndexB as number,
          cableType: (params as Record<string, unknown>).cableType as "cat6",
        });

      case "disconnectPorts":
        return handleAction(server, id, {
          type: "DISCONNECT_PORTS",
          linkId: (params as Record<string, unknown>).linkId as string,
        });

      case "repairPort":
        return handleAction(server, id, {
          type: "REPAIR_PORT",
          deviceId: (params as Record<string, unknown>).deviceId as string,
          portIndex: (params as Record<string, unknown>).portIndex as number,
        });

      case "connectUplink":
        return handleAction(server, id, {
          type: "CONNECT_UPLINK",
          deviceId: (params as Record<string, unknown>).deviceId as string,
          portIndex: (params as Record<string, unknown>).portIndex as number,
        });

      case "acceptClient":
        return handleAction(server, id, {
          type: "ACCEPT_CLIENT",
          clientId: (params as Record<string, unknown>).clientId as string,
        });

      case "rejectClient":
        return handleAction(server, id, {
          type: "REJECT_CLIENT",
          clientId: (params as Record<string, unknown>).clientId as string,
        });

      case "setSpeed":
        return handleAction(server, id, {
          type: "SET_SPEED",
          speed: (params as Record<string, unknown>).speed as number,
        });

      case "setBrowserZoom":
        return handleAction(server, id, {
          type: "SET_BROWSER_ZOOM",
          zoomIndex: (params as Record<string, unknown>).zoomIndex as number,
        });

      case "pause":
        return handleAction(server, id, { type: "SET_SPEED", speed: 0 });

      // --- World actions ---

      case "movePlayer":
        return handleAction(server, id, {
          type: "MOVE_PLAYER",
          position: (params as Record<string, unknown>).position as { x: number; y: number },
          facing: (params as Record<string, unknown>).facing as "up" | "down" | "left" | "right",
        });

      case "enterDoor":
        return handleAction(server, id, {
          type: "ENTER_DOOR",
          interactableId: (params as Record<string, unknown>).interactableId as string,
        });

      case "edgeExit":
        return handleAction(server, id, {
          type: "EDGE_EXIT",
          side: (params as Record<string, unknown>).side as "left" | "right",
        });

      case "buyItem":
        return handleAction(server, id, {
          type: "BUY_ITEM",
          listingId: (params as Record<string, unknown>).listingId as string,
        });

      case "pickupItem":
        return handleAction(server, id, {
          type: "PICKUP_ITEM",
          itemId: (params as Record<string, unknown>).itemId as string,
        });

      case "dropItem":
        return handleAction(server, id, {
          type: "DROP_ITEM",
          position: (params as Record<string, unknown>).position as { x: number; y: number },
        });

      case "placeRack":
        return handleAction(server, id, {
          type: "PLACE_RACK",
          itemId: (params as Record<string, unknown>).itemId as string,
          zoneId: (params as Record<string, unknown>).zoneId as string,
        });

      case "installDevice":
        return handleAction(server, id, {
          type: "INSTALL_DEVICE",
          itemId: (params as Record<string, unknown>).itemId as string,
          rackItemId: (params as Record<string, unknown>).rackItemId as string,
          slotU: (params as Record<string, unknown>).slotU as number,
        });

      case "installDeviceFromStorage":
        return handleAction(server, id, {
          type: "INSTALL_DEVICE_FROM_STORAGE",
          itemId: (params as Record<string, unknown>).itemId as string,
          rackItemId: (params as Record<string, unknown>).rackItemId as string,
          slotU: (params as Record<string, unknown>).slotU as number,
        });

      case "buyCartItems": {
        const state = server.getState()!;
        const p = params as Record<string, unknown>;
        const cartItems = p.items as Array<{ listingId: string; quantity: number }>;
        const result = buyCartItems(state, cartItems);
        if (result.error) {
          return rpcError(id, -32000, result.error);
        }
        server.setState(result.state);
        return rpcSuccess(id, {
          purchasedItemIds: result.purchasedItemIds,
          totalCost: result.totalCost,
        });
      }

      case "pickupFromStorage":
        return handleAction(server, id, {
          type: "PICKUP_FROM_STORAGE",
          shelfId: (params as Record<string, unknown>).shelfId as string,
        });

      // --- Device configuration ---

      case "configureInterface": {
        const p = params as Record<string, unknown>;
        return handleAction(server, id, {
          type: "CONFIGURE_INTERFACE",
          deviceId: p.deviceId as string,
          portIndex: p.portIndex as number,
          ip: (p.ip as string) ?? null,
          mask: (p.mask as number) ?? null,
          enabled: p.enabled !== false,
        });
      }

      case "addStaticRoute": {
        const state = server.getState()!;
        const p = params as Record<string, unknown>;
        const result = applyAction(state, {
          type: "ADD_STATIC_ROUTE",
          deviceId: p.deviceId as string,
          destination: p.destination as string,
          nextHop: p.nextHop as string,
          metric: (p.metric as number) || 1,
        });
        if (result.error) return rpcError(id, -32000, result.error);
        server.setState(result.state);
        return rpcSuccess(id, { routeId: (result as { routeId?: string }).routeId });
      }

      case "removeRoute":
        return handleAction(server, id, {
          type: "REMOVE_ROUTE",
          routeId: (params as Record<string, unknown>).routeId as string,
        });

      case "setDeviceHostname":
        return handleAction(server, id, {
          type: "SET_HOSTNAME",
          deviceId: (params as Record<string, unknown>).deviceId as string,
          hostname: (params as Record<string, unknown>).hostname as string,
        });

      // --- Phase 2: VLAN + switch + server configuration ---

      case "configureVlan": {
        const p = params as Record<string, unknown>;
        return handleAction(server, id, {
          type: "CONFIGURE_VLAN",
          vlanId: p.vlanId as number,
          name: p.name as string,
        });
      }

      case "removeVlan":
        return handleAction(server, id, {
          type: "REMOVE_VLAN",
          vlanId: (params as Record<string, unknown>).vlanId as number,
        });

      case "setPortVlan": {
        const p = params as Record<string, unknown>;
        return handleAction(server, id, {
          type: "SET_PORT_VLAN",
          deviceId: p.deviceId as string,
          portIndex: p.portIndex as number,
          mode: p.mode as "access" | "trunk",
          accessVlan: p.accessVlan as number | undefined,
          trunkAllowedVlans: p.trunkAllowedVlans as number[] | undefined,
        });
      }

      case "configureServerNetwork": {
        const p = params as Record<string, unknown>;
        return handleAction(server, id, {
          type: "CONFIGURE_SERVER_NETWORK",
          deviceId: p.deviceId as string,
          ip: (p.ip as string) ?? null,
          mask: (p.mask as number) ?? null,
          gateway: (p.gateway as string) ?? null,
        });
      }

      case "toggleService": {
        const p = params as Record<string, unknown>;
        return handleAction(server, id, {
          type: "TOGGLE_SERVICE",
          deviceId: p.deviceId as string,
          serviceIndex: p.serviceIndex as number,
          enabled: p.enabled as boolean,
        });
      }

      case "configureSwitchManagement": {
        const p = params as Record<string, unknown>;
        return handleAction(server, id, {
          type: "CONFIGURE_SWITCH_MANAGEMENT",
          deviceId: p.deviceId as string,
          managementIp: (p.managementIp as string) ?? null,
          managementMask: (p.managementMask as number) ?? null,
        });
      }

      case "createSubnet": {
        const state = server.getState()!;
        const p = params as Record<string, unknown>;
        const result = applyAction(state, {
          type: "CREATE_SUBNET",
          network: p.network as string,
          mask: p.mask as number,
          name: p.name as string,
          vlanId: (p.vlanId as number) ?? null,
        });
        if (result.error) return rpcError(id, -32000, result.error);
        server.setState(result.state);
        return rpcSuccess(id, { subnetId: (result as { subnetId?: string }).subnetId });
      }

      case "deleteSubnet":
        return handleAction(server, id, {
          type: "DELETE_SUBNET",
          subnetId: (params as Record<string, unknown>).subnetId as string,
        });

      case "allocateIp": {
        const p = params as Record<string, unknown>;
        return handleAction(server, id, {
          type: "ALLOCATE_IP",
          subnetId: p.subnetId as string,
          ip: p.ip as string,
          deviceId: (p.deviceId as string) ?? null,
          description: (p.description as string) || "",
        });
      }

      case "releaseIp": {
        const p = params as Record<string, unknown>;
        return handleAction(server, id, {
          type: "RELEASE_IP",
          subnetId: p.subnetId as string,
          ip: p.ip as string,
        });
      }

      case "resolveBrowserTarget": {
        const state = server.getState()!;
        const p = params as Record<string, unknown>;
        const result = resolveBrowserTarget(state, p.targetIp as string);
        return rpcSuccess(id, result);
      }

      case "getSnapshot":
        return rpcSuccess(id, { state: server.getState() });

      case "startTracer": {
        const state = server.getState()!;
        const p = params as Record<string, unknown>;
        const result = createTracer(state, {
          srcIp: p.srcIp as string,
          dstIp: p.dstIp as string,
          protocol: (p.protocol as string) || "tcp",
          srcPort: (p.srcPort as number) || 0,
          dstPort: p.dstPort as number,
        });
        activeTracers.set(result.packet.id, result.packet);
        return rpcSuccess(id, { tracerId: result.packet.id });
      }

      case "stepTracer": {
        const state = server.getState()!;
        const tracerId = (params as Record<string, unknown>)
          .tracerId as string;
        const packet = activeTracers.get(tracerId);
        if (!packet) {
          return rpcError(id, -32001, `Tracer ${tracerId} not found`);
        }
        const result = advanceTracer(state, packet);
        activeTracers.set(tracerId, result.packet);
        if (
          result.packet.status === "delivered" ||
          result.packet.status === "dropped" ||
          result.packet.status === "expired"
        ) {
          activeTracers.delete(tracerId);
        }
        return rpcSuccess(id, { packet: result.packet });
      }

      case "saveGame": {
        const name = (params as Record<string, unknown>).name as string;
        return server.saveGame(name).then(
          () => rpcSuccess(id, null),
          (err) => rpcError(id, -32002, String(err)),
        );
      }

      default:
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    log.error({ err, method }, "RPC handler error");
    return rpcError(id, -32603, "Internal error");
  }
}

function handleAction(
  server: GameServer,
  id: string | number,
  action: Action,
): JsonRpcResponse {
  const state = server.getState()!;
  const result = applyAction(state, action);

  if (result.error) {
    return rpcError(id, -32000, result.error);
  }

  server.setState(result.state);
  return rpcSuccess(id, null);
}

function rpcSuccess(
  id: string | number,
  result: unknown,
): JsonRpcResponse {
  return { jsonrpc: "2.0", result, id };
}

function rpcError(
  id: string | number,
  code: number,
  message: string,
): JsonRpcResponse {
  return { jsonrpc: "2.0", error: { code, message }, id };
}
