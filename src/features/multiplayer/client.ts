import {
  type MultiplayerClientConfig,
  type MultiplayerSnapshotListener,
  type MultiplayerTransport,
  createId,
  createIdentity,
  createPlayer,
  createSnapshot,
  getStoredIdentity,
  normalizeCode,
  normalizeRoomLookup,
  persistIdentity,
  readMultiplayerConfig,
} from './clientShared';
import { LocalMultiplayerClient } from './LocalMultiplayerClient';
import { SocketMultiplayerClient } from './SocketMultiplayerClient';
import {
  CreateRoomInput,
  JoinRoomInput,
  LobbyRoomSummaryDto,
  MatchCommandDto,
  MatchSnapshotDto,
  MultiplayerSnapshot,
  PlayerIdentityDto,
  RoomDetailsDto,
} from './types';

export type {
  MultiplayerClientConfig,
  MultiplayerSnapshotListener,
  MultiplayerTransport,
};
export {
  createId,
  createIdentity,
  createPlayer,
  createSnapshot,
  getStoredIdentity,
  normalizeCode,
  normalizeRoomLookup,
  persistIdentity,
  readMultiplayerConfig,
};

export interface MultiplayerClient {
  loadSnapshot(): Promise<MultiplayerSnapshot>;
  subscribe(listener: MultiplayerSnapshotListener): () => void;
  saveDisplayName(displayName: string): Promise<PlayerIdentityDto>;
  listRooms(): Promise<LobbyRoomSummaryDto[]>;
  getRoom(roomIdOrCode: string): Promise<RoomDetailsDto | null>;
  getMatch(roomId: string): Promise<MatchSnapshotDto | null>;
  createRoom(input: CreateRoomInput): Promise<RoomDetailsDto>;
  joinRoom(input: JoinRoomInput): Promise<RoomDetailsDto | null>;
  leaveRoom(roomId: string): Promise<void>;
  setReady(roomId: string, ready: boolean): Promise<RoomDetailsDto | null>;
  startMatch(roomId: string): Promise<MatchSnapshotDto | null>;
  sendMatchCommand(roomId: string, command: MatchCommandDto): Promise<MatchSnapshotDto | null>;
}

export function createConfiguredMultiplayerClient(config = readMultiplayerConfig()): MultiplayerClient {
  if (config.transport === 'socket') {
    return new SocketMultiplayerClient(config.serverUrl);
  }

  return new LocalMultiplayerClient();
}
