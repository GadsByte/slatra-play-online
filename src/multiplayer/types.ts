import type { GameState } from '@/game/types';

export type RoomStatus = 'waiting' | 'in_game' | 'finished';

export interface Room {
  id: string;
  name: string;
  host_id: string;
  host_name: string;
  is_private: boolean;
  room_code: string;
  status: RoomStatus;
  max_players: number;
  created_at: string;
}

export interface RoomPlayer {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  is_host: boolean;
  is_ready: boolean;
  joined_at: string;
}

export interface MultiplayerUser {
  id: string;
  display_name: string;
}

export interface Game {
  id: string;
  room_id: string;
  state: GameState;
  plague_player_id: string;
  bone_player_id: string;
  version: number;
  updated_at: string;
}
