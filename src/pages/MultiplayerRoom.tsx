import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const STORAGE_KEY = 'slatraDisplayName';

const MultiplayerRoom = () => {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const [displayName, setDisplayName] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      navigate('/multiplayer');
      return;
    }
    setDisplayName(saved);
  }, [navigate]);

  const isHost = true; // Mock: current user is always host for now
  const roomName = 'The Blood Pit';
  const roomCode = roomId?.toUpperCase().slice(-6) || 'XXXXXX';

  const players = [
    { name: displayName, ready, isHost: true },
    { name: 'Waiting...', ready: false, isHost: false, isEmpty: true },
  ];

  const handleStartGame = () => {
    toast('Online play coming soon', {
      description: 'Multiplayer gameplay is not yet implemented.',
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-8 gap-6">
      <h1 className="font-display text-4xl font-black tracking-widest text-foreground">{roomName}</h1>

      <div className="flex items-center gap-3">
        <span className="font-body text-muted-foreground text-sm">Room Code:</span>
        <span className="font-display text-primary tracking-[0.2em] text-lg">{roomCode}</span>
      </div>

      <Card className="w-full max-w-sm bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <h2 className="font-display text-sm tracking-wider text-foreground">PLAYERS</h2>
          {players.map((p, i) => (
            <div key={i} className={`flex items-center justify-between py-2 ${i > 0 ? 'border-t border-border' : ''}`}>
              <div className="flex items-center gap-2">
                <span className={`font-body ${p.isEmpty ? 'text-muted-foreground/50 italic' : 'text-foreground'}`}>{p.name}</span>
                {p.isHost && !p.isEmpty && <Badge variant="outline" className="text-xs font-display border-primary/30 text-primary">HOST</Badge>}
              </div>
              {!p.isEmpty && (
                <Badge
                  className={`text-xs font-display ${p.ready ? 'bg-primary/20 text-primary border-primary/30' : 'bg-muted text-muted-foreground'}`}
                  variant="outline"
                >
                  {p.ready ? 'READY' : 'NOT READY'}
                </Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Switch checked={ready} onCheckedChange={setReady} />
        <Label className="font-display tracking-wider text-foreground text-sm">READY</Label>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        {isHost && (
          <Button
            size="lg"
            onClick={handleStartGame}
            disabled={!ready}
            className="w-full font-display text-lg tracking-wider py-6"
          >
            START GAME
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => navigate('/multiplayer/lobby')}
          className="w-full font-display tracking-wider text-muted-foreground hover:text-foreground"
        >
          LEAVE ROOM
        </Button>
      </div>
    </div>
  );
};

export default MultiplayerRoom;
