import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMultiplayer } from '@/features/multiplayer/MultiplayerContext';

const MultiplayerEntry = () => {
  const navigate = useNavigate();
  const { identity, loading, saveDisplayName } = useMultiplayer();
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(identity?.displayName ?? '');
  }, [identity?.displayName]);

  const handleContinue = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) return;

    setSaving(true);
    await saveDisplayName(trimmed);
    setSaving(false);
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
          onKeyDown={(e) => e.key === 'Enter' && !loading && !saving && void handleContinue()}
          maxLength={24}
          disabled={loading || saving}
          className="font-body text-center text-lg h-12 bg-secondary border-border focus:border-primary"
        />
        <Button
          size="lg"
          onClick={() => void handleContinue()}
          disabled={!displayName.trim() || loading || saving}
          className="w-full font-display text-lg tracking-wider py-6"
        >
          {loading || saving ? 'PREPARING...' : 'CONTINUE'}
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
