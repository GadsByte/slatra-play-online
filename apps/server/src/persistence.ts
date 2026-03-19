import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { MatchSnapshotDto, RoomId, RoomPlayerDto, RoomStatus, RoomVisibility } from '@slatra/shared';

export interface PersistedPlayerSessionRecord {
  id: string;
  sessionToken: string;
  displayName: string;
  roomId: string | null;
}

export interface PersistedRoomRecord {
  id: string;
  name: string;
  code: string;
  hostPlayerId: string;
  maxPlayers: number;
  status: RoomStatus;
  visibility: RoomVisibility;
  activeMatchId: string | null;
  players: RoomPlayerDto[];
}

export interface PersistedRngStateRecord {
  seed: number;
  state: number;
}

export interface PersistedMatchSnapshotRecord extends MatchSnapshotDto {
  rngState: PersistedRngStateRecord;
}

export interface PlayerSessionRepository {
  list(): PersistedPlayerSessionRecord[];
  save(session: PersistedPlayerSessionRecord): void;
  delete(sessionToken: string): void;
}

export interface RoomRepository {
  list(): PersistedRoomRecord[];
  save(room: PersistedRoomRecord): void;
  delete(roomId: RoomId): void;
}

export interface MatchSnapshotRepository {
  list(): PersistedMatchSnapshotRecord[];
  save(match: PersistedMatchSnapshotRecord): void;
  delete(roomId: RoomId): void;
}

interface PersistedServerState {
  version: 1;
  players: PersistedPlayerSessionRecord[];
  rooms: PersistedRoomRecord[];
  matches: PersistedMatchSnapshotRecord[];
}

function createEmptyState(): PersistedServerState {
  return {
    version: 1,
    players: [],
    rooms: [],
    matches: [],
  };
}

export class JsonFileServerStateStore {
  constructor(private readonly filePath: string) {}

  read(): PersistedServerState {
    if (!existsSync(this.filePath)) {
      return createEmptyState();
    }

    const raw = readFileSync(this.filePath, 'utf8').trim();
    if (!raw) {
      return createEmptyState();
    }

    const parsed = JSON.parse(raw) as Partial<PersistedServerState>;
    return {
      version: 1,
      players: parsed.players ?? [],
      rooms: parsed.rooms ?? [],
      matches: parsed.matches ?? [],
    };
  }

  write(state: PersistedServerState) {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tempFilePath = `${this.filePath}.tmp`;
    writeFileSync(tempFilePath, JSON.stringify(state, null, 2), 'utf8');
    renameSync(tempFilePath, this.filePath);
  }

  update(mutator: (state: PersistedServerState) => void) {
    const nextState = this.read();
    mutator(nextState);
    this.write(nextState);
  }
}

export class InMemoryPlayerSessionRepository implements PlayerSessionRepository {
  private readonly sessions = new Map<string, PersistedPlayerSessionRecord>();

  list(): PersistedPlayerSessionRecord[] {
    return Array.from(this.sessions.values()).map(session => ({ ...session }));
  }

  save(session: PersistedPlayerSessionRecord) {
    this.sessions.set(session.sessionToken, { ...session });
  }

  delete(sessionToken: string) {
    this.sessions.delete(sessionToken);
  }
}

export class InMemoryRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, PersistedRoomRecord>();

  list(): PersistedRoomRecord[] {
    return Array.from(this.rooms.values()).map(room => ({
      ...room,
      players: room.players.map(player => ({ ...player })),
    }));
  }

  save(room: PersistedRoomRecord) {
    this.rooms.set(room.id, {
      ...room,
      players: room.players.map(player => ({ ...player })),
    });
  }

  delete(roomId: RoomId) {
    this.rooms.delete(roomId);
  }
}

export class InMemoryMatchSnapshotRepository implements MatchSnapshotRepository {
  private readonly matches = new Map<string, PersistedMatchSnapshotRecord>();

  list(): PersistedMatchSnapshotRecord[] {
    return Array.from(this.matches.values()).map(match => ({
      ...match,
      seats: match.seats.map(seat => ({ ...seat })),
      gameState: structuredClone(match.gameState),
      rngState: { ...match.rngState },
    }));
  }

  save(match: PersistedMatchSnapshotRecord) {
    this.matches.set(match.roomId, {
      ...match,
      seats: match.seats.map(seat => ({ ...seat })),
      gameState: structuredClone(match.gameState),
      rngState: { ...match.rngState },
    });
  }

  delete(roomId: RoomId) {
    this.matches.delete(roomId);
  }
}

export class FilePlayerSessionRepository implements PlayerSessionRepository {
  constructor(private readonly stateStore: JsonFileServerStateStore) {}

  list(): PersistedPlayerSessionRecord[] {
    return this.stateStore.read().players;
  }

  save(session: PersistedPlayerSessionRecord) {
    this.stateStore.update(state => {
      state.players = state.players.filter(existing => existing.sessionToken !== session.sessionToken);
      state.players.push({ ...session });
    });
  }

  delete(sessionToken: string) {
    this.stateStore.update(state => {
      state.players = state.players.filter(session => session.sessionToken !== sessionToken);
    });
  }
}

export class FileRoomRepository implements RoomRepository {
  constructor(private readonly stateStore: JsonFileServerStateStore) {}

  list(): PersistedRoomRecord[] {
    return this.stateStore.read().rooms;
  }

  save(room: PersistedRoomRecord) {
    this.stateStore.update(state => {
      state.rooms = state.rooms.filter(existing => existing.id !== room.id);
      state.rooms.push({
        ...room,
        players: room.players.map(player => ({ ...player })),
      });
    });
  }

  delete(roomId: RoomId) {
    this.stateStore.update(state => {
      state.rooms = state.rooms.filter(room => room.id !== roomId);
    });
  }
}

export class FileMatchSnapshotRepository implements MatchSnapshotRepository {
  constructor(private readonly stateStore: JsonFileServerStateStore) {}

  list(): PersistedMatchSnapshotRecord[] {
    return this.stateStore.read().matches;
  }

  save(match: PersistedMatchSnapshotRecord) {
    this.stateStore.update(state => {
      state.matches = state.matches.filter(existing => existing.roomId !== match.roomId);
      state.matches.push({
        ...match,
        seats: match.seats.map(seat => ({ ...seat })),
        gameState: structuredClone(match.gameState),
        rngState: { ...match.rngState },
      });
    });
  }

  delete(roomId: RoomId) {
    this.stateStore.update(state => {
      state.matches = state.matches.filter(match => match.roomId !== roomId);
    });
  }
}
