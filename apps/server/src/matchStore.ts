import type { MatchCommandDto, MatchSnapshotDto, MatchStateUpdatePayload, RoomDetailsDto, RoomId } from '@slatra/shared';
import { applyCommand, type GameCommand } from '../../../packages/engine/src/slatra/index.js';
import { createMatchState, type MatchStateRecord, toMatchStateUpdate, toSnapshot } from './matchState.js';

export class MatchStore {
  private matchesByRoomId = new Map<RoomId, MatchStateRecord>();

  getMatch(roomId: RoomId): MatchSnapshotDto | null {
    const match = this.matchesByRoomId.get(roomId);
    return match ? toSnapshot(match) : null;
  }

  getMatchRecord(roomId: RoomId): MatchStateRecord | null {
    return this.matchesByRoomId.get(roomId) ?? null;
  }

  createMatch(room: RoomDetailsDto): MatchSnapshotDto {
    const existing = this.matchesByRoomId.get(room.id);
    if (existing) {
      return toSnapshot(existing);
    }

    const match = createMatchState(room);
    this.matchesByRoomId.set(room.id, match);
    return toSnapshot(match);
  }

  getStateUpdate(roomId: RoomId, reason: MatchStateUpdatePayload['reason'], command?: MatchCommandDto): MatchStateUpdatePayload | null {
    const match = this.matchesByRoomId.get(roomId);
    return match ? toMatchStateUpdate(match, reason, command) : null;
  }

  applyCommand(roomId: RoomId, command: MatchCommandDto): { update: MatchStateUpdatePayload; changed: boolean } | null {
    const match = this.matchesByRoomId.get(roomId);
    if (!match) {
      return null;
    }

    const nextState = applyCommand(match.gameState, command as GameCommand, match.rng);
    if (nextState === match.gameState) {
      return { update: toMatchStateUpdate(match, 'sync', command), changed: false };
    }

    match.gameState = nextState;
    match.revision += 1;
    match.updatedAt = new Date().toISOString();

    return {
      update: toMatchStateUpdate(match, 'command_applied', command),
      changed: true,
    };
  }

  deleteMatch(roomId: RoomId) {
    this.matchesByRoomId.delete(roomId);
  }
}
