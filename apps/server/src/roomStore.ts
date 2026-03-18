import {
  CreateRoomRequestDto,
  DEFAULT_ROOM_SIZE,
  JoinRoomRequestDto,
  LobbyRoomSummaryDto,
  PlayerIdentityDto,
  RoomDetailsDto,
  RoomErrorPayload,
  RoomId,
  RoomPlayerDto,
  RoomVisibility,
  SetReadyRequestDto,
} from '@slatra/shared';
import { randomUUID } from 'node:crypto';

interface PlayerSession {
  id: string;
  socketId: string;
  displayName: string;
  roomId: string | null;
}

interface RoomRecord {
  id: string;
  name: string;
  code: string;
  hostPlayerId: string;
  maxPlayers: number;
  status: 'waiting' | 'in_game';
  visibility: RoomVisibility;
  players: Map<string, RoomPlayerDto>;
}

interface MutationResult {
  updatedRoomIds: string[];
  leftRoomId?: string;
}

function createRoomCode(): string {
  return randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
}

function normalizeLookup(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

export class RoomStore {
  private playersBySocket = new Map<string, PlayerSession>();

  private rooms = new Map<string, RoomRecord>();

  get connectionCount() {
    return this.playersBySocket.size;
  }

  get roomCount() {
    return this.rooms.size;
  }

  registerPlayer(socketId: string, displayName: string): PlayerIdentityDto {
    const trimmed = displayName.trim();
    const existing = this.playersBySocket.get(socketId);

    const session: PlayerSession = {
      id: existing?.id ?? `player-${randomUUID()}`,
      socketId,
      displayName: trimmed,
      roomId: existing?.roomId ?? null,
    };

    this.playersBySocket.set(socketId, session);

    if (session.roomId) {
      const room = this.rooms.get(session.roomId);
      const player = room?.players.get(session.id);
      if (room && player) {
        room.players.set(session.id, { ...player, displayName: trimmed });
      }
    }

    return { id: session.id, displayName: session.displayName };
  }

  getPlayer(socketId: string) {
    return this.playersBySocket.get(socketId) ?? null;
  }

  listRooms(): LobbyRoomSummaryDto[] {
    return Array.from(this.rooms.values()).map(room => {
      const host = room.players.get(room.hostPlayerId);
      return {
        id: room.id,
        name: room.name,
        code: room.code,
        hostPlayerId: room.hostPlayerId,
        hostDisplayName: host?.displayName ?? 'Unknown Host',
        playerCount: room.players.size,
        maxPlayers: room.maxPlayers,
        status: room.status,
        visibility: room.visibility,
      };
    });
  }

  getRoom(roomId: RoomId): RoomDetailsDto | null {
    const room = this.rooms.get(roomId);
    return room ? this.toRoomDetails(room) : null;
  }

  findRoom(roomIdOrCode: string): RoomRecord | null {
    const lookup = normalizeLookup(roomIdOrCode);
    const code = normalizeCode(roomIdOrCode);

    return Array.from(this.rooms.values()).find(room => room.id === lookup || room.code === code) ?? null;
  }

  createRoom(socketId: string, input: CreateRoomRequestDto): { room?: RoomDetailsDto; changes?: MutationResult; error?: RoomErrorPayload } {
    const player = this.getPlayer(socketId);
    if (!player) {
      return { error: { message: 'Register a display name before creating a room.' } };
    }

    if (!input.name.trim()) {
      return { error: { message: 'Room name is required.' } };
    }

    const leaveResult = this.leaveRoom(socketId, player.roomId ?? undefined);
    const roomId = `room-${randomUUID()}`;
    const room: RoomRecord = {
      id: roomId,
      name: input.name.trim(),
      code: createRoomCode(),
      hostPlayerId: player.id,
      maxPlayers: DEFAULT_ROOM_SIZE,
      status: 'waiting',
      visibility: input.visibility,
      players: new Map([
        [player.id, { id: player.id, displayName: player.displayName, ready: false }],
      ]),
    };

    this.rooms.set(room.id, room);
    player.roomId = room.id;

    const updatedRoomIds = [...(leaveResult.changes?.updatedRoomIds ?? []), room.id];
    return {
      room: this.toRoomDetails(room),
      changes: { updatedRoomIds, leftRoomId: leaveResult.changes?.leftRoomId },
    };
  }

  joinRoom(socketId: string, input: JoinRoomRequestDto): { room?: RoomDetailsDto; changes?: MutationResult; error?: RoomErrorPayload; notFound?: true } {
    const player = this.getPlayer(socketId);
    if (!player) {
      return { error: { message: 'Register a display name before joining a room.' } };
    }

    const room = this.findRoom(input.roomIdOrCode);
    if (!room) {
      return { notFound: true };
    }

    if (!room.players.has(player.id) && room.players.size >= room.maxPlayers) {
      return { error: { message: 'That room is full.' } };
    }

    const leaveResult = player.roomId && player.roomId !== room.id
      ? this.leaveRoom(socketId, player.roomId)
      : { changes: { updatedRoomIds: [] } };

    room.players.set(player.id, {
      id: player.id,
      displayName: player.displayName,
      ready: room.players.get(player.id)?.ready ?? false,
    });
    player.roomId = room.id;

    const updatedRoomIds = [...(leaveResult.changes?.updatedRoomIds ?? []), room.id];
    return {
      room: this.toRoomDetails(room),
      changes: { updatedRoomIds, leftRoomId: leaveResult.changes?.leftRoomId },
    };
  }

  leaveRoom(socketId: string, explicitRoomId?: string): { roomId?: string; changes?: MutationResult; error?: RoomErrorPayload } {
    const player = this.getPlayer(socketId);
    if (!player) {
      return { error: { message: 'Unknown player session.' } };
    }

    const roomId = explicitRoomId ?? player.roomId;
    if (!roomId) {
      return { changes: { updatedRoomIds: [] } };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      player.roomId = null;
      return { roomId, changes: { updatedRoomIds: [], leftRoomId: roomId } };
    }

    room.players.delete(player.id);
    player.roomId = null;

    const updatedRoomIds: string[] = [];

    if (room.players.size === 0) {
      this.rooms.delete(room.id);
      updatedRoomIds.push(room.id);
      return { roomId: room.id, changes: { updatedRoomIds, leftRoomId: room.id } };
    }

    if (room.hostPlayerId === player.id) {
      room.hostPlayerId = room.players.keys().next().value as string;
    }

    updatedRoomIds.push(room.id);

    return { roomId: room.id, changes: { updatedRoomIds, leftRoomId: room.id } };
  }

  setReady(socketId: string, input: SetReadyRequestDto): { room?: RoomDetailsDto; changes?: MutationResult; error?: RoomErrorPayload } {
    const player = this.getPlayer(socketId);
    if (!player) {
      return { error: { message: 'Register a display name before updating readiness.' } };
    }

    const room = this.rooms.get(input.roomId);
    if (!room || !room.players.has(player.id)) {
      return { error: { message: 'You are not in that room.' } };
    }

    const existing = room.players.get(player.id)!;
    room.players.set(player.id, {
      ...existing,
      ready: input.ready,
      displayName: player.displayName,
    });

    return {
      room: this.toRoomDetails(room),
      changes: { updatedRoomIds: [room.id] },
    };
  }

  disconnect(socketId: string) {
    const player = this.getPlayer(socketId);
    if (!player) {
      return { changes: { updatedRoomIds: [] } };
    }

    const leaveResult = this.leaveRoom(socketId, player.roomId ?? undefined);
    this.playersBySocket.delete(socketId);
    return leaveResult;
  }

  private toRoomDetails(room: RoomRecord): RoomDetailsDto {
    return {
      id: room.id,
      name: room.name,
      code: room.code,
      hostPlayerId: room.hostPlayerId,
      maxPlayers: room.maxPlayers,
      status: room.status,
      visibility: room.visibility,
      players: Array.from(room.players.values()),
    };
  }
}
