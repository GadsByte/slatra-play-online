import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  createConfiguredMultiplayerClient,
  readMultiplayerConfig,
  type MultiplayerClient,
} from './client';
import {
  LobbyRoomSummaryDto,
  MatchCommandDto,
  MatchSnapshotDto,
  MultiplayerSnapshot,
  PlayerIdentityDto,
  RoomDetailsDto,
  RoomVisibility,
} from './types';

interface MultiplayerContextValue {
  identity: PlayerIdentityDto | null;
  rooms: LobbyRoomSummaryDto[];
  loading: boolean;
  ready: boolean;
  saveDisplayName: (displayName: string) => Promise<PlayerIdentityDto>;
  createRoom: (name: string, visibility: RoomVisibility) => Promise<RoomDetailsDto>;
  joinRoom: (roomIdOrCode: string) => Promise<RoomDetailsDto | null>;
  leaveRoom: (roomId: string) => Promise<void>;
  findRoomByIdOrCode: (roomIdOrCode: string) => RoomDetailsDto | null;
  findMatchByRoomId: (roomId: string) => MatchSnapshotDto | null;
  setReadyState: (roomId: string, nextReady: boolean) => Promise<RoomDetailsDto | null>;
  startMatch: (roomId: string) => Promise<MatchSnapshotDto | null>;
  sendMatchCommand: (roomId: string, command: MatchCommandDto) => Promise<MatchSnapshotDto | null>;
  refreshRooms: () => Promise<void>;
}

interface MultiplayerProviderProps {
  children: ReactNode;
  clientOverride?: MultiplayerClient;
}

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

function normalizeLookup(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

export function MultiplayerProvider({ children, clientOverride }: MultiplayerProviderProps) {
  const [client] = useState<MultiplayerClient>(() => {
    if (clientOverride) {
      return clientOverride;
    }

    const config = readMultiplayerConfig();
    return createConfiguredMultiplayerClient(config);
  });
  const [identity, setIdentity] = useState<PlayerIdentityDto | null>(null);
  const [rooms, setRooms] = useState<LobbyRoomSummaryDto[]>([]);
  const [roomStates, setRoomStates] = useState<RoomDetailsDto[]>([]);
  const [matchStates, setMatchStates] = useState<MatchSnapshotDto[]>([]);
  const [loading, setLoading] = useState(true);

  const applySnapshot = useCallback((snapshot: MultiplayerSnapshot) => {
    setIdentity(snapshot.identity);
    setRooms(snapshot.rooms);
    setRoomStates(snapshot.roomStates);
    setMatchStates(snapshot.matchStates);
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
    const index = new Map<string, RoomDetailsDto>();

    roomStates.forEach(room => {
      index.set(room.id, room);
      index.set(room.code, room);
      index.set(normalizeLookup(room.id), room);
      index.set(normalizeCode(room.code), room);
    });

    return index;
  }, [roomStates]);

  const matchLookup = useMemo(() => {
    return new Map(matchStates.map(match => [match.roomId, match]));
  }, [matchStates]);

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

  const findMatchByRoomId = useCallback((roomId: string) => {
    return matchLookup.get(roomId) ?? null;
  }, [matchLookup]);

  const setReadyState = useCallback(async (roomId: string, nextReady: boolean) => {
    return client.setReady(roomId, nextReady);
  }, [client]);

  const startMatch = useCallback(async (roomId: string) => {
    return client.startMatch(roomId);
  }, [client]);

  const sendMatchCommand = useCallback(async (roomId: string, command: MatchCommandDto) => {
    return client.sendMatchCommand(roomId, command);
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
    findMatchByRoomId,
    setReadyState,
    startMatch,
    sendMatchCommand,
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
    findMatchByRoomId,
    setReadyState,
    startMatch,
    sendMatchCommand,
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
