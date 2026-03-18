# Deploy verification checklist

This checklist is the mandatory verification path for shipping the current frontend/server refactor safely. Treat every item here as release-blocking for production.

## Required checks

Run these commands from the repository root:

```sh
npm run ci:frontend-build
npm run ci:server-build
npm run ci:server-typecheck
npm run ci:shared-build
npm run ci:shared-typecheck
npm run ci:engine-build
npm run ci:engine-typecheck
npm run test:smoke:server
npm run test:smoke:frontend
```

Or run the aggregate command:

```sh
npm run ci:deploy-checks
```

## Frontend (repo root) deploy checklist

- Install dependencies with `npm ci`.
- Confirm the root frontend builds successfully with `npm run ci:frontend-build`.
- Confirm the frontend multiplayer provider smoke test passes with `npm run test:smoke:frontend`.
- Verify the deployment environment provides the expected frontend variables:
  - `VITE_MULTIPLAYER_TRANSPORT`
  - `VITE_MULTIPLAYER_SERVER_URL`
- For production deployments, verify the frontend is configured to talk to the deployed backend origin.

## `apps/server` deploy checklist

- Install dependencies with `npm ci` from the repo root.
- Confirm the backend compiles with `npm run ci:server-build`.
- Confirm the backend typecheck passes with `npm run ci:server-typecheck`.
- Confirm the room lifecycle smoke test passes with `npm run test:smoke:server`.
- Confirm the shared package contracts build/typecheck cleanly:
  - `npm run ci:shared-build`
  - `npm run ci:shared-typecheck`
- Confirm the engine package build/typecheck cleanly:
  - `npm run ci:engine-build`
  - `npm run ci:engine-typecheck`
- Verify the deployment environment provides the expected server variables:
  - `PORT`
  - `CLIENT_ORIGIN`

## Production deployment gate

- GitHub Actions workflow `verify.yml` runs the full verification command on pushes and pull requests.
- GitHub Actions workflow `deploy-production.yml` runs the same verification job before the deploy job and will not proceed unless verification succeeds.
- Local production deploys should go through `npm run deploy:production`, which refuses to continue until `npm run ci:deploy-checks` passes.
