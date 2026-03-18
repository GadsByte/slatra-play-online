import { MatchSnapshotDto, PlayerIdentityDto, RoomDetailsDto } from './types';

const STORAGE_KEYS = {
  identity: 'slatra.multiplayer.identity',
  rooms: 'slatra.multiplayer.rooms',
  matches: 'slatra.multiplayer.matches',
  legacyDisplayName: 'slatraDisplayName',
} as const;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadStoredIdentity(): PlayerIdentityDto | null {
  if (!canUseStorage()) return null;

  const raw = window.localStorage.getItem(STORAGE_KEYS.identity);
  if (raw) {
    try {
      return JSON.parse(raw) as PlayerIdentityDto;
    } catch {
      window.localStorage.removeItem(STORAGE_KEYS.identity);
    }
  }

  const legacyDisplayName = window.localStorage.getItem(STORAGE_KEYS.legacyDisplayName)?.trim();
  if (!legacyDisplayName) return null;

  return {
    id: 'player-legacy',
    displayName: legacyDisplayName,
  };
}

export function saveStoredIdentity(identity: PlayerIdentityDto) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEYS.identity, JSON.stringify(identity));
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
