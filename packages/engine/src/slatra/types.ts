export type Faction = 'plague' | 'bone';
export type UnitClass = 'grunt' | 'medic' | 'heavy' | 'captain';
export type Direction = 'north' | 'south' | 'east' | 'west';

export interface Position {
  row: number;
  col: number;
}

export const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export interface UnitStats {
  maxHp: number;
  move: number;
  attackDice: string;
}

export const UNIT_STATS: Record<UnitClass, UnitStats> = {
  grunt: { maxHp: 6, move: 3, attackDice: '1d6' },
  medic: { maxHp: 6, move: 2, attackDice: '1d4' },
  heavy: { maxHp: 10, move: 2, attackDice: '2d6' },
  captain: { maxHp: 12, move: 3, attackDice: '2d6' },
};

export interface Unit {
  id: string;
  faction: Faction;
  unitClass: UnitClass;
  name: string;
  position: Position;
  hp: number;
  maxHp: number;
  move: number;
  attackDice: string;
  facing: Direction;
  activated: boolean;
  pinned: boolean;
  usedOncePerGame: boolean;
  usedAbilityThisRound: boolean;
  usedReactionThisRound: boolean;
}

export interface CorpseMarker {
  position: Position;
  faction: Faction;
  unitClass: UnitClass;
  unitId: string;
  cleansed: boolean;
}

export interface HazardTile {
  position: Position;
}

export interface ObjectiveToken {
  position: Position;
  faction: Faction;
  type: 'plague_crate' | 'bone_altar';
  used: boolean;
}

export type GamePhase =
  | 'title'
  | 'hazard_placement'
  | 'objective_roll'
  | 'deployment_p1'
  | 'deployment_p2'
  | 'initiative_roll'
  | 'playing'
  | 'game_over';

export type PlayingSubPhase = 'select_unit' | 'unit_actions' | 'confirm_end';

export interface DiceResult {
  dice: string;
  rolls: number[];
  total: number;
  label: string;
}

export interface ActiveUnitState {
  unitId: string;
  movementRemaining: number;
  hasAttacked: boolean;
  hasUsedAbility: boolean;
  hasInteractedObjective: boolean;
}

export interface GameState {
  phase: GamePhase;
  subPhase: PlayingSubPhase;
  round: number;
  currentPlayer: Faction;
  initiativePlayer: Faction;
  units: Unit[];
  corpses: CorpseMarker[];
  hazards: HazardTile[];
  objectives: ObjectiveToken[];
  activeUnit: ActiveUnitState | null;
  selectedTile: Position | null;
  diceResult: DiceResult | null;
  log: string[];
  winner: Faction | null;
  hazardsToPlace: number;
  selectedDeployClass: UnitClass | null;
  bannerActive: boolean;
  auraActive: boolean;
  damageBuff: { faction: Faction; extraDice: string } | null;
  lastRiteUsed: boolean;
  returnOfDeadUsed: boolean;
}

export function createInitialState(): GameState {
  return {
    phase: 'hazard_placement',
    subPhase: 'select_unit',
    round: 0,
    currentPlayer: 'plague',
    initiativePlayer: 'plague',
    units: [],
    corpses: [],
    hazards: [],
    objectives: [],
    activeUnit: null,
    selectedTile: null,
    diceResult: null,
    log: [],
    winner: null,
    hazardsToPlace: 4,
    selectedDeployClass: null,
    bannerActive: false,
    auraActive: false,
    damageBuff: null,
    lastRiteUsed: false,
    returnOfDeadUsed: false,
  };
}

export function posKey(pos: Position): string {
  return `${pos.row}-${pos.col}`;
}

export function posEqual(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

export function getAdjacent(pos: Position): Position[] {
  const adj: Position[] = [];
  if (pos.row > 1) adj.push({ row: pos.row - 1, col: pos.col });
  if (pos.row < 8) adj.push({ row: pos.row + 1, col: pos.col });
  if (pos.col > 0) adj.push({ row: pos.row, col: pos.col - 1 });
  if (pos.col < 5) adj.push({ row: pos.row, col: pos.col + 1 });
  return adj;
}

export function isInBounds(pos: Position): boolean {
  return pos.row >= 1 && pos.row <= 8 && pos.col >= 0 && pos.col <= 5;
}

export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

export function tileLabel(pos: Position): string {
  return `${pos.row}${COLUMNS[pos.col]}`;
}

export function getFactionName(faction: Faction): string {
  return faction === 'plague' ? 'Plague Order' : 'Bone Legion';
}

export function getUnitDisplayName(unit: Unit): string {
  return unit.name;
}

export function createUnit(
  faction: Faction,
  unitClass: UnitClass,
  index: number,
  position: Position,
): Unit {
  const stats = UNIT_STATS[unitClass];
  const names: Record<Faction, Record<UnitClass, string>> = {
    plague: {
      grunt: 'Plague Soldier',
      medic: 'Plague Chaplain',
      heavy: 'Plague Flamer',
      captain: 'Plague Commander',
    },
    bone: {
      grunt: 'Zombie Centurion',
      medic: 'Bone Shaman',
      heavy: 'Magma Troll',
      captain: 'Death Legionnaire',
    },
  };
  const name = unitClass === 'grunt'
    ? `${names[faction][unitClass]} ${index + 1}`
    : names[faction][unitClass];

  return {
    id: `${faction}-${unitClass}-${index}`,
    faction,
    unitClass,
    name,
    position,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    move: stats.move,
    attackDice: stats.attackDice,
    facing: faction === 'plague' ? 'south' : 'north',
    activated: false,
    pinned: false,
    usedOncePerGame: false,
    usedAbilityThisRound: false,
    usedReactionThisRound: false,
  };
}

export function getValidMoves(
  unit: Unit,
  movementRemaining: number,
  allUnits: Unit[],
  corpses: CorpseMarker[],
  _hazards: HazardTile[],
): Position[] {
  const occupied = new Set<string>();
  allUnits.forEach(existingUnit => {
    if (existingUnit.id !== unit.id && existingUnit.hp > 0) occupied.add(posKey(existingUnit.position));
  });
  corpses.forEach(corpse => occupied.add(posKey(corpse.position)));

  const visited = new Map<string, number>();
  const queue: { pos: Position; remaining: number }[] = [
    { pos: unit.position, remaining: movementRemaining },
  ];
  visited.set(posKey(unit.position), movementRemaining);
  const result: Position[] = [];

  while (queue.length > 0) {
    const { pos, remaining } = queue.shift()!;
    if (remaining <= 0) continue;

    for (const adj of getAdjacent(pos)) {
      const key = posKey(adj);
      if (occupied.has(key)) continue;
      const prev = visited.get(key);
      if (prev !== undefined && prev >= remaining - 1) continue;
      visited.set(key, remaining - 1);
      result.push(adj);
      queue.push({ pos: adj, remaining: remaining - 1 });
    }
  }

  return result;
}

export function getAdjacentEnemies(unit: Unit, allUnits: Unit[]): Unit[] {
  const adj = getAdjacent(unit.position);
  return allUnits.filter(
    existingUnit => existingUnit.hp > 0 && existingUnit.faction !== unit.faction && adj.some(a => posEqual(a, existingUnit.position)),
  );
}

export function isIn5x5(center: Position, target: Position): boolean {
  return Math.abs(center.row - target.row) <= 2 && Math.abs(center.col - target.col) <= 2;
}
