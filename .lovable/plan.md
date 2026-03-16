

## Plan: Allow switching selected unit before taking any action

**What the user wants**: When a unit is selected but the player hasn't moved, attacked, or used any ability yet, clicking another friendly unactivated unit should switch selection to that unit instead.

**Current behavior**: `SELECT_UNIT` is only allowed when `subPhase === 'select_unit'`. Once a unit is selected, `subPhase` becomes `'unit_actions'` and clicking friendly units does nothing.

### Changes

**1. `src/game/gameReducer.ts`** — Update the `SELECT_UNIT` case:
- Allow `SELECT_UNIT` when `subPhase === 'unit_actions'` AND the active unit hasn't taken any action (no move spent, no attack, no ability, no objective interaction).
- If conditions are met, reset `activeUnit` to the newly clicked unit with fresh action state.

**2. `src/components/game/SlatraGame.tsx`** — Update `handleTileClick`:
- In the `unit_actions` branch, before checking valid moves/attacks, check if the clicked tile has a friendly unactivated unit. If the active unit has taken no actions, dispatch `SELECT_UNIT` for the new unit.

- Also update `handleSelectUnit` to dispatch `SELECT_UNIT` during `unit_actions` subPhase (for clicks from the side panel).

These are the only two files that need changes. The logic is: if `movementRemaining === unit.move` (full movement left) and `hasAttacked`, `hasUsedAbility`, `hasInteractedObjective` are all false, switching is allowed.

