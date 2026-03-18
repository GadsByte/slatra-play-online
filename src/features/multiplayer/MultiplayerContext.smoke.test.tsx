import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MultiplayerClient } from './client';
import { createSnapshot } from './client';
import { MultiplayerProvider, useMultiplayer } from './MultiplayerContext';

function createSmokeClient(): MultiplayerClient {
  const snapshot = createSnapshot(
    { id: 'player-1', sessionToken: 'session-1', displayName: 'Alice' },
    [
      {
        id: 'room-1',
        name: 'Arena',
        code: 'ABCDE',
        hostPlayerId: 'player-1',
        maxPlayers: 2,
        status: 'waiting',
        visibility: 'public',
        activeMatchId: null,
        players: [{ id: 'player-1', displayName: 'Alice', ready: false }],
      },
    ],
    [],
  );

  return {
    loadSnapshot: vi.fn().mockResolvedValue(snapshot),
    subscribe: vi.fn().mockReturnValue(() => undefined),
    saveDisplayName: vi.fn(),
    listRooms: vi.fn().mockResolvedValue(snapshot.rooms),
    getRoom: vi.fn().mockResolvedValue(snapshot.roomStates[0]),
    getMatch: vi.fn().mockResolvedValue(null),
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
    setReady: vi.fn(),
    startMatch: vi.fn(),
    sendMatchCommand: vi.fn(),
  };
}

function Probe() {
  const multiplayer = useMultiplayer();

  return (
    <div>
      <span data-testid="ready">{String(multiplayer.ready)}</span>
      <span data-testid="identity">{multiplayer.identity?.displayName ?? 'none'}</span>
      <span data-testid="rooms">{multiplayer.rooms.length}</span>
    </div>
  );
}

describe('MultiplayerProvider smoke test', () => {
  it('initializes provider state from the configured multiplayer client', async () => {
    const client = createSmokeClient();

    render(
      <MultiplayerProvider clientOverride={client}>
        <Probe />
      </MultiplayerProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('identity')).toHaveTextContent('Alice');
    expect(screen.getByTestId('rooms')).toHaveTextContent('1');
    expect(client.loadSnapshot).toHaveBeenCalledTimes(1);
    expect(client.subscribe).toHaveBeenCalledTimes(1);
  });
});
