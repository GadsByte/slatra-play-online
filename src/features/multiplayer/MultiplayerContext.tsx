import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { multiplayerClient } from './client';
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
  getRoomByIdOrCode: (roomIdOrCode: string) => Promise<RoomDetails | null>;
  setReadyState: (roomId: string, nextReady: boolean) => Promise<RoomDetails | null>;
  refreshRooms: () => Promise<void>;
}

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

export function MultiplayerProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<PlayerIdentity | null>(null);
  const [rooms, setRooms] = useState<LobbyRoomSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshRooms = useCallback(async () => {
    const nextRooms = await multiplayerClient.listRooms();
    setRooms(nextRooms);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const snapshot = await multiplayerClient.loadSnapshot();
      const nextRooms = snapshot.rooms.map(room => ({
        id: room.id,
        name: room.name,
        code: room.code,
        hostPlayerId: room.hostPlayerId,
        hostDisplayName: room.players.find(player => player.id === room.hostPlayerId)?.displayName ?? 'Unknown Host',
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers,
        status: room.status,
        visibility: room.visibility,
      }));

      if (!cancelled) {
        setIdentity(snapshot.identity);
        setRooms(nextRooms);
        setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveDisplayName = useCallback(async (displayName: string) => {
    const nextIdentity = await multiplayerClient.saveDisplayName(displayName);
    setIdentity(nextIdentity);
    await refreshRooms();
    return nextIdentity;
  }, [refreshRooms]);

  const createRoom = useCallback(async (name: string, visibility: RoomVisibility) => {
    const room = await multiplayerClient.createRoom({ name, visibility });
    await refreshRooms();
    return room;
  }, [refreshRooms]);

  const joinRoom = useCallback(async (roomIdOrCode: string) => {
    const room = await multiplayerClient.joinRoom({ roomIdOrCode });
    await refreshRooms();
    return room;
  }, [refreshRooms]);

  const leaveRoom = useCallback(async (roomId: string) => {
    await multiplayerClient.leaveRoom(roomId);
    await refreshRooms();
  }, [refreshRooms]);

  const getRoomByIdOrCode = useCallback(async (roomIdOrCode: string) => {
    return multiplayerClient.getRoom(roomIdOrCode);
  }, []);

  const setReadyState = useCallback(async (roomId: string, nextReady: boolean) => {
    const room = await multiplayerClient.setReady(roomId, nextReady);
    await refreshRooms();
    return room;
  }, [refreshRooms]);

  const value = useMemo<MultiplayerContextValue>(() => ({
    identity,
    rooms,
    loading,
    ready: !loading,
    saveDisplayName,
    createRoom,
    joinRoom,
    leaveRoom,
    getRoomByIdOrCode,
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
    getRoomByIdOrCode,
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
