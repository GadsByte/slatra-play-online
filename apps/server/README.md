# @slatra/server

Initial Node.js + TypeScript + Socket.IO backend milestone for SLATRA.

## Features in this milestone

- `GET /health`
- Socket.IO connection
- player identity / display-name registration
- persistent room list with restart recovery
- create room
- join room
- leave room
- ready toggle
- persisted player sessions, rooms, and active matches

## Local run

From the repo root:

```sh
npm install
npm run dev:server
```

Or from the server workspace:

```sh
npm install
npm run dev --workspace @slatra/server
```

## Environment variables

### Local development

- `PORT` — HTTP + Socket.IO port. Defaults to `3001`.
- `CLIENT_ORIGIN` — CORS origin for the frontend. Defaults to `*`.

Suggested local values live in `.env.example`:

```sh
PORT=3001
CLIENT_ORIGIN=http://localhost:8080
PERSISTENCE_FILE=.data/slatra-server-state.json
```

### Deployed environments

- `PORT` — production listening port. Most hosts inject this automatically; if they do not, set it explicitly.
- `CLIENT_ORIGIN` — required deployed frontend origin allowed to connect to this Socket.IO server. Set this to the exact frontend URL for production.
- `PERSISTENCE_FILE` — filesystem path for the JSON snapshot that stores player sessions, room state, and active matches across process restarts. Defaults to `.data/slatra-server-state.json` relative to the working directory.

If the frontend is deployed on a different origin than the backend, this must align with the frontend's `VITE_MULTIPLAYER_SERVER_URL` value documented in the root `README.md`.

## Mandatory verification before deployment

Run the repository-wide deploy verification path from the repo root before any production deploy:

```sh
npm ci
npm run ci:deploy-checks
```

The full checklist is documented in [`../../docs/deploy-checklist.md`](../../docs/deploy-checklist.md) and covers:

- root frontend build verification
- `apps/server` build + typecheck verification
- `packages/shared` build + typecheck verification
- `packages/engine` build + typecheck verification
- backend room lifecycle smoke test
- frontend multiplayer provider initialization smoke test

Production deployment is expected to run through the gated root command:

```sh
npm run deploy:production
```

## Notes

- The server now restores persisted player sessions, rooms, and active matches from the JSON snapshot referenced by `PERSISTENCE_FILE`.
- Persistence currently uses a local filesystem snapshot rather than an external database.
- Frontend multiplayer transport is environment-driven and can now be verified with a provider smoke test before deploy.
