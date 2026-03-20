# DowntimeOPS — Technical Architecture

**Version:** 0.2 Draft
**Date:** March 2026

---

## 1. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Language | TypeScript | Both server and client, shared types |
| Server Runtime | Bun | Fast startup, native WebSocket, TS-first |
| Communication | JSON-RPC 2.0 over WebSocket | Structured RPC, raw WS (not Socket.io) |
| Client Build | Vite | Fast HMR for client development |
| Game Renderer | Phaser 3 (swappable) | Initial 2D renderer, replaceable |
| Client UI | React 18 | Config panels, forms, tables |
| Client State | Zustand | Local mirror of server state + ephemeral UI state |
| Simulation | Pure TypeScript (server-side) | Runs on Bun, authoritative, zero rendering deps |
| Storage | Abstraction layer (JSON file initially) | Agnostic interface, swappable backends |
| Unit/Integration Testing | Vitest | Native TS support, fast, compatible with Vite |
| E2E Testing | Playwright | Browser-based end-to-end tests for client |
| Linting | ESLint | Code quality, consistent style |
| Git Hooks | Husky + lint-staged | Pre-commit: lint + tests |
| Monorepo | Bun workspaces | server/, client/, shared/ |
| Assets | Aseprite / SVG | Pixel art sprites + vector UI elements |

### Renderer Swappability

The server/simulation is completely decoupled from rendering. Any client that speaks JSON-RPC over WebSocket can render the game — Phaser (browser), Unity, Godot, or even a terminal UI. The current Phaser + React client is the first implementation, chosen for fast iteration and instant browser sharing during prototyping. The simulation engine (pure TS) can also be ported to C#/GDScript if needed, but the server can remain as-is regardless of client technology.

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                     SERVER (Bun)                          │
│                                                           │
│  ┌───────────────────┐  ┌──────────────────────────────┐ │
│  │  JSON-RPC Handler  │  │     Simulation Engine        │ │
│  │                    │  │                              │ │
│  │  - validate intent │  │  - Tick processor            │ │
│  │  - dispatch action │  │  - Connection/flow engine    │ │
│  │  - broadcast diffs │  │  - Failure generator         │ │
│  │                    │  │  - Economy calculator         │ │
│  └────────┬───────────┘  │  - SLA evaluator             │ │
│           │              │  - Tracer (on-demand)         │ │
│           │              └──────────────────────────────┘ │
│           │  WebSocket                                    │
└───────────┼───────────────────────────────────────────────┘
            │
            │  JSON-RPC 2.0 messages
            │  Client → Server: intentions (requests)
            │  Server → Client: state diffs (notifications)
            │
┌───────────┼───────────────────────────────────────────────┐
│           │                CLIENT                          │
│  ┌────────┴───────────┐                                   │
│  │  JSON-RPC Client    │                                  │
│  │  + State Reconciler │                                  │
│  └────────┬────────────┘                                  │
│           │                                               │
│  ┌────────┴───────────────────────────────────────────┐  │
│  │           Zustand Store (local mirror)               │  │
│  ├────────────────────────┬────────────────────────────┤  │
│  │   Phaser Renderer      │     React UI Layer         │  │
│  │   (swappable)          │                            │  │
│  └────────────────────────┴────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

**Key principles:**

- **Server is authoritative.** The simulation engine runs server-side. Clients send intentions (e.g., "place device at rack X, slot Y"), server validates and applies.
- **Simulation engine has zero UI imports.** Pure functions: `(GameState, Action) → GameState`. Testable, portable, deterministic.
- **Zustand is a local mirror**, not the source of truth. It receives state diffs from the server and provides reactive updates to Phaser and React.

### State Synchronization

The server and client stay in sync via a diff-based protocol:

1. **Each tick**, the server computes the new game state and produces a diff (only changed fields).
2. **Server broadcasts** the diff to all connected clients as a JSON-RPC notification (`stateDiff`).
3. **Periodically** (every N ticks), the server includes a hash of the full state.
4. **Client verifies** the hash against its local reconstructed state.
5. **On mismatch**, client requests a full state snapshot via `getSnapshot` RPC call.
6. **On reconnect**, client always requests a full snapshot to resync.

### Action Flow

```
Client UI (click "place device")
    → JSON-RPC request: placeDevice({ rackId, slotU, model })
    → Server validates (slot empty? enough money? equipment exists?)
    → Server applies to GameState
    → Server responds with result (success + deviceId, or error)
    → Server broadcasts stateDiff to all clients
    → Client reconciler applies diff to Zustand store
    → Phaser + React reactively update
```

### Storage Abstraction

Game persistence is behind an agnostic interface. The engine and server never know what storage backend is in use.

```typescript
interface GameStorage {
  save(saveId: string, state: GameState): Promise<void>;
  load(saveId: string): Promise<GameState>;
  delete(saveId: string): Promise<void>;
  list(): Promise<SaveInfo[]>;
}

interface SaveInfo {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  phase: number;
  money: number;
}
```

**Phase 1:** `JsonFileStorage` — writes `saves/{id}.json`. Simple, debuggable, human-readable.

**Later options** (swap in without changing game code):
- `SqliteStorage` — better for large saves, partial reads, autosave without lag
- `IndexedDBStorage` — if save/load moves client-side
- `CloudStorage` — for multiplayer / cross-device saves

---

## 3. Project Structure

```
downtime-ops/
├── server/                      # Bun backend
│   ├── src/
│   │   ├── engine/              # Simulation — NO rendering code
│   │   │   ├── entities/
│   │   │   │   ├── Device.ts
│   │   │   │   ├── Port.ts
│   │   │   │   ├── Link.ts
│   │   │   │   ├── Connection.ts     # Bandwidth stream (normal traffic)
│   │   │   │   ├── Vlan.ts
│   │   │   │   ├── Subnet.ts
│   │   │   │   ├── Route.ts
│   │   │   │   ├── FirewallRule.ts
│   │   │   │   ├── Client.ts
│   │   │   │   └── Rack.ts
│   │   │   │
│   │   │   ├── simulation/
│   │   │   │   ├── tick.ts           # Main tick processor
│   │   │   │   ├── connectionEngine.ts  # Connection creation, path resolution, utilization
│   │   │   │   ├── switchLogic.ts    # L2 forwarding, MAC learning, VLAN
│   │   │   │   ├── routerLogic.ts    # L3 routing table lookup
│   │   │   │   ├── firewallLogic.ts  # Rule evaluation
│   │   │   │   ├── failureGen.ts     # Random failure generation
│   │   │   │   ├── economy.ts        # Revenue, costs, billing
│   │   │   │   ├── sla.ts            # SLA tracking and violation detection
│   │   │   │   └── tracer.ts         # Packet tracer (on-demand, single packet)
│   │   │   │
│   │   │   ├── config/
│   │   │   │   ├── equipment.ts      # Equipment catalog (stats, costs, specs)
│   │   │   │   ├── clients.ts        # Client templates and generation
│   │   │   │   ├── balance.ts        # Game balance constants
│   │   │   │   └── progression.ts    # Unlock conditions per phase
│   │   │   │
│   │   │   └── index.ts              # Engine public API
│   │   │
│   │   ├── rpc/                      # JSON-RPC handler
│   │   │   ├── methods.ts            # RPC method implementations
│   │   │   ├── validator.ts          # Intent validation
│   │   │   └── index.ts
│   │   │
│   │   ├── sync/                     # State synchronization
│   │   │   ├── differ.ts             # State diff calculator
│   │   │   ├── hasher.ts             # State hash for verification
│   │   │   └── snapshot.ts           # Full state snapshot
│   │   │
│   │   ├── storage/                   # Persistence abstraction
│   │   │   ├── interface.ts           # GameStorage interface
│   │   │   └── jsonFile.ts            # JSON file implementation (Phase 1)
│   │   │
│   │   ├── ws/                       # WebSocket server
│   │   │   └── server.ts
│   │   │
│   │   └── main.ts                   # Server entry point
│   │
│   ├── tests/
│   │   ├── engine/
│   │   │   ├── connectionEngine.test.ts
│   │   │   ├── switchLogic.test.ts
│   │   │   ├── routerLogic.test.ts
│   │   │   └── tracer.test.ts
│   │   └── integration/
│   │
│   ├── package.json
│   └── tsconfig.json
│
├── client/                           # Vite + React + Phaser frontend
│   ├── src/
│   │   ├── renderer/                 # Phaser scenes
│   │   │   ├── RackScene.ts
│   │   │   ├── RoomScene.ts          # (future)
│   │   │   ├── ConnectionLayer.ts    # Connection flow visualization
│   │   │   ├── CableLayer.ts         # Cable rendering
│   │   │   └── sprites/
│   │   │
│   │   ├── ui/                       # React components
│   │   │   ├── panels/
│   │   │   │   ├── DevicePanel.tsx
│   │   │   │   ├── PortConfig.tsx
│   │   │   │   ├── RoutingTable.tsx
│   │   │   │   ├── FirewallRules.tsx
│   │   │   │   ├── VlanManager.tsx
│   │   │   │   ├── ConnectionInspector.tsx
│   │   │   │   └── TracerPanel.tsx
│   │   │   │
│   │   │   ├── hud/
│   │   │   │   ├── TopBar.tsx
│   │   │   │   ├── AlertBar.tsx
│   │   │   │   ├── ClientList.tsx
│   │   │   │   └── SystemLog.tsx
│   │   │   │
│   │   │   ├── shop/
│   │   │   │   └── EquipmentShop.tsx
│   │   │   │
│   │   │   └── Layout.tsx
│   │   │
│   │   ├── store/
│   │   │   └── gameStore.ts          # Zustand — local mirror of server state
│   │   │
│   │   ├── rpc/                      # JSON-RPC client
│   │   │   ├── client.ts             # WebSocket + JSON-RPC transport
│   │   │   └── methods.ts            # Typed RPC method callers
│   │   │
│   │   ├── sync/                     # State reconciliation
│   │   │   ├── reconciler.ts         # Apply diffs to Zustand store
│   │   │   └── hashCheck.ts          # Verify state hash, request snapshot on mismatch
│   │   │
│   │   ├── App.tsx
│   │   └── main.tsx
│   │
│   ├── assets/
│   │   ├── sprites/
│   │   ├── tiles/
│   │   ├── ui/
│   │   └── audio/
│   │
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── shared/                           # Shared types & contracts
│   ├── src/
│   │   ├── types/                    # All entity interfaces
│   │   │   ├── GameState.ts
│   │   │   ├── Device.ts
│   │   │   ├── Port.ts
│   │   │   ├── Link.ts
│   │   │   ├── Connection.ts
│   │   │   ├── TracerPacket.ts       # Tracer-only packet type
│   │   │   ├── Vlan.ts
│   │   │   ├── Subnet.ts
│   │   │   ├── Route.ts
│   │   │   ├── FirewallRule.ts
│   │   │   ├── Client.ts
│   │   │   ├── Rack.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── rpc/                      # JSON-RPC contracts
│   │   │   ├── methods.ts            # Method names, param types, return types
│   │   │   ├── notifications.ts      # Server-pushed notification types
│   │   │   └── messages.ts           # JSON-RPC envelope types
│   │   │
│   │   ├── storage/
│   │   │   └── interface.ts          # GameStorage interface definition
│   │   │
│   │   └── index.ts
│   │
│   ├── package.json
│   └── tsconfig.json
│
├── docs/
│   ├── 01-downtime-ops-gdd.md
│   ├── 02-downtime-ops-tech-architecture.md
│   └── plan.md
│
├── package.json                      # Workspace root
└── README.md
```

---

## 4. Data Model

### 4.1 Core Entities

```typescript
// === Physical ===

interface Rack {
  id: string;
  name: string;
  totalU: number;                    // typically 42
  devices: Record<number, Device>;   // slot (U position) → device
  powerBudgetWatts: number;
  currentPowerWatts: number;
}

interface Device {
  id: string;
  type: DeviceType;                  // 'server' | 'switch' | 'router' | 'firewall' | 'pdu' | 'patch_panel'
  name: string;
  model: string;                     // equipment catalog reference
  uHeight: number;                   // 1U, 2U, 4U
  rackId: string;
  slotU: number;                     // starting U position in rack
  ports: Port[];
  powerDrawWatts: number;
  heatOutput: number;
  status: DeviceStatus;              // 'online' | 'offline' | 'degraded' | 'failed'
  health: number;                    // 0-100
  config: DeviceConfig;              // type-specific configuration
}

interface Port {
  id: string;
  deviceId: string;
  index: number;                     // port number on device
  type: PortType;                    // 'copper_1g' | 'copper_10g' | 'sfp_10g' | 'sfp_25g' | 'qsfp_40g'
  status: PortStatus;                // 'up' | 'down' | 'err_disabled'
  linkId: string | null;             // connected cable
  speed: number;                     // negotiated speed in Mbps
  // L2 config
  vlanMode: 'access' | 'trunk';
  accessVlan: number;                // VLAN ID if access mode
  trunkAllowedVlans: number[];       // allowed VLANs if trunk mode
  // Stats
  txBps: number;
  rxBps: number;
  txErrors: number;
  rxErrors: number;
}

interface Link {
  id: string;
  type: CableType;                   // 'cat6' | 'cat6a' | 'om3_fiber' | 'os2_fiber'
  portA: { deviceId: string; portIndex: number };
  portB: { deviceId: string; portIndex: number };
  maxBandwidthMbps: number;
  currentLoadMbps: number;           // sum of active connections' bandwidth
  activeConnectionIds: string[];     // connections traversing this link
  status: 'active' | 'degraded' | 'cut';
  lengthMeters: number;
}

// === Network ===

interface Vlan {
  id: number;                        // VLAN ID (1-4094)
  name: string;
  color: string;                     // for UI visualization
  subnet: Subnet | null;
}

interface Subnet {
  network: string;                   // e.g. "10.0.1.0"
  mask: number;                      // e.g. 24
  gateway: string;                   // e.g. "10.0.1.1"
  dhcpRange?: { start: string; end: string };
}

interface Route {
  id: string;
  deviceId: string;                  // which router owns this route
  destination: string;               // e.g. "10.0.2.0/24"
  nextHop: string;                   // e.g. "10.0.1.1"
  interface: string;                 // egress port
  metric: number;
  source: 'static' | 'connected' | 'ospf' | 'bgp';
}

interface FirewallRule {
  id: string;
  deviceId: string;
  order: number;                     // evaluation order
  action: 'allow' | 'deny';
  srcNetwork: string;                // CIDR or "any"
  dstNetwork: string;
  protocol: 'tcp' | 'udp' | 'icmp' | 'any';
  dstPort: number | 'any';
  description: string;
  hitCount: number;
}

// === Traffic ===

interface Connection {
  id: string;
  srcIp: string;
  dstIp: string;
  protocol: 'tcp' | 'udp';
  srcPort: number;
  dstPort: number;
  bandwidthMbps: number;             // allocated bandwidth
  clientId: string;                  // which client generated this
  // Path (pre-computed on creation, recomputed on topology change)
  path: ConnectionHop[];             // ordered list of hops
  status: 'active' | 'rejected' | 'degraded' | 'terminated';
}

interface ConnectionHop {
  deviceId: string;
  ingressPortIndex: number;
  egressPortIndex: number;
  linkId: string;
}

/** Used only by the Packet Tracer debugging tool — not part of normal simulation */
interface TracerPacket {
  id: string;
  srcIp: string;
  dstIp: string;
  protocol: string;
  srcPort: number;
  dstPort: number;
  vlanTag: number | null;
  size: number;                      // bytes
  ttl: number;
  // Tracer state
  currentDeviceId: string;
  currentPortIndex: number;
  status: 'in_transit' | 'delivered' | 'dropped' | 'expired';
  hops: PacketHop[];                 // trace log
}

interface PacketHop {
  deviceId: string;
  portIn: number;
  portOut: number;
  action: string;                    // human-readable: "routed via eth2", "VLAN mismatch — dropped"
  decision: HopDecision;             // structured decision data for tracer UI
  timestamp: number;                 // tick
}

interface HopDecision {
  type: 'route_lookup' | 'mac_lookup' | 'vlan_check' | 'firewall_eval' | 'forward' | 'drop';
  matchedRule?: string;              // which route/rule matched
  allRules?: string[];               // all evaluated rules (for tracer display)
  reason?: string;                   // why dropped
}

// === Business ===

interface Client {
  id: string;
  name: string;
  type: 'startup' | 'smb' | 'enterprise' | 'bank';
  contract: Contract;
  satisfaction: number;              // 0-100
  status: 'prospect' | 'active' | 'warning' | 'churned';
}

interface Contract {
  bandwidthMbps: number;
  uptimeSla: number;                 // e.g. 99.9
  isolationRequired: boolean;        // needs dedicated VLAN
  dedicatedHardware: boolean;        // needs own server
  monthlyRevenue: number;
  penaltyPerViolation: number;
  durationMonths: number;
}

// === Top-level ===

interface GameState {
  tick: number;
  speed: number;                     // 0 (paused), 1, 2, 3
  money: number;
  reputation: number;                // 0-100
  phase: number;                     // current progression phase

  racks: Record<string, Rack>;
  devices: Record<string, Device>;
  links: Record<string, Link>;
  vlans: Record<number, Vlan>;
  routes: Route[];
  firewallRules: FirewallRule[];
  clients: Record<string, Client>;
  connections: Record<string, Connection>;

  alerts: Alert[];
  log: LogEntry[];

  uplinks: Uplink[];                 // internet connections
  monthlyExpenses: number;
  monthlyRevenue: number;
}
```

### 4.2 Connection Routing & Packet Tracing

**Connection Path Resolution**

When a new connection is established, the engine computes its path through the network using the same routing/switching/firewall logic that the Packet Tracer uses. The path is stored as an ordered list of `ConnectionHop` entries. Paths are recomputed when the network topology changes (link up/down, route added/removed, VLAN reconfigured).

```
function resolveConnectionPath(connection, gameState):
  Walk from source device to destination device:
    At each device, apply the same logic as packet routing:
      switch → VLAN check, MAC lookup, egress port selection
      router → firewall rules, longest prefix match, next hop
      firewall → rule evaluation, allow/deny

  If path resolves successfully → connection is 'active'
  If blocked at any point → connection is 'rejected' (with reason)
```

**Link Utilization**

Each tick, link utilization is the sum of bandwidth from all active connections traversing that link:

```
for each link:
  link.currentLoadMbps = sum(connection.bandwidthMbps
    for connection in link.activeConnectionIds
    where connection.status == 'active')

  if link.currentLoadMbps > link.maxBandwidthMbps:
    // Congestion — degrade or throttle connections
```

Connection paths are computed on establishment and topology changes, not per-tick. Per-tick work is O(connections) for utilization aggregation.

**Packet Tracer Algorithm**

The Packet Tracer uses the same per-hop logic as path resolution, but with detailed decision logging at each step. It spawns a single `TracerPacket` on demand and walks it through the network, recording every routing table lookup, VLAN check, and firewall rule evaluation for display in the tracer UI.

```
function tracePacket(packet, gameState):
  device = getDevice(packet.currentDeviceId)

  switch device.type:
    case 'switch':
      // 1. Check VLAN: does ingress port VLAN match packet tag?
      // 2. MAC table lookup → find egress port
      // 3. If trunk port → keep tag. If access port → strip tag.
      // 4. Log decision to packet.hops
      // 5. Forward to egress port → traverse link → next device

    case 'router':
      // 1. Check firewall rules (if any) — first match wins
      // 2. Longest prefix match on routing table
      // 3. Decrement TTL (TTL=0 → drop)
      // 4. Determine egress interface
      // 5. If egress is on different VLAN → re-tag
      // 6. Log decision to packet.hops
      // 7. Forward to next hop

    case 'firewall':
      // 1. Evaluate rules top-to-bottom
      // 2. First match → allow or deny
      // 3. Default deny if no match
      // 4. Log all evaluated rules + decision to packet.hops

    case 'server':
      // Packet arrived at destination
      // Mark as delivered
```

---

## 5. Client Architecture

### Zustand Store (Local Mirror)

The Zustand store on the client is a **mirror** of the server's game state, not the source of truth. It serves two purposes:

1. **Game state mirror** — updated by applying diffs received from the server
2. **Ephemeral UI state** — selected device, active panel, cursor position, etc. (client-only, not synced)

```typescript
interface GameStore {
  // Server-synced state
  state: GameState;

  // Ephemeral UI state (client-only)
  selectedDeviceId: string | null;
  selectedPortId: string | null;
  activeView: 'rack' | 'room' | 'trace' | 'map';

  // State sync
  applyDiff: (diff: StateDiff) => void;
  applySnapshot: (snapshot: GameState) => void;

  // UI actions (client-only)
  selectDevice: (deviceId: string | null) => void;
  setView: (view: string) => void;
}
```

### JSON-RPC Protocol

Methods are labeled by the development phase they're introduced in.

**Client → Server (requests):**

```jsonc
// Player actions (Phase 1)
{ "jsonrpc": "2.0", "method": "placeDevice", "params": { "rackId": "r1", "slotU": 10, "model": "switch_24p" }, "id": 1 }
{ "jsonrpc": "2.0", "method": "connectPorts", "params": { "portA": "p1", "portB": "p2", "cableType": "cat6" }, "id": 2 }
{ "jsonrpc": "2.0", "method": "repairPort", "params": { "deviceId": "d3", "portIndex": 5 }, "id": 3 }
{ "jsonrpc": "2.0", "method": "acceptClient", "params": { "clientId": "c1" }, "id": 4 }
{ "jsonrpc": "2.0", "method": "rejectClient", "params": { "clientId": "c1" }, "id": 5 }

// Player actions (Phase 3+)
{ "jsonrpc": "2.0", "method": "setPortVlan", "params": { "portId": "p1", "vlanId": 10 }, "id": 6 }
{ "jsonrpc": "2.0", "method": "addRoute", "params": { "deviceId": "d1", "destination": "10.0.2.0/24", "nextHop": "10.0.1.1" }, "id": 7 }
{ "jsonrpc": "2.0", "method": "addFirewallRule", "params": { "deviceId": "d1", "rule": { "...": "..." } }, "id": 8 }

// Tracer
{ "jsonrpc": "2.0", "method": "startTracer", "params": { "srcIp": "10.0.1.10", "dstIp": "10.0.2.20", "protocol": "tcp", "dstPort": 443 }, "id": 6 }
{ "jsonrpc": "2.0", "method": "stepTracer", "params": { "tracerId": "t1" }, "id": 7 }

// Game controls
{ "jsonrpc": "2.0", "method": "setSpeed", "params": { "speed": 2 }, "id": 8 }
{ "jsonrpc": "2.0", "method": "pause", "id": 9 }

// State sync
{ "jsonrpc": "2.0", "method": "getSnapshot", "id": 10 }
```

**Server → Client (notifications, no id):**

```jsonc
{ "jsonrpc": "2.0", "method": "stateDiff", "params": { "tick": 142, "diff": { "...": "..." }, "hash": "a3f..." } }
{ "jsonrpc": "2.0", "method": "alert", "params": { "type": "port_down", "deviceId": "d3", "portIndex": 5 } }
{ "jsonrpc": "2.0", "method": "tracerStep", "params": { "tracerId": "t1", "hop": { "...": "..." } } }
```

### Phaser ↔ React

Phaser owns the game canvas (rack visualization, animations). React owns the UI overlay (panels, forms). Both read from the same Zustand store and dispatch actions via the JSON-RPC client. Neither talks directly to the other — the store is the bridge.

---

## 6. Development Roadmap

### Phase 1 — Vertical Slice
Get the full gameplay loop working, ugly but functional.

**Server:**
- [ ] Bun project setup, WebSocket server, JSON-RPC handler
- [ ] Core type definitions in shared/ package
- [ ] Tick loop with game clock (pause, speed)
- [ ] Connection engine: create connection, resolve path, aggregate utilization
- [ ] Basic failure generator (port down)
- [ ] Packet tracer: on-demand single packet trace with hop decisions
- [ ] Simple economy: revenue from clients, costs for equipment/uplink
- [ ] Client accept/reject and repair port actions
- [ ] State diff + hash sync
- [ ] JsonFileStorage: save/load game state

**Client:**
- [ ] Vite + React + Phaser project setup
- [ ] JSON-RPC client, state reconciler
- [ ] Rack scene: 42U rack, place devices, show ports
- [ ] Cable rendering between device ports
- [ ] Connection flow visualization (bandwidth bars on links)
- [ ] Basic connection inspector (active connections per link, bandwidth, source/destination)
- [ ] Basic tracer UI: step through hops
- [ ] Equipment shop (minimal)
- [ ] Client prospect panel: accept/reject
- [ ] Repair interaction: click to fix failed port
- [ ] HUD: money, clock, speed controls

**Goal:** Player builds a small network, connections flow, something breaks, player traces a packet to find it, fixes it.

### Phase 2 — UI Polish & Content
- [ ] Equipment catalog with real stats, costs, variety
- [ ] Polished shop UI
- [ ] Device panel: port status, stats, configuration
- [ ] Dashboard: finances, SLA status, alerts
- [ ] Client list, contract details
- [ ] Alert bar and system log
- [ ] Save/load (server-side state persistence)
- [ ] Game balance tuning
- [ ] Tutorial / first-time guidance
- [ ] Sound effects

### Phase 3 — VLANs, Routing, Firewalls
- [ ] VLAN implementation (access/trunk ports, tagging)
- [ ] VLAN manager UI (color-coded drag assignment)
- [ ] IP addressing, subnets
- [ ] Static routing, routing table editor UI
- [ ] OSPF (mid-game unlock)
- [ ] Firewall rules, rule editor UI
- [ ] Connection path recomputation on config changes
- [ ] Tracer enhancements (VLAN checks, firewall rule display)

### Phase 4 — Room View, Cooling, Power
- [ ] Room/floor plan view (isometric or top-down)
- [ ] Multiple racks in a room
- [ ] Cooling zones, heat simulation
- [ ] Power budget management
- [ ] Cable tray routing in room view
- [ ] Medium/large client types with complex requirements

### Phase 5 — Multiple DCs & Multiplayer
- [ ] Multiple datacenter locations
- [ ] Inter-DC connectivity
- [ ] BGP peering with ISPs
- [ ] Multiple players connecting to same server
- [ ] Player-specific views and permissions
- [ ] Competitive/cooperative modes

---

## 7. Development Workflow

- **Version control:** Git
- **Monorepo commands:**
  - `bun run dev` — start server + client concurrently
  - `bun run dev:server` — start simulation server with hot reload
  - `bun run dev:client` — start Vite client with HMR
  - `bun run test` — run all tests with Vitest (server + shared + client unit)
  - `bun run test:e2e` — run Playwright end-to-end tests
  - `bun run lint` — run ESLint across all packages
  - `bun run build:client` — build client for deployment
- **Linting:** ESLint with TypeScript rules across all packages. Shared config at workspace root.
- **Git hooks:** Husky pre-commit hook runs lint-staged:
  - ESLint on changed files
  - Vitest on affected tests
  - Blocks commit on failure
- **Testing strategy:**
  - Simulation engine: near-100% unit test coverage (pure functions, easy to test)
  - JSON-RPC methods: integration tests (server + simulated client)
  - Client: Playwright E2E tests for critical flows (place device, cable, trace packet)
- **Deployment:** Server runs on any machine with Bun. Client is a static bundle (Netlify/Vercel or self-hosted). For single-player, both run locally.

---

## 8. Open Questions

1. **Art style** — Pixel art (like Prison Architect), clean vector (like Mini Motorways), or technical/schematic? Affects asset pipeline significantly.

2. **Tutorial approach** — Guided tutorial with objectives, or sandbox with progressive unlocks? Factorio does the latter well.

3. **Modding** — Equipment catalog as JSON makes custom equipment easy. Could be a powerful community feature.

4. **Single-player server mode** — Should the server run as a separate Bun process, or as an embedded Web Worker / same-process module for single-player? Separate process is simpler architecture but adds startup complexity.

5. **Connection model granularity** — How frequently do connections come and go? Are they long-lived streams (exist as long as client contract is active) or short-lived (individual requests that start and stop)? Affects simulation behavior and visual feedback.
