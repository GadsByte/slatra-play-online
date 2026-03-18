# @slatra/engine

This package now contains the first extracted slice of reusable SLATRA game logic.

## Extracted in this pass

- core game state/types
- board/unit helper functions
- deterministic command interface (`GameCommand`)
- RNG abstraction (`EngineRandom`)
- command application entry point (`applyCommand(state, command, rng)`)

## Still coupled outside the package

The React UI still owns:
- reducer wiring through `useReducer`
- click/selection orchestration in `SlatraGame.tsx`
- view-model derivation for highlighted tiles and action affordances
- presentation-specific strings and layout decisions in UI components

## Current integration strategy

The frontend keeps importing from `src/game/*`, but those files are now thin compatibility wrappers around engine exports. This keeps the UI stable while moving gameplay code toward a reusable package.
