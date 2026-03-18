export interface EngineRandom {
  nextInt: (sides: number) => number;
  pickIndex: (length: number) => number;
}

export interface DiceRollResult {
  rolls: number[];
  total: number;
}

export function createMathRandom(): EngineRandom {
  return {
    nextInt(sides: number) {
      return Math.floor(Math.random() * sides) + 1;
    },
    pickIndex(length: number) {
      return Math.floor(Math.random() * length);
    },
  };
}

export function rollDice(rng: EngineRandom, notation: string): DiceRollResult {
  const match = notation.match(/^(\d+)d(\d+)(?:\+(\d+))?$/);
  if (!match) return { rolls: [0], total: 0 };

  const count = Number.parseInt(match[1], 10);
  const sides = Number.parseInt(match[2], 10);
  const bonus = match[3] ? Number.parseInt(match[3], 10) : 0;
  const rolls: number[] = [];

  for (let i = 0; i < count; i += 1) {
    rolls.push(rng.nextInt(sides));
  }

  return {
    rolls,
    total: rolls.reduce((sum, roll) => sum + roll, 0) + bonus,
  };
}
