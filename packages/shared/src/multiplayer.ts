export type PlayerId = string;
export type RoomId = string;
export type RoomCode = string;

export type RoomStatus = 'waiting' | 'in_game';
export type RoomVisibility = 'public' | 'private';

export interface PlayerIdentityDto {
  id: PlayerId;
  displayName: string;
}

export interface LobbyRoomSummaryDto {
  id: RoomId;
  name: string;
  code: RoomCode;
  hostPlayerId: PlayerId;
  hostDisplayName: string;
  playerCount: number;
  maxPlayers: number;
  status: RoomStatus;
  visibility: RoomVisibility;
}

export interface RoomPlayerDto {
  id: PlayerId;
  displayName: string;
  ready: boolean;
}

export interface RoomDetailsDto {
  id: RoomId;
  name: string;
  code: RoomCode;
  hostPlayerId: PlayerId;
  maxPlayers: number;
  status: RoomStatus;
  visibility: RoomVisibility;
  players: RoomPlayerDto[];
}

export interface RegisterPlayerRequestDto {
  displayName: string;
}

export interface CreateRoomRequestDto {
  name: string;
  visibility: RoomVisibility;
}

export interface JoinRoomRequestDto {
  roomIdOrCode: string;
}

export interface LeaveRoomRequestDto {
  roomId: RoomId;
}

export interface SetReadyRequestDto {
  roomId: RoomId;
  ready: boolean;
}

export interface SessionReadyPayload {
  player: PlayerIdentityDto;
}

export interface LobbyRoomsPayload {
  rooms: LobbyRoomSummaryDto[];
}

export interface RoomStatePayload {
  room: RoomDetailsDto;
}

export interface RoomNotFoundPayload {
  roomIdOrCode: string;
}

export interface RoomErrorPayload {
  message: string;
}

export interface ClientToServerEvents {
  'session:set-name': (payload: RegisterPlayerRequestDto) => void;
  'lobby:list-rooms': () => void;
  'room:create': (payload: CreateRoomRequestDto) => void;
  'room:join': (payload: JoinRoomRequestDto) => void;
  'room:leave': (payload: LeaveRoomRequestDto) => void;
  'room:set-ready': (payload: SetReadyRequestDto) => void;
}

export interface ServerToClientEvents {
  'session:ready': (payload: SessionReadyPayload) => void;
  'lobby:rooms': (payload: LobbyRoomsPayload) => void;
  'room:state': (payload: RoomStatePayload) => void;
  'room:not-found': (payload: RoomNotFoundPayload) => void;
  'room:error': (payload: RoomErrorPayload) => void;
}
