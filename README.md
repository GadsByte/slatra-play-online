# SLATRA

SLATRA is a browser adaptation of a tactical 2-player board game. The current repository still runs the existing Vite/React frontend from the repo root while the codebase is being migrated, in small stages, toward a multi-package architecture with a Node.js + TypeScript + Socket.IO backend.

## Current state

- **Current runnable frontend:** repo root (`src/`, `vite.config.ts`, current `npm run dev` flow)
- **Local game mode:** implemented client-side and still the gameplay reference
- **Multiplayer UI:** socket-backed by default; in-browser local multiplayer remains available only as an explicit offline/demo mode
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

Frontend multiplayer transport selection is environment-driven:
- `VITE_MULTIPLAYER_TRANSPORT=socket` is the required default for normal multiplayer usage in local development, preview, and production.
- `VITE_MULTIPLAYER_TRANSPORT=local` is an explicit offline/demo-only override for the in-browser mock client.
- `VITE_MULTIPLAYER_LOCAL_SEEDS=demo` is optional and only applies when local transport is enabled; it injects clearly labeled `[Demo]` rooms/matches into browser storage.
- If local transport is enabled together with demo seeding, **you will see dummy rooms** and dummy match state in the multiplayer UI.
- `VITE_MULTIPLAYER_SERVER_URL` sets the backend Socket.IO server URL. If omitted, development falls back to `http://localhost:3001` and production uses the current site origin.

### Backend

```sh
npm install
npm run dev:server
```

## Environment variables

### Frontend environment matrix

Use the following exact frontend settings unless you are intentionally running the offline/demo transport:

| Environment | `VITE_MULTIPLAYER_TRANSPORT` | `VITE_MULTIPLAYER_SERVER_URL` | `VITE_MULTIPLAYER_LOCAL_SEEDS` | Notes |
| --- | --- | --- | --- | --- |
| Local development | `socket` | `http://localhost:3001` | Unset | Required for normal local multiplayer against `npm run dev:server`. |
| Local development (offline/demo only) | `local` | Optional; ignored by local transport | Unset by default, or `demo` to preload demo data | If `VITE_MULTIPLAYER_LOCAL_SEEDS=demo`, you will see dummy rooms and dummy match state. |
| Preview build | `socket` | `https://<preview-backend-host>` or the preview frontend origin when the backend is served from the same origin | Unset | Required so previews exercise the real Socket.IO path instead of mock data. |
| Production | `socket` | `https://<production-backend-host>` or the production frontend origin when the backend is served from the same origin | Unset | Required for live multiplayer. Do not enable local transport in production. |

### Local development

| Surface | Variable | Required? | Purpose | Expected local value |
| --- | --- | --- | --- | --- |
| Frontend | `VITE_MULTIPLAYER_TRANSPORT` | Yes | Chooses the multiplayer transport implementation. | `socket` |
| Frontend | `VITE_MULTIPLAYER_SERVER_URL` | Yes | Points the frontend at the Socket.IO backend for normal multiplayer development. | `http://localhost:3001` |
| Frontend | `VITE_MULTIPLAYER_LOCAL_SEEDS` | No | Opt-in demo seed data for explicit local transport only. | Unset, or `demo` for offline/demo work |
| Server | `PORT` | Optional | HTTP + Socket.IO port for `apps/server`. | `3001` |
| Server | `CLIENT_ORIGIN` | Optional | CORS origin allowed to connect to the backend. | `http://localhost:8080` |

Example local pairing for real multiplayer:

```sh
# frontend
VITE_MULTIPLAYER_TRANSPORT=socket
VITE_MULTIPLAYER_SERVER_URL=http://localhost:3001

# apps/server
PORT=3001
CLIENT_ORIGIN=http://localhost:8080
```

Example offline/demo-only local transport:

```sh
# frontend
VITE_MULTIPLAYER_TRANSPORT=local
VITE_MULTIPLAYER_LOCAL_SEEDS=demo
```

### Deployed environments

| Surface | Variable | Required? | Purpose |
| --- | --- | --- | --- |
| Frontend | `VITE_MULTIPLAYER_TRANSPORT` | Yes | Set to `socket` for preview and production builds. |
| Frontend | `VITE_MULTIPLAYER_SERVER_URL` | Yes | Set to the exact public Socket.IO backend origin used by that environment. |
| Frontend | `VITE_MULTIPLAYER_LOCAL_SEEDS` | No | Leave unset in preview and production; only use `demo` for explicit offline/demo work. |
| Server | `PORT` | Usually platform-provided | Listening port used by the backend process. |
| Server | `CLIENT_ORIGIN` | Yes | Exact deployed frontend origin allowed by Socket.IO CORS. |

If the frontend and backend are deployed on different origins, `VITE_MULTIPLAYER_SERVER_URL` and `CLIENT_ORIGIN` must be configured as a matching pair.

## Mandatory deploy verification path

Before deploying this refactor, run the documented verification path in [`docs/deploy-checklist.md`](docs/deploy-checklist.md).

Quick path from the repo root:

```sh
npm ci
npm run ci:deploy-checks
```

Production deployments should go through:

```sh
npm run deploy:production
```

That command is intentionally gated: it runs all required verification commands first and will refuse to continue until a real production deploy command is configured.

## Workspace notes

The root `package.json` declares workspaces for `apps/*` and `packages/*`. The repo is therefore ready for follow-up PRs that:

1. wire the frontend multiplayer provider to the Socket.IO backend
2. move multiplayer DTO usage from `src/features/multiplayer/*` to `packages/shared`
3. continue extracting rules from `src/game/*` into `packages/engine`
4. move the current frontend into `apps/web`
5. connect match state to the authoritative server
