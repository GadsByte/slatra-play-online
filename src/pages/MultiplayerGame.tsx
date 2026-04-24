import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useMultiplayer } from '@/multiplayer/MultiplayerContext';
import { SlatraGameView } from '@/components/game/SlatraGameView';
import { gameReducer } from '@/game/gameReducer';
import type { GameAction } from '@/game/gameReducer';
import type { GameState, Faction } from '@/game/types';
import type { Game } from '@/multiplayer/types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function toGame(row: any): Game {
  return {
    id: row.id,
    room_id: row.room_id,
    state: row.state as GameState,
    plague_player_id: row.plague_player_id,
    bone_player_id: row.bone_player_id,
    version: row.version,
    updated_at: row.updated_at,
  };
}

const MultiplayerGame = () => {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const { user, cleanupExpiredRooms } = useMultiplayer();

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const versionRef = useRef(0);

  // Determine local faction
  const localFaction: Faction | null = game && user
    ? (game.plague_player_id === user.id ? 'plague' : game.bone_player_id === user.id ? 'bone' : null)
    : null;

  // Initial load
  useEffect(() => {
    if (!roomId || !user) return;
    let cancelled = false;
    (async () => {
      await cleanupExpiredRooms();
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('room_id', roomId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        toast.error('Game not found');
        navigate('/multiplayer/lobby');
        return;
      }
      const g = toGame(data);
      setGame(g);
      versionRef.current = g.version;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [roomId, user, navigate, cleanupExpiredRooms]);

  // Subscribe to game updates
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`game-${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `room_id=eq.${roomId}` }, (payload) => {
        const g = toGame(payload.new);
        if (g.version >= versionRef.current) {
          versionRef.current = g.version;
          setGame(g);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  // Watch for opponent leaving (room_players row deleted)
  useEffect(() => {
    if (!roomId || !user) return;
    const channel = supabase
      .channel(`room-players-${roomId}-game`)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` }, (payload) => {
        const leftUserId = (payload.old as any)?.user_id;
        if (leftUserId && leftUserId !== user.id) {
          setOpponentLeft(true);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, user]);

  useEffect(() => {
    if (!roomId) return;
    const checkExpiry = async () => {
      await cleanupExpiredRooms();
      const { data } = await supabase.from('rooms').select('id').eq('id', roomId).maybeSingle();
      if (!data) {
        toast.info('Room expired');
        navigate('/multiplayer/lobby');
      }
    };
    const expiryCheck = window.setInterval(checkExpiry, 30000);
    const expiryTimeout = window.setTimeout(checkExpiry, 60 * 60 * 1000);
    return () => {
      window.clearInterval(expiryCheck);
      window.clearTimeout(expiryTimeout);
    };
  }, [roomId, navigate, cleanupExpiredRooms]);

  // Sync-aware dispatch
  const syncDispatch = useCallback((action: GameAction) => {
    if (!game || !user || !localFaction) return;
    // Only allow dispatch on our turn
    if (game.state.currentPlayer !== localFaction) return;

    const newState = gameReducer(game.state, action);
    const newVersion = game.version + 1;

    // Optimistic local update
    versionRef.current = newVersion;
    setGame({ ...game, state: newState, version: newVersion });

    // Persist
    supabase
      .from('games')
      .update({ state: newState as any, version: newVersion, updated_at: new Date().toISOString() })
      .eq('id', game.id)
      .then(({ error }) => {
        if (error) {
          toast.error('Sync failed');
          console.error('Game sync error:', error);
        }
      });
  }, [game, user, localFaction]);

  const handleLeave = async () => {
    if (roomId && user) {
      await supabase.from('room_players').delete().eq('room_id', roomId).eq('user_id', user.id);
      await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId);
    }
    navigate('/multiplayer/lobby');
  };

  if (!user) {
    navigate('/multiplayer');
    return null;
  }

  if (loading || !game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-body text-muted-foreground">Loading game...</p>
      </div>
    );
  }

  if (!localFaction) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="font-body text-muted-foreground">You are not a player in this game.</p>
        <Button onClick={() => navigate('/multiplayer/lobby')} className="font-display tracking-wider">
          BACK TO LOBBY
        </Button>
      </div>
    );
  }

  if (opponentLeft) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
        <h1 className="font-display text-5xl font-black tracking-widest text-foreground">VICTORY</h1>
        <p className="font-display text-xl text-muted-foreground">Your opponent disconnected.</p>
        <Button size="lg" onClick={handleLeave} className="font-display tracking-wider">
          BACK TO LOBBY
        </Button>
      </div>
    );
  }

  const isMyTurn = game.state.currentPlayer === localFaction;
  const factionLabel = localFaction === 'plague' ? 'PLAGUE ORDER' : 'BONE LEGION';
  const factionColor = localFaction === 'plague' ? 'text-plague-light' : 'text-bone-light';

  const banner = (
    <div className="bg-card/50 border-b border-border px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-3">
        <span className="font-display text-muted-foreground">YOU:</span>
        <span className={`font-display font-bold tracking-wider ${factionColor}`}>{factionLabel}</span>
      </div>
      <div className="font-display tracking-wider">
        {isMyTurn ? (
          <span className="text-primary">YOUR TURN</span>
        ) : (
          <span className="text-muted-foreground animate-pulse">WAITING FOR OPPONENT...</span>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={handleLeave} className="font-display tracking-wider text-muted-foreground hover:text-foreground">
        LEAVE
      </Button>
    </div>
  );

  return (
    <SlatraGameView
      state={game.state}
      dispatch={syncDispatch}
      localFaction={localFaction}
      statusBanner={banner}
      exitPath="/multiplayer/lobby"
    />
  );
};

export default MultiplayerGame;
