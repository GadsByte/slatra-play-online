import React from 'react';
import { Position, Unit, CorpseMarker, HazardTile, ObjectiveToken, posEqual, COLUMNS } from '@/game/types';

interface GameBoardProps {
  units: Unit[];
  corpses: CorpseMarker[];
  hazards: HazardTile[];
  objectives: ObjectiveToken[];
  validMoves: Position[];
  validAttacks: Position[];
  selectedUnitId: string | null;
  onTileClick: (pos: Position) => void;
  phase: string;
  highlightRows?: [number, number];
}

const UNIT_ICONS: Record<string, Record<string, string>> = {
  plague: { grunt: '⚔', medic: '✚', heavy: '🔥', captain: '👑' },
  bone:   { grunt: '💀', medic: '🦴', heavy: '🪨', captain: '☠' },
};

export const GameBoard: React.FC<GameBoardProps> = ({
  units,
  corpses,
  hazards,
  objectives,
  validMoves,
  validAttacks,
  selectedUnitId,
  onTileClick,
  phase,
  highlightRows,
}) => {
  const rows = [1, 2, 3, 4, 5, 6, 7, 8];
  const cols = [0, 1, 2, 3, 4, 5];

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Column labels */}
      <div className="flex gap-1 ml-8">
        {cols.map(c => (
          <div key={c} className="w-16 h-6 flex items-center justify-center font-display text-sm text-muted-foreground">
            {COLUMNS[c]}
          </div>
        ))}
      </div>

      {rows.map(row => (
        <div key={row} className="flex gap-1 items-center">
          {/* Row label */}
          <div className="w-6 text-center font-display text-sm text-muted-foreground">{row}</div>

          {cols.map(col => {
            const pos: Position = { row, col };
            const unit = units.find(u => u.hp > 0 && posEqual(u.position, pos));
            const corpse = corpses.find(c => posEqual(c.position, pos));
            const isHazard = hazards.some(h => posEqual(h.position, pos));
            const objective = objectives.find(o => posEqual(o.position, pos));
            const isValidMove = validMoves.some(m => posEqual(m, pos));
            const isValidAttack = validAttacks.some(a => posEqual(a, pos));
            const isSelected = unit && unit.id === selectedUnitId;
            const isDark = (row + col) % 2 === 0;
            const isHighlightRow = highlightRows && row >= highlightRows[0] && row <= highlightRows[1];

            let tileClasses = 'w-16 h-16 relative flex items-center justify-center cursor-pointer transition-all duration-150 border border-border/30';

            if (isHazard) {
              tileClasses += ' tile-hazard bg-hazard/20';
            } else if (isDark) {
              tileClasses += ' bg-tile-dark';
            } else {
              tileClasses += ' bg-tile-light';
            }

            if (isValidMove) tileClasses += ' tile-valid-move bg-tile-valid';
            if (isValidAttack) tileClasses += ' tile-valid-attack bg-tile-attack';
            if (isSelected) tileClasses += ' ring-2 ring-primary';
            if (isHighlightRow) tileClasses += ' bg-secondary/50';

            return (
              <div
                key={`${row}-${col}`}
                className={tileClasses}
                onClick={() => onTileClick(pos)}
                title={`${row}${COLUMNS[col]}`}
              >
                {/* Objective token */}
                {objective && (
                  <div className={`absolute inset-0 flex items-center justify-center ${objective.used ? 'opacity-30' : 'opacity-60'}`}>
                    <div className={`w-10 h-10 rounded-sm border-2 flex items-center justify-center text-xs font-display
                      ${objective.faction === 'plague' ? 'border-plague bg-plague-bg' : 'border-bone bg-bone-bg'}`}>
                      {objective.faction === 'plague' ? '📦' : '⛩'}
                    </div>
                  </div>
                )}

                {/* Corpse marker */}
                {corpse && !unit && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-50">
                    <span className="text-lg">⚰</span>
                  </div>
                )}

                {/* Hazard indicator */}
                {isHazard && (
                  <div className="absolute bottom-0.5 left-0.5 text-[8px] text-hazard-glow">☢</div>
                )}

                {/* Unit */}
                {unit && (
                  <div className={`relative z-10 w-12 h-12 rounded-sm flex flex-col items-center justify-center border-2 transition-transform
                    ${unit.faction === 'plague' ? 'border-plague-light bg-plague-bg' : 'border-bone-light bg-bone-bg'}
                    ${isSelected ? 'scale-110' : 'hover:scale-105'}
                    ${unit.pinned ? 'opacity-60' : ''}`}>
                    <span className="text-lg leading-none">{UNIT_ICONS[unit.faction][unit.unitClass]}</span>
                    {/* HP bar */}
                    <div className="w-10 h-1.5 bg-secondary rounded-full mt-0.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          unit.hp / unit.maxHp > 0.5 ? 'bg-plague-light' :
                          unit.hp / unit.maxHp > 0.25 ? 'bg-objective' : 'bg-destructive'
                        }`}
                        style={{ width: `${(unit.hp / unit.maxHp) * 100}%` }}
                      />
                    </div>
                    {unit.pinned && (
                      <div className="absolute -top-1 -right-1 text-[10px] bg-pinned rounded-full w-4 h-4 flex items-center justify-center">📌</div>
                    )}
                    {unit.activated && (
                      <div className="absolute -top-1 -left-1 w-3 h-3 bg-muted rounded-full border border-border" />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
