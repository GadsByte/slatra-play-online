import React from 'react';
import { Unit, getFactionName } from '@/game/types';

interface UnitPanelProps {
  units: Unit[];
  faction: 'plague' | 'bone';
  selectedUnitId: string | null;
  onSelectUnit: (id: string) => void;
  isCurrentPlayer: boolean;
}

const CLASS_LABELS: Record<string, string> = {
  grunt: 'GNT',
  medic: 'MED',
  heavy: 'HVY',
  captain: 'CPT',
};

export const UnitPanel: React.FC<UnitPanelProps> = ({
  units,
  faction,
  selectedUnitId,
  onSelectUnit,
  isCurrentPlayer,
}) => {
  const factionUnits = units.filter(u => u.faction === faction);

  return (
    <div className={`p-3 rounded-sm border ${faction === 'plague' ? 'border-plague/40 bg-plague-bg/50' : 'border-bone/40 bg-bone-bg/50'}`}>
      <h3 className={`font-display text-sm font-bold mb-2 ${faction === 'plague' ? 'text-plague-light' : 'text-bone-light'}`}>
        {getFactionName(faction)}
        {isCurrentPlayer && <span className="ml-2 text-primary text-xs">◆ ACTIVE</span>}
      </h3>

      <div className="space-y-1.5">
        {factionUnits.map(unit => {
          const isDead = unit.hp <= 0;
          const isSelected = unit.id === selectedUnitId;

          return (
            <div
              key={unit.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer transition-colors text-sm
                ${isDead ? 'opacity-30 line-through' : ''}
                ${isSelected ? 'bg-primary/20 border border-primary/40' : 'hover:bg-secondary/50'}
                ${unit.activated ? 'opacity-60' : ''}`}
              onClick={() => !isDead && onSelectUnit(unit.id)}
            >
              <span className={`font-display text-[10px] px-1 rounded ${faction === 'plague' ? 'bg-plague/30 text-plague-light' : 'bg-bone/30 text-bone-light'}`}>
                {CLASS_LABELS[unit.unitClass]}
              </span>
              <span className="flex-1 truncate font-body">{unit.name}</span>
              <span className={`text-xs font-bold ${
                unit.hp / unit.maxHp > 0.5 ? 'text-plague-light' :
                unit.hp / unit.maxHp > 0.25 ? 'text-objective' : 'text-destructive'
              }`}>
                {unit.hp}/{unit.maxHp}
              </span>
              {unit.pinned && <span className="text-xs">📌</span>}
              {unit.activated && !isDead && <span className="text-[10px] text-muted-foreground">✓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
