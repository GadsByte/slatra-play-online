import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useMultiplayer } from '@/features/multiplayer/MultiplayerContext';

const MultiplayerMatch = () => {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const { identity, loading, findRoomByIdOrCode, findMatchByRoomId } = useMultiplayer();

  const room = useMemo(() => (roomId ? findRoomByIdOrCode(roomId) : null), [findRoomByIdOrCode, roomId]);
  const match = useMemo(() => (roomId ? findMatchByRoomId(roomId) : null), [findMatchByRoomId, roomId]);
  const currentPlayer = room && identity ? room.players.find(player => player.id === identity.id) ?? null : null;

  useEffect(() => {
    if (!loading && !identity) {
      navigate('/multiplayer');
    }
  }, [identity, loading, navigate]);

  useEffect(() => {
    if (!loading && room && room.status !== 'in_game') {
      navigate(`/multiplayer/room/${room.id}`, { replace: true });
    }
  }, [loading, navigate, room]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <p className="font-display tracking-wider text-muted-foreground">SUMMONING THE BATTLEFIELD...</p>
      </div>
    );
  }

  if (!roomId || !room || !match) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-display text-3xl tracking-widest text-foreground">MATCH NOT FOUND</h1>
        <p className="font-body text-muted-foreground max-w-md">
          This match has not started yet, or the room is no longer available.
        </p>
        <Button onClick={() => navigate('/multiplayer/lobby')} className="font-display tracking-wider">
          RETURN TO LOBBY
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-3 text-center">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Badge variant="outline" className="font-display border-primary/30 text-primary">AUTHORITATIVE MATCH</Badge>
            <Badge variant="outline" className="font-display border-muted-foreground/30 text-muted-foreground">ROOM {room.code}</Badge>
          </div>
          <h1 className="font-display text-4xl font-black tracking-widest text-foreground">{room.name}</h1>
          <p className="font-body text-muted-foreground">
            Match started at {new Date(match.createdAt).toLocaleString()} and is now tracked by the server.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-card border-border">
            <CardContent className="space-y-3 p-5">
              <h2 className="font-display text-sm tracking-wider text-foreground">MATCH SNAPSHOT</h2>
              <div className="grid grid-cols-2 gap-3 text-sm font-body text-foreground">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p>{match.status}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phase</p>
                  <p>{match.gameState.phase}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Round</p>
                  <p>{match.gameState.round}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Current Turn</p>
                  <p>{match.gameState.currentPlayer}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="space-y-3 p-5">
              <h2 className="font-display text-sm tracking-wider text-foreground">WARBANDS</h2>
              {room.players.map(player => (
                <div key={player.id} className="flex items-center justify-between gap-3 rounded border border-border px-3 py-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-body text-foreground">{player.displayName}</span>
                    {room.hostPlayerId === player.id && <Badge variant="outline" className="text-xs font-display border-primary/30 text-primary">HOST</Badge>}
                    {identity?.id === player.id && <Badge variant="outline" className="text-xs font-display border-muted-foreground/30 text-muted-foreground">YOU</Badge>}
                  </div>
                  <Badge variant="outline" className="font-display border-primary/30 text-primary">
                    {player.ready ? 'READY' : 'SYNCING'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="space-y-4 p-5">
            <h2 className="font-display text-sm tracking-wider text-foreground">NEXT STEP</h2>
            <p className="font-body text-muted-foreground">
              The room has successfully transitioned into a server-owned match. The initial game state is live on the backend, and follow-up work can now layer in authoritative match commands.
            </p>
            {currentPlayer ? (
              <p className="font-body text-foreground">
                You are seated as <span className="font-semibold">{currentPlayer.displayName}</span> in this match.
              </p>
            ) : (
              <p className="font-body text-muted-foreground">You are viewing the match but are not seated in the room.</p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate(`/multiplayer/room/${room.id}`)} variant="outline" className="font-display tracking-wider">
                VIEW ROOM STATE
              </Button>
              <Button onClick={() => navigate('/multiplayer/lobby')} className="font-display tracking-wider">
                RETURN TO LOBBY
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MultiplayerMatch;
