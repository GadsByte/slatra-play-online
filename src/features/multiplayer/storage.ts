import { MatchSnapshotDto, PlayerIdentityDto, RoomDetailsDto } from './types';

const STORAGE_KEYS = {
  identity: 'slatra.multiplayer.identity',
  sessionToken: 'slatra.multiplayer.session-token',
  rooms: 'slatra.multiplayer.rooms',
  matches: 'slatra.multiplayer.matches',
  legacyDisplayName: 'slatraDisplayName',
} as const;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function createSessionToken() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `session-${globalThis.crypto.randomUUID()}`;
  }

  return `session-${Math.random().toString(36).slice(2, 12)}`;
}

export function loadStoredSessionToken(): string | null {
  if (!canUseStorage()) return null;

  const storedToken = window.localStorage.getItem(STORAGE_KEYS.sessionToken)?.trim();
  return storedToken || null;
}

function persistSessionToken(sessionToken: string) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEYS.sessionToken, sessionToken);
}

export function loadStoredIdentity(): PlayerIdentityDto | null {
  if (!canUseStorage()) return null;

  const raw = window.localStorage.getItem(STORAGE_KEYS.identity);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<PlayerIdentityDto>;
      if (!parsed.id || !parsed.displayName) {
        window.localStorage.removeItem(STORAGE_KEYS.identity);
        return null;
      }

      const sessionToken = parsed.sessionToken?.trim() || loadStoredSessionToken() || createSessionToken();
      const identity: PlayerIdentityDto = {
        id: parsed.id,
        displayName: parsed.displayName,
        sessionToken,
      };

      if (identity.sessionToken !== parsed.sessionToken) {
        saveStoredIdentity(identity);
      } else {
        persistSessionToken(identity.sessionToken);
      }

      return identity;
    } catch {
      window.localStorage.removeItem(STORAGE_KEYS.identity);
    }
  }

  const legacyDisplayName = window.localStorage.getItem(STORAGE_KEYS.legacyDisplayName)?.trim();
  if (!legacyDisplayName) return null;

  const identity: PlayerIdentityDto = {
    id: 'player-legacy',
    sessionToken: loadStoredSessionToken() || createSessionToken(),
    displayName: legacyDisplayName,
  };

  saveStoredIdentity(identity);
  return identity;
}

export function saveStoredIdentity(identity: PlayerIdentityDto) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEYS.identity, JSON.stringify(identity));
  persistSessionToken(identity.sessionToken);
  window.localStorage.setItem(STORAGE_KEYS.legacyDisplayName, identity.displayName);
}

export function loadStoredRooms(): RoomDetailsDto[] {
  if (!canUseStorage()) return [];

  const raw = window.localStorage.getItem(STORAGE_KEYS.rooms);
  if (!raw) return [];

  try {
    const rooms = JSON.parse(raw) as RoomDetailsDto[];
    return Array.isArray(rooms) ? rooms : [];
  } catch {
    window.localStorage.removeItem(STORAGE_KEYS.rooms);
    return [];
  }
}

export function saveStoredRooms(rooms: RoomDetailsDto[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEYS.rooms, JSON.stringify(rooms));
}

export function loadStoredMatches(): MatchSnapshotDto[] {
  if (!canUseStorage()) return [];

  const raw = window.localStorage.getItem(STORAGE_KEYS.matches);
  if (!raw) return [];

  try {
    const matches = JSON.parse(raw) as MatchSnapshotDto[];
    return Array.isArray(matches) ? matches : [];
  } catch {
    window.localStorage.removeItem(STORAGE_KEYS.matches);
    return [];
  }
}

export function saveStoredMatches(matches: MatchSnapshotDto[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEYS.matches, JSON.stringify(matches));
}
