import { randomInt, randomUUID } from 'node:crypto';
import type { MatchCommandDto, MatchSnapshotDto, MatchStateUpdatePayload, RoomDetailsDto, RoomId } from '@slatra/shared';
import type { EngineRandom, Faction, GameState } from '../../../packages/engine/src/slatra/index.js';
import { createInitialState } from '../../../packages/engine/src/slatra/index.js';

export interface BackendRngState {
  seed: number;
  state: number;
}

export class BackendMatchRandom implements EngineRandom {
  private state: number;

  constructor(private readonly seed: number, initialState = seed) {
    this.state = initialState >>> 0;
  }

  nextInt(sides: number) {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return (this.state % sides) + 1;
  }

  pickIndex(length: number) {
    if (length <= 0) return 0;
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state % length;
  }

  snapshot(): BackendRngState {
    return {
      seed: this.seed,
      state: this.state,
    };
  }
}

export interface MatchStateRecord {
  id: string;
  roomId: RoomId;
  status: 'active';
  playerFactions: Record<string, Faction>;
  gameState: GameState;
  rng: BackendMatchRandom;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export function createMatchState(room: RoomDetailsDto): MatchStateRecord {
  const hostSeat = room.players.find(player => player.id === room.hostPlayerId);
  const opponentSeat = room.players.find(player => player.id !== room.hostPlayerId);
  if (!hostSeat || !opponentSeat) {
    throw new Error('Two seated players are required to create a match.');
  }

  const createdAt = new Date().toISOString();
  const rngSeed = randomInt(1, 0x7fffffff);

  return {
    id: `match-${randomUUID()}`,
    roomId: room.id,
    status: 'active',
    playerFactions: {
      [hostSeat.id]: 'plague',
      [opponentSeat.id]: 'bone',
    },
    gameState: createInitialState(),
    rng: new BackendMatchRandom(rngSeed),
    createdAt,
    updatedAt: createdAt,
    revision: 0,
  };
}

export function toSnapshot(match: MatchStateRecord): MatchSnapshotDto {
  return {
    id: match.id,
    roomId: match.roomId,
    status: match.status,
    seats: Object.entries(match.playerFactions).map(([playerId, seat]) => ({
      seat,
      playerId,
    })),
    gameState: match.gameState,
    createdAt: match.createdAt,
    updatedAt: match.updatedAt,
    revision: match.revision,
  };
}

export function toMatchStateUpdate(
  match: MatchStateRecord,
  reason: MatchStateUpdatePayload['reason'],
  command?: MatchCommandDto,
): MatchStateUpdatePayload {
  return {
    roomId: match.roomId,
    match: toSnapshot(match),
    reason,
    command,
    emittedAt: new Date().toISOString(),
  };
}
