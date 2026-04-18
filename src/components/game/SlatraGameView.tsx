import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameBoard } from '@/components/game/GameBoard';
import { UnitPanel } from '@/components/game/UnitPanel';
import { ActionBar } from '@/components/game/ActionBar';
import { DiceDisplay } from '@/components/game/DiceDisplay';
import { GameLog } from '@/components/game/GameLog';
import { GameHeader } from '@/components/game/GameHeader';
import { UnitSummary } from '@/components/game/UnitSummary';
import { GameState, Position, posEqual, posKey, getValidMoves, getAdjacentEnemies, isIn5x5, UnitClass, Faction } from '@/game/types';
import { GameAction } from '@/game/gameReducer';
import { Button } from '@/components/ui/button';

const DEPLOY_ORDER: { unitClass: UnitClass; label: string; icon: string }[] = [
  { unitClass: 'grunt', label: 'Grunt', icon: '⚔' },
  { unitClass: 'medic', label: 'Medic', icon: '✚' },
  { unitClass: 'heavy', label: 'Heavy', icon: '🔥' },
  { unitClass: 'captain', label: 'Captain', icon: '👑' },
];

interface SlatraGameViewProps {
  state: GameState;
  dispatch: (action: GameAction) => void;
  /** If set, only this faction's player can interact. If undefined, both can (local play). */
  localFaction?: Faction;
  /** Optional banner shown above the board (e.g. "Waiting for opponent..."). */
  statusBanner?: React.ReactNode;
  /** Where to navigate when game ends. */
  exitPath?: string;
}

export const SlatraGameView: React.FC<SlatraGameViewProps> = ({
  state,
  dispatch,
  localFaction,
  statusBanner,
  exitPath = '/',
}) => {
  const navigate = useNavigate();

  const isMyTurn = localFaction === undefined || state.currentPlayer === localFaction;
  const interactive = isMyTurn;

  const safeDispatch = useCallback((action: GameAction) => {
    if (!interactive) return;
    dispatch(action);
  }, [interactive, dispatch]);

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

  const auraTiles = useMemo(() => {
    const tiles = new Set<string>();
    if (state.bannerActive) {
      const captain = state.units.find(u => u.faction === 'plague' && u.unitClass === 'captain' && u.hp > 0);
      if (captain) {
        state.units.forEach(u => {
          if (u.faction === 'plague' && u.hp > 0 && u.unitClass !== 'captain' && isIn5x5(captain.position, u.position)) {
            tiles.add(posKey(u.position));
          }
        });
      }
    }
    if (state.auraActive) {
      const captain = state.units.find(u => u.faction === 'bone' && u.unitClass === 'captain' && u.hp > 0);
      if (captain) {
        state.units.forEach(u => {
          if (u.faction === 'bone' && u.hp > 0 && u.unitClass !== 'captain' && isIn5x5(captain.position, u.position)) {
            tiles.add(posKey(u.position));
          }
        });
      }
    }
    return tiles;
  }, [state.units, state.bannerActive, state.auraActive]);

  const handleTileClick = useCallback((pos: Position) => {
    if (!interactive) return;
    if (state.phase === 'hazard_placement') {
      safeDispatch({ type: 'PLACE_HAZARD', position: pos });
      return;
    }
    if (state.phase === 'deployment_p1' || state.phase === 'deployment_p2') {
      safeDispatch({ type: 'DEPLOY_UNIT', unitClass: '', position: pos });
      return;
    }
    if (state.phase === 'playing') {
      if (state.subPhase === 'select_unit') {
        const unit = state.units.find(u => u.hp > 0 && posEqual(u.position, pos) && u.faction === state.currentPlayer && !u.activated);
        if (unit) safeDispatch({ type: 'SELECT_UNIT', unitId: unit.id });
        return;
      }
      if (state.subPhase === 'unit_actions' && state.activeUnit) {
        const clickedUnit = state.units.find(u => u.hp > 0 && posEqual(u.position, pos));
        if (clickedUnit && clickedUnit.id === state.activeUnit.unitId) {
          safeDispatch({ type: 'DESELECT_UNIT' });
          return;
        }
        const friendlyUnit = state.units.find(u => u.hp > 0 && posEqual(u.position, pos) && u.faction === state.currentPlayer && !u.activated && u.id !== state.activeUnit.unitId);
        if (friendlyUnit) {
          safeDispatch({ type: 'SELECT_UNIT', unitId: friendlyUnit.id });
          return;
        }
        if (validMoves.some(m => posEqual(m, pos))) {
          safeDispatch({ type: 'MOVE_UNIT', position: pos });
          return;
        }
        const enemy = state.units.find(u => u.hp > 0 && u.faction !== state.currentPlayer && posEqual(u.position, pos));
        if (enemy && validAttacks.some(a => posEqual(a, pos))) {
          safeDispatch({ type: 'ATTACK_UNIT', targetId: enemy.id });
          return;
        }
      }
    }
  }, [interactive, state.phase, state.subPhase, state.activeUnit, state.currentPlayer, state.units, validMoves, validAttacks, safeDispatch]);

  const handleSelectUnit = useCallback((id: string) => {
    if (!interactive) return;
    if (state.phase === 'playing') {
      if (state.subPhase === 'select_unit') {
        safeDispatch({ type: 'SELECT_UNIT', unitId: id });
      } else if (state.subPhase === 'unit_actions') {
        if (state.activeUnit && state.activeUnit.unitId === id) {
          safeDispatch({ type: 'DESELECT_UNIT' });
        } else {
          safeDispatch({ type: 'SELECT_UNIT', unitId: id });
        }
      }
    }
  }, [interactive, state.phase, state.subPhase, state.activeUnit, safeDispatch]);

  const canForfeit = useMemo(() => {
    const captain = state.units.find(u => u.faction === state.currentPlayer && u.unitClass === 'captain');
    return !captain || captain.hp <= 0;
  }, [state.units, state.currentPlayer]);

  const getDeploymentInfo = () => {
    const faction = state.phase === 'deployment_p1' ? 'plague' : 'bone';
    const factionName = faction === 'plague' ? 'Plague Order' : 'Bone Legion';
    const rows = faction === 'plague' ? '1-2' : '7-8';
    const count = state.units.filter(u => u.faction === faction).length;
    return { factionName, rows, count, faction };
  };

  const getAvailableDeployClasses = () => {
    const faction = state.phase === 'deployment_p1' ? 'plague' : 'bone';
    const factionUnits = state.units.filter(u => u.faction === faction);
    return DEPLOY_ORDER.filter(d => {
      const count = factionUnits.filter(u => u.unitClass === d.unitClass).length;
      const max = d.unitClass === 'grunt' ? 3 : 1;
      return count < max;
    }).map(d => {
      const count = factionUnits.filter(u => u.unitClass === d.unitClass).length;
      const max = d.unitClass === 'grunt' ? 3 : 1;
      return { ...d, remaining: max - count };
    });
  };

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
        {localFaction && (
          <p className="font-display text-xl text-muted-foreground">
            {state.winner === localFaction ? 'YOU WIN' : state.winner ? 'YOU LOSE' : ''}
          </p>
        )}
        <GameLog log={state.log} />
        <Button size="lg" onClick={() => navigate(exitPath)} className="font-display tracking-wider">
          BACK TO MENU
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

      {statusBanner}

      <div className={`flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-7xl mx-auto w-full ${!interactive ? 'opacity-90' : ''}`}>
        <div className="lg:w-56 space-y-3">
          <UnitPanel
            units={state.units}
            faction="plague"
            selectedUnitId={state.activeUnit?.unitId || null}
            onSelectUnit={handleSelectUnit}
            isCurrentPlayer={state.currentPlayer === 'plague'}
          />
        </div>

        <div className="flex-1 flex flex-col items-center gap-3">
          {state.phase === 'hazard_placement' && (
            <div className="text-center text-sm font-display text-hazard-glow">
              Place {state.hazardsToPlace} hazard tile{state.hazardsToPlace !== 1 ? 's' : ''} in rows 3-6
            </div>
          )}
          {state.phase === 'objective_roll' && interactive && (
            <div className="text-center">
              <Button onClick={() => safeDispatch({ type: 'ROLL_OBJECTIVES' })} className="font-display">
                Roll for Objectives
              </Button>
            </div>
          )}
          {state.phase === 'initiative_roll' && interactive && (
            <div className="text-center">
              <Button onClick={() => safeDispatch({ type: 'ROLL_INITIATIVE' })} className="font-display">
                Roll for Initiative
              </Button>
            </div>
          )}
          {(state.phase === 'deployment_p1' || state.phase === 'deployment_p2') && (() => {
            const info = getDeploymentInfo();
            const available = getAvailableDeployClasses();
            return (
              <div className="text-center space-y-2">
                <div className="text-sm font-display text-primary">
                  {info.factionName}: Deploy units in rows {info.rows} ({info.count}/6)
                </div>
                {interactive && (
                  <>
                    <div className="flex gap-2 justify-center flex-wrap">
                      {available.map(d => (
                        <Button
                          key={d.unitClass}
                          size="sm"
                          variant={state.selectedDeployClass === d.unitClass ? 'default' : 'outline'}
                          onClick={() => safeDispatch({ type: 'SELECT_DEPLOY_CLASS', unitClass: d.unitClass })}
                          className="text-xs font-display"
                        >
                          {d.icon} {d.label} ({d.remaining})
                        </Button>
                      ))}
                    </div>
                    {!state.selectedDeployClass && (
                      <div className="text-xs text-muted-foreground">Select a unit type above, then click a tile</div>
                    )}
                  </>
                )}
              </div>
            );
          })()}

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
            auraTiles={auraTiles}
          />

          <ActionBar
            activeUnit={state.activeUnit}
            unit={activeUnitObj}
            allUnits={state.units}
            objectives={state.objectives}
            onAttack={(id) => safeDispatch({ type: 'ATTACK_UNIT', targetId: id })}
            onAbility={(id) => safeDispatch({ type: 'USE_ABILITY', targetId: id })}
            onInteract={() => safeDispatch({ type: 'INTERACT_OBJECTIVE' })}
            onEndActivation={() => safeDispatch({ type: 'END_ACTIVATION' })}
            onForfeit={() => safeDispatch({ type: 'FORFEIT' })}
            canForfeit={canForfeit}
            currentPlayer={state.currentPlayer}
            phase={state.phase}
            subPhase={state.subPhase}
          />

          <UnitSummary unit={activeUnitObj} />
        </div>

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

      <DiceDisplay result={state.diceResult} onDismiss={() => safeDispatch({ type: 'DISMISS_DICE' })} />
    </div>
  );
};

export default SlatraGameView;
