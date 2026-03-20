import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  RpcMethodName,
  RpcMethods,
} from "@downtime-ops/shared";

type NotificationHandler = (notification: JsonRpcNotification) => void;
type ConnectionHandler = (connected: boolean) => void;

export class RpcClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  >();
  private notificationHandler: NotificationHandler | null = null;
  private connectionHandler: ConnectionHandler | null = null;
  private url: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string = `ws://${window.location.hostname}:3000`) {
    this.url = url;
  }

  onNotification(handler: NotificationHandler) {
    this.notificationHandler = handler;
  }

  onConnection(handler: ConnectionHandler) {
    this.connectionHandler = handler;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.connectionHandler?.(true);
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onclose = () => {
      this.connectionHandler?.(false);
      this.rejectAllPending("Connection closed");
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);

        // Check if it's a response (has id)
        if ("id" in data && data.id !== null) {
          const response = data as JsonRpcResponse;
          const pending = this.pending.get(response.id as number);
          if (pending) {
            this.pending.delete(response.id as number);
            if (response.error) {
              pending.reject(new Error(response.error.message));
            } else {
              pending.resolve(response.result);
            }
          }
        } else {
          // It's a notification
          this.notificationHandler?.(data as JsonRpcNotification);
        }
      } catch {
        // Ignore malformed messages
      }
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  async call<M extends RpcMethodName>(
    method: M,
    ...args: RpcMethods[M]["params"] extends void
      ? []
      : [params: RpcMethods[M]["params"]]
  ): Promise<RpcMethods[M]["result"]> {
    const id = this.nextId++;
    const params = args[0] as Record<string, unknown> | undefined;

    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      method,
      ...(params ? { params } : {}),
      id,
    };

    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("Not connected"));
        return;
      }

      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.ws.send(JSON.stringify(request));

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`RPC timeout: ${method}`));
        }
      }, 10_000);
    });
  }

  private rejectAllPending(reason: string) {
    for (const [id, pending] of this.pending) {
      pending.reject(new Error(reason));
      this.pending.delete(id);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }
}

export const rpcClient = new RpcClient();
