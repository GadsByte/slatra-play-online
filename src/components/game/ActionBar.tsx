import React from 'react';
import { Unit, ActiveUnitState, getAdjacentEnemies, getAdjacent, posEqual, ObjectiveToken } from '@/game/types';
import { Button } from '@/components/ui/button';

interface ActionBarProps {
  activeUnit: ActiveUnitState | null;
  unit: Unit | undefined;
  allUnits: Unit[];
  objectives: ObjectiveToken[];
  onAttack: (targetId: string) => void;
  onAbility: (targetId?: string) => void;
  onInteract: () => void;
  onEndActivation: () => void;
  onForfeit: () => void;
  canForfeit: boolean;
  currentPlayer: 'plague' | 'bone';
  phase: string;
  subPhase: string;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  activeUnit,
  unit,
  allUnits,
  objectives,
  onAttack,
  onAbility,
  onInteract,
  onEndActivation,
  onForfeit,
  canForfeit,
  currentPlayer,
  phase,
  subPhase,
}) => {
  if (phase !== 'playing') return null;

  if (subPhase === 'select_unit') {
    return (
      <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-sm">
        <span className="font-display text-sm text-primary">
          {currentPlayer === 'plague' ? 'Plague Order' : 'Bone Legion'}
        </span>
        <span className="text-sm text-muted-foreground">— Select a unit to activate</span>
        {canForfeit && (
          <Button variant="destructive" size="sm" onClick={onForfeit} className="ml-auto text-xs">
            Forfeit
          </Button>
        )}
      </div>
    );
  }

  if (!activeUnit || !unit) return null;

  const enemies = getAdjacentEnemies(unit, allUnits);
  const adjAllies = getAdjacent(unit.position)
    .map(a => allUnits.find(u => u.hp > 0 && u.faction === unit.faction && posEqual(u.position, a)))
    .filter(Boolean) as Unit[];
  const healableAllies = [...adjAllies, unit].filter(u => u.hp < u.maxHp);

  const canAttack = !activeUnit.hasAttacked && !activeUnit.hasInteractedObjective && enemies.length > 0;
  const canAbility = !activeUnit.hasUsedAbility && !activeUnit.hasInteractedObjective && !unit.usedAbilityThisRound;

  // Objective interaction
  const onObj = objectives.find(
    o => posEqual(o.position, unit.position) && !o.used &&
      ((o.faction === 'plague' && unit.faction === 'plague') ||
       (o.faction === 'bone' && unit.faction === 'bone'))
  );
  const canInteract = !!onObj && !activeUnit.hasAttacked && !activeUnit.hasUsedAbility && !activeUnit.hasInteractedObjective;

  // Ability labels
  let abilityLabel = 'Use Ability';
  let abilityTargets: Unit[] = [];
  if (unit.unitClass === 'medic') {
    abilityLabel = unit.faction === 'plague' ? 'Purify (Heal)' : 'Grave Gift (Heal)';
    abilityTargets = healableAllies;
  }
  if (unit.unitClass === 'heavy' && unit.faction === 'plague') {
    abilityLabel = 'Flame of Wulfgrim';
  }
  if (unit.unitClass === 'captain') {
    abilityLabel = unit.faction === 'plague' ? 'Banner of Iron Faith' : 'Aura of Death';
    if (unit.usedOncePerGame) abilityLabel += ' (USED)';
  }

  // Bone Shaman resurrect
  const canResurrect = unit.unitClass === 'medic' && unit.faction === 'bone' && !unit.usedOncePerGame;

  return (
    <div className="p-3 bg-card border border-border rounded-sm space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-display text-sm text-primary">{unit.name}</span>
        <span className="text-xs text-muted-foreground">
          Move: {activeUnit.movementRemaining}/{unit.move}
        </span>
        <span className="text-xs text-muted-foreground">
          HP: {unit.hp}/{unit.maxHp}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Attack buttons */}
        {canAttack && enemies.map(enemy => (
          <Button
            key={enemy.id}
            variant="destructive"
            size="sm"
            onClick={() => onAttack(enemy.id)}
            className="text-xs"
          >
            ⚔ Attack {enemy.name} ({enemy.hp}HP)
          </Button>
        ))}

        {/* Ability button */}
        {canAbility && unit.unitClass === 'medic' && abilityTargets.map(target => (
          <Button
            key={target.id}
            size="sm"
            onClick={() => onAbility(target.id)}
            className="text-xs bg-plague/50 hover:bg-plague/70"
          >
            💚 Heal {target.name}
          </Button>
        ))}

        {canAbility && unit.unitClass === 'heavy' && unit.faction === 'plague' && (
          <Button size="sm" onClick={() => onAbility()} className="text-xs bg-hazard/50 hover:bg-hazard/70">
            🔥 {abilityLabel}
          </Button>
        )}

        {canAbility && unit.unitClass === 'captain' && !unit.usedOncePerGame && (
          <Button size="sm" onClick={() => onAbility()} className="text-xs bg-accent/50 hover:bg-accent/70">
            👑 {abilityLabel}
          </Button>
        )}

        {canAbility && canResurrect && (
          <Button size="sm" onClick={() => onAbility('resurrect')} className="text-xs bg-corpse/50 hover:bg-corpse/70">
            💀 Return of the Dead
          </Button>
        )}

        {/* Interact */}
        {canInteract && (
          <Button size="sm" onClick={onInteract} className="text-xs bg-objective/50 hover:bg-objective/70">
            📦 Interact with Objective
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={onEndActivation} className="text-xs ml-auto">
          End Activation
        </Button>
      </div>
    </div>
  );
};
