export const DEFAULT_SERVER_PORT = 3001;
export const DEFAULT_ROOM_SIZE = 2;
export const SERVER_INFO = {
  name: 'SLATRA backend',
} as const;

export interface HealthResponseDto {
  name: string;
  status: 'ok';
  rooms: number;
  connections: number;
  transport: 'socket.io';
}

export * from './multiplayer.js';
