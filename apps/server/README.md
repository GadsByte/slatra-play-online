# @slatra/server

Initial Node.js + TypeScript + Socket.IO backend milestone for SLATRA.

## Features in this milestone

- `GET /health`
- Socket.IO connection
- player identity / display-name registration
- in-memory room list
- create room
- join room
- leave room
- ready toggle

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

- `PORT` — HTTP + Socket.IO port. Defaults to `3001`.
- `CLIENT_ORIGIN` — CORS origin for the frontend. Defaults to `*`.

See `.env.example` for suggested local values.

## Notes

- Room state is in-memory only.
- No database or persistence is used yet.
- No gameplay/match engine integration is wired yet.
- The frontend multiplayer pages still use the local mock provider and have not been pointed at this backend yet.
