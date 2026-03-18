import {
  CreateRoomInput,
  JoinRoomInput,
  LobbyRoomSummary,
  MultiplayerSnapshot,
  PlayerIdentity,
  RoomDetails,
  RoomPlayer,
} from './types';
import { loadStoredIdentity, loadStoredRooms, saveStoredIdentity, saveStoredRooms } from './storage';

export interface MultiplayerClient {
  loadSnapshot(): Promise<MultiplayerSnapshot>;
  saveDisplayName(displayName: string): Promise<PlayerIdentity>;
  listRooms(): Promise<LobbyRoomSummary[]>;
  getRoom(roomIdOrCode: string): Promise<RoomDetails | null>;
  createRoom(input: CreateRoomInput): Promise<RoomDetails>;
  joinRoom(input: JoinRoomInput): Promise<RoomDetails | null>;
  leaveRoom(roomId: string): Promise<void>;
  setReady(roomId: string, ready: boolean): Promise<RoomDetails | null>;
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
    joinedAt: new Date().toISOString(),
  };
}

function seedRooms(): RoomDetails[] {
  const now = new Date().toISOString();

  return [
    {
      id: 'room-blood-pit',
      name: 'The Blood Pit',
      code: 'BLOOD1',
      hostPlayerId: 'npc-wulfgrim',
      maxPlayers: 2,
      status: 'waiting',
      visibility: 'public',
      players: [
        { id: 'npc-wulfgrim', displayName: 'Wulfgrim', ready: false, joinedAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'room-bone-throne',
      name: 'Bone Throne Arena',
      code: 'BONES2',
      hostPlayerId: 'npc-skullcrusher',
      maxPlayers: 2,
      status: 'in_game',
      visibility: 'public',
      players: [
        { id: 'npc-skullcrusher', displayName: 'Skullcrusher', ready: true, joinedAt: now },
        { id: 'npc-rattlemaw', displayName: 'Rattlemaw', ready: true, joinedAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'room-plague-grounds',
      name: 'Plague Grounds',
      code: 'PLAGUE',
      hostPlayerId: 'npc-rotface',
      maxPlayers: 2,
      status: 'waiting',
      visibility: 'private',
      players: [
        { id: 'npc-rotface', displayName: 'Rotface', ready: false, joinedAt: now },
      ],
      createdAt: now,
      updatedAt: now,
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
  };
}

function persistRooms(rooms: RoomDetails[]) {
  saveStoredRooms(rooms);
  return rooms;
}

export class LocalMultiplayerClient implements MultiplayerClient {
  async loadSnapshot(): Promise<MultiplayerSnapshot> {
    return {
      identity: getStoredIdentity(),
      rooms: ensureRooms(),
    };
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
      updatedAt: room.players.some(player => player.id === identity.id)
        ? new Date().toISOString()
        : room.updatedAt,
    }));

    persistRooms(updatedRooms);
    return identity;
  }

  async listRooms(): Promise<LobbyRoomSummary[]> {
    return ensureRooms().map(toLobbySummary);
  }

  async getRoom(roomIdOrCode: string): Promise<RoomDetails | null> {
    const lookup = normalizeRoomLookup(roomIdOrCode);
    const code = normalizeCode(roomIdOrCode);

    return ensureRooms().find(room => room.id === lookup || room.code === code) ?? null;
  }

  async createRoom(input: CreateRoomInput): Promise<RoomDetails> {
    const identity = getStoredIdentity();
    if (!identity) {
      throw new Error('A display name is required before creating a room.');
    }

    const now = new Date().toISOString();
    const room: RoomDetails = {
      id: createId('room'),
      name: input.name.trim(),
      code: createId('code').replace('code-', '').slice(0, 6).toUpperCase(),
      hostPlayerId: identity.id,
      maxPlayers: 2,
      status: 'waiting',
      visibility: input.visibility,
      players: [createPlayer(identity)],
      createdAt: now,
      updatedAt: now,
    };

    persistRooms([...ensureRooms(), room]);
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
          updatedAt: new Date().toISOString(),
        }
      : {
          ...room,
          players: [...room.players, createPlayer(identity)],
          updatedAt: new Date().toISOString(),
        };

    const nextRooms = [...rooms];
    nextRooms[roomIndex] = nextRoom;
    persistRooms(nextRooms);
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

          return {
            ...existingRoom,
            hostPlayerId: nextHostId,
            players: remainingPlayers,
            updatedAt: new Date().toISOString(),
          };
        });

    persistRooms(nextRooms);
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
      updatedAt: new Date().toISOString(),
    };

    const nextRooms = [...rooms];
    nextRooms[roomIndex] = nextRoom;
    persistRooms(nextRooms);
    return nextRoom;
  }
}

export const multiplayerClient: MultiplayerClient = new LocalMultiplayerClient();
