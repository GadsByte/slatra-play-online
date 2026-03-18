import { applyCommand, createInitialState, createMathRandom, type GameCommand } from '../../../packages/engine/src/slatra';
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
import {
  loadStoredMatches,
  loadStoredRooms,
  saveStoredMatches,
  saveStoredRooms,
} from './storage';
import type { MultiplayerClient } from './client';
import {
  createId,
  createIdentity,
  createPlayer,
  createSnapshot,
  getStoredIdentity,
  normalizeCode,
  normalizeRoomLookup,
  persistIdentity,
  type MultiplayerSnapshotListener,
} from './clientShared';

function seedRooms(): RoomDetailsDto[] {
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

function seedMatches(): MatchSnapshotDto[] {
  return [
    {
      id: 'match-bone-throne',
      roomId: 'room-bone-throne',
      status: 'active',
      seats: [
        { seat: 'plague', playerId: 'npc-skullcrusher' },
        { seat: 'bone', playerId: 'npc-rattlemaw' },
      ],
      gameState: createInitialState(),
      createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    },
  ];
}

function ensureRooms(): RoomDetailsDto[] {
  const stored = loadStoredRooms();
  if (stored.length > 0) return stored;

  const seeded = seedRooms();
  saveStoredRooms(seeded);
  return seeded;
}

function ensureMatches(): MatchSnapshotDto[] {
  const stored = loadStoredMatches();
  if (stored.length > 0) return stored;

  const seeded = seedMatches();
  saveStoredMatches(seeded);
  return seeded;
}

function persistRooms(rooms: RoomDetailsDto[]) {
  saveStoredRooms(rooms);
  return rooms;
}

function persistMatches(matches: MatchSnapshotDto[]) {
  saveStoredMatches(matches);
  return matches;
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

  async saveDisplayName(displayName: string): Promise<PlayerIdentityDto> {
    const trimmed = displayName.trim();
    const existing = getStoredIdentity();
    const identity = persistIdentity(createIdentity(trimmed, existing));

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

  async listRooms(): Promise<LobbyRoomSummaryDto[]> {
    const snapshot = this.getSnapshot();
    this.emitSnapshot();
    return snapshot.rooms;
  }

  async getRoom(roomIdOrCode: string): Promise<RoomDetailsDto | null> {
    const lookup = normalizeRoomLookup(roomIdOrCode);
    const code = normalizeCode(roomIdOrCode);

    return ensureRooms().find(room => room.id === lookup || room.code === code) ?? null;
  }

  async getMatch(roomId: string): Promise<MatchSnapshotDto | null> {
    return ensureMatches().find(match => match.roomId === roomId) ?? null;
  }

  async createRoom(input: CreateRoomInput): Promise<RoomDetailsDto> {
    const identity = getStoredIdentity();
    if (!identity) {
      throw new Error('A display name is required before creating a room.');
    }

    const room: RoomDetailsDto = {
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

  async joinRoom(input: JoinRoomInput): Promise<RoomDetailsDto | null> {
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

    const nextRoom: RoomDetailsDto = alreadyInRoom
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

  async setReady(roomId: string, ready: boolean): Promise<RoomDetailsDto | null> {
    const identity = getStoredIdentity();
    if (!identity) return null;

    const rooms = ensureRooms();
    const roomIndex = rooms.findIndex(room => room.id === roomId);
    if (roomIndex < 0) return null;

    const room = rooms[roomIndex];
    if (!room.players.some(player => player.id === identity.id)) return room;

    const nextRoom: RoomDetailsDto = {
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

  async startMatch(roomId: string): Promise<MatchSnapshotDto | null> {
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

    const match: MatchSnapshotDto = {
      id: createId('match'),
      roomId,
      status: 'active',
      seats: [
        { seat: 'plague', playerId: room.hostPlayerId },
        { seat: 'bone', playerId: room.players.find(player => player.id !== room.hostPlayerId)?.id ?? room.hostPlayerId },
      ],
      gameState: createInitialState(),
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

  async sendMatchCommand(roomId: string, command: MatchCommandDto): Promise<MatchSnapshotDto | null> {
    const identity = getStoredIdentity();
    if (!identity) {
      throw new Error('A display name is required before playing a match.');
    }

    const match = ensureMatches().find(existingMatch => existingMatch.roomId === roomId);
    if (!match) {
      return null;
    }

    const nextState = applyCommand(match.gameState, command as GameCommand, createMathRandom());
    if (nextState === match.gameState) {
      throw new Error('That command is not valid for the current game state.');
    }

    const nextMatches = ensureMatches().map(existingMatch =>
      existingMatch.roomId === roomId
        ? {
            ...existingMatch,
            gameState: nextState,
          }
        : existingMatch,
    );

    persistMatches(nextMatches);
    this.emitSnapshot();
    return nextMatches.find(existingMatch => existingMatch.roomId === roomId) ?? null;
  }

  private getSnapshot() {
    return createSnapshot(getStoredIdentity(), ensureRooms(), ensureMatches());
  }

  private emitSnapshot() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(listener => listener(snapshot));
  }
}
