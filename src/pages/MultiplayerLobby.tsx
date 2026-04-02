import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useMultiplayer } from '@/multiplayer/MultiplayerContext';
import { toast } from 'sonner';

const STORAGE_KEY = 'slatraDisplayName';

const MultiplayerLobby = () => {
  const navigate = useNavigate();
  const {
    user, setUser, rooms, roomsLoading,
    fetchRooms, subscribeToRooms,
    createRoom, joinRoom, joinRoomByCode,
  } = useMultiplayer();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomPrivate, setNewRoomPrivate] = useState(false);
  const [joinPrivateOpen, setJoinPrivateOpen] = useState(false);
  const [privateCode, setPrivateCode] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/multiplayer');
      return;
    }
    setNameInput(user.display_name);
    fetchRooms();
    const unsub = subscribeToRooms();
    return unsub;
  }, [user, navigate, fetchRooms, subscribeToRooms]);

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed || !user) return;
    localStorage.setItem(STORAGE_KEY, trimmed);
    setUser({ ...user, display_name: trimmed });
    setEditingName(false);
  };

  const handleCreateRoom = async () => {
    const trimmed = newRoomName.trim();
    if (!trimmed) return;
    const room = await createRoom(trimmed, newRoomPrivate);
    if (room) {
      setCreateOpen(false);
      setNewRoomName('');
      setNewRoomPrivate(false);
      navigate(`/multiplayer/room/${room.id}`);
    } else {
      toast.error('Failed to create room');
    }
  };

  const handleJoin = async (roomId: string) => {
    const ok = await joinRoom(roomId);
    if (ok) {
      navigate(`/multiplayer/room/${roomId}`);
    } else {
      toast.error('Failed to join room');
    }
  };

  const handleJoinPrivate = async () => {
    const trimmed = privateCode.trim();
    if (!trimmed) return;
    const room = await joinRoomByCode(trimmed);
    if (room) {
      setJoinPrivateOpen(false);
      setPrivateCode('');
      navigate(`/multiplayer/room/${room.id}`);
    } else {
      toast.error('Room not found or full');
    }
  };

  // Derive player counts from rooms (we'd ideally join with room_players count, 
  // but for now rooms table is the source of truth for display)
  const publicRooms = rooms.filter(r => !r.is_private);

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
            <Button size="sm" variant="ghost" onClick={() => { setEditingName(false); setNameInput(user?.display_name || ''); }} className="font-display text-xs text-muted-foreground">CANCEL</Button>
          </>
        ) : (
          <>
            <span className="font-body text-foreground text-lg">Playing as <span className="font-display text-primary">{user?.display_name}</span></span>
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
        </div>

        {roomsLoading && (
          <p className="text-muted-foreground font-body text-center py-8">Loading rooms...</p>
        )}

        {!roomsLoading && publicRooms.length === 0 && (
          <p className="text-muted-foreground font-body text-center py-8">No rooms available. Create one!</p>
        )}

        {publicRooms.map(room => (
          <Card key={room.id} className="bg-card border-border">
            <CardContent className="flex items-center justify-between p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm tracking-wider text-foreground">{room.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-body text-muted-foreground">
                  <span>Host: {room.host_name}</span>
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
                disabled={room.status !== 'waiting'}
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
