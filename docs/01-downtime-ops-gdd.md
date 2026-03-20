# DowntimeOPS — Game Design Document

**Version:** 0.2 Draft
**Date:** March 2026
**Status:** Pre-production

---

## 1. Concept

A datacenter tycoon game where **networking IS the gameplay**. The player builds, cables, configures, and debugs real network infrastructure. Think Netbox meets Factorio — the depth comes from authentic networking decisions, not abstract resource management.

**Target audience:** Engineers, sysadmins, networking enthusiasts, and tycoon game fans who want something deeper than the usual "place building, watch money go up."

**Unique selling point:** No other game treats networking as a first-class gameplay mechanic. Players configure VLANs, set up routing, trace packets through their infrastructure, and debug real (simplified) network problems. The "aha!" moment of finding a misconfigured route feels just like real incident response.

---

## 2. Core Loop

```
Client arrives with requirements
        ↓
Plan infrastructure
        ↓
Buy & rack equipment
        ↓
Cable & configure network
        ↓
Connections flow through your topology
        ↓
Earn revenue from served traffic
        ↓
Handle incidents & debug problems
        ↓
Scale up → bigger clients → more complexity
        ↓
(repeat)
```

The key insight from Factorio/Satisfactory: the player is always solving the NEXT problem. Every solution creates new constraints that require new solutions. A flat network works until you need client isolation. VLANs work until you need inter-VLAN routing. Static routes work until you have 50 subnets. The game naturally pushes you toward more sophisticated solutions.

---

## 3. Game Layers

### 3.1 Physical Layer

The player manages physical infrastructure:

- **Site** — your building(s), where fiber enters, power feeds
- **Rooms** — floor plan with rack positions, cooling zones, cable trays
- **Racks** — 42U standard racks, vertical elevation view (like Netbox)
- **Devices** — servers, switches, routers, firewalls, patch panels, PDUs
- **Cabling** — copper (Cat6), fiber (single-mode, multi-mode), with capacity limits
- **Power** — each rack has a power budget, overload = shutdown
- **Cooling** — equipment generates heat, cooling units have coverage radius

Equipment has physical properties: U height, power draw, heat generation, port count, port type. You slot devices into specific rack positions and run cables between ports.

### 3.2 Network Layer

This is where the game is unique. The network actually works — connections follow the rules the player sets up.

**Ports & Links**
- Each device has physical ports (copper, fiber, different speeds)
- Ports connect via cables to form links
- Links have bandwidth capacity; overloaded links throttle or reject new connections
- Port status: up/down, speed negotiation, error counters

**VLANs**
- Switch ports assigned to VLANs (access mode or trunk mode)
- VLANs provide L2 isolation between clients
- Trunk ports carry tagged traffic between switches
- Visual: VLANs are color-coded, player drags ports into color groups

**IP Addressing**
- Each VLAN gets a subnet (semi-automatic — game suggests, player can override)
- Devices get IPs on their connected subnets
- Misconfigured IPs = no connectivity

**Routing**
- Static routes for simple setups
- OSPF for internal routing (unlocked mid-game)
- BGP for ISP peering (unlocked late-game)
- Visual: routing shown as directed paths on network map
- Routing loops create visible connection failures

**Firewalling**
- Rule-based filtering (ordered rule list)
- Rules: allow/deny based on source, destination, port, protocol
- Rule order matters — first match wins
- Wrong rule order = security breach or broken connectivity

**Uplinks**
- Paid internet connections with bandwidth limits
- Multiple ISPs available with different price/performance
- Redundant uplinks for high availability
- BGP peering decisions affect traffic paths and costs

### 3.3 Business Layer

- **Clients** arrive with contracts: bandwidth, uptime SLA, isolation requirements, latency
- **Small clients** (startup, personal site) — cheap, low requirements
- **Medium clients** (e-commerce, SaaS) — need VLANs, redundancy, better SLAs
- **Large clients** (banks, streaming, enterprise) — dedicated infrastructure, strict isolation, 99.99% uptime
- **Revenue** — monthly payments based on contract terms
- **Costs** — equipment purchase, power consumption, uplink bandwidth, cooling, floor space rent
- **SLA penalties** — downtime or performance violations cost money and reputation
- **Reputation** — affects which clients approach you; low rep = only cheap clients

### 3.4 Operations Layer

The "live" part of the game — things happen, you respond.

**Equipment failures:**
- Port failures (flapping, errors)
- Disk failures in servers
- Power supply failures
- Cooling unit breakdown → thermal throttling → cascading failures
- Cable damage

**Network incidents:**
- DDoS attacks (traffic floods)
- Routing anomalies (BGP hijack if peering)
- Broadcast storms (VLAN misconfiguration)
- Congestion events

**Debugging tools:**
- **Connection Inspector** (primary monitoring tool — see active connections per link, bandwidth utilization, source/destination, connection health)
- **Packet Tracer** (on-demand debugging tool — spawns a single test packet to trace its path step-by-step through the network; see section 4)
- **Traffic Monitor** — per-interface bandwidth graphs showing aggregate connection utilization
- **Device Logs** — syslog-style event log per device
- **Topology Map** — auto-generated network diagram
- **Alerts** — configurable thresholds ("alert when link > 80%")

---

## 4. Connection Inspection & Packet Trace — The Signature Mechanics

### Traffic model

Normal traffic in the game is simulated as **connections** (bandwidth streams), not individual packets. A connection represents a continuous flow of data — e.g., "Client A's web traffic → Server B, 50 Mbps." Links show aggregate utilization from all connections traversing them. This keeps the simulation efficient and the gameplay focused on capacity planning and topology.

### Connection Inspector

The player's primary monitoring tool. Select any link or device to see:
- Active connections passing through it
- Bandwidth allocation per connection
- Source/destination for each connection
- Connection health (active, degraded, throttled)
- Total utilization vs. capacity

### Packet Tracer

When something goes wrong and the player needs to understand *why*, they use the Packet Tracer — an on-demand debugging tool inspired by MikroTik's Torch tool.

**How it works:**

1. Player opens the Packet Tracer tool
2. Creates a test packet: source IP, destination IP, protocol, port
3. "Injects" the packet
4. Watches it traverse the network step-by-step, in slow motion

**At each hop, the player sees:**

**Router hop:**
- Routing table lookup (all routes shown, matching route highlighted)
- Decision: "destination 10.0.3.0/24 → matched rule 5 → forward to eth2"
- Green = match found, packet forwarded
- Red = no route, packet dropped

**Switch hop:**
- MAC table lookup
- VLAN tag check: "ingress port VLAN 20, packet tagged VLAN 20 → OK"
- Forwarding decision: "destination MAC → port 12"
- VLAN mismatch = red highlight, packet drops

**Firewall hop:**
- Rules evaluated top to bottom, each rule shown
- First matching rule highlighted
- Allow = green, packet passes
- Deny = red, packet blocked
- Player sees exactly which rule matched (or didn't)

### Difficulty scaling:

- **Early game:** Cable unplugged. Trace shows packet stops at disconnected port. Obvious.
- **Mid game:** VLAN mismatch on trunk, missing route for new subnet, firewall rule order wrong.
- **Late game:** Asymmetric routing, MTU issues, BGP prefix not advertised, subtle misconfigurations.

### Why this is fun:

It turns networking knowledge into a superpower. The player who understands how routing works can diagnose problems in seconds. The player who doesn't will learn by watching the trace and understanding why their packet was dropped. It's educational AND satisfying.

---

## 5. Gameplay Progression

> **Note:** These are in-game progression phases (what the player experiences). They are not the same as development phases — see `docs/plan.md` for the development roadmap.

### Phase 1 — "The First Rack"
- One 42U rack
- One 100Mbps uplink (monthly cost)
- Equipment: 1U servers, 24-port switch, basic router
- Flat network — everything on one subnet
- Small clients: personal websites, small shops
- Simple failures: port down, cable break
- **Player learns:** physical placement, cabling, basic connectivity

### Phase 2 — "Growing Pains"
- 3-5 racks in one room
- Need for VLANs (bank client demands isolation)
- Inter-switch trunking
- First router for inter-VLAN routing
- Static routes
- Second uplink for redundancy
- **Player learns:** VLANs, subnetting, basic routing

### Phase 3 — "The Room"
- Full room management (floor plan view unlocked)
- Cooling zones matter — hot/cold aisle
- Multiple switches, aggregation layer
- OSPF replaces static routes
- Firewalls for client security
- Medium clients with strict SLAs
- Hire NOC staff for basic monitoring
- **Player learns:** routing protocols, firewall rules, capacity planning

### Phase 4 — "The Campus"
- Multiple rooms, maybe multiple buildings
- Core/distribution/access network architecture
- BGP peering with multiple ISPs
- Traffic engineering — choose paths based on cost/latency
- DDoS mitigation infrastructure
- Large enterprise clients
- Edge PoPs in the city
- **Player learns:** BGP, traffic engineering, large-scale design

### Phase 5 — "Global Operations"
- Multiple datacenter locations in different cities/countries
- Inter-DC connectivity and traffic engineering
- Become an ISP — peer with other providers
- Lay fiber to businesses
- Compete for transit customers
- Internet exchange points
- Multiplayer: compete or cooperate with other operators (future)

---

## 6. UI / UX Design

### Views (zoom levels):

1. **Site View** — building exterior, fiber entry points, power feeds. High-level overview.
2. **Room View** — isometric/top-down floor plan. Rack positions, cooling units, cable trays. This is where you place racks and plan layout.
3. **Rack View** — Netbox-style rack elevation (42U vertical). Front and rear. Slot devices, see power usage, port status. The primary "building" interface.
4. **Device Panel** — click any device to see ports, configuration, stats. This is where you assign VLANs, set routes, configure firewalls.
5. **Network Map** — auto-generated topology diagram showing logical connections, traffic flow, VLAN domains.
6. **Connection & Trace View** — connection inspector for live monitoring; packet tracer for step-through debugging.
7. **Dashboard** — financial overview, SLA status, alerts, client list.

### Interaction model:

- All configuration is visual — click, drag, select from lists
- No command line (maybe as an optional power-user feature later)
- Color coding is heavy — VLANs, traffic health, device status
- Tooltips and contextual info everywhere
- Right-click for context menus on devices/ports/cables

---

## 7. Phase 1 Scope — "Vertical Slice"

What we build first to prove the gameplay is fun. The goal is the thinnest possible version of the full loop: build → traffic flows → break → trace → fix.

Implementation is server-authoritative (see tech architecture doc for details).

### Included:
- One rack view (42U elevation)
- Equipment catalog: 1U server, 1U 24-port switch, 1U router (acts as uplink gateway in Phase 1; full routing in Phase 3)
- Drag equipment into rack slots
- Cable between device ports (visual cable routing)
- One uplink connection
- Simple clients that request hosting (just bandwidth + uptime)
- Connection-based traffic flow — see bandwidth utilization across your network
- Basic packet tracer — step through a test packet's path on demand
- Money system: income from clients, costs for equipment and uplink
- One failure type: port goes down
- Game clock with pause and speed controls

### NOT included in Phase 1:
- VLANs (everything on one flat network)
- Routing (only one subnet)
- Firewalls
- Room/floor view
- Cooling/power simulation
- Staff hiring
- Multiple uplinks

### Success criteria:
The player should feel the satisfaction of: "I built this small network, I can see connections flowing through it, something broke, I traced a packet and found the problem, I fixed it." If that loop is fun — the game works.

---

## 8. Monetization (future consideration)

- Premium game on Steam (not free-to-play)
- No microtransactions
- Possible DLC for expansion packs (new scenarios, equipment types, campaign missions)
- Community workshop for custom scenarios

---

## 9. Inspiration & References

- **Factorio** — the "build systems, optimize, handle complexity" loop
- **Satisfactory** — spatial building, visual flow
- **OpenTTD** — transport logistics, growing network
- **Netbox** — UI/UX for device management
- **MikroTik Torch** — packet tracing gameplay mechanic
- **Datacenter Tycoon** — genre reference (we go much deeper on networking)
- **Prison Architect** — top-down management sim visual style
- **Shenzhen I/O** — making technical knowledge into gameplay

---

## 10. Future Direction

**Multiplayer:** The game architecture is server-authoritative and multi-client-capable from the start. This opens the door to multiplayer modes in the future — competitive datacenter operators, shared infrastructure, or cooperative management. Design details TBD; this is aspirational, not near-term scope.

**Global scale:** Multiple datacenter locations across cities and countries, with inter-DC networking, transit agreements, and internet exchange participation.
