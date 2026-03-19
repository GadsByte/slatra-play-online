import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RoomPlayerDto } from '@slatra/shared';
import { FilePlayerSessionRepository, FileRoomRepository, JsonFileServerStateStore } from './persistence.js';
import { RoomStore } from './roomStore.js';

describe('RoomStore reconnect sessions', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rebinds the same session token to a new socket before the disconnect grace period expires', () => {
    vi.useFakeTimers();

    const store = new RoomStore();
    const originalPlayer = store.registerPlayer('socket-a', 'session-1', 'Alice');
    const createdRoom = store.createRoom('socket-a', { name: 'Arena', visibility: 'public' }).room;

    expect(createdRoom).not.toBeUndefined();

    store.disconnect('socket-a');
    vi.advanceTimersByTime(store.getDisconnectGracePeriodMs() - 1);

    const reboundPlayer = store.registerPlayer('socket-b', 'session-1', 'Alice');
    const room = store.getRoom(createdRoom!.id);

    expect(reboundPlayer.id).toBe(originalPlayer.id);
    expect(reboundPlayer.sessionToken).toBe('session-1');
    expect(store.getPlayer('socket-a')).toBeNull();
    expect(store.getPlayer('socket-b')?.roomId).toBe(createdRoom!.id);
    expect(room?.players).toHaveLength(1);
    expect(room?.players[0]?.id).toBe(originalPlayer.id);
  });

  it('removes a disconnected player after the grace period and clears an active match', () => {
    vi.useFakeTimers();

    const mutations: string[] = [];
    const store = new RoomStore((changes: { updatedRoomIds: string[]; clearedMatchRoomIds?: string[] }) => {
      mutations.push(changes.updatedRoomIds.join(','), changes.clearedMatchRoomIds?.join(',') ?? '');
    });

    const host = store.registerPlayer('socket-host', 'session-host', 'Host');
    const room = store.createRoom('socket-host', { name: 'Arena', visibility: 'public' }).room!;

    store.registerPlayer('socket-guest', 'session-guest', 'Guest');
    store.joinRoom('socket-guest', { roomIdOrCode: room.id });
    store.setReady('socket-host', { roomId: room.id, ready: true });
    store.setReady('socket-guest', { roomId: room.id, ready: true });
    store.markRoomInGame(room.id, 'match-1');

    store.disconnect('socket-guest');
    vi.advanceTimersByTime(store.getDisconnectGracePeriodMs());

    const updatedRoom = store.getRoom(room.id);

    expect(updatedRoom?.status).toBe('waiting');
    expect(updatedRoom?.activeMatchId).toBeNull();
    expect(updatedRoom?.players.map((player: RoomPlayerDto) => player.id)).toEqual([host.id]);
    expect(updatedRoom?.players[0]?.ready).toBe(false);
    expect(store.getPlayer('socket-guest')).toBeNull();
    expect(mutations).toContain(room.id);
  });

  it('restores persisted player sessions and room membership after a process restart', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'slatra-room-store-'));
    const stateFile = join(tempDir, 'server-state.json');
    const stateStore = new JsonFileServerStateStore(stateFile);

    try {
      const store = new RoomStore(undefined, {
        players: new FilePlayerSessionRepository(stateStore),
        rooms: new FileRoomRepository(stateStore),
      });

      const host = store.registerPlayer('socket-host', 'session-host', 'Host');
      store.registerPlayer('socket-guest', 'session-guest', 'Guest');
      const createdRoom = store.createRoom('socket-host', { name: 'Arena', visibility: 'private' }).room!;

      store.joinRoom('socket-guest', { roomIdOrCode: createdRoom.code });
      store.setReady('socket-host', { roomId: createdRoom.id, ready: true });
      store.setReady('socket-guest', { roomId: createdRoom.id, ready: true });

      const restoredStateStore = new JsonFileServerStateStore(stateFile);
      const restoredStore = new RoomStore(undefined, {
        players: new FilePlayerSessionRepository(restoredStateStore),
        rooms: new FileRoomRepository(restoredStateStore),
      });
      restoredStore.restore();

      const reboundHost = restoredStore.registerPlayer('socket-host-rebound', 'session-host', 'Host Reloaded');
      const reboundGuest = restoredStore.registerPlayer('socket-guest-rebound', 'session-guest', 'Guest');
      const restoredRoom = restoredStore.getRoom(createdRoom.id);

      expect(reboundHost.id).toBe(host.id);
      expect(reboundGuest.id).not.toBe(host.id);
      expect(restoredRoom).toMatchObject({
        id: createdRoom.id,
        code: createdRoom.code,
        visibility: 'private',
        hostPlayerId: host.id,
        status: 'waiting',
      });
      expect(restoredRoom?.players).toEqual([
        { id: host.id, displayName: 'Host Reloaded', ready: true },
        { id: reboundGuest.id, displayName: 'Guest', ready: true },
      ]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
