# DowntimeOPS — Development Plan

**Status:** Phase 1 complete, entering Phase 2 (game feel & visual identity)

---

## Art Direction

Visual identity decisions. DowntimeOPS should look like a real game, not an internal network tool.

- **Visual approach:** Layered 2D composition inspired by Uncle Chop's Rocket Shop — background room → rack frame → device faceplates → cables → effects/VFX
- **Style influences:** Prison Architect (readability, strong silhouettes), Uncle Chop's (tactile diegetic interface, physical manipulation), Factorio (build-optimize loop)
- **Camera:** Front-facing rack elevation for rack gameplay; no 3D, no isometric in rack view
- **Aesthetic:** Dark datacenter room, cool LED glow, cable clutter/control, industrial rails, screws, faceplates
- **Device language:** Sprite-based servers, switches, routers with readable front panels, visible port LEDs, fan grilles, status lights
- **Interaction principle:** Player manipulates ports, devices, and cables directly in the rack; abstract menu interactions are secondary
- **Repair fantasy:** Incidents should be visually legible and tactile to fix under pressure — the Uncle Chop's "diagnose and fix with your hands" feel
- **Animation tone:** Subtle idle motion (fans, LEDs), strong failure states (sparks, smoke), satisfying placement/connect feedback
- **Sound hooks:** Every major physical interaction and incident state exposes a clear audio event for later sound design
- **Phaser layer stack:** Background (room art) → Rack frame → Device sprites → Cable sprites → Effects/particles → Hit targets (invisible, oversized)

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
- [x] Failure generator: port failure affects connections
- [x] Tracer: hop-by-hop decisions match expected routing
- [x] Economy: revenue/cost calculations
- [x] JSON-RPC: round-trip request/response validation
- [ ] E2E: place device, cable ports, see connection flow (Playwright)

### Phase 1 Done When
Player can: open the game → place devices in a rack → cable them → accept a client → see connections flowing → a port fails → trace a packet to find the failure → fix it → traffic resumes. The loop is fun.

---

## Phase 2 — Game Feel & Visual Identity
Transform the vertical slice from a debug visualization into an actual game: tactile rack interactions, layered 2D art, readable incidents, and a guided first-session loop.

### Sprint 2.1 — First-Session Playability
Establish the minimum viable fun loop so a new player knows what to do in 5 minutes.

- [x] Add server-driven objective system with explicit milestones: buy router, buy switch, buy server, connect devices, accept first client, survive first incident
- [x] Add objective/tutorial state to shared types, server state, and client sync
- [x] Script a first-session tutorial flow with step-by-step guidance instead of passive help text
- [x] Spawn a guaranteed starter client immediately on new game start
- [x] Gate random prospects until the starter contract is completed or expired
- [x] Gate random failures until the player has seen traffic flow at least once
- [x] Script the first failure to occur after the first successful client activation
- [x] Add server-side "network ready" checks: router present, server present, valid path to uplink, client-capable topology
- [x] Surface readiness state in the HUD and tutorial/objective panel
- [x] Rewrite empty-state messaging in panels to explain why revenue is zero and what the next action is
- [x] Add player-facing alert categories: tutorial, prospect, outage, capacity, SLA
- [x] Add visible monthly cashflow delta and runway hint in the HUD

### Sprint 2.2 — Layered 2D Rendering Foundation
Replace placeholder debug graphics with a sprite-based layered rack scene.

- [x] Create a Phaser asset manifest/preload pipeline for rack art, device sprites, cable sprites, LEDs, and FX
- [x] Add a static painted datacenter room background layer behind the rack
- [x] Replace procedural rack frame drawing with rack shell art: rails, screw holes, depth shading, labels
- [x] Replace colored device rectangles with composed sprite-based device faceplates
- [x] Define device visual prefabs for server, switch, router, and future firewall/patch panel variants
- [x] Add device state overlays for selected, idle, active, degraded, and failed states
- [x] Convert port indicators into visible LED/port sprites with larger hidden hit areas
- [x] Add rack slot highlights and placement ghost sprites for valid/invalid U positions
- [x] Refactor the Phaser rack renderer into explicit layers: background, rack, devices, cables, effects, hit targets
- [x] Make the Phaser canvas responsive so the rack fills the main play area instead of a fixed debug-sized viewport
- [x] Add camera zoom and pan tuned for rack work while keeping all interactions readable

### Sprint 2.3 — Tactile Rack Interactions
Move primary gameplay into the rack scene so the player learns by manipulating hardware directly.

- [x] Implement click-to-cable directly in the rack scene: select source port, highlight valid targets, click destination to connect
- [x] Add cable preview rendering while hovering a target port
- [x] Add disconnect interaction from the rack scene via cable or port context action
- [x] Implement drag-to-place equipment from the shop into explicit rack U slots
- [x] Add placement snap, occupancy validation, and visual rejection feedback for blocked slots
- [x] Add device hover tooltips with critical data only: type, status, power, connected ports
- [x] Add client-to-path highlighting: selecting a client glows its active route through the rack
- [x] Add incident targeting: selecting an alert highlights the failing device, port, or link in the rack
- [x] Reduce dependence on side tabs by showing context-sensitive actions based on current selection
- [x] Keep panel workflows as secondary inspectors, not the primary place to play

### Sprint 2.4 — Traffic, Failures, and Visual Feedback
Make the network state visible and legible without opening debug panels.

- [ ] Add animated traffic pulses moving across active links
- [ ] Scale traffic pulse rate and intensity by link utilization
- [ ] Add link state visuals: idle dim, active glow, congested amber, failed red
- [ ] Replace abstract bezier-only cables with textured cable sprites or segmented cable paths
- [ ] Add blinking link LEDs on connected ports and device status LEDs on active hardware
- [ ] Add failure VFX for ports/devices: sparks, smoke puffs, warning flashes, intermittent flicker
- [ ] Add repair completion feedback: flash reset, LED recovery, traffic restoration pulse
- [ ] Add device placement animation: slide-in/snap-in with subtle bounce
- [ ] Add selection/highlight treatment that feels physical rather than UI-like
- [ ] Add connection restoration feedback when a repaired path comes back online
- [ ] Add renderer-level audio event hooks for place, connect, disconnect, alert, fail, repair, and revenue events

### Sprint 2.5 — UI Restructure and Onboarding
Support the tactile rack loop with a clearer surrounding interface.

- [ ] Add a persistent objective/tutorial panel in React
- [ ] Add a tutorial overlay/callout system that can spotlight UI and rack interactions
- [ ] Rework the right panel default state to show objectives, starter contract, and current blockers
- [ ] Rework the client panel to explain prospect urgency, contract value, and activation state
- [ ] Rework the top bar to prioritize net cashflow, reputation impact, and current incident status
- [ ] Add a scrolling event log or expandable operations feed for readable incident history
- [ ] Rework alert bar copy to use player-facing language instead of debug/system phrasing
- [ ] Add a first-revenue celebration moment: alert, animation, and obvious state change
- [ ] Add save/load UI backed by existing storage
- [ ] Add autosave and visible save-state feedback

### Sprint 2.6 — Progression, Milestones, and Pressure
Create reasons to keep building after the first solved network.

- [ ] Add a milestone progression system tied to solved gameplay problems, not only money
- [ ] Add milestone rewards: new equipment unlocks, new client tiers, new incident classes
- [ ] Add authored early-game milestones: first client served, first month profitable, first incident resolved, first congested link
- [ ] Gate new complexity behind milestones: simple hosting first, then isolation, then redundancy
- [ ] Add contract urgency: prospect expiration and clearer opportunity-cost messaging
- [ ] Add financial pressure metrics: burn rate, runway, monthly net, penalty exposure
- [ ] Add a balancing pass for the starter economy so first success arrives quickly but failure still matters
- [ ] Add client flavor text/archetypes so contracts feel like jobs, not rows in a table
- [ ] Add reputation-based content pacing so stronger clients appear as a result of competence

### Sprint 2.7 — Asset Pipeline and Audio Preparation
Set up production-friendly workflows so the look and feel can scale.

- [ ] Create asset directory structure: `client/public/assets/{backgrounds,racks,devices,cables,fx,ui}`
- [ ] Define naming/versioning scheme for sprite atlases and layered device parts
- [ ] Document target sprite scale, palette, and export rules for consistent art production
- [ ] Add placeholder-to-final asset swap points so engineering can progress before all art is finished
- [ ] Add renderer abstractions for device prefabs and cable prefabs instead of hardcoded scene drawing
- [ ] Add a sound event registry and trigger points even if final audio assets are not ready
- [ ] Add performance budgets for particles, animated links, and layered sprite counts
- [ ] Test the rack scene at dense occupancy to ensure the layered approach remains readable and performant

### Phase 2 Done When
New players can start a game and understand the next step without external explanation. The rack is a tactile, sprite-based play space with visible devices, cables, LEDs, traffic, and failure states. The first session teaches the build → connect → serve → fail → fix loop through direct interaction, and the game has a clear visual identity with enough progression pressure to make the second hour desirable.

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
