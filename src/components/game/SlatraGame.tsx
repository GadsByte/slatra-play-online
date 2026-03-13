import React, { useReducer, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameBoard } from '@/components/game/GameBoard';
import { UnitPanel } from '@/components/game/UnitPanel';
import { ActionBar } from '@/components/game/ActionBar';
import { DiceDisplay } from '@/components/game/DiceDisplay';
import { GameLog } from '@/components/game/GameLog';
import { GameHeader } from '@/components/game/GameHeader';
import { gameReducer, createInitialState } from '@/game/gameReducer';
import { Position, posEqual, getValidMoves, getAdjacentEnemies } from '@/game/types';
import { Button } from '@/components/ui/button';

const SlatraGame: React.FC = () => {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);

  const activeUnitObj = useMemo(() => {
    if (!state.activeUnit) return undefined;
    return state.units.find(u => u.id === state.activeUnit!.unitId);
  }, [state.activeUnit, state.units]);

  const validMoves = useMemo(() => {
    if (!activeUnitObj || !state.activeUnit || state.activeUnit.hasInteractedObjective) return [];
    return getValidMoves(activeUnitObj, state.activeUnit.movementRemaining, state.units, state.corpses, state.hazards);
  }, [activeUnitObj, state.activeUnit, state.units, state.corpses, state.hazards]);

  const validAttacks = useMemo(() => {
    if (!activeUnitObj || !state.activeUnit || state.activeUnit.hasAttacked || state.activeUnit.hasInteractedObjective) return [];
    return getAdjacentEnemies(activeUnitObj, state.units).map(u => u.position);
  }, [activeUnitObj, state.activeUnit, state.units]);

  const handleTileClick = useCallback((pos: Position) => {
    if (state.phase === 'hazard_placement') {
      dispatch({ type: 'PLACE_HAZARD', position: pos });
      return;
    }
    if (state.phase === 'deployment_p1' || state.phase === 'deployment_p2') {
      dispatch({ type: 'DEPLOY_UNIT', unitClass: '', position: pos });
      return;
    }
    if (state.phase === 'playing') {
      if (state.subPhase === 'select_unit') {
        const unit = state.units.find(u => u.hp > 0 && posEqual(u.position, pos) && u.faction === state.currentPlayer && !u.activated);
        if (unit) dispatch({ type: 'SELECT_UNIT', unitId: unit.id });
        return;
      }
      if (state.subPhase === 'unit_actions' && state.activeUnit) {
        if (validMoves.some(m => posEqual(m, pos))) {
          dispatch({ type: 'MOVE_UNIT', position: pos });
          return;
        }
        const enemy = state.units.find(u => u.hp > 0 && u.faction !== state.currentPlayer && posEqual(u.position, pos));
        if (enemy && validAttacks.some(a => posEqual(a, pos))) {
          dispatch({ type: 'ATTACK_UNIT', targetId: enemy.id });
          return;
        }
      }
    }
  }, [state.phase, state.subPhase, state.activeUnit, state.currentPlayer, state.units, validMoves, validAttacks]);

  const handleSelectUnit = useCallback((id: string) => {
    if (state.phase === 'playing' && state.subPhase === 'select_unit') {
      dispatch({ type: 'SELECT_UNIT', unitId: id });
    }
  }, [state.phase, state.subPhase]);

  const canForfeit = useMemo(() => {
    const captain = state.units.find(u => u.faction === state.currentPlayer && u.unitClass === 'captain');
    return !captain || captain.hp <= 0;
  }, [state.units, state.currentPlayer]);

  const getDeploymentInfo = () => {
    if (state.phase === 'deployment_p1') {
      const count = state.units.filter(u => u.faction === 'plague').length;
      const order = ['Grunt 1', 'Grunt 2', 'Grunt 3', 'Medic', 'Heavy', 'Captain'];
      return `Plague Order: Place ${order[count] || 'unit'} (${count}/6) in rows 1-2`;
    }
    if (state.phase === 'deployment_p2') {
      const count = state.units.filter(u => u.faction === 'bone').length;
      const order = ['Grunt 1', 'Grunt 2', 'Grunt 3', 'Medic', 'Heavy', 'Captain'];
      return `Bone Legion: Place ${order[count] || 'unit'} (${count}/6) in rows 7-8`;
    }
    return '';
  };


  // Game over screen
  if (state.phase === 'game_over') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
        <h1 className="font-display text-5xl font-black tracking-widest text-foreground">GAME OVER</h1>
        {state.winner ? (
          <p className={`font-display text-3xl font-bold ${state.winner === 'plague' ? 'text-plague-light' : 'text-bone-light'}`}>
            {state.winner === 'plague' ? 'PLAGUE ORDER' : 'BONE LEGION'} VICTORIOUS
          </p>
        ) : (
          <p className="font-display text-3xl text-muted-foreground">DRAW</p>
        )}
        <GameLog log={state.log} />
        <Button size="lg" onClick={() => dispatch({ type: 'START_GAME' })} className="font-display tracking-wider">
          PLAY AGAIN
        </Button>
      </div>
    );
  }

  const highlightRows: [number, number] | undefined =
    state.phase === 'deployment_p1' ? [1, 2] :
    state.phase === 'deployment_p2' ? [7, 8] :
    state.phase === 'hazard_placement' ? [3, 6] :
    undefined;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <GameHeader round={state.round} currentPlayer={state.currentPlayer} phase={state.phase} />

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-7xl mx-auto w-full">
        {/* Left panel */}
        <div className="lg:w-56 space-y-3">
          <UnitPanel
            units={state.units}
            faction="plague"
            selectedUnitId={state.activeUnit?.unitId || null}
            onSelectUnit={handleSelectUnit}
            isCurrentPlayer={state.currentPlayer === 'plague'}
          />
        </div>

        {/* Center - Board */}
        <div className="flex-1 flex flex-col items-center gap-3">
          {/* Phase info */}
          {state.phase === 'hazard_placement' && (
            <div className="text-center text-sm font-display text-hazard-glow">
              Place {state.hazardsToPlace} hazard tile{state.hazardsToPlace !== 1 ? 's' : ''} in rows 3-6
            </div>
          )}
          {state.phase === 'objective_roll' && (
            <div className="text-center">
              <Button onClick={() => dispatch({ type: 'ROLL_OBJECTIVES' })} className="font-display">
                Roll for Objectives
              </Button>
            </div>
          )}
          {state.phase === 'initiative_roll' && (
            <div className="text-center">
              <Button onClick={() => dispatch({ type: 'ROLL_INITIATIVE' })} className="font-display">
                Roll for Initiative
              </Button>
            </div>
          )}
          {(state.phase === 'deployment_p1' || state.phase === 'deployment_p2') && (
            <div className="text-center text-sm font-display text-primary">{getDeploymentInfo()}</div>
          )}

          <GameBoard
            units={state.units}
            corpses={state.corpses}
            hazards={state.hazards}
            objectives={state.objectives}
            validMoves={validMoves}
            validAttacks={validAttacks}
            selectedUnitId={state.activeUnit?.unitId || null}
            onTileClick={handleTileClick}
            phase={state.phase}
            highlightRows={highlightRows}
          />

          <ActionBar
            activeUnit={state.activeUnit}
            unit={activeUnitObj}
            allUnits={state.units}
            objectives={state.objectives}
            onAttack={(id) => dispatch({ type: 'ATTACK_UNIT', targetId: id })}
            onAbility={(id) => dispatch({ type: 'USE_ABILITY', targetId: id })}
            onInteract={() => dispatch({ type: 'INTERACT_OBJECTIVE' })}
            onEndActivation={() => dispatch({ type: 'END_ACTIVATION' })}
            onForfeit={() => dispatch({ type: 'FORFEIT' })}
            canForfeit={canForfeit}
            currentPlayer={state.currentPlayer}
            phase={state.phase}
            subPhase={state.subPhase}
          />
        </div>

        {/* Right panel */}
        <div className="lg:w-56 space-y-3">
          <UnitPanel
            units={state.units}
            faction="bone"
            selectedUnitId={state.activeUnit?.unitId || null}
            onSelectUnit={handleSelectUnit}
            isCurrentPlayer={state.currentPlayer === 'bone'}
          />
          <GameLog log={state.log} />
        </div>
      </div>

      <DiceDisplay result={state.diceResult} onDismiss={() => dispatch({ type: 'DISMISS_DICE' })} />
    </div>
  );
};

export default SlatraGame;
