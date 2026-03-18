// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { MatchStore } from './matchStore.js';
import { RoomStore } from './roomStore.js';

describe('backend room lifecycle smoke test', () => {
  it('supports create, join, ready, start, and leave lifecycle transitions', () => {
    const roomStore = new RoomStore();
    const matchStore = new MatchStore();

    const host = roomStore.registerPlayer('socket-host', 'session-host', 'Host');
    const guest = roomStore.registerPlayer('socket-guest', 'session-guest', 'Guest');

    const room = roomStore.createRoom('socket-host', { name: 'Arena', visibility: 'public' }).room;
    expect(room).not.toBeUndefined();

    const joinedRoom = roomStore.joinRoom('socket-guest', { roomIdOrCode: room!.code }).room;
    expect(joinedRoom?.players.map(player => player.id)).toEqual([host.id, guest.id]);

    roomStore.setReady('socket-host', { roomId: room!.id, ready: true });
    const readyRoom = roomStore.setReady('socket-guest', { roomId: room!.id, ready: true }).room;
    expect(readyRoom?.players.every(player => player.ready)).toBe(true);

    const match = matchStore.createMatch(readyRoom!);
    const inGameRoom = roomStore.markRoomInGame(room!.id, match.id);
    expect(inGameRoom?.status).toBe('in_game');
    expect(inGameRoom?.activeMatchId).toBe(match.id);

    const leaveResult = roomStore.leaveRoom('socket-guest', room!.id);
    expect(leaveResult.error).toBeUndefined();

    const waitingRoom = roomStore.getRoom(room!.id);
    expect(waitingRoom?.status).toBe('waiting');
    expect(waitingRoom?.activeMatchId).toBeNull();
    expect(waitingRoom?.players).toHaveLength(1);
    expect(waitingRoom?.players[0]?.id).toBe(host.id);
  });
});
