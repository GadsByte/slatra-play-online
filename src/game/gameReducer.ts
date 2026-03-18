import { applyCommand, createInitialState, createMathRandom, GameCommand, GameState } from '../../packages/engine/src/slatra';

export type GameAction = GameCommand;

const defaultRng = createMathRandom();

export { createInitialState };

export function gameReducer(state: GameState, action: GameAction): GameState {
  return applyCommand(state, action, defaultRng);
}
