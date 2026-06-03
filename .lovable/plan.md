## Problem

In multiplayer setup, Plague Order can place all hazards and both teams' units. The reducer's phase transitions and the `MultiplayerGame.tsx` dispatch gate (`state.currentPlayer === localFaction`) are already correct, so a fresh build *should* hand control to Bone after Plague's deployment + 2 hazards.

The real gap is that **nothing on the server enforces whose turn it is**. The `update_multiplayer_game` RPC only checks "is this user one of the two assigned players" — it accepts any new state from either player. That means:

- A stale Plague client (cached JS from before the turn-gating change) can keep dispatching for Bone with no rejection.
- A second tab, replayed state, or any direct RPC call from Plague's user_id will mutate the row freely.
- The client-side gate becomes the only line of defense, which is exactly why this regressed.

## Fix

Enforce turn ownership server-side, then verify the client gate still holds.

### 1. Server-side turn check (`update_multiplayer_game`)

In a new migration, replace the function so it inspects the **current** stored state's `currentPlayer` and rejects if the caller isn't that faction's assigned player.

```text
expected_player := CASE _current.state->>'currentPlayer'
                     WHEN 'plague' THEN _current.plague_player_id
                     WHEN 'bone'   THEN _current.bone_player_id
                   END;
IF _user_id <> expected_player THEN
  RAISE EXCEPTION 'Not your turn';
END IF;
```

This runs in addition to the existing membership check and the optimistic `version = _version - 1` guard. Game-over and missing-currentPlayer states fall back to the existing membership check (so cleanup writes still work).

### 2. Surface rejections in the client (`MultiplayerGame.tsx`)

When the RPC throws `Not your turn`:
- Roll back the optimistic local update by refetching the row.
- Show a toast: "It's not your turn."

This makes a stale-cache regression visible instead of silently corrupting state.

### 3. Audit the client gate

Re-confirm `SlatraGameView` and `MultiplayerGame.syncDispatch` only act when `state.currentPlayer === localFaction` for every setup phase (`objective_roll`, `deployment_p1`, `hazard_placement`, `deployment_p2`, `initiative_roll`). No code change expected — just a verification pass after the server gate is in place.

## Files

| File | Change |
|------|--------|
| `supabase/migrations/<new>.sql` | Replace `update_multiplayer_game` with turn-aware version |
| `src/pages/MultiplayerGame.tsx` | Handle "Not your turn" rejection: toast + refetch to drop optimistic state |

No reducer, types, or UI-layout changes. No DB schema changes.

## Out of scope

- Server-side validation of *what* each action does (e.g. "is this hazard in rows 3-6"). The reducer remains the source of truth for legal moves; the server only enforces *who* may write.
- Reworking the setup flow further — it already alternates correctly once turn ownership is enforced.
