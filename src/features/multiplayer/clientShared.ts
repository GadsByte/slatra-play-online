import {
  LobbyRoomSummaryDto,
  MatchSnapshotDto,
  MultiplayerSnapshot,
  PlayerIdentityDto,
  RoomDetailsDto,
  RoomPlayerDto,
} from './types';
import { createSessionToken, loadStoredIdentity, saveStoredIdentity } from './storage';

export type MultiplayerSnapshotListener = (snapshot: MultiplayerSnapshot) => void;
export type MultiplayerTransport = 'local' | 'socket';

export interface MultiplayerClientConfig {
  transport: MultiplayerTransport;
  serverUrl: string;
}

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

export function normalizeRoomLookup(value: string) {
  return value.trim().toLowerCase();
}

export function getStoredIdentity(): PlayerIdentityDto | null {
  return loadStoredIdentity();
}

export function createIdentity(displayName: string, existingIdentity?: PlayerIdentityDto | null): PlayerIdentityDto {
  return {
    id: existingIdentity?.id ?? createId('player'),
    sessionToken: existingIdentity?.sessionToken ?? createSessionToken(),
    displayName,
  };
}

export function persistIdentity(identity: PlayerIdentityDto) {
  saveStoredIdentity(identity);
  return identity;
}

export function createPlayer(identity: PlayerIdentityDto): RoomPlayerDto {
  return {
    id: identity.id,
    displayName: identity.displayName,
    ready: false,
  };
}

function toLobbySummary(room: RoomDetailsDto): LobbyRoomSummaryDto {
  const host = room.players.find(player => player.id === room.hostPlayerId);

  return {
    id: room.id,
    name: room.name,
    code: room.code,
    hostPlayerId: room.hostPlayerId,
    hostDisplayName: host?.displayName ?? 'Unknown Host',
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    status: room.status,
    visibility: room.visibility,
    activeMatchId: room.activeMatchId,
  };
}

export function createSnapshot(
  identity: PlayerIdentityDto | null,
  roomStates: RoomDetailsDto[],
  matchStates: MatchSnapshotDto[],
): MultiplayerSnapshot {
  return {
    identity,
    rooms: roomStates.map(toLobbySummary),
    roomStates,
    matchStates,
  };
}

export function readMultiplayerConfig(): MultiplayerClientConfig {
  const requestedTransport = import.meta.env.VITE_MULTIPLAYER_TRANSPORT?.trim().toLowerCase();
  const transport: MultiplayerTransport = requestedTransport === 'local'
    ? 'local'
    : requestedTransport === 'socket'
      ? 'socket'
      : import.meta.env.PROD
        ? 'socket'
        : 'local';
  const defaultServerUrl = import.meta.env.PROD ? window.location.origin : 'http://localhost:3001';
  const serverUrl = import.meta.env.VITE_MULTIPLAYER_SERVER_URL?.trim() || defaultServerUrl;

  return { transport, serverUrl };
}
