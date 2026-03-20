import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  TracerPacket,
  GameState,
} from "@downtime-ops/shared";
import {
  applyAction,
  createTracer,
  advanceTracer,
  type Action,
} from "../engine";
import pino from "pino";

const log = pino({ name: "rpc" });

export interface GameServer {
  getState(): GameState;
  setState(state: GameState): void;
  broadcast(notification: JsonRpcNotification): void;
  saveGame(name: string): Promise<void>;
  loadGame(saveId: string): Promise<void>;
}

// Active tracers stored outside game state
const activeTracers = new Map<string, TracerPacket>();

export function handleRpcRequest(
  request: JsonRpcRequest,
  server: GameServer,
): JsonRpcResponse | Promise<JsonRpcResponse> {
  const { method, params, id } = request;

  try {
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

      case "getSnapshot":
        return rpcSuccess(id, { state: server.getState() });

      case "startTracer": {
        const p = params as Record<string, unknown>;
        const result = createTracer(server.getState(), {
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
        const tracerId = (params as Record<string, unknown>)
          .tracerId as string;
        const packet = activeTracers.get(tracerId);
        if (!packet) {
          return rpcError(id, -32001, `Tracer ${tracerId} not found`);
        }
        const result = advanceTracer(server.getState(), packet);
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

      case "loadGame": {
        const saveId = (params as Record<string, unknown>).saveId as string;
        return server.loadGame(saveId).then(
          () => rpcSuccess(id, { state: server.getState() }),
          (err) => rpcError(id, -32003, String(err)),
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
  const state = server.getState();
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
