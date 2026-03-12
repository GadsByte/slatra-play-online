// ===== SLATRA Game Types =====

export type Faction = 'plague' | 'bone';
export type UnitClass = 'grunt' | 'medic' | 'heavy' | 'captain';
export type Direction = 'north' | 'south' | 'east' | 'west';

export interface Position {
  row: number; // 1-8
  col: number; // 0-5 (A=0, F=5)
}

export const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export interface UnitStats {
  maxHp: number;
  move: number;
  attackDice: string; // e.g. "1d6", "2d6", "1d4"
}

export const UNIT_STATS: Record<UnitClass, UnitStats> = {
  grunt:   { maxHp: 6,  move: 3, attackDice: '1d6' },
  medic:   { maxHp: 6,  move: 2, attackDice: '1d4' },
  heavy:   { maxHp: 10, move: 2, attackDice: '2d6' },
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
  // Once-per-game ability tracking
  usedOncePerGame: boolean;
  // Once-per-round ability tracking
  usedAbilityThisRound: boolean;
  // Ancient Evasion (Bone grunt reaction)
  usedReactionThisRound: boolean;
}

export interface CorpseMarker {
  position: Position;
  faction: Faction;
  unitClass: UnitClass;
  unitId: string;
  cleansed: boolean; // Filth Scorch
}

export type TileType = 'normal' | 'hazard';

export interface HazardTile {
  position: Position;
}

export interface ObjectiveToken {
  position: Position;
  faction: Faction; // which faction can use it
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

export type PlayingSubPhase =
  | 'select_unit'      // Current player selects which unit to activate
  | 'unit_actions'     // Selected unit performing actions
  | 'confirm_end';     // Confirm end of activation

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
  // Setup state
  hazardsToPlace: number;
  // Captain buff tracking
  bannerActive: boolean; // Plague Commander Banner of Iron Faith
  auraActive: boolean;   // Death Legionnaire Aura of Death
  // Objective damage buff
  damageBuff: { faction: Faction; extraDice: string } | null;
  // Last Rite used
  lastRiteUsed: boolean;
  // Return of Dead used
  returnOfDeadUsed: boolean;
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

// Dice rolling
export function rollDice(notation: string): { rolls: number[]; total: number } {
  const match = notation.match(/^(\d+)d(\d+)(?:\+(\d+))?$/);
  if (!match) return { rolls: [0], total: 0 };
  const count = parseInt(match[1]);
  const sides = parseInt(match[2]);
  const bonus = match[3] ? parseInt(match[3]) : 0;
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  const total = rolls.reduce((a, b) => a + b, 0) + bonus;
  return { rolls, total };
}

// Create initial unit
export function createUnit(
  faction: Faction,
  unitClass: UnitClass,
  index: number,
  position: Position
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

// Get valid movement tiles using BFS
export function getValidMoves(
  unit: Unit,
  movementRemaining: number,
  allUnits: Unit[],
  corpses: CorpseMarker[],
  hazards: HazardTile[]
): Position[] {
  const occupied = new Set<string>();
  allUnits.forEach(u => {
    if (u.id !== unit.id && u.hp > 0) occupied.add(posKey(u.position));
  });
  corpses.forEach(c => occupied.add(posKey(c.position)));

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

// Get adjacent enemies
export function getAdjacentEnemies(unit: Unit, allUnits: Unit[]): Unit[] {
  const adj = getAdjacent(unit.position);
  return allUnits.filter(
    u => u.hp > 0 && u.faction !== unit.faction && adj.some(a => posEqual(a, u.position))
  );
}

// Check if position is in 5x5 area centered on center
export function isIn5x5(center: Position, target: Position): boolean {
  return (
    Math.abs(center.row - target.row) <= 2 &&
    Math.abs(center.col - target.col) <= 2
  );
}
