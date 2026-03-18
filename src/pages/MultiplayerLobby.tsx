import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useMultiplayer } from '@/features/multiplayer/MultiplayerContext';

const MultiplayerLobby = () => {
  const navigate = useNavigate();
  const {
    identity,
    rooms,
    loading,
    saveDisplayName,
    createRoom,
    joinRoom,
  } = useMultiplayer();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomPrivate, setNewRoomPrivate] = useState(false);
  const [joinPrivateOpen, setJoinPrivateOpen] = useState(false);
  const [privateCode, setPrivateCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !identity) {
      navigate('/multiplayer');
      return;
    }

    setNameInput(identity?.displayName ?? '');
  }, [identity, loading, navigate]);

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;

    setSubmitting(true);

    try {
      await saveDisplayName(trimmed);
      setEditingName(false);
    } catch (error) {
      toast('Unable to save name', {
        description: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRoom = async () => {
    const trimmed = newRoomName.trim();
    if (!trimmed) return;

    setSubmitting(true);

    try {
      const room = await createRoom(trimmed, newRoomPrivate ? 'private' : 'public');
      setCreateOpen(false);
      setNewRoomName('');
      setNewRoomPrivate(false);
      navigate(`/multiplayer/room/${room.id}`);
    } catch (error) {
      toast('Unable to create room', {
        description: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (roomIdOrCode: string) => {
    setSubmitting(true);

    try {
      const room = await joinRoom(roomIdOrCode);

      if (!room) {
        toast('Room not found', {
          description: 'That room no longer exists.',
        });
        return;
      }

      const currentPlayer = room.players.find(player => player.id === identity?.id);
      if (!currentPlayer && room.players.length >= room.maxPlayers) {
        toast('Room is full', {
          description: 'This room already has two players.',
        });
        return;
      }

      navigate(`/multiplayer/room/${room.id}`);
    } catch (error) {
      toast('Unable to join room', {
        description: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinPrivate = async () => {
    const trimmed = privateCode.trim();
    if (!trimmed) return;

    setSubmitting(true);

    try {
      const room = await joinRoom(trimmed);

      if (!room) {
        toast('Room not found', {
          description: 'Check the room code and try again.',
        });
        return;
      }

      const currentPlayer = room.players.find(player => player.id === identity?.id);
      if (!currentPlayer && room.players.length >= room.maxPlayers) {
        toast('Room is full', {
          description: 'This room already has two players.',
        });
        return;
      }

      setJoinPrivateOpen(false);
      setPrivateCode('');
      navigate(`/multiplayer/room/${room.id}`);
    } catch (error) {
      toast('Unable to join room', {
        description: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <p className="font-display tracking-wider text-muted-foreground">SUMMONING THE LOBBY...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-8 gap-6">
      <h1 className="font-display text-4xl font-black tracking-widest text-foreground">LOBBY</h1>

      <div className="flex items-center gap-3">
        {editingName ? (
          <>
            <Input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !submitting && void handleSaveName()}
              maxLength={24}
              disabled={submitting}
              className="font-body w-48 h-9 bg-secondary border-border text-center"
            />
            <Button size="sm" onClick={() => void handleSaveName()} disabled={submitting} className="font-display text-xs">SAVE</Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditingName(false); setNameInput(identity?.displayName ?? ''); }} className="font-display text-xs text-muted-foreground">CANCEL</Button>
          </>
        ) : (
          <>
            <span className="font-body text-foreground text-lg">Playing as <span className="font-display text-primary">{identity?.displayName}</span></span>
            <Button size="sm" variant="ghost" onClick={() => setEditingName(true)} className="font-display text-xs text-muted-foreground hover:text-foreground">EDIT</Button>
          </>
        )}
      </div>

      <div className="w-full max-w-lg space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg tracking-wider text-foreground">ROOMS</h2>
          <div className="flex items-center gap-2">
            <Dialog open={joinPrivateOpen} onOpenChange={setJoinPrivateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="font-display tracking-wider text-xs border-primary/30 text-primary">ENTER CODE</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="font-display tracking-wider text-foreground">JOIN PRIVATE ROOM</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <Input
                    placeholder="Room code"
                    value={privateCode}
                    onChange={(e) => setPrivateCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && !submitting && void handleJoinPrivate()}
                    maxLength={12}
                    className="font-display text-center text-lg tracking-[0.2em] bg-secondary border-border uppercase"
                  />
                  <Button onClick={() => void handleJoinPrivate()} disabled={!privateCode.trim() || submitting} className="w-full font-display tracking-wider">
                    JOIN
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="font-display tracking-wider">+ CREATE ROOM</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="font-display tracking-wider text-foreground">CREATE ROOM</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <Input
                    placeholder="Room name"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !submitting && void handleCreateRoom()}
                    maxLength={32}
                    className="font-body bg-secondary border-border"
                  />
                  <div className="flex items-center gap-3">
                    <Switch checked={newRoomPrivate} onCheckedChange={setNewRoomPrivate} />
                    <Label className="font-body text-muted-foreground">Private room</Label>
                  </div>
                  <Button onClick={() => void handleCreateRoom()} disabled={!newRoomName.trim() || submitting} className="w-full font-display tracking-wider">
                    CREATE
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {rooms.length === 0 && (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center space-y-2">
              <p className="font-display tracking-wider text-foreground">NO ROOMS IN THE LOBBY</p>
              <p className="text-sm font-body text-muted-foreground">Create a room to begin the slaughter.</p>
            </CardContent>
          </Card>
        )}

        {rooms.map(room => {
          const isFull = room.playerCount >= room.maxPlayers;
          const isInGame = room.status === 'in_game';

          return (
            <Card key={room.id} className="bg-card border-border">
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm tracking-wider text-foreground">{room.name}</span>
                    {room.visibility === 'private' && <Badge variant="outline" className="text-xs font-display border-muted-foreground/30 text-muted-foreground">PRIVATE</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs font-body text-muted-foreground flex-wrap">
                    <span>Host: {room.hostDisplayName}</span>
                    <span>{room.playerCount}/{room.maxPlayers}</span>
                    {room.visibility === 'private' && <span>Code: {room.code}</span>}
                    <Badge
                      variant={room.status === 'waiting' ? 'default' : 'secondary'}
                      className={`text-xs font-display ${room.status === 'waiting' ? 'bg-primary/20 text-primary border-primary/30' : 'bg-muted text-muted-foreground'}`}
                    >
                      {room.status === 'waiting' ? 'Waiting' : 'In Game'}
                    </Badge>
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={submitting || isFull || isInGame}
                  onClick={() => void handleJoin(room.id)}
                  className="font-display tracking-wider text-xs"
                >
                  JOIN
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button
        variant="ghost"
        onClick={() => navigate('/')}
        className="font-display tracking-wider text-muted-foreground hover:text-foreground"
      >
        ← BACK TO MENU
      </Button>
    </div>
  );
};

export default MultiplayerLobby;
