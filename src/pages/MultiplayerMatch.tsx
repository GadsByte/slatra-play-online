import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ActionBar } from '@/components/game/ActionBar';
import { DiceDisplay } from '@/components/game/DiceDisplay';
import { GameBoard } from '@/components/game/GameBoard';
import { GameHeader } from '@/components/game/GameHeader';
import { GameLog } from '@/components/game/GameLog';
import { UnitPanel } from '@/components/game/UnitPanel';
import { UnitSummary } from '@/components/game/UnitSummary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useMultiplayer } from '@/features/multiplayer/MultiplayerContext';
import type { MatchCommand } from '@/features/multiplayer/types';
import { COLUMNS, type Faction, getAdjacentEnemies, getValidMoves, isIn5x5, posEqual, posKey, type Position, type UnitClass } from '@/game/types';
import { toast } from 'sonner';

const DEPLOY_ORDER: { unitClass: UnitClass; label: string; icon: string }[] = [
  { unitClass: 'grunt', label: 'Grunt', icon: '⚔' },
  { unitClass: 'medic', label: 'Medic', icon: '✚' },
  { unitClass: 'heavy', label: 'Heavy', icon: '🔥' },
  { unitClass: 'captain', label: 'Captain', icon: '👑' },
];

const MultiplayerMatch = () => {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const { identity, loading, findRoomByIdOrCode, findMatchByRoomId, sendMatchCommand } = useMultiplayer();
  const [actionPending, setActionPending] = useState(false);

  const room = useMemo(() => (roomId ? findRoomByIdOrCode(roomId) : null), [findRoomByIdOrCode, roomId]);
  const match = useMemo(() => (roomId ? findMatchByRoomId(roomId) : null), [findMatchByRoomId, roomId]);
  const gameState = match?.gameState ?? null;

  useEffect(() => {
    if (!loading && !identity) {
      navigate('/multiplayer');
    }
  }, [identity, loading, navigate]);

  useEffect(() => {
    if (!loading && room && room.status !== 'in_game') {
      navigate(`/multiplayer/room/${room.id}`, { replace: true });
    }
  }, [loading, navigate, room]);

  const currentPlayer = useMemo(() => {
    if (!room || !identity) return null;
    return room.players.find(player => player.id === identity.id) ?? null;
  }, [identity, room]);

  const viewerSeat = useMemo<Faction | null>(() => {
    if (!match || !identity) return null;
    return match.seats.find(seat => seat.playerId === identity.id)?.seat ?? null;
  }, [identity, match]);

  const viewerTurn = !!viewerSeat && gameState?.currentPlayer === viewerSeat;

  const issueCommand = useCallback(async (command: MatchCommand) => {
    if (!roomId) return;

    setActionPending(true);
    try {
      await sendMatchCommand(roomId, command);
    } catch (error) {
      toast('Unable to update the match', {
        description: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    } finally {
      setActionPending(false);
    }
  }, [roomId, sendMatchCommand]);

  const activeUnitObj = useMemo(() => {
    if (!gameState?.activeUnit) return undefined;
    return gameState.units.find(unit => unit.id === gameState.activeUnit?.unitId);
  }, [gameState]);

  const validMoves = useMemo(() => {
    if (!gameState || !activeUnitObj || !gameState.activeUnit || gameState.activeUnit.hasInteractedObjective) {
      return [];
    }

    return getValidMoves(
      activeUnitObj,
      gameState.activeUnit.movementRemaining,
      gameState.units,
      gameState.corpses,
      gameState.hazards,
    );
  }, [activeUnitObj, gameState]);

  const validAttacks = useMemo(() => {
    if (!gameState || !activeUnitObj || !gameState.activeUnit || gameState.activeUnit.hasAttacked || gameState.activeUnit.hasInteractedObjective) {
      return [];
    }

    return getAdjacentEnemies(activeUnitObj, gameState.units).map(unit => unit.position);
  }, [activeUnitObj, gameState]);

  const auraTiles = useMemo(() => {
    const tiles = new Set<string>();
    if (!gameState) return tiles;

    if (gameState.bannerActive) {
      const captain = gameState.units.find(unit => unit.faction === 'plague' && unit.unitClass === 'captain' && unit.hp > 0);
      if (captain) {
        gameState.units.forEach(unit => {
          if (unit.faction === 'plague' && unit.hp > 0 && unit.unitClass !== 'captain' && isIn5x5(captain.position, unit.position)) {
            tiles.add(posKey(unit.position));
          }
        });
      }
    }

    if (gameState.auraActive) {
      const captain = gameState.units.find(unit => unit.faction === 'bone' && unit.unitClass === 'captain' && unit.hp > 0);
      if (captain) {
        gameState.units.forEach(unit => {
          if (unit.faction === 'bone' && unit.hp > 0 && unit.unitClass !== 'captain' && isIn5x5(captain.position, unit.position)) {
            tiles.add(posKey(unit.position));
          }
        });
      }
    }

    return tiles;
  }, [gameState]);

  const canForfeit = useMemo(() => {
    if (!gameState) return false;
    const captain = gameState.units.find(unit => unit.faction === gameState.currentPlayer && unit.unitClass === 'captain');
    return !captain || captain.hp <= 0;
  }, [gameState]);

  const highlightRows: [number, number] | undefined = !gameState
    ? undefined
    : gameState.phase === 'deployment_p1'
      ? [1, 2]
      : gameState.phase === 'deployment_p2'
        ? [7, 8]
        : gameState.phase === 'hazard_placement'
          ? [3, 6]
          : undefined;

  const deploymentInfo = useMemo(() => {
    if (!gameState || (gameState.phase !== 'deployment_p1' && gameState.phase !== 'deployment_p2')) {
      return null;
    }

    const faction = gameState.phase === 'deployment_p1' ? 'plague' : 'bone';
    return {
      faction,
      factionName: faction === 'plague' ? 'Plague Order' : 'Bone Legion',
      rows: faction === 'plague' ? '1-2' : '7-8',
      count: gameState.units.filter(unit => unit.faction === faction).length,
    };
  }, [gameState]);

  const availableDeployClasses = useMemo(() => {
    if (!gameState || !deploymentInfo) return [];

    const factionUnits = gameState.units.filter(unit => unit.faction === deploymentInfo.faction);
    return DEPLOY_ORDER.filter(option => {
      const count = factionUnits.filter(unit => unit.unitClass === option.unitClass).length;
      const max = option.unitClass === 'grunt' ? 3 : 1;
      return count < max;
    }).map(option => {
      const count = factionUnits.filter(unit => unit.unitClass === option.unitClass).length;
      const max = option.unitClass === 'grunt' ? 3 : 1;
      return { ...option, remaining: max - count };
    });
  }, [deploymentInfo, gameState]);

  const handleTileClick = useCallback((position: Position) => {
    if (!gameState || actionPending) return;

    if (gameState.phase === 'hazard_placement') {
      void issueCommand({ type: 'PLACE_HAZARD', position });
      return;
    }

    if (gameState.phase === 'deployment_p1' || gameState.phase === 'deployment_p2') {
      if (!gameState.selectedDeployClass) return;
      void issueCommand({ type: 'DEPLOY_UNIT', unitClass: gameState.selectedDeployClass, position });
      return;
    }

    if (gameState.phase !== 'playing') return;

    if (gameState.subPhase === 'select_unit') {
      const unit = gameState.units.find(existingUnit =>
        existingUnit.hp > 0
        && posEqual(existingUnit.position, position)
        && existingUnit.faction === gameState.currentPlayer
        && !existingUnit.activated,
      );

      if (unit) {
        void issueCommand({ type: 'SELECT_UNIT', unitId: unit.id });
      }
      return;
    }

    if (gameState.subPhase === 'unit_actions' && gameState.activeUnit) {
      const clickedUnit = gameState.units.find(unit => unit.hp > 0 && posEqual(unit.position, position));
      if (clickedUnit && clickedUnit.id === gameState.activeUnit.unitId) {
        void issueCommand({ type: 'DESELECT_UNIT' });
        return;
      }

      const friendlyUnit = gameState.units.find(unit =>
        unit.hp > 0
        && posEqual(unit.position, position)
        && unit.faction === gameState.currentPlayer
        && !unit.activated
        && unit.id !== gameState.activeUnit?.unitId,
      );
      if (friendlyUnit) {
        void issueCommand({ type: 'SELECT_UNIT', unitId: friendlyUnit.id });
        return;
      }

      if (validMoves.some(move => posEqual(move, position))) {
        void issueCommand({ type: 'MOVE_UNIT', position });
        return;
      }

      const enemy = gameState.units.find(unit => unit.hp > 0 && unit.faction !== gameState.currentPlayer && posEqual(unit.position, position));
      if (enemy && validAttacks.some(attack => posEqual(attack, position))) {
        void issueCommand({ type: 'ATTACK_UNIT', targetId: enemy.id });
      }
    }
  }, [actionPending, gameState, issueCommand, validAttacks, validMoves]);

  const handleSelectUnit = useCallback((unitId: string) => {
    if (!gameState || actionPending || gameState.phase !== 'playing') return;

    if (gameState.subPhase === 'select_unit') {
      void issueCommand({ type: 'SELECT_UNIT', unitId });
      return;
    }

    if (gameState.subPhase === 'unit_actions') {
      if (gameState.activeUnit?.unitId === unitId) {
        void issueCommand({ type: 'DESELECT_UNIT' });
        return;
      }

      void issueCommand({ type: 'SELECT_UNIT', unitId });
    }
  }, [actionPending, gameState, issueCommand]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <p className="font-display tracking-wider text-muted-foreground">SUMMONING THE BATTLEFIELD...</p>
      </div>
    );
  }

  if (!roomId || !room || !match || !gameState) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-display text-3xl tracking-widest text-foreground">MATCH NOT FOUND</h1>
        <p className="font-body text-muted-foreground max-w-md">
          This match has not started yet, or the room is no longer available.
        </p>
        <Button onClick={() => navigate('/multiplayer/lobby')} className="font-display tracking-wider">
          RETURN TO LOBBY
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <GameHeader round={gameState.round} currentPlayer={gameState.currentPlayer} phase={gameState.phase} />

      <div className="px-4 py-4 border-b border-border bg-card/30">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-display border-primary/30 text-primary">AUTHORITATIVE MATCH</Badge>
              <Badge variant="outline" className="font-display border-muted-foreground/30 text-muted-foreground">ROOM {room.code}</Badge>
              {viewerSeat && (
                <Badge variant="outline" className="font-display border-primary/30 text-primary">
                  YOU ARE {viewerSeat === 'plague' ? 'PLAGUE ORDER' : 'BONE LEGION'}
                </Badge>
              )}
              <Badge variant="outline" className="font-display border-muted-foreground/30 text-muted-foreground">
                {viewerTurn ? 'YOUR TURN' : 'WAITING'}
              </Badge>
            </div>
            <h1 className="font-display text-3xl font-black tracking-widest text-foreground">{room.name}</h1>
            <p className="font-body text-sm text-muted-foreground">
              Started {new Date(match.createdAt).toLocaleString()} — clients now render the server-owned engine state.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate(`/multiplayer/room/${room.id}`)} variant="outline" className="font-display tracking-wider">
              VIEW ROOM
            </Button>
            <Button onClick={() => navigate('/multiplayer/lobby')} className="font-display tracking-wider">
              RETURN TO LOBBY
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-7xl mx-auto w-full">
        <div className="lg:w-56 space-y-3">
          <UnitPanel
            units={gameState.units}
            faction="plague"
            selectedUnitId={gameState.activeUnit?.unitId ?? null}
            onSelectUnit={handleSelectUnit}
            isCurrentPlayer={gameState.currentPlayer === 'plague'}
          />

          <Card className="bg-card border-border">
            <CardContent className="space-y-3 p-4">
              <h2 className="font-display text-sm tracking-wider text-foreground">SEATS</h2>
              {match.seats.map(seat => {
                const player = room.players.find(roomPlayer => roomPlayer.id === seat.playerId);
                return (
                  <div key={seat.seat} className="rounded border border-border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-foreground">{seat.seat === 'plague' ? 'PLAGUE ORDER' : 'BONE LEGION'}</span>
                      {gameState.currentPlayer === seat.seat && (
                        <Badge variant="outline" className="font-display border-primary/30 text-primary">ACTIVE</Badge>
                      )}
                    </div>
                    <p className="font-body text-muted-foreground">
                      {player?.displayName ?? seat.playerId}
                      {identity?.id === seat.playerId ? ` • you` : ''}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <UnitSummary unit={activeUnitObj} />
        </div>

        <div className="flex-1 flex flex-col items-center gap-3">
          {(gameState.phase === 'deployment_p1' || gameState.phase === 'deployment_p2') && deploymentInfo && (
            <div className="text-center space-y-2">
              <div className="text-sm font-display text-primary">
                {deploymentInfo.factionName}: Deploy units in rows {deploymentInfo.rows} ({deploymentInfo.count}/6)
              </div>
              <div className="flex gap-2 justify-center flex-wrap">
                {availableDeployClasses.map(option => (
                  <Button
                    key={option.unitClass}
                    size="sm"
                    variant={gameState.selectedDeployClass === option.unitClass ? 'default' : 'outline'}
                    onClick={() => void issueCommand({ type: 'SELECT_DEPLOY_CLASS', unitClass: option.unitClass })}
                    className="text-xs font-display"
                    disabled={actionPending}
                  >
                    {option.icon} {option.label} ({option.remaining})
                  </Button>
                ))}
              </div>
              {!gameState.selectedDeployClass && (
                <div className="text-xs text-muted-foreground">Select a unit type above, then click a tile.</div>
              )}
            </div>
          )}

          {gameState.phase === 'hazard_placement' && (
            <div className="text-center text-sm font-display text-hazard-glow">
              Place {gameState.hazardsToPlace} hazard tile{gameState.hazardsToPlace !== 1 ? 's' : ''} in rows 3-6
            </div>
          )}

          {gameState.phase === 'objective_roll' && (
            <Button onClick={() => void issueCommand({ type: 'ROLL_OBJECTIVES' })} className="font-display" disabled={actionPending}>
              Roll for Objectives
            </Button>
          )}

          {gameState.phase === 'initiative_roll' && (
            <Button onClick={() => void issueCommand({ type: 'ROLL_INITIATIVE' })} className="font-display" disabled={actionPending}>
              Roll for Initiative
            </Button>
          )}

          <GameBoard
            units={gameState.units}
            corpses={gameState.corpses}
            hazards={gameState.hazards}
            objectives={gameState.objectives}
            validMoves={validMoves}
            validAttacks={validAttacks}
            selectedUnitId={gameState.activeUnit?.unitId ?? null}
            onTileClick={handleTileClick}
            phase={gameState.phase}
            highlightRows={highlightRows}
            auraTiles={auraTiles}
          />

          <ActionBar
            activeUnit={gameState.activeUnit}
            unit={activeUnitObj}
            allUnits={gameState.units}
            objectives={gameState.objectives}
            onAttack={targetId => void issueCommand({ type: 'ATTACK_UNIT', targetId })}
            onAbility={targetId => void issueCommand({ type: 'USE_ABILITY', targetId })}
            onInteract={() => void issueCommand({ type: 'INTERACT_OBJECTIVE' })}
            onEndActivation={() => void issueCommand({ type: 'END_ACTIVATION' })}
            onForfeit={() => void issueCommand({ type: 'FORFEIT' })}
            canForfeit={canForfeit}
            currentPlayer={gameState.currentPlayer}
            phase={gameState.phase}
            subPhase={gameState.subPhase}
          />

          <Card className="w-full bg-card border-border">
            <CardContent className="grid gap-3 p-4 sm:grid-cols-4">
              <div>
                <p className="text-xs font-display tracking-wider text-muted-foreground">STATUS</p>
                <p className="font-body text-foreground">{match.status}</p>
              </div>
              <div>
                <p className="text-xs font-display tracking-wider text-muted-foreground">PHASE</p>
                <p className="font-body text-foreground">{gameState.phase}</p>
              </div>
              <div>
                <p className="text-xs font-display tracking-wider text-muted-foreground">ROUND</p>
                <p className="font-body text-foreground">{gameState.round}</p>
              </div>
              <div>
                <p className="text-xs font-display tracking-wider text-muted-foreground">CURRENT TURN</p>
                <p className="font-body text-foreground">{gameState.currentPlayer}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:w-56 space-y-3">
          <UnitPanel
            units={gameState.units}
            faction="bone"
            selectedUnitId={gameState.activeUnit?.unitId ?? null}
            onSelectUnit={handleSelectUnit}
            isCurrentPlayer={gameState.currentPlayer === 'bone'}
          />

          <Card className="bg-card border-border">
            <CardContent className="space-y-3 p-4">
              <h2 className="font-display text-sm tracking-wider text-foreground">MATCH STATE</h2>
              <div className="space-y-2 text-sm font-body">
                <p className="text-muted-foreground">
                  Selected tile: {gameState.selectedTile ? `${gameState.selectedTile.row}${COLUMNS[gameState.selectedTile.col]}` : 'none'}
                </p>
                <p className="text-muted-foreground">Winner: {gameState.winner ?? 'undecided'}</p>
                <p className="text-muted-foreground">Action pending: {actionPending ? 'sending command…' : 'idle'}</p>
                {currentPlayer ? (
                  <p className="text-foreground">
                    Signed in as <span className="font-semibold">{currentPlayer.displayName}</span>.
                  </p>
                ) : (
                  <p className="text-muted-foreground">You are observing this match without a seat.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <GameLog log={gameState.log} />
        </div>
      </div>

      <DiceDisplay result={gameState.diceResult} onDismiss={() => void issueCommand({ type: 'DISMISS_DICE' })} />
    </div>
  );
};

export default MultiplayerMatch;
