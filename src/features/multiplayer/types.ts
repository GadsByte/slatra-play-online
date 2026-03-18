import type {
  CreateRoomRequestDto,
  FactionDto,
  JoinRoomRequestDto,
  LobbyRoomSummaryDto,
  MatchCommandDto,
  MatchSnapshotDto,
  PlayerIdentityDto,
  RoomDetailsDto,
  RoomPlayerDto,
  RoomStatus,
  RoomVisibility,
} from '@slatra/shared';

export type {
  CreateRoomRequestDto,
  LobbyRoomSummaryDto,
  MatchCommandDto,
  MatchSnapshotDto,
  PlayerIdentityDto,
  RoomDetailsDto,
  RoomPlayerDto,
  RoomStatus,
  RoomVisibility,
};

export type CreateRoomInput = CreateRoomRequestDto;
export type JoinRoomInput = JoinRoomRequestDto;

export interface MultiplayerSnapshot {
  identity: PlayerIdentityDto | null;
  rooms: LobbyRoomSummaryDto[];
  roomStates: RoomDetailsDto[];
  matchStates: MatchSnapshotDto[];
}

export interface LobbyRoomViewModel {
  room: LobbyRoomSummaryDto;
  isFull: boolean;
  isInGame: boolean;
}

export interface RoomViewModel {
  room: RoomDetailsDto;
  currentPlayer: RoomPlayerDto | null;
  isHost: boolean;
  canStart: boolean;
  openSeatCount: number;
}

export interface MatchViewModel {
  room: RoomDetailsDto;
  match: MatchSnapshotDto;
  viewerSeat: FactionDto | null;
  viewerTurn: boolean;
}

export function toLobbyRoomViewModel(room: LobbyRoomSummaryDto): LobbyRoomViewModel {
  return {
    room,
    isFull: room.playerCount >= room.maxPlayers,
    isInGame: room.status === 'in_game',
  };
}

export function toRoomViewModel(room: RoomDetailsDto, playerId?: string | null): RoomViewModel {
  const currentPlayer = playerId
    ? room.players.find(player => player.id === playerId) ?? null
    : null;

  return {
    room,
    currentPlayer,
    isHost: room.hostPlayerId === playerId,
    canStart: room.players.length === room.maxPlayers && room.players.every(player => player.ready),
    openSeatCount: Math.max(room.maxPlayers - room.players.length, 0),
  };
}

export function toMatchViewModel(
  room: RoomDetailsDto,
  match: MatchSnapshotDto,
  playerId?: string | null,
): MatchViewModel {
  const viewerSeat = playerId
    ? match.seats.find(seat => seat.playerId === playerId)?.seat ?? null
    : null;

  return {
    room,
    match,
    viewerSeat,
    viewerTurn: viewerSeat !== null && match.gameState.currentPlayer === viewerSeat,
  };
}
