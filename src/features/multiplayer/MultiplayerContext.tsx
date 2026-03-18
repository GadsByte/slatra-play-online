import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createConfiguredMultiplayerClient, type MultiplayerClient } from './client';
import { LobbyRoomSummary, PlayerIdentity, RoomDetails, RoomVisibility } from './types';

interface MultiplayerContextValue {
  identity: PlayerIdentity | null;
  rooms: LobbyRoomSummary[];
  loading: boolean;
  ready: boolean;
  saveDisplayName: (displayName: string) => Promise<PlayerIdentity>;
  createRoom: (name: string, visibility: RoomVisibility) => Promise<RoomDetails>;
  joinRoom: (roomIdOrCode: string) => Promise<RoomDetails | null>;
  leaveRoom: (roomId: string) => Promise<void>;
  findRoomByIdOrCode: (roomIdOrCode: string) => RoomDetails | null;
  setReadyState: (roomId: string, nextReady: boolean) => Promise<RoomDetails | null>;
  refreshRooms: () => Promise<void>;
}

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

function normalizeLookup(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

export function MultiplayerProvider({ children }: { children: ReactNode }) {
  const [client] = useState<MultiplayerClient>(() => createConfiguredMultiplayerClient());
  const [identity, setIdentity] = useState<PlayerIdentity | null>(null);
  const [rooms, setRooms] = useState<LobbyRoomSummary[]>([]);
  const [roomStates, setRoomStates] = useState<RoomDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const applySnapshot = useCallback((snapshot: {
    identity: PlayerIdentity | null;
    rooms: LobbyRoomSummary[];
    roomStates: RoomDetails[];
  }) => {
    setIdentity(snapshot.identity);
    setRooms(snapshot.rooms);
    setRoomStates(snapshot.roomStates);
  }, []);

  const refreshRooms = useCallback(async () => {
    await client.listRooms();
  }, [client]);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = client.subscribe(snapshot => {
      if (cancelled) return;
      applySnapshot(snapshot);
    });

    const load = async () => {
      setLoading(true);

      try {
        const snapshot = await client.loadSnapshot();
        if (!cancelled) {
          applySnapshot(snapshot);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [applySnapshot, client]);

  const roomLookup = useMemo(() => {
    const index = new Map<string, RoomDetails>();

    roomStates.forEach(room => {
      index.set(room.id, room);
      index.set(room.code, room);
      index.set(normalizeLookup(room.id), room);
      index.set(normalizeCode(room.code), room);
    });

    return index;
  }, [roomStates]);

  const saveDisplayName = useCallback(async (displayName: string) => {
    return client.saveDisplayName(displayName);
  }, [client]);

  const createRoom = useCallback(async (name: string, visibility: RoomVisibility) => {
    return client.createRoom({ name, visibility });
  }, [client]);

  const joinRoom = useCallback(async (roomIdOrCode: string) => {
    return client.joinRoom({ roomIdOrCode });
  }, [client]);

  const leaveRoom = useCallback(async (roomId: string) => {
    await client.leaveRoom(roomId);
  }, [client]);

  const findRoomByIdOrCode = useCallback((roomIdOrCode: string) => {
    return roomLookup.get(normalizeLookup(roomIdOrCode))
      ?? roomLookup.get(normalizeCode(roomIdOrCode))
      ?? roomLookup.get(roomIdOrCode)
      ?? null;
  }, [roomLookup]);

  const setReadyState = useCallback(async (roomId: string, nextReady: boolean) => {
    return client.setReady(roomId, nextReady);
  }, [client]);

  const value = useMemo<MultiplayerContextValue>(() => ({
    identity,
    rooms,
    loading,
    ready: !loading,
    saveDisplayName,
    createRoom,
    joinRoom,
    leaveRoom,
    findRoomByIdOrCode,
    setReadyState,
    refreshRooms,
  }), [
    identity,
    rooms,
    loading,
    saveDisplayName,
    createRoom,
    joinRoom,
    leaveRoom,
    findRoomByIdOrCode,
    setReadyState,
    refreshRooms,
  ]);

  return <MultiplayerContext.Provider value={value}>{children}</MultiplayerContext.Provider>;
}

export function useMultiplayer() {
  const context = useContext(MultiplayerContext);
  if (!context) {
    throw new Error('useMultiplayer must be used within a MultiplayerProvider');
  }
  return context;
}
