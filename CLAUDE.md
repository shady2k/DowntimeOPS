# DowntimeOPS — Claude Constitution

## Project Overview

DowntimeOPS is a datacenter tycoon game where networking is the core gameplay mechanic. The player builds, cables, configures, and debugs real network infrastructure.

## Architecture

- **Monorepo:** `server/`, `client/`, `shared/`
- **Server:** Bun + TypeScript — simulation engine, JSON-RPC over WebSocket, authoritative game state
- **Client:** Vite + React + Phaser — thin renderer, Zustand as local state mirror
- **Shared:** Type definitions, JSON-RPC contracts, storage interface
- **Communication:** JSON-RPC 2.0 over raw WebSocket. Client sends intentions, server validates and applies.
- **Traffic model:** Connection/flow-based (not per-packet). Packet Tracer spawns individual packets on-demand for debugging only.
- **Storage:** Abstraction layer (`GameStorage` interface). Currently JSON files, swappable to SQLite/cloud later.

## Key Principles

- **Simulation engine has zero UI imports.** Pure functions: `(GameState, Action) → GameState`. Keep it testable, portable, deterministic.
- **Server is authoritative.** Clients never modify game state directly. They send intentions via JSON-RPC; server validates and applies.
- **Use `Record<string|number, T>` not `Map`** for entity collections. Serializes cleanly, works with React/Zustand. Arrays are fine for ordered lists (routes, firewall rules).
- **Storage is always behind the `GameStorage` interface.** Never import a specific storage backend directly in game logic.
- **Transport is behind a clean interface.** JSON-RPC now, binary (MessagePack) can be swapped in later.
- **Renderer is swappable.** Any client that speaks the JSON-RPC protocol can render the game.

## Development

- **Runtime:** Bun
- **Testing:** Vitest for unit/integration tests, Playwright for E2E
- **Linting:** ESLint with TypeScript rules
- **Git hooks:** Husky pre-commit runs lint + tests via lint-staged
- **Commands:**
  - `bun run dev` — start server + client
  - `bun run dev:server` — server only
  - `bun run dev:client` — client only
  - `bun run test` — Vitest
  - `bun run test:e2e` — Playwright
  - `bun run lint` — ESLint

## Code Guidelines

- Keep simulation logic in `server/src/engine/`. No rendering code, no framework imports.
- All shared types go in `shared/src/types/`. Both server and client import from there.
- JSON-RPC method definitions and payload schemas go in `shared/src/rpc/`.
- Prefer simple, flat code. Don't over-abstract. Three similar lines > premature abstraction.
- No per-packet simulation in normal traffic. Connections are the simulation unit. Only the Packet Tracer creates individual packets.
- Test simulation engine thoroughly (near-100% coverage). It's pure functions — no excuses.
- Don't add features beyond what's asked. Follow the current development phase scope.

## Docs

Design and planning docs live in `docs/`. This file (CLAUDE.md) stays at repo root as the AI assistant constitution.

## MCP Tools

- When using Codex MCP, use `codex-reply` to continue an existing conversation thread instead of starting a new one.
