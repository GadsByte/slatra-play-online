import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const STORAGE_KEY = 'slatraDisplayName';

interface MockRoom {
  id: string;
  name: string;
  host: string;
  players: number;
  maxPlayers: number;
  status: 'Waiting' | 'In Game';
  isPrivate: boolean;
}

const INITIAL_ROOMS: MockRoom[] = [
  { id: 'room-1', name: 'The Blood Pit', host: 'Wulfgrim', players: 1, maxPlayers: 2, status: 'Waiting', isPrivate: false },
  { id: 'room-2', name: 'Bone Throne Arena', host: 'Skullcrusher', players: 2, maxPlayers: 2, status: 'In Game', isPrivate: false },
  { id: 'room-3', name: 'Plague Grounds', host: 'Rotface', players: 1, maxPlayers: 2, status: 'Waiting', isPrivate: true },
];

const MultiplayerLobby = () => {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [rooms, setRooms] = useState<MockRoom[]>(INITIAL_ROOMS);
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [joinPrivateOpen, setJoinPrivateOpen] = useState(false);
  const [privateCode, setPrivateCode] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      navigate('/multiplayer');
      return;
    }
    setDisplayName(saved);
    setNameInput(saved);
  }, [navigate]);

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    localStorage.setItem(STORAGE_KEY, trimmed);
    setDisplayName(trimmed);
    setEditingName(false);
  };

  const handleCreateRoom = () => {
    const trimmed = newRoomName.trim();
    if (!trimmed) return;
    const id = `room-${Date.now()}`;
    const room: MockRoom = {
      id,
      name: trimmed,
      host: displayName,
      players: 1,
      maxPlayers: 2,
      status: 'Waiting',
      isPrivate: newRoomPrivate,
    };
    setRooms(prev => [...prev, room]);
    setCreateOpen(false);
    setNewRoomName('');
    setNewRoomPrivate(false);
    navigate(`/multiplayer/room/${id}`);
  };

  const handleJoin = (roomId: string) => {
    navigate(`/multiplayer/room/${roomId}`);
  };

  const handleJoinPrivate = () => {
    const trimmed = privateCode.trim();
    if (!trimmed) return;
    setJoinPrivateOpen(false);
    setPrivateCode('');
    navigate(`/multiplayer/room/${trimmed.toLowerCase()}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-8 gap-6">
      <h1 className="font-display text-4xl font-black tracking-widest text-foreground">LOBBY</h1>

      {/* Display name */}
      <div className="flex items-center gap-3">
        {editingName ? (
          <>
            <Input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              maxLength={24}
              className="font-body w-48 h-9 bg-secondary border-border text-center"
            />
            <Button size="sm" onClick={handleSaveName} className="font-display text-xs">SAVE</Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditingName(false); setNameInput(displayName); }} className="font-display text-xs text-muted-foreground">CANCEL</Button>
          </>
        ) : (
          <>
            <span className="font-body text-foreground text-lg">Playing as <span className="font-display text-primary">{displayName}</span></span>
            <Button size="sm" variant="ghost" onClick={() => setEditingName(true)} className="font-display text-xs text-muted-foreground hover:text-foreground">EDIT</Button>
          </>
        )}
      </div>

      {/* Room list */}
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
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinPrivate()}
                    maxLength={12}
                    className="font-display text-center text-lg tracking-[0.2em] bg-secondary border-border uppercase"
                  />
                  <Button onClick={handleJoinPrivate} disabled={!privateCode.trim()} className="w-full font-display tracking-wider">
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
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                  maxLength={32}
                  className="font-body bg-secondary border-border"
                />
                <div className="flex items-center gap-3">
                  <Switch checked={newRoomPrivate} onCheckedChange={setNewRoomPrivate} />
                  <Label className="font-body text-muted-foreground">Private room</Label>
                </div>
                <Button onClick={handleCreateRoom} disabled={!newRoomName.trim()} className="w-full font-display tracking-wider">
                  CREATE
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {rooms.length === 0 && (
          <p className="text-muted-foreground font-body text-center py-8">No rooms available. Create one!</p>
        )}

        {rooms.map(room => (
          <Card key={room.id} className="bg-card border-border">
            <CardContent className="flex items-center justify-between p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm tracking-wider text-foreground">{room.name}</span>
                  {room.isPrivate && <Badge variant="outline" className="text-xs font-display border-muted-foreground/30 text-muted-foreground">PRIVATE</Badge>}
                </div>
                <div className="flex items-center gap-3 text-xs font-body text-muted-foreground">
                  <span>Host: {room.host}</span>
                  <span>{room.players}/{room.maxPlayers}</span>
                  <Badge
                    variant={room.status === 'Waiting' ? 'default' : 'secondary'}
                    className={`text-xs font-display ${room.status === 'Waiting' ? 'bg-primary/20 text-primary border-primary/30' : 'bg-muted text-muted-foreground'}`}
                  >
                    {room.status}
                  </Badge>
                </div>
              </div>
              <Button
                size="sm"
                disabled={room.players >= room.maxPlayers || room.status === 'In Game'}
                onClick={() => handleJoin(room.id)}
                className="font-display tracking-wider text-xs"
              >
                JOIN
              </Button>
            </CardContent>
          </Card>
        ))}
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
