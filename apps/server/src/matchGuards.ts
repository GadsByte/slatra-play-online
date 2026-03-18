import type { Faction, GameState } from '../../../packages/engine/src/slatra/types.js';
import type { MatchCommandDto } from '@slatra/shared';
import type { MatchStore } from './matchStore.js';

type MatchRecord = NonNullable<ReturnType<MatchStore['getMatchRecord']>>;

interface ValidationResult {
  allowed: boolean;
  message?: string;
}

function getControllingSeat(state: GameState): Faction | null {
  switch (state.phase) {
    case 'hazard_placement':
    case 'objective_roll':
    case 'deployment_p1':
    case 'initiative_roll':
      return 'plague';
    case 'deployment_p2':
      return 'bone';
    case 'playing':
      return state.currentPlayer;
    case 'title':
    case 'game_over':
    default:
      return null;
  }
}

export function validatePlayerCommand(match: MatchRecord, playerId: string, command: MatchCommandDto): ValidationResult {
  const playerSeat = match.seats.plague === playerId
    ? 'plague'
    : match.seats.bone === playerId
      ? 'bone'
      : null;

  if (!playerSeat) {
    return { allowed: false, message: 'You are not seated in this match.' };
  }

  if (match.gameState.phase === 'game_over') {
    return { allowed: false, message: 'This match is already over.' };
  }

  const controllingSeat = getControllingSeat(match.gameState);
  if (!controllingSeat || controllingSeat !== playerSeat) {
    return { allowed: false, message: 'It is not your turn to issue a match command.' };
  }

  if (
    (command.type === 'MOVE_UNIT'
      || command.type === 'ATTACK_UNIT'
      || command.type === 'USE_ABILITY'
      || command.type === 'INTERACT_OBJECTIVE'
      || command.type === 'END_ACTIVATION'
      || command.type === 'DESELECT_UNIT')
    && (!match.gameState.activeUnit || !match.gameState.units.some(unit => unit.id === match.gameState.activeUnit?.unitId && unit.faction === playerSeat))
  ) {
    return { allowed: false, message: 'You do not control the currently active unit.' };
  }

  if (command.type === 'SELECT_UNIT') {
    const unit = match.gameState.units.find(existingUnit => existingUnit.id === command.unitId);
    if (!unit || unit.faction !== playerSeat) {
      return { allowed: false, message: 'You can only select one of your own units.' };
    }
  }

  return { allowed: true };
}
