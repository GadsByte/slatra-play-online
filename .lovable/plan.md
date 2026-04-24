
# Multiplayer Setup: Alternating Hazards & Per-Player Deployment

## Goal
Restructure the match setup so each player is responsible for their own units and half the hazards, instead of one player ("plague") doing everything.

## New setup flow

After the room starts, the game runs through this sequence:

```text
1. objective_roll           (auto / either player can roll — board state only)
2. plague deploys 6 units   (rows 1-2)
3. plague places 2 hazards  (rows 3-6)
4. bone deploys 6 units     (rows 7-8)
5. bone places 2 hazards    (rows 3-6)
6. initiative_roll          (either player)
7. playing                  (existing turn-by-turn flow)
```

Why this order: each player commits their army before seeing the opponent's, then drops their hazards knowing where their own units sit but before the opponent's are placed (still an information asymmetry, but a fair and symmetric one). Total hazards on the board = 4, same as today. This avoids two boring "wait for opponent" gaps in a row.

Local (single-screen) play keeps the same total flow, just reordered — still feels natural with one device.

## Gameplay changes (`src/game/types.ts` + `src/game/gameReducer.ts`)

- Add `currentPlayer: Faction` semantics to setup phases. The reducer already tracks `currentPlayer`; we will set it explicitly during setup so the multiplayer turn gate works.
- Replace `hazardsToPlace: number` with `hazardsToPlace: number` plus the active faction implied by `currentPlayer`. Each hazard-placement turn places exactly 2.
- Rework phase transitions in the reducer:
  - `objective_roll` → `deployment_p1` (plague), `currentPlayer = 'plague'`
  - `deployment_p1` (after 6 plague units) → `hazard_placement` with `currentPlayer = 'plague'`, `hazardsToPlace = 2`
  - `hazard_placement` (plague's 2 placed) → `deployment_p2`, `currentPlayer = 'bone'`
  - `deployment_p2` (after 6 bone units) → `hazard_placement` with `currentPlayer = 'bone'`, `hazardsToPlace = 2`
  - `hazard_placement` (bone's 2 placed) → `initiative_roll`
- `PLACE_HAZARD` keeps row 3-6 validation; on completion of a player's 2 hazards, advance to next phase based on which faction just finished.
- `DEPLOY_UNIT` already keys off `state.phase`; no change needed beyond the new transition target after `deployment_p1`.
- Update setup log messages to reflect the new sequence.

## Multiplayer turn gating (`src/components/game/SlatraGameView.tsx`)

`SlatraGameView` currently computes `isMyTurn = localFaction === undefined || state.currentPlayer === localFaction`. With `currentPlayer` set correctly during setup, this already works for hazards and deployment. Two small fixes:

- `objective_roll` and `initiative_roll`: these are board-state events that either player can trigger. Allow either side to dispatch the roll button (treat as host-or-anyone). Simplest: any player whose turn flag is `currentPlayer` may roll; we will set `currentPlayer = 'plague'` for `objective_roll` (host rolls) and to whoever has initiative-roll responsibility — keep it simple: `objective_roll` = plague rolls, `initiative_roll` = bone rolls. This guarantees both players are involved.
- The deployment unit-class buttons and hazard banner already render based on `interactive`; no change needed beyond the gating logic above.

## Multiplayer dispatch (`src/pages/MultiplayerGame.tsx`)

The current `syncDispatch` blocks dispatch unless `state.currentPlayer === localFaction`. With the reducer setting `currentPlayer` correctly for every setup phase, this gate already does the right thing — no logic change needed.

The status banner copy should be slightly improved to read clearly during setup ("WAITING FOR OPPONENT TO DEPLOY", "WAITING FOR OPPONENT TO PLACE HAZARDS"). Small UI polish in the banner.

## Status banner copy (`src/pages/MultiplayerGame.tsx`)

Replace the generic "YOUR TURN / WAITING FOR OPPONENT" with phase-aware text:
- `objective_roll` (plague): "ROLL FOR OBJECTIVES" / "WAITING FOR OBJECTIVE ROLL"
- `deployment_p1`/`deployment_p2`: "DEPLOY YOUR UNITS" / "OPPONENT IS DEPLOYING"
- `hazard_placement`: "PLACE 2 HAZARDS" / "OPPONENT IS PLACING HAZARDS"
- `initiative_roll`: "ROLL FOR INITIATIVE" / "WAITING FOR INITIATIVE ROLL"
- `playing`: existing "YOUR TURN" / "WAITING FOR OPPONENT..."

## Files to change

| File | Change |
|------|--------|
| `src/game/types.ts` | (no shape change expected; existing fields suffice) |
| `src/game/gameReducer.ts` | Reorder setup phase transitions, set `currentPlayer` during setup, split hazard placement into 2+2, update logs |
| `src/components/game/SlatraGameView.tsx` | (no change — gating already works once reducer sets `currentPlayer`) |
| `src/pages/MultiplayerGame.tsx` | Phase-aware status banner copy |

No database changes. Backwards-incompatible for any in-flight games (they would be mid-setup with the old phase order) — acceptable since rooms expire after 60 minutes.

## Out of scope
- Reordering for local single-device play UX (it just runs through the same new sequence; both players share the screen)
- Showing the opponent's deployments live during their turn (they will appear on the board as they happen via existing realtime sync — no extra work)
- Bans/draft/snake order for hazards
