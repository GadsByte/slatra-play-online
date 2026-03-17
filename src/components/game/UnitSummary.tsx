import React from 'react';
import { Unit } from '@/game/types';

interface UnitSummaryProps {
  unit: Unit | undefined;
}

const ABILITY_INFO: Record<string, Record<string, { abilities: string[]; passives: string[]; reactions: string[] }>> = {
  plague: {
    grunt: {
      abilities: [],
      passives: ['Filth Scorch — On kill, cleanses corpse tile (prevents resurrection)'],
      reactions: [],
    },
    medic: {
      abilities: ['Purify (Heal) — Heal adjacent ally or self for 1d4 HP (once per round)'],
      passives: ['Last Rite ★ — If an adjacent ally would die, save them at 1 HP (once per game)'],
      reactions: [],
    },
    heavy: {
      abilities: ['Flame of Wulfgrim — Cone attack: 1d6+2 to primary target, 1d4 to sides (once per round)'],
      passives: [],
      reactions: [],
    },
    captain: {
      abilities: ['Banner of Iron Faith ★ — Allies within 5×5 take −1 damage this round (once per game)'],
      passives: [],
      reactions: [],
    },
  },
  bone: {
    grunt: {
      abilities: [],
      passives: [],
      reactions: ['Ancient Evasion — After being hit, dodge to an adjacent empty tile (once per round)'],
    },
    medic: {
      abilities: [
        'Grave Gift (Heal) — Heal adjacent ally or self for 1d4 HP (once per round)',
        'Return of the Dead ★ — Resurrect a dead Zombie Centurion at 3 HP on its corpse tile (once per game)',
      ],
      passives: [],
      reactions: [],
    },
    heavy: {
      abilities: [],
      passives: ['Fists of Magma — On hit, push target 1 tile. If blocked, chance to pin (roll 5+ on 1d6)'],
      reactions: [],
    },
    captain: {
      abilities: ['Aura of Death ★ — Allies within 5×5 deal +1 damage this round (once per game)'],
      passives: [],
      reactions: [],
    },
  },
};

export const UnitSummary: React.FC<UnitSummaryProps> = ({ unit }) => {
  if (!unit) return null;

  const info = ABILITY_INFO[unit.faction]?.[unit.unitClass];
  if (!info) return null;

  return (
    <div className="p-3 bg-card border border-border rounded-sm space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <span className={`font-display text-sm font-bold ${unit.faction === 'plague' ? 'text-plague-light' : 'text-bone-light'}`}>
          {unit.name}
        </span>
        <span className="text-muted-foreground capitalize">({unit.unitClass})</span>
      </div>

      <div className="flex gap-4 text-muted-foreground">
        <span>HP: {unit.hp}/{unit.maxHp}</span>
        <span>Move: {unit.move}</span>
        <span>Attack: {unit.attackDice}</span>
      </div>

      {info.abilities.length > 0 && (
        <div className="space-y-1">
          <span className="font-display text-[10px] tracking-wider text-primary uppercase">Abilities</span>
          {info.abilities.map((a, i) => (
            <div key={i} className="text-foreground/80 pl-2 border-l-2 border-primary/30">
              {a.includes('★') && unit.usedOncePerGame && a.includes('once per game') ? (
                <span className="line-through opacity-50">{a} — USED</span>
              ) : a.includes('once per round') && unit.usedAbilityThisRound ? (
                <span className="line-through opacity-50">{a} — USED THIS ROUND</span>
              ) : (
                a
              )}
            </div>
          ))}
        </div>
      )}

      {info.passives.length > 0 && (
        <div className="space-y-1">
          <span className="font-display text-[10px] tracking-wider text-objective uppercase">Passives</span>
          {info.passives.map((p, i) => (
            <div key={i} className="text-foreground/80 pl-2 border-l-2 border-objective/30">
              {p.includes('★') && unit.usedOncePerGame ? (
                <span className="line-through opacity-50">{p} — USED</span>
              ) : p}
            </div>
          ))}
        </div>
      )}

      {info.reactions.length > 0 && (
        <div className="space-y-1">
          <span className="font-display text-[10px] tracking-wider text-pinned uppercase">Reactions</span>
          {info.reactions.map((r, i) => (
            <div key={i} className="text-foreground/80 pl-2 border-l-2 border-pinned/30">
              {r.includes('once per round') && unit.usedReactionThisRound ? (
                <span className="line-through opacity-50">{r} — USED THIS ROUND</span>
              ) : r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
