import type {
  CreateRoomRequestDto,
  JoinRoomRequestDto,
  LobbyRoomSummaryDto,
  MatchSnapshotDto,
  PlayerIdentityDto,
  RoomDetailsDto,
  RoomPlayerDto,
  RoomStatus as SharedRoomStatus,
  RoomVisibility as SharedRoomVisibility,
} from '@slatra/shared';

export type RoomStatus = SharedRoomStatus;
export type RoomVisibility = SharedRoomVisibility;

export type PlayerIdentity = PlayerIdentityDto;
export type RoomPlayer = RoomPlayerDto;
export type LobbyRoomSummary = LobbyRoomSummaryDto;
export type RoomDetails = RoomDetailsDto;
export type MatchSnapshot = MatchSnapshotDto;

export type CreateRoomInput = CreateRoomRequestDto;
export type JoinRoomInput = JoinRoomRequestDto;

export interface MultiplayerSnapshot {
  identity: PlayerIdentity | null;
  rooms: LobbyRoomSummary[];
  roomStates: RoomDetails[];
  matchStates: MatchSnapshot[];
}
