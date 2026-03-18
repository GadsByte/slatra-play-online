import { PlayerIdentity, RoomDetails } from './types';

const STORAGE_KEYS = {
  identity: 'slatra.multiplayer.identity',
  rooms: 'slatra.multiplayer.rooms',
  legacyDisplayName: 'slatraDisplayName',
} as const;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadStoredIdentity(): PlayerIdentity | null {
  if (!canUseStorage()) return null;

  const raw = window.localStorage.getItem(STORAGE_KEYS.identity);
  if (raw) {
    try {
      return JSON.parse(raw) as PlayerIdentity;
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

export function saveStoredIdentity(identity: PlayerIdentity) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEYS.identity, JSON.stringify(identity));
  window.localStorage.setItem(STORAGE_KEYS.legacyDisplayName, identity.displayName);
}

export function loadStoredRooms(): RoomDetails[] {
  if (!canUseStorage()) return [];

  const raw = window.localStorage.getItem(STORAGE_KEYS.rooms);
  if (!raw) return [];

  try {
    const rooms = JSON.parse(raw) as RoomDetails[];
    return Array.isArray(rooms) ? rooms : [];
  } catch {
    window.localStorage.removeItem(STORAGE_KEYS.rooms);
    return [];
  }
}

export function saveStoredRooms(rooms: RoomDetails[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEYS.rooms, JSON.stringify(rooms));
}
