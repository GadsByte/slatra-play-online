

# Multiplayer Gameplay Implementation Plan

## Goal
Take the existing local game (`SlatraGame.tsx` + `gameReducer.ts`) and make it playable between two remote players in a Supabase room.

## Core architecture

**Authoritative state in the database.** One row per active game holds the entire serialized `GameState`. Both clients read it, but only the player whose turn it is dispatches actions. Each action updates the DB row, and Realtime pushes the new state to both clients.

```text
Player A click → reducer (local) → write new state to DB
                                        ↓
                                   Realtime
                                        ↓
                          Player B receives new state → re-render
```

This keeps the existing reducer as the single source of truth — we just add a thin sync layer around it.

## What needs to be built

### 1. New `games` table
Stores the live game state for each room.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `room_id` | uuid | unique, links to `rooms` |
| `state` | jsonb | full serialized `GameState` |
| `plague_player_id` | text | which user controls Plague |
| `bone_player_id` | text | which user controls Bone |
| `version` | int | bumped on every update for optimistic concurrency |
| `updated_at` | timestamptz | |

RLS: anyone in the room can read; only the two assigned players can update (we'll keep policies permissive for now to match existing tables, tighten later with auth).

Realtime enabled on this table.

### 2. Faction assignment on game start
When the host clicks "START GAME" in `MultiplayerRoom.tsx`:
- Randomly assign one player to Plague, one to Bone
- Create the initial `GameState` via `createInitialState()`
- Insert a row into `games`
- Update room status to `in_game`
- Both clients navigate to `/multiplayer/game/:roomId`

### 3. New page: `MultiplayerGame.tsx`
A wrapper around the existing game UI that:
- Loads the game row for the room
- Subscribes to Realtime updates on that row
- Determines the local player's faction
- Renders the existing `GameBoard`, `UnitPanel`, `ActionBar`, etc.
- **Intercepts dispatch**: if it's the local player's turn, apply the reducer locally for instant feedback AND write the new state to the DB. If it's the opponent's turn, ignore input and just display incoming state from Realtime.

### 4. Refactor `SlatraGame.tsx` to be reusable
Currently `SlatraGame` owns the `useReducer`. We'll extract the rendering into a presentational component that accepts `state` and `dispatch` as props. The local-play page keeps a `useReducer`; the multiplayer page provides its own sync-aware dispatch.

### 5. Turn enforcement
The UI already tracks `currentPlayer`. We add: if `currentPlayer !== localFaction`, disable all click handlers (board, action bar, panels) and show a "Waiting for opponent..." indicator.

### 6. Disconnect handling (basic)
If a player leaves mid-game, mark the room as `finished` and show the other player a "Opponent disconnected — you win" screen. Detected via `room_players` row deletion.

## Files

| File | Action |
|---|---|
| `supabase/migrations/<new>.sql` | Create `games` table + RLS + Realtime |
| `src/multiplayer/types.ts` | Add `Game` interface |
| `src/multiplayer/MultiplayerContext.tsx` | Add `startGame` logic (create game row, assign factions), add `currentGame` state + subscription helpers |
| `src/components/game/SlatraGameView.tsx` | New — extracted presentational component (board + panels + action bar) taking `state`, `dispatch`, and optional `localFaction` |
| `src/pages/Index.tsx` (local play) | Use `SlatraGameView` with local `useReducer` |
| `src/pages/MultiplayerGame.tsx` | New — loads game row, subscribes, wraps `SlatraGameView` with sync dispatch |
| `src/pages/MultiplayerRoom.tsx` | Update "START GAME" to create game row + navigate |
| `src/App.tsx` | Add `/multiplayer/game/:roomId` route |

## Out of scope for this pass
- Replay / spectator mode
- Reconnect after browser refresh mid-game (state will load fine, but no formal "rejoin" flow)
- Server-side action validation (clients are trusted for now — fine for friendly play, not for ranked)
- Chat
- Authenticated accounts and tightened RLS

## Open question

