import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useMultiplayer } from '@/multiplayer/MultiplayerContext';

function getTimeRemainingLabel(expiresAt: string): string {
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) return 'Expiring now';
  const minutes = Math.ceil(remainingMs / 60000);
  return `Expires in ${minutes}m`;
}

const MultiplayerRoom = () => {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const {
    user, currentRoom, currentPlayers,
    fetchRoom, subscribeToRoom, leaveRoom, setReady, startGame,
  } = useMultiplayer();

  const [localReady, setLocalReady] = useState(false);
  const [hasLoadedRoom, setHasLoadedRoom] = useState(false);
  const [, setTimerTick] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate('/multiplayer');
      return;
    }
    if (!roomId) return;
    let cancelled = false;
    setHasLoadedRoom(false);
    fetchRoom(roomId).finally(() => {
      if (!cancelled) setHasLoadedRoom(true);
    });
    const unsub = subscribeToRoom(roomId);
    const expiryCheck = window.setInterval(() => fetchRoom(roomId), 30000);
    const expiryTimeout = window.setTimeout(() => fetchRoom(roomId), 60 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(expiryCheck);
      window.clearTimeout(expiryTimeout);
      unsub();
    };
  }, [user, roomId, navigate, fetchRoom, subscribeToRoom]);

  useEffect(() => {
    if (!roomId || !hasLoadedRoom || currentRoom) return;
    toast.info('Room expired');
    navigate('/multiplayer/lobby');
  }, [currentRoom, hasLoadedRoom, roomId, navigate]);

  useEffect(() => {
    const timer = window.setInterval(() => setTimerTick(tick => tick + 1), 60000);
    return () => window.clearInterval(timer);
  }, []);

  // Sync local ready state from server
  useEffect(() => {
    if (!user) return;
    const me = currentPlayers.find(p => p.user_id === user.id);
    if (me) setLocalReady(me.is_ready);
  }, [currentPlayers, user]);

  const isHost = currentRoom?.host_id === user?.id;
  const allReady = currentPlayers.length >= 2 && currentPlayers.every(p => p.is_ready);

  const handleReadyToggle = async (checked: boolean) => {
    setLocalReady(checked);
    await setReady(checked);
  };

  const handleStartGame = async () => {
    if (!allReady) {
      toast.error('All players must be ready');
      return;
    }
    const ok = await startGame();
    if (!ok) {
      toast.error('Failed to start game');
      return;
    }
    // Navigation handled by status-change effect below
  };

  // When room transitions to in_game, navigate everyone to the game view
  useEffect(() => {
    if (currentRoom?.status === 'in_game' && roomId) {
      navigate(`/multiplayer/game/${roomId}`);
    }
  }, [currentRoom?.status, roomId, navigate]);

  const handleLeave = async () => {
    await leaveRoom();
    navigate('/multiplayer/lobby');
  };

  if (!currentRoom) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="font-body text-muted-foreground">Loading room...</p>
        <Button variant="ghost" onClick={() => navigate('/multiplayer/lobby')} className="font-display tracking-wider text-muted-foreground">
          ← BACK TO LOBBY
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-8 gap-6">
      <h1 className="font-display text-4xl font-black tracking-widest text-foreground">{currentRoom.name}</h1>

      <div className="flex items-center gap-3">
        <span className="font-body text-muted-foreground text-sm">Room Code:</span>
        <span className="font-display text-primary tracking-[0.2em] text-lg">{currentRoom.room_code}</span>
        <Badge variant="outline" className="text-xs font-display border-border text-muted-foreground">
          {getTimeRemainingLabel(currentRoom.expires_at)}
        </Badge>
      </div>

      <Card className="w-full max-w-sm bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <h2 className="font-display text-sm tracking-wider text-foreground">PLAYERS</h2>
          {currentPlayers.map((p, i) => (
            <div key={p.id} className={`flex items-center justify-between py-2 ${i > 0 ? 'border-t border-border' : ''}`}>
              <div className="flex items-center gap-2">
                <span className="font-body text-foreground">{p.display_name}</span>
                {p.is_host && <Badge variant="outline" className="text-xs font-display border-primary/30 text-primary">HOST</Badge>}
              </div>
              <Badge
                className={`text-xs font-display ${p.is_ready ? 'bg-primary/20 text-primary border-primary/30' : 'bg-muted text-muted-foreground'}`}
                variant="outline"
              >
                {p.is_ready ? 'READY' : 'NOT READY'}
              </Badge>
            </div>
          ))}
          {currentPlayers.length < (currentRoom.max_players || 2) && (
            <div className="flex items-center py-2 border-t border-border">
              <span className="font-body text-muted-foreground/50 italic">Waiting for player...</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Switch checked={localReady} onCheckedChange={handleReadyToggle} />
        <Label className="font-display tracking-wider text-foreground text-sm">READY</Label>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        {isHost && (
          <Button
            size="lg"
            onClick={handleStartGame}
            disabled={!allReady}
            className="w-full font-display text-lg tracking-wider py-6"
          >
            START GAME
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={handleLeave}
          className="w-full font-display tracking-wider text-muted-foreground hover:text-foreground"
        >
          LEAVE ROOM
        </Button>
      </div>
    </div>
  );
};

export default MultiplayerRoom;
