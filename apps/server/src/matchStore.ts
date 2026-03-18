import { MatchSnapshotDto, RoomId, createInitialMatchGameState } from '@slatra/shared';
import { randomUUID } from 'node:crypto';

interface MatchRecord {
  id: string;
  roomId: RoomId;
  status: 'active';
  gameState: import('@slatra/shared').MatchGameStateDto;
  createdAt: string;
}

export class MatchStore {
  private matchesByRoomId = new Map<RoomId, MatchRecord>();

  getMatch(roomId: RoomId): MatchSnapshotDto | null {
    const match = this.matchesByRoomId.get(roomId);
    return match ? { ...match } : null;
  }

  createMatch(roomId: RoomId): MatchSnapshotDto {
    const existing = this.matchesByRoomId.get(roomId);
    if (existing) {
      return { ...existing };
    }

    const match: MatchRecord = {
      id: `match-${randomUUID()}`,
      roomId,
      status: 'active',
      gameState: createInitialMatchGameState(),
      createdAt: new Date().toISOString(),
    };

    this.matchesByRoomId.set(roomId, match);
    return { ...match };
  }

  deleteMatch(roomId: RoomId) {
    this.matchesByRoomId.delete(roomId);
  }
}
