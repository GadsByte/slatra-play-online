import { GameState, Unit, Position, posEqual, posKey, rollDice, getAdjacent, getAdjacentEnemies, isIn5x5, CorpseMarker, createUnit, UnitClass } from './types';

// ===== Game Actions =====
export type GameAction =
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

export function createInitialState(): GameState {
  return {
    phase: 'objective_roll',
    subPhase: 'select_unit',
    round: 0,
    currentPlayer: 'plague',
    initiativePlayer: 'plague',
    units: [],
    corpses: [],
    hazards: [],
    objectives: [],
    activeUnit: null,
    selectedTile: null,
    diceResult: null,
    log: [],
    winner: null,
    hazardsToPlace: 0,
    selectedDeployClass: null,
    bannerActive: false,
    auraActive: false,
    damageBuff: null,
    lastRiteUsed: false,
    returnOfDeadUsed: false,
  };
}

function addLog(state: GameState, msg: string): GameState {
  return { ...state, log: [...state.log, msg] };
}

function checkWinCondition(state: GameState): GameState {
  const plagueAlive = state.units.filter(u => u.faction === 'plague' && u.hp > 0);
  const boneAlive = state.units.filter(u => u.faction === 'bone' && u.hp > 0);

  if (plagueAlive.length === 0) {
    return { ...state, phase: 'game_over', winner: 'bone' };
  }
  if (boneAlive.length === 0) {
    return { ...state, phase: 'game_over', winner: 'plague' };
  }
  return state;
}

function getUnitById(state: GameState, id: string): Unit | undefined {
  return state.units.find(u => u.id === id);
}

function updateUnit(state: GameState, id: string, updates: Partial<Unit>): GameState {
  return {
    ...state,
    units: state.units.map(u => u.id === id ? { ...u, ...updates } : u),
  };
}

function applyDamage(state: GameState, targetId: string, damage: number, source: string): GameState {
  const target = getUnitById(state, targetId);
  if (!target || target.hp <= 0) return state;

  const onObjective = state.objectives.some(o => posEqual(o.position, target.position));
  let actualDamage = damage;
  if (onObjective) {
    const half = damage / 2;
    if (half !== Math.floor(half)) {
      const coverRoll = rollDice('1d4');
      actualDamage = coverRoll.total <= 2 ? Math.floor(half) : Math.ceil(half);
      state = addLog(state, `Half cover! ${damage} → ${actualDamage} (cover roll: ${coverRoll.total})`);
    } else {
      actualDamage = half;
      state = addLog(state, `Half cover! ${damage} → ${actualDamage}`);
    }
  }

  if (state.bannerActive) {
    const commander = state.units.find(u => u.faction === 'plague' && u.unitClass === 'captain' && u.hp > 0);
    if (commander && target.faction === 'plague' && target.unitClass !== 'captain' && isIn5x5(commander.position, target.position)) {
      actualDamage = Math.max(0, actualDamage - 1);
      state = addLog(state, `Banner of Iron Faith reduces damage by 1!`);
    }
  }

  const newHp = Math.max(0, target.hp - actualDamage);
  state = addLog(state, `${target.name} takes ${actualDamage} damage (${target.hp} → ${newHp} HP)`);
  state = updateUnit(state, targetId, { hp: newHp });

  if (newHp <= 0) {
    if (target.faction === 'plague' && !state.lastRiteUsed) {
      const chaplain = state.units.find(
        u => u.faction === 'plague' && u.unitClass === 'medic' && u.hp > 0 && !u.pinned
      );
      if (chaplain) {
        const chaplainAdj = getAdjacent(chaplain.position);
        if (chaplainAdj.some(a => posEqual(a, target.position)) && target.id !== chaplain.id) {
          state = updateUnit(state, targetId, { hp: 1 });
          state = { ...state, lastRiteUsed: true };
          state = addLog(state, `⚡ LAST RITE! ${chaplain.name} saves ${target.name} at 1 HP!`);
          return state;
        }
      }
    }

    state = addLog(state, `💀 ${target.name} has been slain!`);
    const corpse: CorpseMarker = {
      position: { ...target.position },
      faction: target.faction,
      unitClass: target.unitClass,
      unitId: target.id,
      cleansed: false,
    };
    state = { ...state, corpses: [...state.corpses, corpse] };
    state = checkWinCondition(state);
  }

  return state;
}

function nextActivation(state: GameState): GameState {
  const plagueUnactivated = state.units.filter(u => u.faction === 'plague' && u.hp > 0 && !u.activated);
  const boneUnactivated = state.units.filter(u => u.faction === 'bone' && u.hp > 0 && !u.activated);

  if (plagueUnactivated.length === 0 && boneUnactivated.length === 0) {
    return endRound(state);
  }

  const nextPlayer = state.currentPlayer === 'plague' ? 'bone' : 'plague';
  const nextUnactivated = state.units.filter(u => u.faction === nextPlayer && u.hp > 0 && !u.activated);

  if (nextUnactivated.length > 0) {
    return { ...state, currentPlayer: nextPlayer, subPhase: 'select_unit', activeUnit: null };
  }

  const currentUnactivated = state.units.filter(u => u.faction === state.currentPlayer && u.hp > 0 && !u.activated);
  if (currentUnactivated.length > 0) {
    return { ...state, subPhase: 'select_unit', activeUnit: null };
  }

  return endRound(state);
}

function endRound(state: GameState): GameState {
  const newRound = state.round + 1;

  if (newRound > 8) {
    const plagueHp = state.units.filter(u => u.faction === 'plague' && u.hp > 0).reduce((s, u) => s + u.hp, 0);
    const boneHp = state.units.filter(u => u.faction === 'bone' && u.hp > 0).reduce((s, u) => s + u.hp, 0);
    const plagueCount = state.units.filter(u => u.faction === 'plague' && u.hp > 0).length;
    const boneCount = state.units.filter(u => u.faction === 'bone' && u.hp > 0).length;

    let winner: GameState['winner'] = null;
    if (plagueHp > boneHp) winner = 'plague';
    else if (boneHp > plagueHp) winner = 'bone';
    else if (plagueCount > boneCount) winner = 'plague';
    else if (boneCount > plagueCount) winner = 'bone';

    state = addLog(state, `⚔ Round 8 complete! ${winner ? `${winner === 'plague' ? 'Plague Order' : 'Bone Legion'} wins!` : 'DRAW!'}`);
    return { ...state, phase: 'game_over', winner, round: 8 };
  }

  state = addLog(state, `═══ Round ${newRound} begins ═══`);
  return {
    ...state,
    round: newRound,
    corpses: [],
    currentPlayer: state.initiativePlayer,
    subPhase: 'select_unit',
    activeUnit: null,
    bannerActive: false,
    auraActive: false,
    damageBuff: null,
    units: state.units.map(u => ({
      ...u,
      activated: false,
      usedAbilityThisRound: false,
      usedReactionThisRound: false,
      pinned: u.pinned ? false : u.pinned,
    })),
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return {
        ...createInitialState(),
        phase: 'objective_roll',
        currentPlayer: 'plague',
        hazardsToPlace: 0,
        log: ['Welcome to SLATRA. Plague Order rolls for objectives.'],
      };

    case 'PLACE_HAZARD': {
      if (state.phase !== 'hazard_placement') return state;
      const { position } = action;
      if (position.row < 3 || position.row > 6) return state;
      if (state.hazards.some(h => posEqual(h.position, position))) return state;
      if (state.objectives.some(o => posEqual(o.position, position))) return state;

      const newHazards = [...state.hazards, { position }];
      const remaining = state.hazardsToPlace - 1;

      let newState = {
        ...state,
        hazards: newHazards,
        hazardsToPlace: remaining,
      };
      newState = addLog(newState, `Hazard placed at ${position.row}${['A','B','C','D','E','F'][position.col]}`);

      if (remaining <= 0) {
        if (state.currentPlayer === 'plague') {
          newState = { ...newState, phase: 'deployment_p2', currentPlayer: 'bone', hazardsToPlace: 0 };
          newState = addLog(newState, 'Plague hazards placed. Bone Legion: Deploy your 6 units in rows 7-8.');
        } else {
          newState = { ...newState, phase: 'initiative_roll', currentPlayer: 'bone', hazardsToPlace: 0 };
          newState = addLog(newState, 'Bone hazards placed. Bone Legion rolls for initiative.');
        }
      }
      return newState;
    }

    case 'ROLL_OBJECTIVES': {
      if (state.phase !== 'objective_roll') return state;
      const roll1 = rollDice('1d6');
      const roll2 = rollDice('1d6');

      // Opposing objectives: Bone altar closer to Plague (row 4), Plague crate closer to Bone (row 5)
      let col1 = roll1.total - 1; // Bone altar in row 4
      let col2 = roll2.total - 1; // Plague crate in row 5

      while (state.hazards.some(h => h.position.row === 4 && h.position.col === col1)) {
        col1 = (col1 + 1) % 6;
      }
      while (state.hazards.some(h => h.position.row === 5 && h.position.col === col2)) {
        col2 = (col2 + 1) % 6;
      }

      let newState: GameState = {
        ...state,
        phase: 'deployment_p1',
        currentPlayer: 'plague',
        objectives: [
          { position: { row: 4, col: col1 }, faction: 'bone', type: 'bone_altar', used: false },
          { position: { row: 5, col: col2 }, faction: 'plague', type: 'plague_crate', used: false },
        ],
      };
      newState = addLog(newState, `Bone Altar placed at 4${['A','B','C','D','E','F'][col1]} (rolled ${roll1.total})`);
      newState = addLog(newState, `Plague Crate placed at 5${['A','B','C','D','E','F'][col2]} (rolled ${roll2.total})`);
      newState = addLog(newState, 'Plague Order: Deploy your 6 units in rows 1-2. Select a unit type, then click a tile.');
      return newState;
    }

    case 'SELECT_DEPLOY_CLASS': {
      if (state.phase !== 'deployment_p1' && state.phase !== 'deployment_p2') return state;
      return { ...state, selectedDeployClass: action.unitClass };
    }

    case 'DEPLOY_UNIT': {
      if (state.phase !== 'deployment_p1' && state.phase !== 'deployment_p2') return state;
      const faction: 'plague' | 'bone' = state.phase === 'deployment_p1' ? 'plague' : 'bone';
      const { position } = action;

      if (faction === 'plague' && (position.row < 1 || position.row > 2)) return state;
      if (faction === 'bone' && (position.row < 7 || position.row > 8)) return state;
      if (state.units.some(u => posEqual(u.position, position))) return state;

      // Use selected deploy class
      const unitClass = state.selectedDeployClass;
      if (!unitClass) return state;

      // Validate class availability
      const factionUnits = state.units.filter(u => u.faction === faction);
      const classCount = factionUnits.filter(u => u.unitClass === unitClass).length;
      const maxCount = unitClass === 'grunt' ? 3 : 1;
      if (classCount >= maxCount) return state;

      const index = unitClass === 'grunt' ? classCount : 0;
      const unit = createUnit(faction, unitClass, index, position);
      let newState = { ...state, units: [...state.units, unit] };
      newState = addLog(newState, `${unit.name} deployed at ${position.row}${['A','B','C','D','E','F'][position.col]}`);

      // Check if deployment done
      if (newState.units.filter(u => u.faction === faction).length >= 6) {
        if (faction === 'plague') {
          newState = { ...newState, phase: 'deployment_p2', selectedDeployClass: null };
          newState = addLog(newState, 'Bone Legion: Deploy your 6 units in rows 7-8.');
        } else {
          newState = { ...newState, phase: 'initiative_roll', selectedDeployClass: null };
          newState = addLog(newState, 'All units deployed. Roll for initiative!');
        }
      }
      return newState;
    }

    case 'ROLL_INITIATIVE': {
      if (state.phase !== 'initiative_roll') return state;
      const p1Roll = rollDice('1d6');
      const p2Roll = rollDice('1d6');
      const initiative: 'plague' | 'bone' = p1Roll.total >= p2Roll.total ? 'plague' : 'bone';

      let newState: GameState = {
        ...state,
        phase: 'playing',
        subPhase: 'select_unit',
        round: 1,
        initiativePlayer: initiative,
        currentPlayer: initiative,
        diceResult: {
          dice: '1d6 vs 1d6',
          rolls: [p1Roll.total, p2Roll.total],
          total: 0,
          label: `Initiative: Plague ${p1Roll.total} vs Bone ${p2Roll.total}`,
        },
      };
      newState = addLog(newState, `Initiative: Plague rolled ${p1Roll.total}, Bone rolled ${p2Roll.total}. ${initiative === 'plague' ? 'Plague Order' : 'Bone Legion'} goes first!`);
      newState = addLog(newState, `═══ Round 1 begins ═══`);
      return newState;
    }

    case 'DESELECT_UNIT': {
      if (state.phase !== 'playing' || state.subPhase !== 'unit_actions' || !state.activeUnit) return state;
      const au = state.activeUnit;
      const currentUnit = getUnitById(state, au.unitId);
      const isFresh = currentUnit && au.movementRemaining === currentUnit.move && !au.hasAttacked && !au.hasUsedAbility && !au.hasInteractedObjective;
      if (!isFresh) return state;
      return { ...state, subPhase: 'select_unit', activeUnit: null };
    }

    case 'SELECT_UNIT': {
      if (state.phase !== 'playing') return state;
      // Allow deselect by clicking same unit
      if (state.subPhase === 'unit_actions' && state.activeUnit) {
        if (action.unitId === state.activeUnit.unitId) {
          const au = state.activeUnit;
          const currentUnit = getUnitById(state, au.unitId);
          const isFresh = currentUnit && au.movementRemaining === currentUnit.move && !au.hasAttacked && !au.hasUsedAbility && !au.hasInteractedObjective;
          if (isFresh) {
            return { ...state, subPhase: 'select_unit', activeUnit: null };
          }
          return state;
        }
        // Allow switching if fresh
        const au = state.activeUnit;
        const currentUnit = getUnitById(state, au.unitId);
        const isFresh = currentUnit && au.movementRemaining === currentUnit.move && !au.hasAttacked && !au.hasUsedAbility && !au.hasInteractedObjective;
        if (!isFresh) return state;
      } else if (state.subPhase !== 'select_unit') {
        return state;
      }
      const unit = getUnitById(state, action.unitId);
      if (!unit || unit.faction !== state.currentPlayer || unit.hp <= 0 || unit.activated) return state;

      if (unit.pinned) {
        let newState = updateUnit(state, unit.id, { activated: true, pinned: false });
        newState = addLog(newState, `${unit.name} is Pinned and skips activation.`);
        return nextActivation(newState);
      }

      return {
        ...state,
        subPhase: 'unit_actions',
        activeUnit: {
          unitId: unit.id,
          movementRemaining: unit.move,
          hasAttacked: false,
          hasUsedAbility: false,
          hasInteractedObjective: false,
        },
      };
    }

    case 'MOVE_UNIT': {
      if (!state.activeUnit || state.activeUnit.hasInteractedObjective) return state;
      const unit = getUnitById(state, state.activeUnit.unitId);
      if (!unit) return state;

      const { position } = action;
      const dist = Math.abs(position.row - unit.position.row) + Math.abs(position.col - unit.position.col);
      if (dist > state.activeUnit.movementRemaining || dist === 0) return state;

      const occupied = new Set(state.units.filter(u => u.id !== unit.id && u.hp > 0).map(u => posKey(u.position)));
      state.corpses.forEach(c => occupied.add(posKey(c.position)));
      if (occupied.has(posKey(position))) return state;

      let newState = updateUnit(state, unit.id, { position });
      newState = {
        ...newState,
        activeUnit: {
          ...newState.activeUnit!,
          movementRemaining: newState.activeUnit!.movementRemaining - dist,
        },
      };

      const onHazard = newState.hazards.some(h => posEqual(h.position, position));
      if (onHazard) {
        const hazDmg = rollDice('1d4');
        newState = addLog(newState, `☠ ${unit.name} steps on hazard! Takes ${hazDmg.total} damage!`);
        newState = applyDamage(newState, unit.id, hazDmg.total, 'hazard');
      }

      return newState;
    }

    case 'ATTACK_UNIT': {
      if (!state.activeUnit || state.activeUnit.hasAttacked || state.activeUnit.hasInteractedObjective) return state;
      const attacker = getUnitById(state, state.activeUnit.unitId);
      const target = getUnitById(state, action.targetId);
      if (!attacker || !target || target.hp <= 0) return state;

      const adj = getAdjacent(attacker.position);
      if (!adj.some(a => posEqual(a, target.position))) return state;

      let dmgDice = attacker.attackDice;
      const dmgResult = rollDice(dmgDice);
      let totalDmg = dmgResult.total;

      if (state.auraActive && attacker.faction === 'bone' && attacker.unitClass !== 'captain') {
        const legionnaire = state.units.find(u => u.faction === 'bone' && u.unitClass === 'captain' && u.hp > 0);
        if (legionnaire && isIn5x5(legionnaire.position, attacker.position)) {
          totalDmg += 1;
        }
      }

      if (state.damageBuff && state.damageBuff.faction === attacker.faction) {
        const bonusDmg = rollDice(state.damageBuff.extraDice);
        totalDmg += bonusDmg.total;
      }

      let newState = addLog(state, `⚔ ${attacker.name} attacks ${target.name}! Rolled ${dmgResult.rolls.join('+')} = ${totalDmg} damage`);
      newState = {
        ...newState,
        activeUnit: { ...newState.activeUnit!, hasAttacked: true },
        diceResult: { dice: dmgDice, rolls: dmgResult.rolls, total: totalDmg, label: `${attacker.name} attacks!` },
        damageBuff: state.damageBuff?.faction === attacker.faction ? null : state.damageBuff,
      };
      newState = applyDamage(newState, target.id, totalDmg, attacker.name);

      // Filth Scorch
      if (attacker.faction === 'plague' && attacker.unitClass === 'grunt') {
        const updatedTarget = getUnitById(newState, target.id);
        if (updatedTarget && updatedTarget.hp <= 0) {
          newState = {
            ...newState,
            corpses: newState.corpses.map(c =>
              c.unitId === target.id ? { ...c, cleansed: true } : c
            ),
          };
          newState = addLog(newState, `🔥 Filth Scorch! Tile cleansed — no reanimation possible.`);
        }
      }

      // Ancient Evasion
      const updatedTarget2 = getUnitById(newState, target.id);
      if (updatedTarget2 && updatedTarget2.hp > 0 && updatedTarget2.faction === 'bone' && updatedTarget2.unitClass === 'grunt' && !updatedTarget2.usedReactionThisRound && !updatedTarget2.pinned) {
        const escapeAdj = getAdjacent(updatedTarget2.position);
        const occupiedSet = new Set(newState.units.filter(u => u.hp > 0 && u.id !== updatedTarget2.id).map(u => posKey(u.position)));
        newState.corpses.forEach(c => occupiedSet.add(posKey(c.position)));
        const validEscape = escapeAdj.filter(a => !occupiedSet.has(posKey(a)));
        if (validEscape.length > 0) {
          const escapeTo = validEscape[Math.floor(Math.random() * validEscape.length)];
          newState = updateUnit(newState, updatedTarget2.id, {
            position: escapeTo,
            usedReactionThisRound: true,
          });
          newState = addLog(newState, `⚡ Ancient Evasion! ${updatedTarget2.name} dodges to ${escapeTo.row}${['A','B','C','D','E','F'][escapeTo.col]}`);
        }
      }

      // Magma Troll push
      if (attacker.faction === 'bone' && attacker.unitClass === 'heavy') {
        const pushTarget = getUnitById(newState, target.id);
        if (pushTarget && pushTarget.hp > 0) {
          const pushDir = {
            row: pushTarget.position.row - attacker.position.row,
            col: pushTarget.position.col - attacker.position.col,
          };
          const pushDest = {
            row: pushTarget.position.row + pushDir.row,
            col: pushTarget.position.col + pushDir.col,
          };

          const occupiedSet2 = new Set(newState.units.filter(u => u.hp > 0 && u.id !== pushTarget.id).map(u => posKey(u.position)));
          newState.corpses.forEach(c => occupiedSet2.add(posKey(c.position)));

          if (pushDest.row >= 1 && pushDest.row <= 8 && pushDest.col >= 0 && pushDest.col <= 5 && !occupiedSet2.has(posKey(pushDest))) {
            newState = updateUnit(newState, pushTarget.id, { position: pushDest });
            newState = addLog(newState, `💨 Fists of Magma! ${pushTarget.name} pushed to ${pushDest.row}${['A','B','C','D','E','F'][pushDest.col]}`);

            if (newState.hazards.some(h => posEqual(h.position, pushDest))) {
              const hazDmg = rollDice('1d4');
              newState = addLog(newState, `☠ Pushed onto hazard! ${hazDmg.total} damage!`);
              newState = applyDamage(newState, pushTarget.id, hazDmg.total, 'hazard');
            }
          } else {
            const pinRoll = rollDice('1d6');
            if (pinRoll.total >= 5) {
              newState = updateUnit(newState, pushTarget.id, { pinned: true });
              newState = addLog(newState, `📌 ${pushTarget.name} is PINNED! (rolled ${pinRoll.total})`);
            } else {
              newState = addLog(newState, `Push blocked but not pinned (rolled ${pinRoll.total})`);
            }
          }
        }
      }

      return newState;
    }

    case 'USE_ABILITY': {
      if (!state.activeUnit || state.activeUnit.hasUsedAbility || state.activeUnit.hasInteractedObjective) return state;
      const unit = getUnitById(state, state.activeUnit.unitId);
      if (!unit || unit.usedAbilityThisRound) return state;

      let newState = {
        ...state,
        activeUnit: { ...state.activeUnit, hasUsedAbility: true },
      };
      newState = updateUnit(newState, unit.id, { usedAbilityThisRound: true });

      if (unit.unitClass === 'medic') {
        if (!action.targetId) return state;
        const target = getUnitById(newState, action.targetId);
        if (!target || target.hp <= 0 || target.hp >= target.maxHp) return state;
        const adj = getAdjacent(unit.position);
        const isSelf = target.id === unit.id;
        if (!isSelf && !adj.some(a => posEqual(a, target.position))) return state;
        if (target.faction !== unit.faction) return state;

        const healRoll = rollDice('1d4');
        const newHp = Math.min(target.maxHp, target.hp + healRoll.total);
        newState = updateUnit(newState, target.id, { hp: newHp });
        newState = addLog(newState, `💚 ${unit.name} heals ${target.name} for ${healRoll.total} HP (${target.hp} → ${newHp})`);
        newState = {
          ...newState,
          diceResult: { dice: '1d4', rolls: healRoll.rolls, total: healRoll.total, label: `${unit.name} heals!` },
        };
      }

      // Bone Shaman: Return of the Dead
      if (unit.unitClass === 'medic' && unit.faction === 'bone' && action.targetId === 'resurrect') {
        if (state.returnOfDeadUsed || unit.usedOncePerGame) return state;
        const validCorpse = newState.corpses.find(
          c => c.faction === 'bone' && c.unitClass === 'grunt' && !c.cleansed
        );
        if (!validCorpse) return state;

        const resUnit = createUnit('bone', 'grunt', 0, validCorpse.position);
        resUnit.hp = 3;
        resUnit.id = validCorpse.unitId;
        resUnit.activated = true;
        newState = {
          ...newState,
          units: [...newState.units.filter(u => u.id !== validCorpse.unitId), resUnit],
          corpses: newState.corpses.filter(c => c.unitId !== validCorpse.unitId),
          returnOfDeadUsed: true,
        };
        newState = updateUnit(newState, unit.id, { usedOncePerGame: true });
        newState = addLog(newState, `💀 Return of the Dead! ${resUnit.name} rises at 3 HP!`);
      }

      // Heavy abilities
      if (unit.unitClass === 'heavy' && unit.faction === 'plague') {
        const facing = unit.facing;
        let primaryPos: Position;
        switch (facing) {
          case 'north': primaryPos = { row: unit.position.row - 1, col: unit.position.col }; break;
          case 'south': primaryPos = { row: unit.position.row + 1, col: unit.position.col }; break;
          case 'east':  primaryPos = { row: unit.position.row, col: unit.position.col + 1 }; break;
          case 'west':  primaryPos = { row: unit.position.row, col: unit.position.col - 1 }; break;
        }

        let leftPos: Position, rightPos: Position;
        if (facing === 'north' || facing === 'south') {
          leftPos = { row: primaryPos.row, col: primaryPos.col - 1 };
          rightPos = { row: primaryPos.row, col: primaryPos.col + 1 };
        } else {
          leftPos = { row: primaryPos.row - 1, col: primaryPos.col };
          rightPos = { row: primaryPos.row + 1, col: primaryPos.col };
        }

        const primaryTarget = newState.units.find(u => u.hp > 0 && u.faction !== unit.faction && posEqual(u.position, primaryPos));
        if (primaryTarget) {
          const primaryDmg = rollDice('1d6+2');
          newState = addLog(newState, `🔥 Flame of Wulfgrim! Primary: ${primaryTarget.name} takes ${primaryDmg.total} fire damage!`);
          newState = applyDamage(newState, primaryTarget.id, primaryDmg.total, 'Flame');
        }

        for (const sidePos of [leftPos, rightPos]) {
          const sideTarget = newState.units.find(u => u.hp > 0 && u.faction !== unit.faction && posEqual(u.position, sidePos));
          if (sideTarget) {
            const sideDmg = rollDice('1d4');
            newState = addLog(newState, `🔥 Side blast: ${sideTarget.name} takes ${sideDmg.total} fire damage!`);
            newState = applyDamage(newState, sideTarget.id, sideDmg.total, 'Flame');
          }
        }

        if (!primaryTarget && ![leftPos, rightPos].some(sp => newState.units.some(u => u.hp > 0 && u.faction !== unit.faction && posEqual(u.position, sp)))) {
          newState = addLog(newState, 'No valid targets for Flame of Wulfgrim.');
          newState = {
            ...newState,
            activeUnit: { ...newState.activeUnit!, hasUsedAbility: false },
          };
          newState = updateUnit(newState, unit.id, { usedAbilityThisRound: false });
        }
      }

      // Captain abilities (once per game)
      if (unit.unitClass === 'captain' && !unit.usedOncePerGame) {
        if (unit.faction === 'plague') {
          newState = { ...newState, bannerActive: true };
          newState = updateUnit(newState, unit.id, { usedOncePerGame: true });
          newState = addLog(newState, `🛡 Banner of Iron Faith! Allies in range take -1 damage this round!`);
        } else {
          newState = { ...newState, auraActive: true };
          newState = updateUnit(newState, unit.id, { usedOncePerGame: true });
          newState = addLog(newState, `💀 Aura of Death! Allies in range deal +1 damage this round!`);
        }
      }

      return newState;
    }

    case 'INTERACT_OBJECTIVE': {
      if (!state.activeUnit) return state;
      const unit = getUnitById(state, state.activeUnit.unitId);
      if (!unit) return state;

      const obj = state.objectives.find(
        o => posEqual(o.position, unit.position) && !o.used &&
          ((o.faction === 'plague' && unit.faction === 'plague') ||
           (o.faction === 'bone' && unit.faction === 'bone'))
      );
      if (!obj) return state;

      const objRoll = rollDice('1d6');
      let newState: GameState = {
        ...state,
        objectives: state.objectives.map(o =>
          posEqual(o.position, obj.position) ? { ...o, used: true } : o
        ),
        activeUnit: {
          ...state.activeUnit,
          hasInteractedObjective: true,
          movementRemaining: 0,
          hasAttacked: true,
          hasUsedAbility: true,
        },
      };

      if (objRoll.total <= 2) {
        const adjUnits = getAdjacent(unit.position)
          .map(a => newState.units.find(u => u.hp > 0 && u.faction === unit.faction && posEqual(u.position, a)))
          .filter(Boolean) as Unit[];
        if (adjUnits.length > 0) {
          const healTarget = adjUnits[0];
          const healRoll = rollDice('1d6');
          const newHp = Math.min(healTarget.maxHp, healTarget.hp + healRoll.total);
          newState = updateUnit(newState, healTarget.id, { hp: newHp });
          newState = addLog(newState, `📦 Objective (${objRoll.total}): Heal! ${healTarget.name} healed for ${healRoll.total}`);
        }
      } else if (objRoll.total <= 4) {
        newState = { ...newState, damageBuff: { faction: unit.faction, extraDice: '1d4' } };
        newState = addLog(newState, `📦 Objective (${objRoll.total}): Damage Boost! Next ally attack gets +1d4`);
      } else {
        const allAllies = newState.units.filter(u => u.faction === unit.faction && u.hp > 0);
        if (allAllies.length > 0) {
          const weakest = allAllies.reduce((a, b) => (a.hp / a.maxHp < b.hp / b.maxHp ? a : b));
          newState = updateUnit(newState, weakest.id, { hp: weakest.maxHp });
          newState = addLog(newState, `📦 Objective (${objRoll.total}): TIDE TURNER! ${weakest.name} healed to MAX HP!`);
          newState = { ...newState, damageBuff: { faction: unit.faction, extraDice: '1d4' } };
          newState = addLog(newState, `Next ally attack also gets +1d4 damage!`);
        }
      }

      newState = {
        ...newState,
        diceResult: { dice: '1d6', rolls: [objRoll.total], total: objRoll.total, label: 'Objective Roll' },
      };
      return newState;
    }

    case 'END_ACTIVATION': {
      if (!state.activeUnit) return state;
      let newState = updateUnit(state, state.activeUnit.unitId, { activated: true });

      const unit = getUnitById(newState, state.activeUnit.unitId);
      if (unit && unit.hp > 0) {
        const onHazard = newState.hazards.some(h => posEqual(h.position, unit.position));
        if (onHazard) {
          const hazDmg = rollDice('1d4');
          newState = addLog(newState, `☠ ${unit.name} ends on hazard! Takes ${hazDmg.total} damage!`);
          newState = applyDamage(newState, unit.id, hazDmg.total, 'hazard');
        }
      }

      return nextActivation(newState);
    }

    case 'FORFEIT': {
      const captain = state.units.find(u => u.faction === state.currentPlayer && u.unitClass === 'captain');
      if (captain && captain.hp > 0) {
        return addLog(state, 'Cannot forfeit while your Captain is alive!');
      }
      const winner = state.currentPlayer === 'plague' ? 'bone' : 'plague';
      let newState = addLog(state, `${state.currentPlayer === 'plague' ? 'Plague Order' : 'Bone Legion'} forfeits!`);
      return { ...newState, phase: 'game_over', winner };
    }

    case 'DISMISS_DICE':
      return { ...state, diceResult: null };

    case 'SELECT_TILE':
      return { ...state, selectedTile: action.position };

    default:
      return state;
  }
}
