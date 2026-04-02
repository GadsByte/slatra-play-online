import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMultiplayer } from '@/multiplayer/MultiplayerContext';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'slatraDisplayName';
const ID_KEY = 'slatraUserId';

const MultiplayerEntry = () => {
  const navigate = useNavigate();
  const { setUser } = useMultiplayer();
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setDisplayName(saved);
  }, []);

  const handleContinue = () => {
    const trimmed = displayName.trim();
    if (!trimmed) return;
    localStorage.setItem(STORAGE_KEY, trimmed);
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = uuidv4();
      localStorage.setItem(ID_KEY, id);
    }
    setUser({ id, display_name: trimmed });
    navigate('/multiplayer/lobby');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-8 px-4">
      <div className="text-center space-y-3">
        <h1 className="font-display text-4xl font-black tracking-widest text-foreground">MULTIPLAYER</h1>
        <p className="text-muted-foreground font-body text-lg">
          Enter a display name to join the lobby.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <Input
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
          maxLength={24}
          className="font-body text-center text-lg h-12 bg-secondary border-border focus:border-primary"
        />
        <Button
          size="lg"
          onClick={handleContinue}
          disabled={!displayName.trim()}
          className="w-full font-display text-lg tracking-wider py-6"
        >
          CONTINUE
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="w-full font-display tracking-wider text-muted-foreground hover:text-foreground"
        >
          ← BACK TO MENU
        </Button>
      </div>
    </div>
  );
};

export default MultiplayerEntry;
