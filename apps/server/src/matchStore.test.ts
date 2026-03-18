import { describe, expect, it } from 'vitest';
import type { RoomDetailsDto } from '@slatra/shared';
import { MatchStore } from './matchStore.js';

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
});
