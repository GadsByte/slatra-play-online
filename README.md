# SLATRA

SLATRA is a browser adaptation of a tactical 2-player board game. The current repository still runs the existing Vite/React frontend from the repo root while the codebase is being migrated, in small stages, toward a multi-package architecture with a Node.js + TypeScript + Socket.IO backend.

## Current state

- **Current runnable frontend:** repo root (`src/`, `vite.config.ts`, current `npm run dev` flow)
- **Local game mode:** implemented client-side and still the gameplay reference
- **Multiplayer UI:** frontend-only mock flow with provider-backed state and local persistence
- **Backend:** initial Socket.IO server milestone now scaffolded in `apps/server`
- **Rules engine extraction:** started in `packages/engine`

## Incremental monorepo scaffold

This repo now includes the first monorepo-ready folders without moving the live frontend yet:

```text
.
├── apps/
│   ├── server/        # Node.js + TypeScript + Socket.IO backend milestone
│   └── web/           # Planned destination for the Vite frontend
├── packages/
│   ├── engine/        # Reusable SLATRA rules extraction in progress
│   └── shared/        # Shared DTOs and socket event contracts
├── src/               # Current live frontend (temporary until a later move)
└── package.json       # Current frontend package + workspace root
```

### Why the frontend was not moved yet

Moving the existing app into `apps/web` in the same PR would create a large path-churn refactor on top of the backend/shared/engine work. To reduce risk, the current frontend remains at the repository root in this pass so future PRs can move it more mechanically and with less review noise.

## New folders

### `apps/server`

Initial backend milestone with:
- `GET /health`
- Socket.IO server
- in-memory player identity registration
- in-memory room list/create/join/leave/ready flows

### `packages/shared`

Shared TypeScript package for cross-app contracts.

Currently includes:
- multiplayer DTOs
- room/player identifiers
- Socket.IO client/server event interfaces
- shared server constants and health DTO

### `packages/engine`

Reusable SLATRA game logic extraction package.

Currently includes:
- local game state/types
- board and unit helper functions
- RNG abstraction
- command definitions
- `applyCommand(state, command, rng)`

## Running the project today

### Frontend

```sh
npm install
npm run dev
```

### Backend

```sh
npm install
npm run dev:server
```

## Workspace notes

The root `package.json` declares workspaces for `apps/*` and `packages/*`. The repo is therefore ready for follow-up PRs that:

1. wire the frontend multiplayer provider to the Socket.IO backend
2. move multiplayer DTO usage from `src/features/multiplayer/*` to `packages/shared`
3. continue extracting rules from `src/game/*` into `packages/engine`
4. move the current frontend into `apps/web`
5. connect match state to the authoritative server
