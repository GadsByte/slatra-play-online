import React from 'react';
import { DiceResult } from '@/game/types';

interface DiceDisplayProps {
  result: DiceResult | null;
  onDismiss: () => void;
}

export const DiceDisplay: React.FC<DiceDisplayProps> = ({ result, onDismiss }) => {
  if (!result) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <div className="bg-card border-2 border-primary/50 rounded-sm p-6 text-center space-y-3 shadow-2xl min-w-[200px]">
        <h3 className="font-display text-lg text-primary">{result.label}</h3>
        <div className="flex justify-center gap-3">
          {result.rolls.map((r, i) => (
            <div
              key={i}
              className="w-14 h-14 bg-secondary rounded-sm flex items-center justify-center border-2 border-border text-2xl font-display font-bold text-foreground"
            >
              {r}
            </div>
          ))}
        </div>
        <div className="text-2xl font-display font-bold text-primary">
          Total: {result.total}
        </div>
        <p className="text-xs text-muted-foreground">Click anywhere to continue</p>
      </div>
    </div>
  );
};
