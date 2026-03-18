import { GameCommand } from './commands.js';
import { EngineRandom, rollDice } from './rng.js';
import {
  COLUMNS,
  CorpseMarker,
  createInitialState,
  createUnit,
  GameState,
  getAdjacent,
  isIn5x5,
  posEqual,
  posKey,
  Position,
  Unit,
} from './types.js';

function addLog(state: GameState, msg: string): GameState {
  return { ...state, log: [...state.log, msg] };
}

function checkWinCondition(state: GameState): GameState {
  const plagueAlive = state.units.filter(unit => unit.faction === 'plague' && unit.hp > 0);
  const boneAlive = state.units.filter(unit => unit.faction === 'bone' && unit.hp > 0);

  if (plagueAlive.length === 0) {
    return { ...state, phase: 'game_over', winner: 'bone' };
  }
  if (boneAlive.length === 0) {
    return { ...state, phase: 'game_over', winner: 'plague' };
  }
  return state;
}

function getUnitById(state: GameState, id: string): Unit | undefined {
  return state.units.find(unit => unit.id === id);
}

function updateUnit(state: GameState, id: string, updates: Partial<Unit>): GameState {
  return {
    ...state,
    units: state.units.map(unit => (unit.id === id ? { ...unit, ...updates } : unit)),
  };
}

function applyDamage(
  state: GameState,
  targetId: string,
  damage: number,
  _source: string,
  rng: EngineRandom,
): GameState {
  const target = getUnitById(state, targetId);
  if (!target || target.hp <= 0) return state;

  const onObjective = state.objectives.some(objective => posEqual(objective.position, target.position));
  let actualDamage = damage;
  if (onObjective) {
    const half = damage / 2;
    if (half !== Math.floor(half)) {
      const coverRoll = rollDice(rng, '1d4');
      actualDamage = coverRoll.total <= 2 ? Math.floor(half) : Math.ceil(half);
      state = addLog(state, `Half cover! ${damage} → ${actualDamage} (cover roll: ${coverRoll.total})`);
    } else {
      actualDamage = half;
      state = addLog(state, `Half cover! ${damage} → ${actualDamage}`);
    }
  }

  if (state.bannerActive) {
    const commander = state.units.find(unit => unit.faction === 'plague' && unit.unitClass === 'captain' && unit.hp > 0);
    if (commander && target.faction === 'plague' && target.unitClass !== 'captain' && isIn5x5(commander.position, target.position)) {
      actualDamage = Math.max(0, actualDamage - 1);
      state = addLog(state, 'Banner of Iron Faith reduces damage by 1!');
    }
  }

  const newHp = Math.max(0, target.hp - actualDamage);
  state = addLog(state, `${target.name} takes ${actualDamage} damage (${target.hp} → ${newHp} HP)`);
  state = updateUnit(state, targetId, { hp: newHp });

  if (newHp <= 0) {
    if (target.faction === 'plague' && !state.lastRiteUsed) {
      const chaplain = state.units.find(
        unit => unit.faction === 'plague' && unit.unitClass === 'medic' && unit.hp > 0 && !unit.pinned,
      );
      if (chaplain) {
        const chaplainAdj = getAdjacent(chaplain.position);
        if (chaplainAdj.some(adj => posEqual(adj, target.position)) && target.id !== chaplain.id) {
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

function endRound(state: GameState): GameState {
  const newRound = state.round + 1;

  if (newRound > 8) {
    const plagueHp = state.units.filter(unit => unit.faction === 'plague' && unit.hp > 0).reduce((sum, unit) => sum + unit.hp, 0);
    const boneHp = state.units.filter(unit => unit.faction === 'bone' && unit.hp > 0).reduce((sum, unit) => sum + unit.hp, 0);
    const plagueCount = state.units.filter(unit => unit.faction === 'plague' && unit.hp > 0).length;
    const boneCount = state.units.filter(unit => unit.faction === 'bone' && unit.hp > 0).length;

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
    units: state.units.map(unit => ({
      ...unit,
      activated: false,
      usedAbilityThisRound: false,
      usedReactionThisRound: false,
      pinned: unit.pinned ? false : unit.pinned,
    })),
  };
}

function nextActivation(state: GameState): GameState {
  const plagueUnactivated = state.units.filter(unit => unit.faction === 'plague' && unit.hp > 0 && !unit.activated);
  const boneUnactivated = state.units.filter(unit => unit.faction === 'bone' && unit.hp > 0 && !unit.activated);

  if (plagueUnactivated.length === 0 && boneUnactivated.length === 0) {
    return endRound(state);
  }

  const nextPlayer = state.currentPlayer === 'plague' ? 'bone' : 'plague';
  const nextUnactivated = state.units.filter(unit => unit.faction === nextPlayer && unit.hp > 0 && !unit.activated);

  if (nextUnactivated.length > 0) {
    return { ...state, currentPlayer: nextPlayer, subPhase: 'select_unit', activeUnit: null };
  }

  const currentUnactivated = state.units.filter(unit => unit.faction === state.currentPlayer && unit.hp > 0 && !unit.activated);
  if (currentUnactivated.length > 0) {
    return { ...state, subPhase: 'select_unit', activeUnit: null };
  }

  return endRound(state);
}

export function applyCommand(state: GameState, command: GameCommand, rng: EngineRandom): GameState {
  switch (command.type) {
    case 'START_GAME':
      return {
        ...createInitialState(),
        phase: 'hazard_placement',
        hazardsToPlace: 4,
        log: ['Welcome to SLATRA. Place 4 hazard tiles in rows 3-6.'],
      };

    case 'PLACE_HAZARD': {
      if (state.phase !== 'hazard_placement') return state;
      const { position } = command;
      if (position.row < 3 || position.row > 6) return state;
      if (state.hazards.some(hazard => posEqual(hazard.position, position))) return state;

      const newHazards = [...state.hazards, { position }];
      const remaining = state.hazardsToPlace - 1;

      let newState = {
        ...state,
        hazards: newHazards,
        hazardsToPlace: remaining,
      };
      newState = addLog(newState, `Hazard placed at ${position.row}${COLUMNS[position.col]}`);

      if (remaining <= 0) {
        newState = { ...newState, phase: 'objective_roll' };
        newState = addLog(newState, 'Hazards placed. Rolling for objectives...');
      }
      return newState;
    }

    case 'ROLL_OBJECTIVES': {
      if (state.phase !== 'objective_roll') return state;
      const roll1 = rollDice(rng, '1d6');
      const roll2 = rollDice(rng, '1d6');

      let col1 = roll1.total - 1;
      let col2 = roll2.total - 1;

      while (state.hazards.some(hazard => hazard.position.row === 4 && hazard.position.col === col1)) {
        col1 = (col1 + 1) % 6;
      }
      while (state.hazards.some(hazard => hazard.position.row === 5 && hazard.position.col === col2)) {
        col2 = (col2 + 1) % 6;
      }

      let newState: GameState = {
        ...state,
        phase: 'deployment_p1',
        objectives: [
          { position: { row: 4, col: col1 }, faction: 'bone', type: 'bone_altar', used: false },
          { position: { row: 5, col: col2 }, faction: 'plague', type: 'plague_crate', used: false },
        ],
      };
      newState = addLog(newState, `Bone Altar placed at 4${COLUMNS[col1]} (rolled ${roll1.total})`);
      newState = addLog(newState, `Plague Crate placed at 5${COLUMNS[col2]} (rolled ${roll2.total})`);
      newState = addLog(newState, 'Plague Order: Deploy your 6 units in rows 1-2. Select a unit type, then click a tile.');
      return newState;
    }

    case 'SELECT_DEPLOY_CLASS': {
      if (state.phase !== 'deployment_p1' && state.phase !== 'deployment_p2') return state;
      return { ...state, selectedDeployClass: command.unitClass };
    }

    case 'DEPLOY_UNIT': {
      if (state.phase !== 'deployment_p1' && state.phase !== 'deployment_p2') return state;
      const faction: 'plague' | 'bone' = state.phase === 'deployment_p1' ? 'plague' : 'bone';
      const { position } = command;

      if (faction === 'plague' && (position.row < 1 || position.row > 2)) return state;
      if (faction === 'bone' && (position.row < 7 || position.row > 8)) return state;
      if (state.units.some(unit => posEqual(unit.position, position))) return state;

      const unitClass = state.selectedDeployClass;
      if (!unitClass) return state;

      const factionUnits = state.units.filter(unit => unit.faction === faction);
      const classCount = factionUnits.filter(unit => unit.unitClass === unitClass).length;
      const maxCount = unitClass === 'grunt' ? 3 : 1;
      if (classCount >= maxCount) return state;

      const index = unitClass === 'grunt' ? classCount : 0;
      const unit = createUnit(faction, unitClass, index, position);
      let newState = { ...state, units: [...state.units, unit] };
      newState = addLog(newState, `${unit.name} deployed at ${position.row}${COLUMNS[position.col]}`);

      if (newState.units.filter(existingUnit => existingUnit.faction === faction).length >= 6) {
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
      const p1Roll = rollDice(rng, '1d6');
      const p2Roll = rollDice(rng, '1d6');
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
      newState = addLog(newState, '═══ Round 1 begins ═══');
      return newState;
    }

    case 'DESELECT_UNIT': {
      if (state.phase !== 'playing' || state.subPhase !== 'unit_actions' || !state.activeUnit) return state;
      const activeUnit = state.activeUnit;
      const currentUnit = getUnitById(state, activeUnit.unitId);
      const isFresh = currentUnit
        && activeUnit.movementRemaining === currentUnit.move
        && !activeUnit.hasAttacked
        && !activeUnit.hasUsedAbility
        && !activeUnit.hasInteractedObjective;
      if (!isFresh) return state;
      return { ...state, subPhase: 'select_unit', activeUnit: null };
    }

    case 'SELECT_UNIT': {
      if (state.phase !== 'playing') return state;
      if (state.subPhase === 'unit_actions' && state.activeUnit) {
        if (command.unitId === state.activeUnit.unitId) {
          const activeUnit = state.activeUnit;
          const currentUnit = getUnitById(state, activeUnit.unitId);
          const isFresh = currentUnit
            && activeUnit.movementRemaining === currentUnit.move
            && !activeUnit.hasAttacked
            && !activeUnit.hasUsedAbility
            && !activeUnit.hasInteractedObjective;
          if (isFresh) {
            return { ...state, subPhase: 'select_unit', activeUnit: null };
          }
          return state;
        }

        const activeUnit = state.activeUnit;
        const currentUnit = getUnitById(state, activeUnit.unitId);
        const isFresh = currentUnit
          && activeUnit.movementRemaining === currentUnit.move
          && !activeUnit.hasAttacked
          && !activeUnit.hasUsedAbility
          && !activeUnit.hasInteractedObjective;
        if (!isFresh) return state;
      } else if (state.subPhase !== 'select_unit') {
        return state;
      }

      const unit = getUnitById(state, command.unitId);
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

      const { position } = command;
      const dist = Math.abs(position.row - unit.position.row) + Math.abs(position.col - unit.position.col);
      if (dist > state.activeUnit.movementRemaining || dist === 0) return state;

      const occupied = new Set(state.units.filter(existingUnit => existingUnit.id !== unit.id && existingUnit.hp > 0).map(existingUnit => posKey(existingUnit.position)));
      state.corpses.forEach(corpse => occupied.add(posKey(corpse.position)));
      if (occupied.has(posKey(position))) return state;

      let newState = updateUnit(state, unit.id, { position });
      newState = {
        ...newState,
        activeUnit: {
          ...newState.activeUnit!,
          movementRemaining: newState.activeUnit!.movementRemaining - dist,
        },
      };

      const onHazard = newState.hazards.some(hazard => posEqual(hazard.position, position));
      if (onHazard) {
        const hazardDamage = rollDice(rng, '1d4');
        newState = addLog(newState, `☠ ${unit.name} steps on hazard! Takes ${hazardDamage.total} damage!`);
        newState = applyDamage(newState, unit.id, hazardDamage.total, 'hazard', rng);
      }

      return newState;
    }

    case 'ATTACK_UNIT': {
      if (!state.activeUnit || state.activeUnit.hasAttacked || state.activeUnit.hasInteractedObjective) return state;
      const attacker = getUnitById(state, state.activeUnit.unitId);
      const target = getUnitById(state, command.targetId);
      if (!attacker || !target || target.hp <= 0) return state;

      const adjacentTiles = getAdjacent(attacker.position);
      if (!adjacentTiles.some(adj => posEqual(adj, target.position))) return state;

      const damageRoll = rollDice(rng, attacker.attackDice);
      let totalDamage = damageRoll.total;

      if (state.auraActive && attacker.faction === 'bone' && attacker.unitClass !== 'captain') {
        const legionnaire = state.units.find(unit => unit.faction === 'bone' && unit.unitClass === 'captain' && unit.hp > 0);
        if (legionnaire && isIn5x5(legionnaire.position, attacker.position)) {
          totalDamage += 1;
        }
      }

      if (state.damageBuff && state.damageBuff.faction === attacker.faction) {
        const bonusDamage = rollDice(rng, state.damageBuff.extraDice);
        totalDamage += bonusDamage.total;
      }

      let newState = addLog(state, `⚔ ${attacker.name} attacks ${target.name}! Rolled ${damageRoll.rolls.join('+')} = ${totalDamage} damage`);
      newState = {
        ...newState,
        activeUnit: { ...newState.activeUnit!, hasAttacked: true },
        diceResult: { dice: attacker.attackDice, rolls: damageRoll.rolls, total: totalDamage, label: `${attacker.name} attacks!` },
        damageBuff: state.damageBuff?.faction === attacker.faction ? null : state.damageBuff,
      };
      newState = applyDamage(newState, target.id, totalDamage, attacker.name, rng);

      if (attacker.faction === 'plague' && attacker.unitClass === 'grunt') {
        const updatedTarget = getUnitById(newState, target.id);
        if (updatedTarget && updatedTarget.hp <= 0) {
          newState = {
            ...newState,
            corpses: newState.corpses.map(corpse =>
              corpse.unitId === target.id ? { ...corpse, cleansed: true } : corpse,
            ),
          };
          newState = addLog(newState, '🔥 Filth Scorch! Tile cleansed — no reanimation possible.');
        }
      }

      const updatedTarget = getUnitById(newState, target.id);
      if (updatedTarget && updatedTarget.hp > 0 && updatedTarget.faction === 'bone' && updatedTarget.unitClass === 'grunt' && !updatedTarget.usedReactionThisRound && !updatedTarget.pinned) {
        const escapeAdj = getAdjacent(updatedTarget.position);
        const occupiedSet = new Set(newState.units.filter(unit => unit.hp > 0 && unit.id !== updatedTarget.id).map(unit => posKey(unit.position)));
        newState.corpses.forEach(corpse => occupiedSet.add(posKey(corpse.position)));
        const validEscape = escapeAdj.filter(adj => !occupiedSet.has(posKey(adj)));
        if (validEscape.length > 0) {
          const escapeTo = validEscape[rng.pickIndex(validEscape.length)];
          newState = updateUnit(newState, updatedTarget.id, {
            position: escapeTo,
            usedReactionThisRound: true,
          });
          newState = addLog(newState, `⚡ Ancient Evasion! ${updatedTarget.name} dodges to ${escapeTo.row}${COLUMNS[escapeTo.col]}`);
        }
      }

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

          const occupiedSet = new Set(newState.units.filter(unit => unit.hp > 0 && unit.id !== pushTarget.id).map(unit => posKey(unit.position)));
          newState.corpses.forEach(corpse => occupiedSet.add(posKey(corpse.position)));

          if (pushDest.row >= 1 && pushDest.row <= 8 && pushDest.col >= 0 && pushDest.col <= 5 && !occupiedSet.has(posKey(pushDest))) {
            newState = updateUnit(newState, pushTarget.id, { position: pushDest });
            newState = addLog(newState, `💨 Fists of Magma! ${pushTarget.name} pushed to ${pushDest.row}${COLUMNS[pushDest.col]}`);

            if (newState.hazards.some(hazard => posEqual(hazard.position, pushDest))) {
              const hazardDamage = rollDice(rng, '1d4');
              newState = addLog(newState, `☠ Pushed onto hazard! ${hazardDamage.total} damage!`);
              newState = applyDamage(newState, pushTarget.id, hazardDamage.total, 'hazard', rng);
            }
          } else {
            const pinRoll = rollDice(rng, '1d6');
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

      let newState: GameState = {
        ...state,
        activeUnit: { ...state.activeUnit, hasUsedAbility: true },
      };
      newState = updateUnit(newState, unit.id, { usedAbilityThisRound: true });

      if (unit.unitClass === 'medic') {
        if (!command.targetId) return state;
        const target = getUnitById(newState, command.targetId);
        if (!target || target.hp <= 0 || target.hp >= target.maxHp) return state;
        const adjacentTiles = getAdjacent(unit.position);
        const isSelf = target.id === unit.id;
        if (!isSelf && !adjacentTiles.some(adj => posEqual(adj, target.position))) return state;
        if (target.faction !== unit.faction) return state;

        const healRoll = rollDice(rng, '1d4');
        const newHp = Math.min(target.maxHp, target.hp + healRoll.total);
        newState = updateUnit(newState, target.id, { hp: newHp });
        newState = addLog(newState, `💚 ${unit.name} heals ${target.name} for ${healRoll.total} HP (${target.hp} → ${newHp})`);
        newState = {
          ...newState,
          diceResult: { dice: '1d4', rolls: healRoll.rolls, total: healRoll.total, label: `${unit.name} heals!` },
        };
      }

      if (unit.unitClass === 'medic' && unit.faction === 'bone' && command.targetId === 'resurrect') {
        if (state.returnOfDeadUsed || unit.usedOncePerGame) return state;
        const validCorpse = newState.corpses.find(
          corpse => corpse.faction === 'bone' && corpse.unitClass === 'grunt' && !corpse.cleansed,
        );
        if (!validCorpse) return state;

        const resurrectedUnit = createUnit('bone', 'grunt', 0, validCorpse.position);
        resurrectedUnit.hp = 3;
        resurrectedUnit.id = validCorpse.unitId;
        resurrectedUnit.activated = true;
        newState = {
          ...newState,
          units: [...newState.units.filter(existingUnit => existingUnit.id !== validCorpse.unitId), resurrectedUnit],
          corpses: newState.corpses.filter(corpse => corpse.unitId !== validCorpse.unitId),
          returnOfDeadUsed: true,
        };
        newState = updateUnit(newState, unit.id, { usedOncePerGame: true });
        newState = addLog(newState, `💀 Return of the Dead! ${resurrectedUnit.name} rises at 3 HP!`);
      }

      if (unit.unitClass === 'heavy' && unit.faction === 'plague') {
        const facing = unit.facing;
        let primaryPos: Position;
        switch (facing) {
          case 'north': primaryPos = { row: unit.position.row - 1, col: unit.position.col }; break;
          case 'south': primaryPos = { row: unit.position.row + 1, col: unit.position.col }; break;
          case 'east': primaryPos = { row: unit.position.row, col: unit.position.col + 1 }; break;
          case 'west': primaryPos = { row: unit.position.row, col: unit.position.col - 1 }; break;
        }

        let leftPos: Position;
        let rightPos: Position;
        if (facing === 'north' || facing === 'south') {
          leftPos = { row: primaryPos.row, col: primaryPos.col - 1 };
          rightPos = { row: primaryPos.row, col: primaryPos.col + 1 };
        } else {
          leftPos = { row: primaryPos.row - 1, col: primaryPos.col };
          rightPos = { row: primaryPos.row + 1, col: primaryPos.col };
        }

        const primaryTarget = newState.units.find(existingUnit => existingUnit.hp > 0 && existingUnit.faction !== unit.faction && posEqual(existingUnit.position, primaryPos));
        if (primaryTarget) {
          const primaryDamage = rollDice(rng, '1d6+2');
          newState = addLog(newState, `🔥 Flame of Wulfgrim! Primary: ${primaryTarget.name} takes ${primaryDamage.total} fire damage!`);
          newState = applyDamage(newState, primaryTarget.id, primaryDamage.total, 'Flame', rng);
        }

        for (const sidePos of [leftPos, rightPos]) {
          const sideTarget = newState.units.find(existingUnit => existingUnit.hp > 0 && existingUnit.faction !== unit.faction && posEqual(existingUnit.position, sidePos));
          if (sideTarget) {
            const sideDamage = rollDice(rng, '1d4');
            newState = addLog(newState, `🔥 Side blast: ${sideTarget.name} takes ${sideDamage.total} fire damage!`);
            newState = applyDamage(newState, sideTarget.id, sideDamage.total, 'Flame', rng);
          }
        }

        if (!primaryTarget && ![leftPos, rightPos].some(sidePos => newState.units.some(existingUnit => existingUnit.hp > 0 && existingUnit.faction !== unit.faction && posEqual(existingUnit.position, sidePos)))) {
          newState = addLog(newState, 'No valid targets for Flame of Wulfgrim.');
          newState = {
            ...newState,
            activeUnit: { ...newState.activeUnit!, hasUsedAbility: false },
          };
          newState = updateUnit(newState, unit.id, { usedAbilityThisRound: false });
        }
      }

      if (unit.unitClass === 'captain' && !unit.usedOncePerGame) {
        if (unit.faction === 'plague') {
          newState = { ...newState, bannerActive: true };
          newState = updateUnit(newState, unit.id, { usedOncePerGame: true });
          newState = addLog(newState, '🛡 Banner of Iron Faith! Allies in range take -1 damage this round!');
        } else {
          newState = { ...newState, auraActive: true };
          newState = updateUnit(newState, unit.id, { usedOncePerGame: true });
          newState = addLog(newState, '💀 Aura of Death! Allies in range deal +1 damage this round!');
        }
      }

      return newState;
    }

    case 'INTERACT_OBJECTIVE': {
      if (!state.activeUnit) return state;
      const unit = getUnitById(state, state.activeUnit.unitId);
      if (!unit) return state;

      const objective = state.objectives.find(
        existingObjective => posEqual(existingObjective.position, unit.position)
          && !existingObjective.used
          && ((existingObjective.faction === 'plague' && unit.faction === 'plague')
            || (existingObjective.faction === 'bone' && unit.faction === 'bone')),
      );
      if (!objective) return state;

      const objectiveRoll = rollDice(rng, '1d6');
      let newState: GameState = {
        ...state,
        objectives: state.objectives.map(existingObjective =>
          posEqual(existingObjective.position, objective.position) ? { ...existingObjective, used: true } : existingObjective,
        ),
        activeUnit: {
          ...state.activeUnit,
          hasInteractedObjective: true,
          movementRemaining: 0,
          hasAttacked: true,
          hasUsedAbility: true,
        },
      };

      if (objectiveRoll.total <= 2) {
        const adjacentUnits = getAdjacent(unit.position)
          .map(adj => newState.units.find(existingUnit => existingUnit.hp > 0 && existingUnit.faction === unit.faction && posEqual(existingUnit.position, adj)))
          .filter(Boolean) as Unit[];
        if (adjacentUnits.length > 0) {
          const healTarget = adjacentUnits[0];
          const healRoll = rollDice(rng, '1d6');
          const newHp = Math.min(healTarget.maxHp, healTarget.hp + healRoll.total);
          newState = updateUnit(newState, healTarget.id, { hp: newHp });
          newState = addLog(newState, `📦 Objective (${objectiveRoll.total}): Heal! ${healTarget.name} healed for ${healRoll.total}`);
        }
      } else if (objectiveRoll.total <= 4) {
        newState = { ...newState, damageBuff: { faction: unit.faction, extraDice: '1d4' } };
        newState = addLog(newState, `📦 Objective (${objectiveRoll.total}): Damage Boost! Next ally attack gets +1d4`);
      } else {
        const allAllies = newState.units.filter(existingUnit => existingUnit.faction === unit.faction && existingUnit.hp > 0);
        if (allAllies.length > 0) {
          const weakest = allAllies.reduce((currentWeakest, candidate) => (candidate.hp / candidate.maxHp < currentWeakest.hp / currentWeakest.maxHp ? candidate : currentWeakest));
          newState = updateUnit(newState, weakest.id, { hp: weakest.maxHp });
          newState = addLog(newState, `📦 Objective (${objectiveRoll.total}): TIDE TURNER! ${weakest.name} healed to MAX HP!`);
          newState = { ...newState, damageBuff: { faction: unit.faction, extraDice: '1d4' } };
          newState = addLog(newState, 'Next ally attack also gets +1d4 damage!');
        }
      }

      newState = {
        ...newState,
        diceResult: { dice: '1d6', rolls: [objectiveRoll.total], total: objectiveRoll.total, label: 'Objective Roll' },
      };
      return newState;
    }

    case 'END_ACTIVATION': {
      if (!state.activeUnit) return state;
      let newState = updateUnit(state, state.activeUnit.unitId, { activated: true });

      const unit = getUnitById(newState, state.activeUnit.unitId);
      if (unit && unit.hp > 0) {
        const onHazard = newState.hazards.some(hazard => posEqual(hazard.position, unit.position));
        if (onHazard) {
          const hazardDamage = rollDice(rng, '1d4');
          newState = addLog(newState, `☠ ${unit.name} ends on hazard! Takes ${hazardDamage.total} damage!`);
          newState = applyDamage(newState, unit.id, hazardDamage.total, 'hazard', rng);
        }
      }

      return nextActivation(newState);
    }

    case 'FORFEIT': {
      const captain = state.units.find(unit => unit.faction === state.currentPlayer && unit.unitClass === 'captain');
      if (captain && captain.hp > 0) {
        return addLog(state, 'Cannot forfeit while your Captain is alive!');
      }
      const winner = state.currentPlayer === 'plague' ? 'bone' : 'plague';
      const newState = addLog(state, `${state.currentPlayer === 'plague' ? 'Plague Order' : 'Bone Legion'} forfeits!`);
      return { ...newState, phase: 'game_over', winner };
    }

    case 'DISMISS_DICE':
      return { ...state, diceResult: null };

    case 'SELECT_TILE':
      return { ...state, selectedTile: command.position };

    case 'FINISH_DEPLOYMENT':
    case 'ANCIENT_EVASION':
    case 'LAST_RITE':
    default:
      return state;
  }
}
