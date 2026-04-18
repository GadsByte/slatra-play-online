import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createInitialState } from '@/game/gameReducer';
import type { Room, RoomPlayer, MultiplayerUser, RoomStatus } from './types';

interface MultiplayerContextValue {
  user: MultiplayerUser | null;
  setUser: (user: MultiplayerUser | null) => void;
  rooms: Room[];
  roomsLoading: boolean;
  currentRoom: Room | null;
  currentPlayers: RoomPlayer[];
  createRoom: (name: string, isPrivate: boolean) => Promise<Room | null>;
  joinRoom: (roomId: string) => Promise<boolean>;
  joinRoomByCode: (code: string) => Promise<Room | null>;
  leaveRoom: () => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  startGame: () => Promise<boolean>;
  subscribeToRooms: () => () => void;
  subscribeToRoom: (roomId: string) => () => void;
  fetchRooms: () => Promise<void>;
  fetchRoom: (roomId: string) => Promise<void>;
}

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

export const useMultiplayer = () => {
  const ctx = useContext(MultiplayerContext);
  if (!ctx) throw new Error('useMultiplayer must be used within MultiplayerProvider');
  return ctx;
};

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Map DB row to our Room type
function toRoom(row: any): Room {
  return {
    id: row.id,
    name: row.name,
    host_id: row.host_id,
    host_name: row.host_name,
    is_private: row.is_private,
    room_code: row.room_code,
    status: row.status as RoomStatus,
    max_players: row.max_players,
    created_at: row.created_at,
  };
}

function toRoomPlayer(row: any): RoomPlayer {
  return {
    id: row.id,
    room_id: row.room_id,
    user_id: row.user_id,
    display_name: row.display_name,
    is_host: row.is_host,
    is_ready: row.is_ready,
    joined_at: row.joined_at,
  };
}

export const MultiplayerProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<MultiplayerUser | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [currentPlayers, setCurrentPlayers] = useState<RoomPlayer[]>([]);

  // Initialize user from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('slatraDisplayName');
    const savedId = localStorage.getItem('slatraUserId');
    if (saved && savedId) {
      setUser({ id: savedId, display_name: saved });
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    setRoomsLoading(true);
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .in('status', ['waiting', 'in_game'])
      .order('created_at', { ascending: false });
    if (!error && data) setRooms(data.map(toRoom));
    setRoomsLoading(false);
  }, []);

  const fetchRoom = useCallback(async (roomId: string) => {
    const [roomRes, playersRes] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', roomId).single(),
      supabase.from('room_players').select('*').eq('room_id', roomId).order('joined_at', { ascending: true }),
    ]);
    if (roomRes.data) setCurrentRoom(toRoom(roomRes.data));
    if (playersRes.data) setCurrentPlayers(playersRes.data.map(toRoomPlayer));
  }, []);

  const subscribeToRooms = useCallback(() => {
    const channel = supabase
      .channel('rooms-lobby')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchRooms();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchRooms]);

  const subscribeToRoom = useCallback((roomId: string) => {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
        if (payload.eventType === 'UPDATE') setCurrentRoom(toRoom(payload.new));
        if (payload.eventType === 'DELETE') setCurrentRoom(null);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` }, () => {
        supabase.from('room_players').select('*').eq('room_id', roomId).order('joined_at', { ascending: true })
          .then(({ data }) => { if (data) setCurrentPlayers(data.map(toRoomPlayer)); });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const createRoom = useCallback(async (name: string, isPrivate: boolean): Promise<Room | null> => {
    if (!user) return null;
    const roomCode = generateRoomCode();
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        name,
        host_id: user.id,
        host_name: user.display_name,
        is_private: isPrivate,
        room_code: roomCode,
        status: 'waiting',
        max_players: 2,
      })
      .select()
      .single();
    if (error || !data) return null;
    const room = toRoom(data);
    // Auto-join as host
    await supabase.from('room_players').insert({
      room_id: room.id,
      user_id: user.id,
      display_name: user.display_name,
      is_host: true,
      is_ready: false,
    });
    return room;
  }, [user]);

  const joinRoom = useCallback(async (roomId: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.from('room_players').insert({
      room_id: roomId,
      user_id: user.id,
      display_name: user.display_name,
      is_host: false,
      is_ready: false,
    });
    return !error;
  }, [user]);

  const joinRoomByCode = useCallback(async (code: string): Promise<Room | null> => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_code', code.toUpperCase())
      .eq('status', 'waiting')
      .single();
    if (error || !data) return null;
    const room = toRoom(data);
    const joined = await joinRoom(room.id);
    return joined ? room : null;
  }, [joinRoom]);

  const leaveRoom = useCallback(async () => {
    if (!user || !currentRoom) return;
    await supabase.from('room_players').delete().eq('room_id', currentRoom.id).eq('user_id', user.id);
    // If host leaves, delete the room
    if (currentRoom.host_id === user.id) {
      await supabase.from('rooms').delete().eq('id', currentRoom.id);
    }
    setCurrentRoom(null);
    setCurrentPlayers([]);
  }, [user, currentRoom]);

  const setReady = useCallback(async (ready: boolean) => {
    if (!user || !currentRoom) return;
    await supabase
      .from('room_players')
      .update({ is_ready: ready })
      .eq('room_id', currentRoom.id)
      .eq('user_id', user.id);
  }, [user, currentRoom]);

  const startGame = useCallback(async (): Promise<boolean> => {
    if (!user || !currentRoom || currentRoom.host_id !== user.id) return false;
    if (currentPlayers.length < 2) return false;

    // Randomly assign factions
    const shuffled = [...currentPlayers].sort(() => Math.random() - 0.5);
    const plaguePlayer = shuffled[0];
    const bonePlayer = shuffled[1];

    const initialState = createInitialState();

    // Create the game row (upsert in case one already exists for this room)
    const { error: gameError } = await supabase
      .from('games')
      .upsert({
        room_id: currentRoom.id,
        state: initialState as any,
        plague_player_id: plaguePlayer.user_id,
        bone_player_id: bonePlayer.user_id,
        version: 1,
      }, { onConflict: 'room_id' });

    if (gameError) {
      console.error('Failed to create game:', gameError);
      return false;
    }

    const { error } = await supabase
      .from('rooms')
      .update({ status: 'in_game' })
      .eq('id', currentRoom.id);
    return !error;
  }, [user, currentRoom, currentPlayers]);

  return (
    <MultiplayerContext.Provider value={{
      user, setUser, rooms, roomsLoading,
      currentRoom, currentPlayers,
      createRoom, joinRoom, joinRoomByCode, leaveRoom, setReady, startGame,
      subscribeToRooms, subscribeToRoom, fetchRooms, fetchRoom,
    }}>
      {children}
    </MultiplayerContext.Provider>
  );
};
