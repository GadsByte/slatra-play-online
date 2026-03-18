import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createConfiguredMultiplayerClient, readMultiplayerConfig } from './client';
import { LocalMultiplayerClient } from './LocalMultiplayerClient';
import { SocketMultiplayerClient } from './SocketMultiplayerClient';

function clearMultiplayerStorage() {
  window.localStorage.clear();
}

describe('multiplayer client configuration', () => {
  beforeEach(() => {
    clearMultiplayerStorage();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    clearMultiplayerStorage();
  });

  it('creates a socket client when configured', () => {
    const client = createConfiguredMultiplayerClient({
      transport: 'socket',
      serverUrl: 'https://backend.example.com',
    });

    expect(client).toBeInstanceOf(SocketMultiplayerClient);
  });

  it('creates a local client when configured', () => {
    const client = createConfiguredMultiplayerClient({
      transport: 'local',
      serverUrl: 'https://backend.example.com',
    });

    expect(client).toBeInstanceOf(LocalMultiplayerClient);
  });

  it('defaults normal multiplayer usage to socket transport', () => {
    expect(readMultiplayerConfig()).toEqual({
      transport: 'socket',
      serverUrl: 'http://localhost:3001',
    });
  });

  it('reads explicit multiplayer environment overrides', () => {
    vi.stubEnv('VITE_MULTIPLAYER_TRANSPORT', 'socket');
    vi.stubEnv('VITE_MULTIPLAYER_SERVER_URL', 'https://backend.example.com');

    expect(readMultiplayerConfig()).toEqual({
      transport: 'socket',
      serverUrl: 'https://backend.example.com',
    });
  });

  it('only enables local transport when explicitly requested', () => {
    vi.stubEnv('VITE_MULTIPLAYER_TRANSPORT', 'local');

    expect(readMultiplayerConfig()).toEqual({
      transport: 'local',
      serverUrl: 'http://localhost:3001',
    });
  });

  it('does not preload demo rooms unless local demo seeding is explicitly enabled', async () => {
    vi.stubEnv('VITE_MULTIPLAYER_TRANSPORT', 'local');

    const client = new LocalMultiplayerClient();

    await expect(client.listRooms()).resolves.toEqual([]);
  });

  it('labels demo rooms clearly when local demo seeding is enabled', async () => {
    vi.stubEnv('VITE_MULTIPLAYER_TRANSPORT', 'local');
    vi.stubEnv('VITE_MULTIPLAYER_LOCAL_SEEDS', 'demo');

    const client = new LocalMultiplayerClient();
    const rooms = await client.listRooms();

    expect(rooms).toHaveLength(3);
    expect(rooms.every(room => room.name.startsWith('[Demo]'))).toBe(true);
    expect(rooms.map(room => room.code)).toEqual(['DEMO01', 'DEMO02', 'DEMO03']);
  });
});
