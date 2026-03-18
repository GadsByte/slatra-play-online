import { describe, expect, it } from 'vitest';
import { validatePlayerCommand } from './matchGuards.js';
import { MatchStore } from './matchStore.js';
import type { RoomDetailsDto } from '@slatra/shared';

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

describe('validatePlayerCommand', () => {
  it('rejects commands that are not available in the current phase', () => {
    const store = new MatchStore();
    const room = createRoom();
    store.createMatch(room);

    const match = store.getMatchRecord(room.id)!;
    const result = validatePlayerCommand(match, 'player-host', { type: 'ROLL_OBJECTIVES' });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('invalid_phase');
  });

  it('rejects commands from the wrong seated player', () => {
    const store = new MatchStore();
    const room = createRoom();
    store.createMatch(room);

    const match = store.getMatchRecord(room.id)!;
    const result = validatePlayerCommand(match, 'player-guest', { type: 'PLACE_HAZARD', position: { row: 3, col: 0 } });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not_authorized');
  });
});
