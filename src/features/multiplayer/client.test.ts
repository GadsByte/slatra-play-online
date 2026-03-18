import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConfiguredMultiplayerClient, readMultiplayerConfig } from './client';
import { LocalMultiplayerClient } from './LocalMultiplayerClient';
import { SocketMultiplayerClient } from './SocketMultiplayerClient';

describe('multiplayer client configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
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

  it('reads explicit multiplayer environment overrides', () => {
    vi.stubEnv('VITE_MULTIPLAYER_TRANSPORT', 'socket');
    vi.stubEnv('VITE_MULTIPLAYER_SERVER_URL', 'https://backend.example.com');

    expect(readMultiplayerConfig()).toEqual({
      transport: 'socket',
      serverUrl: 'https://backend.example.com',
    });
  });
});
