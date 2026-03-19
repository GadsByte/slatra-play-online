import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import type { RoomDetailsDto } from '@slatra/shared';
import { MatchStore } from './matchStore.js';
import { FileMatchSnapshotRepository, JsonFileServerStateStore } from './persistence.js';

function createRoom(overrides: Partial<RoomDetailsDto> = {}): RoomDetailsDto {
  return {
    id: 'room-1',
    name: 'Arena',
    code: 'ABCDE',
    hostPlayerId: 'player-host',
    maxPlayers: 2,
    status: 'waiting',
    visibility: 'public',
    activeMatchId: null,
    players: [
      { id: 'player-host', displayName: 'Host', ready: true },
      { id: 'player-guest', displayName: 'Guest', ready: true },
    ],
    ...overrides,
  };
}

describe('MatchStore', () => {
  it('creates a room-keyed match snapshot with host and guest seat assignments', () => {
    const store = new MatchStore();
    const room = createRoom();

    const match = store.createMatch(room);

    expect(match.roomId).toBe(room.id);
    expect(match.status).toBe('active');
    expect(match.seats).toEqual([
      { seat: 'plague', playerId: room.hostPlayerId },
      { seat: 'bone', playerId: 'player-guest' },
    ]);
    expect(match.revision).toBe(0);
    expect(match.updatedAt).toBe(match.createdAt);
    expect(store.getMatch(room.id)).toEqual(match);
    expect(store.getMatchRecord(room.id)?.id).toBe(match.id);
  });

  it('reuses the active match for a room instead of creating duplicates', () => {
    const store = new MatchStore();
    const room = createRoom();

    const firstMatch = store.createMatch(room);
    const secondMatch = store.createMatch(room);

    expect(secondMatch).toEqual(firstMatch);
    expect(store.getMatchRecord(room.id)?.id).toBe(firstMatch.id);
  });

  it('increments the authoritative snapshot revision after accepted commands', () => {
    const store = new MatchStore();
    const room = createRoom();

    store.createMatch(room);
    const result = store.applyCommand(room.id, { type: 'PLACE_HAZARD', position: { row: 3, col: 0 } });

    expect(result?.changed).toBe(true);
    expect(result?.update.reason).toBe('command_applied');
    expect(result?.update.match.revision).toBe(1);
    expect(result?.update.command).toEqual({ type: 'PLACE_HAZARD', position: { row: 3, col: 0 } });
  });

  it('restores an active persisted match snapshot after a process restart', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'slatra-match-store-'));
    const stateFile = join(tempDir, 'server-state.json');

    try {
      const room = createRoom();
      const stateStore = new JsonFileServerStateStore(stateFile);
      const store = new MatchStore({
        matches: new FileMatchSnapshotRepository(stateStore),
      });

      const createdMatch = store.createMatch(room);
      store.applyCommand(room.id, { type: 'PLACE_HAZARD', position: { row: 3, col: 0 } });

      const restoredStore = new MatchStore({
        matches: new FileMatchSnapshotRepository(new JsonFileServerStateStore(stateFile)),
      });
      restoredStore.restore();

      const restoredMatch = restoredStore.getMatch(room.id);

      expect(restoredMatch).not.toBeNull();
      expect(restoredMatch?.id).toBe(createdMatch.id);
      expect(restoredMatch?.revision).toBe(1);
      expect(restoredMatch?.createdAt).toBe(createdMatch.createdAt);
      expect(restoredMatch?.updatedAt).not.toBe(createdMatch.createdAt);
      expect(restoredMatch?.seats).toEqual(createdMatch.seats);
      expect(restoredStore.getMatchRecord(room.id)?.rng.snapshot().seed).toBeDefined();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
