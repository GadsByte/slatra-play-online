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

const DISCONNECT_GRACE_PERIOD_MS = 10_000;

interface PlayerSession {
  id: string;
  reconnectToken: string;
  socketId: string | null;
  displayName: string;
  roomId: string | null;
  disconnectTimer: NodeJS.Timeout | null;
}

interface RoomRecord {
  id: string;
  name: string;
  code: string;
  hostPlayerId: string;
  maxPlayers: number;
  status: 'waiting' | 'in_game';
  visibility: RoomVisibility;
  activeMatchId: string | null;
  players: Map<string, RoomPlayerDto>;
}

interface MutationResult {
  updatedRoomIds: string[];
  leftRoomId?: string;
  removedRoomIds?: string[];
  clearedMatchRoomIds?: string[];
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
  private sessionsByReconnectToken = new Map<string, PlayerSession>();

  private reconnectTokenBySocketId = new Map<string, string>();

  private rooms = new Map<string, RoomRecord>();

  constructor(private readonly onMutation?: (changes: MutationResult) => void) {}

  get connectionCount() {
    return this.reconnectTokenBySocketId.size;
  }

  get roomCount() {
    return this.rooms.size;
  }

  registerPlayer(socketId: string, reconnectToken: string, displayName: string): PlayerIdentityDto {
    const trimmedDisplayName = displayName.trim();
    const trimmedReconnectToken = reconnectToken.trim();
    const existing = this.sessionsByReconnectToken.get(trimmedReconnectToken);

    if (existing?.disconnectTimer) {
      clearTimeout(existing.disconnectTimer);
      existing.disconnectTimer = null;
    }

    if (existing?.socketId && existing.socketId !== socketId) {
      this.reconnectTokenBySocketId.delete(existing.socketId);
    }

    const session: PlayerSession = existing ?? {
      id: `player-${randomUUID()}`,
      reconnectToken: trimmedReconnectToken,
      socketId: null,
      displayName: trimmedDisplayName,
      roomId: null,
      disconnectTimer: null,
    };

    session.reconnectToken = trimmedReconnectToken;
    session.socketId = socketId;
    session.displayName = trimmedDisplayName;

    this.sessionsByReconnectToken.set(trimmedReconnectToken, session);
    this.reconnectTokenBySocketId.set(socketId, trimmedReconnectToken);

    if (session.roomId) {
      const room = this.rooms.get(session.roomId);
      const player = room?.players.get(session.id);
      if (room && player) {
        room.players.set(session.id, { ...player, displayName: trimmedDisplayName });
      }
    }

    return {
      id: session.id,
      sessionToken: session.reconnectToken,
      displayName: session.displayName,
    };
  }

  getPlayer(socketId: string) {
    const reconnectToken = this.reconnectTokenBySocketId.get(socketId);
    if (!reconnectToken) return null;

    return this.sessionsByReconnectToken.get(reconnectToken) ?? null;
  }

  getDisconnectGracePeriodMs() {
    return DISCONNECT_GRACE_PERIOD_MS;
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
        activeMatchId: room.activeMatchId,
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
      activeMatchId: null,
      players: new Map([
        [player.id, { id: player.id, displayName: player.displayName, ready: false }],
      ]),
    };

    this.rooms.set(room.id, room);
    player.roomId = room.id;

    const updatedRoomIds = [...(leaveResult.changes?.updatedRoomIds ?? []), room.id];
    const removedRoomIds = leaveResult.changes?.removedRoomIds ?? [];
    const clearedMatchRoomIds = leaveResult.changes?.clearedMatchRoomIds ?? [];
    return {
      room: this.toRoomDetails(room),
      changes: { updatedRoomIds, leftRoomId: leaveResult.changes?.leftRoomId, removedRoomIds, clearedMatchRoomIds },
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
    const removedRoomIds = leaveResult.changes?.removedRoomIds ?? [];
    const clearedMatchRoomIds = leaveResult.changes?.clearedMatchRoomIds ?? [];
    return {
      room: this.toRoomDetails(room),
      changes: { updatedRoomIds, leftRoomId: leaveResult.changes?.leftRoomId, removedRoomIds, clearedMatchRoomIds },
    };
  }

  leaveRoom(socketId: string, explicitRoomId?: string): { roomId?: string; changes?: MutationResult; error?: RoomErrorPayload } {
    const player = this.getPlayer(socketId);
    if (!player) {
      return { error: { message: 'Unknown player session.' } };
    }

    return this.leaveRoomForSession(player, explicitRoomId);
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

    return { room: this.toRoomDetails(room), changes: { updatedRoomIds: [room.id] } };
  }

  markRoomInGame(roomId: RoomId, matchId: string): RoomDetailsDto | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.status = 'in_game';
    room.activeMatchId = matchId;

    return this.toRoomDetails(room);
  }

  disconnect(socketId: string): { changes?: MutationResult } {
    const reconnectToken = this.reconnectTokenBySocketId.get(socketId);
    if (!reconnectToken) {
      return { changes: { updatedRoomIds: [] } };
    }

    this.reconnectTokenBySocketId.delete(socketId);

    const player = this.sessionsByReconnectToken.get(reconnectToken);
    if (!player) {
      return { changes: { updatedRoomIds: [] } };
    }

    if (player.socketId === socketId) {
      player.socketId = null;
    }

    if (!player.roomId) {
      this.sessionsByReconnectToken.delete(reconnectToken);
      if (player.disconnectTimer) {
        clearTimeout(player.disconnectTimer);
      }
      return { changes: { updatedRoomIds: [] } };
    }

    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
    }

    player.disconnectTimer = setTimeout(() => {
      const current = this.sessionsByReconnectToken.get(reconnectToken);
      if (!current || current.socketId) {
        return;
      }

      const result = this.leaveRoomForSession(current, current.roomId ?? undefined);
      this.sessionsByReconnectToken.delete(reconnectToken);
      if (result.changes) {
        this.onMutation?.(result.changes);
      }
    }, DISCONNECT_GRACE_PERIOD_MS);

    return { changes: { updatedRoomIds: [] } };
  }

  private leaveRoomForSession(player: PlayerSession, explicitRoomId?: string): { roomId?: string; changes?: MutationResult } {
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

    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = null;
    }

    const updatedRoomIds: string[] = [];

    if (room.players.size === 0) {
      this.rooms.delete(room.id);
      return {
        roomId: room.id,
        changes: {
          updatedRoomIds: [room.id],
          removedRoomIds: [room.id],
          clearedMatchRoomIds: room.activeMatchId ? [room.id] : [],
          leftRoomId: room.id,
        },
      };
    }

    if (room.hostPlayerId === player.id) {
      room.hostPlayerId = room.players.keys().next().value as string;
    }

    const clearedMatchRoomIds = room.activeMatchId ? [room.id] : [];
    if (room.activeMatchId) {
      room.status = 'waiting';
      room.activeMatchId = null;
      room.players.forEach((existingPlayer, existingPlayerId) => {
        room.players.set(existingPlayerId, { ...existingPlayer, ready: false });
      });
    }

    updatedRoomIds.push(room.id);

    return { roomId: room.id, changes: { updatedRoomIds, leftRoomId: room.id, clearedMatchRoomIds } };
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
      activeMatchId: room.activeMatchId,
      players: Array.from(room.players.values()),
    };
  }
}
