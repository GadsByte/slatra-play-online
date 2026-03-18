import type { MatchCommandDto } from '@slatra/shared';
import type { Faction, GameState } from '../../../packages/engine/src/slatra/index.js';
import type { MatchStore } from './matchStore.js';

type MatchRecord = NonNullable<ReturnType<MatchStore['getMatchRecord']>>;

interface ValidationResult {
  allowed: boolean;
  message?: string;
  reason?: 'not_authorized' | 'invalid_phase' | 'invalid_command';
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

function isCommandAllowedForCurrentPhase(state: GameState, command: MatchCommandDto) {
  switch (state.phase) {
    case 'hazard_placement':
      return command.type === 'PLACE_HAZARD';
    case 'objective_roll':
      return command.type === 'ROLL_OBJECTIVES';
    case 'deployment_p1':
    case 'deployment_p2':
      return command.type === 'SELECT_DEPLOY_CLASS' || command.type === 'DEPLOY_UNIT';
    case 'initiative_roll':
      return command.type === 'ROLL_INITIATIVE' || (command.type === 'DISMISS_DICE' && !!state.diceResult);
    case 'playing':
      if (command.type === 'FORFEIT') {
        return true;
      }
      if (command.type === 'DISMISS_DICE') {
        return !!state.diceResult;
      }
      if (command.type === 'SELECT_TILE') {
        return true;
      }
      if (state.subPhase === 'select_unit') {
        return command.type === 'SELECT_UNIT';
      }
      if (state.subPhase === 'unit_actions') {
        return [
          'SELECT_UNIT',
          'DESELECT_UNIT',
          'MOVE_UNIT',
          'ATTACK_UNIT',
          'USE_ABILITY',
          'INTERACT_OBJECTIVE',
          'END_ACTIVATION',
        ].includes(command.type);
      }
      return false;
    case 'title':
      return command.type === 'START_GAME';
    case 'game_over':
    default:
      return false;
  }
}

export function validatePlayerCommand(match: MatchRecord, playerId: string, command: MatchCommandDto): ValidationResult {
  const playerSeat = match.playerFactions[playerId] ?? null;
  if (!playerSeat) {
    return { allowed: false, reason: 'not_authorized', message: 'You are not seated in this match.' };
  }

  if (match.gameState.phase === 'game_over') {
    return { allowed: false, reason: 'invalid_phase', message: 'This match is already over.' };
  }

  const controllingSeat = getControllingSeat(match.gameState);
  if (!controllingSeat || controllingSeat !== playerSeat) {
    return { allowed: false, reason: 'not_authorized', message: 'It is not your turn to issue a match command.' };
  }

  if (!isCommandAllowedForCurrentPhase(match.gameState, command)) {
    return {
      allowed: false,
      reason: 'invalid_phase',
      message: `The ${command.type} command is not available during ${match.gameState.phase}.`,
    };
  }

  if (
    (command.type === 'MOVE_UNIT'
      || command.type === 'ATTACK_UNIT'
      || command.type === 'USE_ABILITY'
      || command.type === 'INTERACT_OBJECTIVE'
      || command.type === 'END_ACTIVATION'
      || command.type === 'DESELECT_UNIT')
    && (!match.gameState.activeUnit
      || !match.gameState.units.some(unit => unit.id === match.gameState.activeUnit?.unitId && unit.faction === playerSeat))
  ) {
    return { allowed: false, reason: 'invalid_command', message: 'You do not control the currently active unit.' };
  }

  if (command.type === 'SELECT_UNIT') {
    const unit = match.gameState.units.find(existingUnit => existingUnit.id === command.unitId);
    if (!unit || unit.faction !== playerSeat) {
      return { allowed: false, reason: 'invalid_command', message: 'You can only select one of your own units.' };
    }
  }

  if (command.type === 'DEPLOY_UNIT' && match.gameState.selectedDeployClass !== command.unitClass) {
    return {
      allowed: false,
      reason: 'invalid_command',
      message: 'Select a deploy class before placing that unit.',
    };
  }

  return { allowed: true };
}
