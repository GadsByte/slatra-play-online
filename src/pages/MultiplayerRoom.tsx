import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useMultiplayer } from '@/features/multiplayer/MultiplayerContext';

const MultiplayerRoom = () => {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const {
    identity,
    loading,
    findRoomByIdOrCode,
    setReadyState,
    leaveRoom,
    joinRoom,
  } = useMultiplayer();

  const room = useMemo(() => {
    if (!roomId) return null;
    return findRoomByIdOrCode(roomId);
  }, [findRoomByIdOrCode, roomId]);

  const [roomLoading, setRoomLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const attemptedJoinRef = useRef<string | null>(null);

  useEffect(() => {
    if (!loading && !identity) {
      navigate('/multiplayer');
    }
  }, [identity, loading, navigate]);

  useEffect(() => {
    attemptedJoinRef.current = null;
    setRoomLoading(true);
  }, [roomId]);

  useEffect(() => {
    let cancelled = false;

    const loadRoom = async () => {
      if (!roomId || !identity) {
        setRoomLoading(false);
        return;
      }

      if (room) {
        setRoomLoading(false);
        return;
      }

      if (attemptedJoinRef.current === roomId) {
        setRoomLoading(false);
        return;
      }

      attemptedJoinRef.current = roomId;
      setRoomLoading(true);

      try {
        await joinRoom(roomId);
      } catch (error) {
        if (!cancelled) {
          toast('Unable to load room', {
            description: error instanceof Error ? error.message : 'Try again in a moment.',
          });
        }
      } finally {
        if (!cancelled) {
          setRoomLoading(false);
        }
      }
    };

    if (!loading) {
      void loadRoom();
    }

    return () => {
      cancelled = true;
    };
  }, [identity, joinRoom, loading, room, roomId]);

  const currentPlayer = useMemo(() => {
    if (!identity || !room) return null;
    return room.players.find(player => player.id === identity.id) ?? null;
  }, [identity, room]);

  const isHost = !!currentPlayer && room?.hostPlayerId === currentPlayer.id;
  const canStart = !!currentPlayer && room?.players.length === room?.maxPlayers && room.players.every(player => player.ready);

  const handleReadyChange = async (nextReady: boolean) => {
    if (!room) return;
    setActionPending(true);

    try {
      await setReadyState(room.id, nextReady);
    } catch (error) {
      toast('Unable to update ready state', {
        description: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    } finally {
      setActionPending(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!room) {
      navigate('/multiplayer/lobby');
      return;
    }

    setActionPending(true);

    try {
      await leaveRoom(room.id);
      navigate('/multiplayer/lobby');
    } catch (error) {
      toast('Unable to leave room', {
        description: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    } finally {
      setActionPending(false);
    }
  };

  const handleStartGame = () => {
    toast('Online play coming soon', {
      description: 'Multiplayer gameplay is not yet implemented, but the room state is now provider-backed.',
    });
  };

  if (loading || roomLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <p className="font-display tracking-wider text-muted-foreground">CALLING THE WARBAND...</p>
      </div>
    );
  }

  if (!roomId || !room) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-display text-3xl tracking-widest text-foreground">ROOM NOT FOUND</h1>
        <p className="font-body text-muted-foreground max-w-md">
          This room no longer exists, or the room code is invalid.
        </p>
        <Button onClick={() => navigate('/multiplayer/lobby')} className="font-display tracking-wider">
          RETURN TO LOBBY
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-8 gap-6">
      <h1 className="font-display text-4xl font-black tracking-widest text-foreground">{room.name}</h1>

      <div className="flex items-center gap-3 flex-wrap justify-center">
        <span className="font-body text-muted-foreground text-sm">Room Code:</span>
        <span className="font-display text-primary tracking-[0.2em] text-lg">{room.code}</span>
        {room.visibility === 'private' && (
          <Badge variant="outline" className="font-display border-muted-foreground/30 text-muted-foreground">PRIVATE</Badge>
        )}
      </div>

      <Card className="w-full max-w-sm bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-sm tracking-wider text-foreground">PLAYERS</h2>
            <Badge
              variant="outline"
              className={`font-display ${room.status === 'waiting' ? 'border-primary/30 text-primary' : 'border-muted-foreground/30 text-muted-foreground'}`}
            >
              {room.status === 'waiting' ? 'Waiting' : 'In Game'}
            </Badge>
          </div>

          {room.players.map((player, index) => (
            <div key={player.id} className={`flex items-center justify-between py-2 ${index > 0 ? 'border-t border-border' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-body text-foreground">{player.displayName}</span>
                {room.hostPlayerId === player.id && <Badge variant="outline" className="text-xs font-display border-primary/30 text-primary">HOST</Badge>}
                {identity?.id === player.id && <Badge variant="outline" className="text-xs font-display border-muted-foreground/30 text-muted-foreground">YOU</Badge>}
              </div>
              <Badge
                className={`text-xs font-display ${player.ready ? 'bg-primary/20 text-primary border-primary/30' : 'bg-muted text-muted-foreground'}`}
                variant="outline"
              >
                {player.ready ? 'READY' : 'NOT READY'}
              </Badge>
            </div>
          ))}

          {room.players.length < room.maxPlayers && (
            <div className="border-t border-border pt-3 text-center text-sm font-body text-muted-foreground italic">
              Waiting for another challenger...
            </div>
          )}
        </CardContent>
      </Card>

      {currentPlayer ? (
        <div className="flex items-center gap-3">
          <Switch checked={currentPlayer.ready} onCheckedChange={(checked) => void handleReadyChange(checked)} disabled={actionPending} />
          <Label className="font-display tracking-wider text-foreground text-sm">READY</Label>
        </div>
      ) : (
        <p className="text-sm font-body text-muted-foreground">You are not seated in this room.</p>
      )}

      <div className="flex flex-col gap-3 w-full max-w-sm">
        {isHost && (
          <Button
            size="lg"
            onClick={handleStartGame}
            disabled={!canStart}
            className="w-full font-display text-lg tracking-wider py-6"
          >
            START GAME
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => void handleLeaveRoom()}
          disabled={actionPending}
          className="w-full font-display tracking-wider text-muted-foreground hover:text-foreground"
        >
          LEAVE ROOM
        </Button>
      </div>
    </div>
  );
};

export default MultiplayerRoom;
