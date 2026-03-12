import React from 'react';

interface GameLogProps {
  log: string[];
}

export const GameLog: React.FC<GameLogProps> = ({ log }) => {
  return (
    <div className="h-48 overflow-y-auto bg-card/50 border border-border rounded-sm p-2 text-xs font-body space-y-0.5">
      {log.map((entry, i) => (
        <div
          key={i}
          className={`leading-relaxed ${
            entry.includes('═══') ? 'text-primary font-display font-bold text-sm py-1' :
            entry.includes('💀') || entry.includes('☠') ? 'text-destructive' :
            entry.includes('⚡') ? 'text-objective' :
            entry.includes('🔥') ? 'text-hazard-glow' :
            entry.includes('💚') ? 'text-plague-light' :
            'text-muted-foreground'
          }`}
        >
          {entry}
        </div>
      ))}
    </div>
  );
};
