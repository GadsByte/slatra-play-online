import { applyCommand } from '../../../packages/engine/src/slatra/applyCommand.js';
import type { GameCommand } from '../../../packages/engine/src/slatra/commands.js';
import { createMathRandom, type EngineRandom } from '../../../packages/engine/src/slatra/rng.js';
import { createInitialState, type Faction, type GameState } from '../../../packages/engine/src/slatra/types.js';
import { type MatchSnapshotDto, type RoomDetailsDto, type RoomId } from '@slatra/shared';
import { randomUUID } from 'node:crypto';

interface MatchRecord {
  id: string;
  roomId: RoomId;
  status: 'active';
  seats: Record<Faction, string>;
  gameState: GameState;
  rng: EngineRandom;
  createdAt: string;
}

function toSnapshot(match: MatchRecord): MatchSnapshotDto {
  return {
    id: match.id,
    roomId: match.roomId,
    status: match.status,
    seats: [
      { seat: 'plague', playerId: match.seats.plague },
      { seat: 'bone', playerId: match.seats.bone },
    ],
    gameState: match.gameState,
    createdAt: match.createdAt,
  };
}

export class MatchStore {
  private matchesByRoomId = new Map<RoomId, MatchRecord>();

  getMatch(roomId: RoomId): MatchSnapshotDto | null {
    const match = this.matchesByRoomId.get(roomId);
    return match ? toSnapshot(match) : null;
  }

  getMatchRecord(roomId: RoomId): MatchRecord | null {
    return this.matchesByRoomId.get(roomId) ?? null;
  }

  createMatch(room: RoomDetailsDto): MatchSnapshotDto {
    const existing = this.matchesByRoomId.get(room.id);
    if (existing) {
      return toSnapshot(existing);
    }

    const hostSeat = room.players.find(player => player.id === room.hostPlayerId);
    const opponentSeat = room.players.find(player => player.id !== room.hostPlayerId);
    if (!hostSeat || !opponentSeat) {
      throw new Error('Two seated players are required to create a match.');
    }

    const match: MatchRecord = {
      id: `match-${randomUUID()}`,
      roomId: room.id,
      status: 'active',
      seats: {
        plague: hostSeat.id,
        bone: opponentSeat.id,
      },
      gameState: createInitialState(),
      rng: createMathRandom(),
      createdAt: new Date().toISOString(),
    };

    this.matchesByRoomId.set(room.id, match);
    return toSnapshot(match);
  }

  applyCommand(roomId: RoomId, command: GameCommand): { match: MatchSnapshotDto; changed: boolean } | null {
    const match = this.matchesByRoomId.get(roomId);
    if (!match) {
      return null;
    }

    const nextState = applyCommand(match.gameState, command, match.rng);
    if (nextState === match.gameState) {
      return { match: toSnapshot(match), changed: false };
    }

    match.gameState = nextState;
    return { match: toSnapshot(match), changed: true };
  }

  deleteMatch(roomId: RoomId) {
    this.matchesByRoomId.delete(roomId);
  }
}
