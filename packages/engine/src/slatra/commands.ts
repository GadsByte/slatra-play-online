import { Position, UnitClass } from './types';

export type GameCommand =
  | { type: 'START_GAME' }
  | { type: 'PLACE_HAZARD'; position: Position }
  | { type: 'ROLL_OBJECTIVES' }
  | { type: 'DEPLOY_UNIT'; unitClass: string; position: Position }
  | { type: 'FINISH_DEPLOYMENT' }
  | { type: 'ROLL_INITIATIVE' }
  | { type: 'SELECT_UNIT'; unitId: string }
  | { type: 'DESELECT_UNIT' }
  | { type: 'SELECT_DEPLOY_CLASS'; unitClass: UnitClass }
  | { type: 'MOVE_UNIT'; position: Position }
  | { type: 'ATTACK_UNIT'; targetId: string }
  | { type: 'USE_ABILITY'; targetId?: string; direction?: string }
  | { type: 'INTERACT_OBJECTIVE' }
  | { type: 'END_ACTIVATION' }
  | { type: 'ANCIENT_EVASION'; unitId: string; position: Position }
  | { type: 'LAST_RITE'; targetId: string }
  | { type: 'FORFEIT' }
  | { type: 'DISMISS_DICE' }
  | { type: 'SELECT_TILE'; position: Position | null };
