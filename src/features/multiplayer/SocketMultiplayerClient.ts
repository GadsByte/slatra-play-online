import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@slatra/shared';
import { io, type Socket } from 'socket.io-client';
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
import type { MultiplayerClient } from './client';
import {
  createIdentity,
  getStoredIdentity,
  normalizeCode,
  normalizeRoomLookup,
  persistIdentity,
  type MultiplayerSnapshotListener,
} from './clientShared';

interface PendingRequest<TValue = unknown> {
  kind:
    | 'session:set-name'
    | 'lobby:list-rooms'
    | 'room:create'
    | 'room:join'
    | 'room:leave'
    | 'room:set-ready'
    | 'room:start-match'
    | 'match:command';
  resolve: (value: TValue) => void;
  reject: (reason?: unknown) => void;
  timeoutId: ReturnType<typeof window.setTimeout>;
  roomId?: string;
  roomIdOrCode?: string;
}

export class SocketMultiplayerClient implements MultiplayerClient {
  private listeners = new Set<MultiplayerSnapshotListener>();

  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

  private connectPromise: Promise<void> | null = null;

  private pendingRequest: PendingRequest | null = null;

  private identity: PlayerIdentityDto | null = getStoredIdentity();

  private sessionReady = false;

  private rooms: LobbyRoomSummaryDto[] = [];

  private roomStates = new Map<string, RoomDetailsDto>();

  private matchStates = new Map<string, MatchSnapshotDto>();

  constructor(private readonly serverUrl: string) {}

  subscribe(listener: MultiplayerSnapshotListener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());

    return () => {
      this.listeners.delete(listener);
    };
  }

  async loadSnapshot(): Promise<MultiplayerSnapshot> {
    await this.ensureSocket();

    const storedIdentity = getStoredIdentity();
    if (storedIdentity?.displayName && (!this.sessionReady || this.identity?.displayName !== storedIdentity.displayName)) {
      await this.saveDisplayName(storedIdentity.displayName);
    }

    await this.listRooms();
    return this.getSnapshot();
  }

  async saveDisplayName(displayName: string): Promise<PlayerIdentityDto> {
    const trimmed = displayName.trim();
    if (!trimmed) {
      throw new Error('Display name is required.');
    }

    await this.ensureSocket();
    const identity = createIdentity(trimmed, this.identity ?? getStoredIdentity());

    return this.beginRequest<PlayerIdentityDto>({ kind: 'session:set-name' }, () => {
      this.socket!.emit('session:set-name', { displayName: trimmed, sessionToken: identity.sessionToken });
    });
  }

  async listRooms(): Promise<LobbyRoomSummaryDto[]> {
    await this.ensureSocket();

    return this.beginRequest<LobbyRoomSummaryDto[]>({ kind: 'lobby:list-rooms' }, () => {
      this.socket!.emit('lobby:list-rooms');
    });
  }

  async getRoom(roomIdOrCode: string): Promise<RoomDetailsDto | null> {
    const lookup = normalizeRoomLookup(roomIdOrCode);
    const code = normalizeCode(roomIdOrCode);

    return Array.from(this.roomStates.values()).find(room => room.id === lookup || room.code === code) ?? null;
  }

  async getMatch(roomId: string): Promise<MatchSnapshotDto | null> {
    return this.matchStates.get(roomId) ?? null;
  }

  async createRoom(input: CreateRoomInput): Promise<RoomDetailsDto> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error('Room name is required.');
    }

    await this.ensureSocket();

    return this.beginRequest<RoomDetailsDto>({ kind: 'room:create' }, () => {
      this.socket!.emit('room:create', { ...input, name: trimmedName });
    });
  }

  async joinRoom(input: JoinRoomInput): Promise<RoomDetailsDto | null> {
    const roomIdOrCode = input.roomIdOrCode.trim();
    if (!roomIdOrCode) {
      throw new Error('A room code or room id is required.');
    }

    await this.ensureSocket();

    return this.beginRequest<RoomDetailsDto | null>({ kind: 'room:join', roomIdOrCode }, () => {
      this.socket!.emit('room:join', { roomIdOrCode });
    });
  }

  async leaveRoom(roomId: string): Promise<void> {
    await this.ensureSocket();

    return this.beginRequest<void>({ kind: 'room:leave', roomId }, () => {
      this.socket!.emit('room:leave', { roomId });
    });
  }

  async setReady(roomId: string, ready: boolean): Promise<RoomDetailsDto | null> {
    await this.ensureSocket();

    return this.beginRequest<RoomDetailsDto | null>({ kind: 'room:set-ready', roomId }, () => {
      this.socket!.emit('room:set-ready', { roomId, ready });
    });
  }

  async startMatch(roomId: string): Promise<MatchSnapshotDto | null> {
    await this.ensureSocket();

    return this.beginRequest<MatchSnapshotDto | null>({ kind: 'room:start-match', roomId }, () => {
      this.socket!.emit('room:start-match', { roomId });
    });
  }

  async sendMatchCommand(roomId: string, command: MatchCommandDto): Promise<MatchSnapshotDto | null> {
    await this.ensureSocket();

    return this.beginRequest<MatchSnapshotDto | null>({ kind: 'match:command', roomId }, () => {
      this.socket!.emit('match:command', { roomId, command });
    });
  }

  private getSnapshot(): MultiplayerSnapshot {
    return {
      identity: this.identity,
      rooms: this.rooms,
      roomStates: Array.from(this.roomStates.values()),
      matchStates: Array.from(this.matchStates.values()),
    };
  }

  private emitSnapshot() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(listener => listener(snapshot));
  }

  private async ensureSocket() {
    if (this.socket?.connected) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    const socket = this.socket ?? io(this.serverUrl, {
      autoConnect: false,
      withCredentials: false,
    });

    if (!this.socket) {
      this.socket = socket;
      this.bindSocketEvents(socket);
    }

    this.connectPromise = new Promise<void>((resolve, reject) => {
      const handleConnect = () => {
        cleanup();
        this.connectPromise = null;
        resolve();
      };

      const handleError = (error: Error) => {
        cleanup();
        this.connectPromise = null;
        reject(error);
      };

      const cleanup = () => {
        socket.off('connect', handleConnect);
        socket.off('connect_error', handleError);
      };

      socket.on('connect', handleConnect);
      socket.on('connect_error', handleError);
      socket.connect();
    });

    return this.connectPromise;
  }

  private bindSocketEvents(socket: Socket<ServerToClientEvents, ClientToServerEvents>) {
    socket.on('session:ready', payload => {
      this.identity = persistIdentity(payload.player);
      this.sessionReady = true;
      this.emitSnapshot();

      if (this.pendingRequest?.kind === 'session:set-name') {
        this.resolvePending(payload.player);
      }
    });

    socket.on('lobby:rooms', payload => {
      this.rooms = payload.rooms;
      this.pruneRoomStates();
      this.pruneMatchStates();
      this.emitSnapshot();

      if (this.pendingRequest?.kind === 'lobby:list-rooms') {
        this.resolvePending(payload.rooms);
        return;
      }

      if (this.pendingRequest?.kind === 'room:leave' && this.pendingRequest.roomId) {
        this.roomStates.delete(this.pendingRequest.roomId);
        this.matchStates.delete(this.pendingRequest.roomId);
        this.emitSnapshot();
        this.resolvePending(undefined);
      }
    });

    socket.on('room:state', payload => {
      this.roomStates.set(payload.room.id, payload.room);
      this.emitSnapshot();

      if (this.pendingRequest?.kind === 'room:create' || this.pendingRequest?.kind === 'room:join') {
        this.resolvePending(payload.room);
        return;
      }

      if (this.pendingRequest?.kind === 'room:set-ready' && this.pendingRequest.roomId === payload.room.id) {
        this.resolvePending(payload.room);
      }
    });

    socket.on('match:state', payload => {
      this.matchStates.set(payload.match.roomId, payload.match);
      this.emitSnapshot();

      if (
        (this.pendingRequest?.kind === 'room:start-match' || this.pendingRequest?.kind === 'match:command')
        && this.pendingRequest.roomId === payload.match.roomId
      ) {
        this.resolvePending(payload.match);
      }
    });

    socket.on('room:not-found', payload => {
      if (
        this.pendingRequest?.kind === 'room:join'
        && normalizeCode(this.pendingRequest.roomIdOrCode ?? '') === normalizeCode(payload.roomIdOrCode)
      ) {
        this.resolvePending(null);
      }
    });

    socket.on('room:error', payload => {
      if (this.pendingRequest) {
        this.rejectPending(new Error(payload.message));
        return;
      }

      console.error('[multiplayer] room:error', payload.message);
    });

    socket.on('match:error', payload => {
      if (this.pendingRequest?.kind === 'room:start-match' || this.pendingRequest?.kind === 'match:command') {
        this.rejectPending(new Error(payload.message));
        return;
      }

      console.error('[multiplayer] match:error', payload.message);
    });

    socket.on('disconnect', () => {
      this.sessionReady = false;
      this.rejectPending(new Error('Disconnected from the multiplayer server.'));
    });
  }

  private pruneRoomStates() {
    const knownRoomIds = new Set(this.rooms.map(room => room.id));
    Array.from(this.roomStates.keys()).forEach(roomId => {
      if (!knownRoomIds.has(roomId)) {
        this.roomStates.delete(roomId);
      }
    });
  }

  private pruneMatchStates() {
    const activeRoomIds = new Set(this.rooms.filter(room => room.activeMatchId).map(room => room.id));
    Array.from(this.matchStates.keys()).forEach(roomId => {
      if (!activeRoomIds.has(roomId)) {
        this.matchStates.delete(roomId);
      }
    });
  }

  private beginRequest<TValue>(
    request: Pick<PendingRequest<TValue>, 'kind' | 'roomId' | 'roomIdOrCode'>,
    invoke: () => void,
  ): Promise<TValue> {
    if (this.pendingRequest) {
      return Promise.reject(new Error('Another multiplayer action is already in progress.'));
    }

    return new Promise<TValue>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        if (this.pendingRequest?.timeoutId === timeoutId) {
          this.pendingRequest = null;
        }
        reject(new Error('The multiplayer server did not respond in time.'));
      }, 8000);

      this.pendingRequest = {
        ...request,
        resolve,
        reject,
        timeoutId,
      };

      invoke();
    });
  }

  private resolvePending(value: unknown) {
    if (!this.pendingRequest) return;

    const { resolve, timeoutId } = this.pendingRequest;
    window.clearTimeout(timeoutId);
    this.pendingRequest = null;
    resolve(value);
  }

  private rejectPending(error: Error) {
    if (!this.pendingRequest) return;

    const { reject, timeoutId } = this.pendingRequest;
    window.clearTimeout(timeoutId);
    this.pendingRequest = null;
    reject(error);
  }
}
