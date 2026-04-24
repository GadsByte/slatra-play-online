# Plan: Fix multiplayer game write security

## Goal
Resolve the security finding: **Any anonymous user can modify or delete any game**.

The multiplayer system currently uses localStorage-generated player IDs instead of authenticated accounts, so the safest fix for this pass is to scope game writes to verified room participants using the existing room/player records and the browser-provided player ID.

## What will change

1. **Replace permissive `games` write policies**
   - Drop the current policies that allow anyone to insert, update, or delete any game.
   - Keep public read access for now so room participants can load game state without a login flow.
   - Add stricter policies:
     - `INSERT`: only allowed when both assigned players are present in the matching room.
     - `UPDATE`: only allowed when the writer is one of the two assigned players and is still in that room.
     - `DELETE`: only allowed by a participant in that game room, or through backend cleanup/room cascade.

2. **Pass the local player ID into database writes safely**
   - Because the current multiplayer identity is stored in localStorage, database policies need a way to compare the request to that player ID.
   - Add a small helper around game mutations to send the current `user.id` as a request setting/header that RLS can validate.
   - Use that only for game creation, game updates, and leave/delete paths that touch game-related data.

3. **Add database helper functions for RLS**
   - Add `SECURITY DEFINER` functions that safely check:
     - whether a supplied player ID is in a room,
     - whether a supplied player ID is assigned to a game,
     - whether the game belongs to an active room.
   - These avoid recursive RLS issues and keep policies readable.

4. **Preserve room expiry cleanup**
   - Ensure the existing 60-minute expiry cleanup can still delete rooms and cascade-delete games.
   - Verify the cleanup function still works with the new policies.

5. **Verify the finding**
   - Run the security/linter checks after applying the migration.
   - Confirm the `games_unrestricted_write` finding is cleared or downgraded.
   - Build the app to confirm the multiplayer game code still compiles.

## Technical details

Current issue:

```sql
CREATE POLICY "Anyone can update games"
ON public.games
FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete games"
ON public.games
FOR DELETE
USING (true);
```

Proposed direction:

```sql
-- Conceptual policy shape
CREATE POLICY "Room participants can update games"
ON public.games
FOR UPDATE
USING (
  public.is_game_participant(id, current_setting('request.headers', true))
)
WITH CHECK (
  public.is_game_participant(id, current_setting('request.headers', true))
);
```

The exact implementation will be adapted to the request/header support available in the app client and database runtime.

## Important limitation

This fixes the immediate unrestricted-write issue for the current localStorage-based multiplayer system, but it is not as strong as full account-based authentication. A determined attacker could still impersonate a local player ID if they obtain or guess it.

A stronger future hardening pass would add Lovable Cloud authentication and store player identity using authenticated user IDs, then restrict RLS with `auth.uid()`.