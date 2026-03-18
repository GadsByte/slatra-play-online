export type RoomStatus = 'waiting' | 'in_game';
export type RoomVisibility = 'public' | 'private';

export interface PlayerIdentity {
  id: string;
  displayName: string;
}

export interface RoomPlayer {
  id: string;
  displayName: string;
  ready: boolean;
  joinedAt: string;
}

export interface LobbyRoomSummary {
  id: string;
  name: string;
  code: string;
  hostPlayerId: string;
  hostDisplayName: string;
  playerCount: number;
  maxPlayers: number;
  status: RoomStatus;
  visibility: RoomVisibility;
}

export interface RoomDetails {
  id: string;
  name: string;
  code: string;
  hostPlayerId: string;
  maxPlayers: number;
  status: RoomStatus;
  visibility: RoomVisibility;
  players: RoomPlayer[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomInput {
  name: string;
  visibility: RoomVisibility;
}

export interface JoinRoomInput {
  roomIdOrCode: string;
}

export interface MultiplayerSnapshot {
  identity: PlayerIdentity | null;
  rooms: RoomDetails[];
}
