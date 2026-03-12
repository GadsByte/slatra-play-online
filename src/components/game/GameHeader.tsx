import React from 'react';
import { Faction, getFactionName } from '@/game/types';

interface GameHeaderProps {
  round: number;
  currentPlayer: Faction;
  phase: string;
}

export const GameHeader: React.FC<GameHeaderProps> = ({ round, currentPlayer, phase }) => {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
      <h1 className="font-display text-2xl font-bold tracking-wider text-foreground">
        SLATRA
      </h1>
      <div className="flex items-center gap-4 text-sm">
        {phase === 'playing' && (
          <>
            <span className="font-display text-muted-foreground">Round {round}/8</span>
            <span className={`font-display font-bold ${currentPlayer === 'plague' ? 'text-plague-light' : 'text-bone-light'}`}>
              {getFactionName(currentPlayer)}'s Turn
            </span>
          </>
        )}
        {phase === 'game_over' && (
          <span className="font-display text-primary">GAME OVER</span>
        )}
      </div>
    </div>
  );
};
