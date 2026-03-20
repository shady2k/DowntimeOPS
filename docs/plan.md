# DowntimeOPS — Development Plan

**Status:** Phase 1 (vertical slice) — core loop implemented

---

## Phase 0 — Project Setup ✅
Bootstrap the monorepo and tooling before writing game code.

- [x] Initialize git repo
- [x] Bun workspace setup (root `package.json` with `server/`, `client/`, `shared/`)
- [x] `shared/` package: tsconfig, package.json, empty type exports
- [x] `server/` package: Bun project, tsconfig, entry point
- [x] `client/` package: Vite + React + Phaser, tsconfig
- [x] ESLint config (shared at root, TypeScript rules)
- [x] Husky + lint-staged (pre-commit: lint + test)
- [x] Vitest config (server + shared)
- [x] Playwright config (client E2E)
- [x] CLAUDE.md

---

## Phase 1 — Vertical Slice
Get the full gameplay loop working, ugly but functional: **build → traffic flows → break → trace → fix.**

### Shared
- [x] Core type definitions: GameState, Device, Port, Link, Connection, Rack, Client, Contract
- [x] TracerPacket type (debugging only)
- [x] JSON-RPC method definitions (method names, param types, return types)
- [x] JSON-RPC notification types (stateDiff, alert, tracerStep)
- [x] Message envelope types
- [x] GameStorage interface

### Server — Engine
- [x] Equipment catalog: 1U server, 1U 24-port switch, 1U router (uplink gateway in Phase 1)
- [x] Rack entity: 42U slot management, place/remove device
- [x] Port model: types, status, link reference
- [x] Link model: cable between two ports, bandwidth capacity
- [x] Connection engine: create connection, resolve path through devices, track bandwidth
- [x] Link utilization: aggregate active connections per link, detect congestion
- [x] Tick processor: advance game state per tick
- [x] Game clock: pause, speed (1x, 2x, 3x)
- [x] Basic failure generator: port goes down randomly
- [x] Repair action: player can fix a failed port (click to repair, costs money/time)
- [x] Connection recovery: when failed port is repaired, affected connections re-establish
- [x] Packet tracer: spawn single test packet, walk hop-by-hop with decision logging
- [x] Simple economy: client revenue per tick, equipment + uplink costs
- [x] Client generation: random prospects with simple contracts (bandwidth + uptime)
- [x] Accept/reject client: player reviews prospect, accepts or declines contract
- [x] SLA tracking: uptime calculation, violation detection

### Server — Infrastructure
- [x] WebSocket server (Bun native)
- [x] JSON-RPC handler: parse requests, validate, dispatch to engine, send responses
- [x] Intent validation: check player actions are legal (slot empty? enough money? ports compatible?)
- [x] State diff calculator
- [x] State hasher (periodic integrity check)
- [x] Full snapshot on demand (for client resync)
- [x] JsonFileStorage: save/load game state to JSON files

### Client — Connection & Sync
- [x] WebSocket client (connect to server)
- [x] JSON-RPC client: send requests, handle responses and notifications
- [x] State reconciler: apply diffs to Zustand store
- [x] Hash check: verify state integrity, request snapshot on mismatch
- [x] Zustand store: game state mirror + ephemeral UI state

### Client — Renderer (Phaser)
- [x] Rack scene: draw 42U rack, show empty slots
- [x] Device sprites: basic rectangles with port indicators
- [x] Place device into rack (drag from shop → slot)
- [x] Cable rendering between device ports
- [x] Connection flow visualization (bandwidth indicators on links)
- [x] Port status indicators (up/down/error)

### Client — UI (React)
- [x] Layout: game canvas + side panels
- [x] Equipment shop: list available equipment, buy button
- [x] Device panel: click device to see ports and status
- [x] Port interaction: click port to start cabling, click target port to connect
- [x] Basic connection inspector: show active connections per link, bandwidth usage
- [x] Basic tracer panel: create test packet, step through hops, see decisions
- [x] HUD top bar: money, clock, speed controls (pause/1x/2x/3x)
- [x] Alert bar: show active alerts (port down, SLA violation)
- [x] Client list: show active contracts with status
- [x] Client prospect panel: review incoming prospect, accept/reject contract
- [x] Repair interaction: click failed port/device to repair

### Tests
- [x] Connection engine: path resolution, utilization aggregation
- [ ] Failure generator: port failure affects connections
- [x] Tracer: hop-by-hop decisions match expected routing
- [x] Economy: revenue/cost calculations
- [ ] JSON-RPC: round-trip request/response validation
- [ ] E2E: place device, cable ports, see connection flow (Playwright)

### Phase 1 Done When
Player can: open the game → place devices in a rack → cable them → accept a client → see connections flowing → a port fails → trace a packet to find the failure → fix it → traffic resumes. The loop is fun.

---

## Phase 2 — UI Polish & Content
Make it look and feel like a real game.

- [ ] Equipment catalog: variety of devices with real stats, costs, port configurations
- [ ] Polished shop UI with categories, specs, comparison
- [ ] Device panel: detailed port status, stats, configuration
- [ ] Dashboard: financial overview, revenue vs expenses graph
- [ ] SLA dashboard: uptime per client, violation history
- [ ] Client list: contract details, satisfaction, churn risk
- [ ] Alert bar and scrolling system log
- [ ] Connection inspector polish: detailed bandwidth breakdown, filtering, sorting
- [ ] Save/load UI (backed by JsonFileStorage)
- [ ] Autosave
- [ ] Game balance tuning (equipment costs, client revenue, failure rates)
- [ ] Tutorial / first-time guidance
- [ ] Sound effects (place device, cable connect, alert, failure)
- [ ] Visual polish: better sprites, animations, transitions

---

## Phase 3 — VLANs, Routing, Firewalls
Add the networking depth that makes the game unique.

- [ ] VLAN model: VLAN IDs, color coding, subnet association
- [ ] Switch port VLAN assignment (access mode, trunk mode)
- [ ] VLAN manager UI: color-coded drag assignment
- [ ] IP addressing: assign IPs to devices, subnets to VLANs
- [ ] Connection path resolution: VLAN tag checking at switches
- [ ] Static routing: routing table per router, manual route entry
- [ ] Routing table editor UI
- [ ] Inter-VLAN routing (router with ports on different VLANs)
- [ ] OSPF: automatic route discovery (mid-game unlock)
- [ ] Firewall rules: ordered allow/deny rules per firewall device
- [ ] Firewall rule editor UI (drag to reorder, first-match-wins)
- [ ] Connection path recomputation on config changes
- [ ] Tracer enhancements: show VLAN checks, firewall rule evaluation, route table lookup
- [ ] Client types that demand isolation (bank → dedicated VLAN)
- [ ] Second uplink for redundancy

---

## Phase 4 — Room View, Cooling, Power
Physical infrastructure management.

- [ ] Room/floor plan view (isometric or top-down)
- [ ] Place racks in room, plan layout
- [ ] Multiple racks with inter-rack cabling
- [ ] Cooling zones: hot aisle / cold aisle
- [ ] Heat simulation: devices generate heat, cooling units have coverage
- [ ] Thermal throttling → cascading failures if cooling fails
- [ ] Power budget per rack: overload = shutdown
- [ ] PDU management
- [ ] Cable tray routing in room view
- [ ] Medium/large client types with complex SLA requirements
- [ ] Staff hiring: NOC operators for basic monitoring (auto-alert response)

---

## Phase 5 — Multiple DCs & Multiplayer
Global scale and social play.

- [ ] Multiple datacenter locations (different cities)
- [ ] Site view: building exterior, fiber entry points
- [ ] Inter-DC connectivity (leased lines, dark fiber)
- [ ] Traffic engineering between DCs
- [ ] BGP peering with multiple ISPs
- [ ] Internet exchange points
- [ ] Edge PoPs
- [ ] Multiple players connecting to same server
- [ ] Player-specific views and permissions
- [ ] Competitive mode: rival datacenter operators
- [ ] Cooperative mode: shared infrastructure management
