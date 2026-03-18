import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@slatra/shared';
import { createInitialMatchGameState } from '@slatra/shared';
import { io, type Socket } from 'socket.io-client';
import {
  CreateRoomInput,
  JoinRoomInput,
  LobbyRoomSummary,
  MatchSnapshot,
  MultiplayerSnapshot,
  PlayerIdentity,
  RoomDetails,
  RoomPlayer,
} from './types';
import {
  loadStoredIdentity,
  loadStoredMatches,
  loadStoredRooms,
  saveStoredIdentity,
  saveStoredMatches,
  saveStoredRooms,
} from './storage';

export type MultiplayerSnapshotListener = (snapshot: MultiplayerSnapshot) => void;
export type MultiplayerTransport = 'local' | 'socket';

export interface MultiplayerClient {
  loadSnapshot(): Promise<MultiplayerSnapshot>;
  subscribe(listener: MultiplayerSnapshotListener): () => void;
  saveDisplayName(displayName: string): Promise<PlayerIdentity>;
  listRooms(): Promise<LobbyRoomSummary[]>;
  getRoom(roomIdOrCode: string): Promise<RoomDetails | null>;
  getMatch(roomId: string): Promise<MatchSnapshot | null>;
  createRoom(input: CreateRoomInput): Promise<RoomDetails>;
  joinRoom(input: JoinRoomInput): Promise<RoomDetails | null>;
  leaveRoom(roomId: string): Promise<void>;
  setReady(roomId: string, ready: boolean): Promise<RoomDetails | null>;
  startMatch(roomId: string): Promise<MatchSnapshot | null>;
}

interface PendingRequest<TValue = unknown> {
  kind:
    | 'session:set-name'
    | 'lobby:list-rooms'
    | 'room:create'
    | 'room:join'
    | 'room:leave'
    | 'room:set-ready'
    | 'room:start-match';
  resolve: (value: TValue) => void;
  reject: (reason?: unknown) => void;
  timeoutId: ReturnType<typeof window.setTimeout>;
  roomId?: string;
  roomIdOrCode?: string;
}

interface MultiplayerClientConfig {
  transport: MultiplayerTransport;
  serverUrl?: string;
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function normalizeRoomLookup(value: string) {
  return value.trim().toLowerCase();
}

function getStoredIdentity(): PlayerIdentity | null {
  return loadStoredIdentity();
}

function createPlayer(identity: PlayerIdentity): RoomPlayer {
  return {
    id: identity.id,
    displayName: identity.displayName,
    ready: false,
  };
}

function seedRooms(): RoomDetails[] {
  return [
    {
      id: 'room-blood-pit',
      name: 'The Blood Pit',
      code: 'BLOOD1',
      hostPlayerId: 'npc-wulfgrim',
      maxPlayers: 2,
      status: 'waiting',
      visibility: 'public',
      activeMatchId: null,
      players: [
        { id: 'npc-wulfgrim', displayName: 'Wulfgrim', ready: false },
      ],
    },
    {
      id: 'room-bone-throne',
      name: 'Bone Throne Arena',
      code: 'BONES2',
      hostPlayerId: 'npc-skullcrusher',
      maxPlayers: 2,
      status: 'in_game',
      visibility: 'public',
      activeMatchId: 'match-bone-throne',
      players: [
        { id: 'npc-skullcrusher', displayName: 'Skullcrusher', ready: true },
        { id: 'npc-rattlemaw', displayName: 'Rattlemaw', ready: true },
      ],
    },
    {
      id: 'room-plague-grounds',
      name: 'Plague Grounds',
      code: 'PLAGUE',
      hostPlayerId: 'npc-rotface',
      maxPlayers: 2,
      status: 'waiting',
      visibility: 'private',
      activeMatchId: null,
      players: [
        { id: 'npc-rotface', displayName: 'Rotface', ready: false },
      ],
    },
  ];
}

function seedMatches(): MatchSnapshot[] {
  return [
    {
      id: 'match-bone-throne',
      roomId: 'room-bone-throne',
      status: 'active',
      gameState: createInitialMatchGameState(),
      createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    },
  ];
}

function ensureRooms(): RoomDetails[] {
  const stored = loadStoredRooms();
  if (stored.length > 0) return stored;

  const seeded = seedRooms();
  saveStoredRooms(seeded);
  return seeded;
}

function ensureMatches(): MatchSnapshot[] {
  const stored = loadStoredMatches();
  if (stored.length > 0) return stored;

  const seeded = seedMatches();
  saveStoredMatches(seeded);
  return seeded;
}

function toLobbySummary(room: RoomDetails): LobbyRoomSummary {
  const host = room.players.find(player => player.id === room.hostPlayerId);

  return {
    id: room.id,
    name: room.name,
    code: room.code,
    hostPlayerId: room.hostPlayerId,
    hostDisplayName: host?.displayName ?? 'Unknown Host',
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    status: room.status,
    visibility: room.visibility,
    activeMatchId: room.activeMatchId,
  };
}

function persistRooms(rooms: RoomDetails[]) {
  saveStoredRooms(rooms);
  return rooms;
}

function persistMatches(matches: MatchSnapshot[]) {
  saveStoredMatches(matches);
  return matches;
}

function createSnapshot(identity: PlayerIdentity | null, roomStates: RoomDetails[], matchStates: MatchSnapshot[]): MultiplayerSnapshot {
  return {
    identity,
    rooms: roomStates.map(toLobbySummary),
    roomStates,
    matchStates,
  };
}

function readMultiplayerConfig(): MultiplayerClientConfig {
  const requestedTransport = import.meta.env.VITE_MULTIPLAYER_TRANSPORT?.trim().toLowerCase();
  const transport: MultiplayerTransport = requestedTransport === 'socket' ? 'socket' : 'local';
  const serverUrl = import.meta.env.VITE_MULTIPLAYER_SERVER_URL?.trim() || 'http://localhost:3001';

  return { transport, serverUrl };
}

export class LocalMultiplayerClient implements MultiplayerClient {
  private listeners = new Set<MultiplayerSnapshotListener>();

  subscribe(listener: MultiplayerSnapshotListener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());

    return () => {
      this.listeners.delete(listener);
    };
  }

  async loadSnapshot(): Promise<MultiplayerSnapshot> {
    return this.getSnapshot();
  }

  async saveDisplayName(displayName: string): Promise<PlayerIdentity> {
    const trimmed = displayName.trim();
    const existing = getStoredIdentity();

    const identity: PlayerIdentity = {
      id: existing?.id ?? createId('player'),
      displayName: trimmed,
    };

    saveStoredIdentity(identity);

    const updatedRooms = ensureRooms().map(room => ({
      ...room,
      players: room.players.map(player =>
        player.id === identity.id ? { ...player, displayName: identity.displayName } : player,
      ),
    }));

    persistRooms(updatedRooms);
    this.emitSnapshot();
    return identity;
  }

  async listRooms(): Promise<LobbyRoomSummary[]> {
    const snapshot = this.getSnapshot();
    this.emitSnapshot();
    return snapshot.rooms;
  }

  async getRoom(roomIdOrCode: string): Promise<RoomDetails | null> {
    const lookup = normalizeRoomLookup(roomIdOrCode);
    const code = normalizeCode(roomIdOrCode);

    return ensureRooms().find(room => room.id === lookup || room.code === code) ?? null;
  }

  async getMatch(roomId: string): Promise<MatchSnapshot | null> {
    return ensureMatches().find(match => match.roomId === roomId) ?? null;
  }

  async createRoom(input: CreateRoomInput): Promise<RoomDetails> {
    const identity = getStoredIdentity();
    if (!identity) {
      throw new Error('A display name is required before creating a room.');
    }

    const room: RoomDetails = {
      id: createId('room'),
      name: input.name.trim(),
      code: createId('code').replace('code-', '').slice(0, 6).toUpperCase(),
      hostPlayerId: identity.id,
      maxPlayers: 2,
      status: 'waiting',
      visibility: input.visibility,
      activeMatchId: null,
      players: [createPlayer(identity)],
    };

    persistRooms([...ensureRooms(), room]);
    this.emitSnapshot();
    return room;
  }

  async joinRoom(input: JoinRoomInput): Promise<RoomDetails | null> {
    const identity = getStoredIdentity();
    if (!identity) {
      throw new Error('A display name is required before joining a room.');
    }

    const lookup = normalizeRoomLookup(input.roomIdOrCode);
    const code = normalizeCode(input.roomIdOrCode);
    const rooms = ensureRooms();
    const roomIndex = rooms.findIndex(room => room.id === lookup || room.code === code);
    if (roomIndex < 0) return null;

    const room = rooms[roomIndex];
    const alreadyInRoom = room.players.some(player => player.id === identity.id);
    if (!alreadyInRoom && (room.players.length >= room.maxPlayers || room.status === 'in_game')) {
      return room;
    }

    const nextRoom: RoomDetails = alreadyInRoom
      ? {
          ...room,
          players: room.players.map(player =>
            player.id === identity.id ? { ...player, displayName: identity.displayName } : player,
          ),
        }
      : {
          ...room,
          players: [...room.players, createPlayer(identity)],
        };

    const nextRooms = [...rooms];
    nextRooms[roomIndex] = nextRoom;
    persistRooms(nextRooms);
    this.emitSnapshot();
    return nextRoom;
  }

  async leaveRoom(roomId: string): Promise<void> {
    const identity = getStoredIdentity();
    if (!identity) return;

    const rooms = ensureRooms();
    const room = rooms.find(existingRoom => existingRoom.id === roomId);
    if (!room) return;

    const remainingPlayers = room.players.filter(player => player.id !== identity.id);
    const nextRooms = remainingPlayers.length === 0
      ? rooms.filter(existingRoom => existingRoom.id !== roomId)
      : rooms.map(existingRoom => {
          if (existingRoom.id !== roomId) return existingRoom;

          const nextHostId = existingRoom.hostPlayerId === identity.id
            ? remainingPlayers[0]?.id ?? existingRoom.hostPlayerId
            : existingRoom.hostPlayerId;
          const matchEnded = !!existingRoom.activeMatchId;

          return {
            ...existingRoom,
            hostPlayerId: nextHostId,
            status: matchEnded ? 'waiting' : existingRoom.status,
            activeMatchId: matchEnded ? null : existingRoom.activeMatchId,
            players: remainingPlayers.map(player => (matchEnded ? { ...player, ready: false } : player)),
          };
        });

    persistRooms(nextRooms);
    persistMatches(ensureMatches().filter(match => match.roomId !== roomId));
    this.emitSnapshot();
  }

  async setReady(roomId: string, ready: boolean): Promise<RoomDetails | null> {
    const identity = getStoredIdentity();
    if (!identity) return null;

    const rooms = ensureRooms();
    const roomIndex = rooms.findIndex(room => room.id === roomId);
    if (roomIndex < 0) return null;

    const room = rooms[roomIndex];
    if (!room.players.some(player => player.id === identity.id)) return room;

    const nextRoom: RoomDetails = {
      ...room,
      players: room.players.map(player =>
        player.id === identity.id
          ? { ...player, ready, displayName: identity.displayName }
          : player,
      ),
    };

    const nextRooms = [...rooms];
    nextRooms[roomIndex] = nextRoom;
    persistRooms(nextRooms);
    this.emitSnapshot();
    return nextRoom;
  }

  async startMatch(roomId: string): Promise<MatchSnapshot | null> {
    const identity = getStoredIdentity();
    if (!identity) {
      throw new Error('A display name is required before starting a match.');
    }

    const rooms = ensureRooms();
    const roomIndex = rooms.findIndex(room => room.id === roomId);
    if (roomIndex < 0) return null;

    const room = rooms[roomIndex];
    const currentPlayer = room.players.find(player => player.id === identity.id);
    if (!currentPlayer) {
      throw new Error('You are not in that room.');
    }
    if (room.hostPlayerId !== identity.id) {
      throw new Error('Only the host can start the match.');
    }
    if (room.players.length !== room.maxPlayers) {
      throw new Error('Both players must be present before starting the match.');
    }
    if (!room.players.every(player => player.ready)) {
      throw new Error('Both players must be ready before starting the match.');
    }

    const existingMatch = ensureMatches().find(match => match.roomId === roomId);
    if (existingMatch) {
      return existingMatch;
    }

    const match: MatchSnapshot = {
      id: createId('match'),
      roomId,
      status: 'active',
      gameState: createInitialMatchGameState(),
      createdAt: new Date().toISOString(),
    };

    const nextRooms = [...rooms];
    nextRooms[roomIndex] = {
      ...room,
      status: 'in_game',
      activeMatchId: match.id,
    };

    persistRooms(nextRooms);
    persistMatches([...ensureMatches(), match]);
    this.emitSnapshot();
    return match;
  }

  private getSnapshot() {
    return createSnapshot(getStoredIdentity(), ensureRooms(), ensureMatches());
  }

  private emitSnapshot() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(listener => listener(snapshot));
  }
}

export class SocketMultiplayerClient implements MultiplayerClient {
  private listeners = new Set<MultiplayerSnapshotListener>();

  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

  private connectPromise: Promise<void> | null = null;

  private pendingRequest: PendingRequest | null = null;

  private identity: PlayerIdentity | null = getStoredIdentity();

  private sessionReady = false;

  private rooms: LobbyRoomSummary[] = [];

  private roomStates = new Map<string, RoomDetails>();

  private matchStates = new Map<string, MatchSnapshot>();

  constructor(private readonly serverUrl = 'http://localhost:3001') {}

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

  async saveDisplayName(displayName: string): Promise<PlayerIdentity> {
    const trimmed = displayName.trim();
    if (!trimmed) {
      throw new Error('Display name is required.');
    }

    await this.ensureSocket();

    return this.beginRequest<PlayerIdentity>({ kind: 'session:set-name' }, () => {
      this.socket!.emit('session:set-name', { displayName: trimmed });
    });
  }

  async listRooms(): Promise<LobbyRoomSummary[]> {
    await this.ensureSocket();

    return this.beginRequest<LobbyRoomSummary[]>({ kind: 'lobby:list-rooms' }, () => {
      this.socket!.emit('lobby:list-rooms');
    });
  }

  async getRoom(roomIdOrCode: string): Promise<RoomDetails | null> {
    const lookup = normalizeRoomLookup(roomIdOrCode);
    const code = normalizeCode(roomIdOrCode);

    return Array.from(this.roomStates.values()).find(room => room.id === lookup || room.code === code) ?? null;
  }

  async getMatch(roomId: string): Promise<MatchSnapshot | null> {
    return this.matchStates.get(roomId) ?? null;
  }

  async createRoom(input: CreateRoomInput): Promise<RoomDetails> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error('Room name is required.');
    }

    await this.ensureSocket();

    return this.beginRequest<RoomDetails>({ kind: 'room:create' }, () => {
      this.socket!.emit('room:create', { ...input, name: trimmedName });
    });
  }

  async joinRoom(input: JoinRoomInput): Promise<RoomDetails | null> {
    const roomIdOrCode = input.roomIdOrCode.trim();
    if (!roomIdOrCode) {
      throw new Error('A room code or room id is required.');
    }

    await this.ensureSocket();

    return this.beginRequest<RoomDetails | null>({ kind: 'room:join', roomIdOrCode }, () => {
      this.socket!.emit('room:join', { roomIdOrCode });
    });
  }

  async leaveRoom(roomId: string): Promise<void> {
    await this.ensureSocket();

    return this.beginRequest<void>({ kind: 'room:leave', roomId }, () => {
      this.socket!.emit('room:leave', { roomId });
    });
  }

  async setReady(roomId: string, ready: boolean): Promise<RoomDetails | null> {
    await this.ensureSocket();

    return this.beginRequest<RoomDetails | null>({ kind: 'room:set-ready', roomId }, () => {
      this.socket!.emit('room:set-ready', { roomId, ready });
    });
  }

  async startMatch(roomId: string): Promise<MatchSnapshot | null> {
    await this.ensureSocket();

    return this.beginRequest<MatchSnapshot | null>({ kind: 'room:start-match', roomId }, () => {
      this.socket!.emit('room:start-match', { roomId });
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
      this.identity = payload.player;
      this.sessionReady = true;
      saveStoredIdentity(payload.player);
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

      if (this.pendingRequest?.kind === 'room:start-match' && this.pendingRequest.roomId === payload.match.roomId) {
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
      if (this.pendingRequest?.kind === 'room:start-match') {
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

export function createConfiguredMultiplayerClient(config = readMultiplayerConfig()): MultiplayerClient {
  if (config.transport === 'socket') {
    return new SocketMultiplayerClient(config.serverUrl);
  }

  return new LocalMultiplayerClient();
}
