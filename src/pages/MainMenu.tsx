import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const MainMenu = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-8">
      <div className="text-center space-y-4">
        <h1 className="font-display text-6xl font-black tracking-widest text-foreground">SLATRA</h1>
        <p className="font-display text-xl text-primary tracking-[0.3em]">SERVE · SUFFER · DIE</p>
        <p className="text-muted-foreground font-body text-lg max-w-md mx-auto">
          A tactical skirmish between the Plague Order and the Bone Legion. Two players. One board. No mercy.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <Button
          size="lg"
          onClick={() => navigate('/local')}
          className="font-display text-lg tracking-wider px-8 py-6"
        >
          BEGIN THE SLAUGHTER
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => navigate('/multiplayer')}
          className="font-display text-lg tracking-wider px-8 py-6 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
        >
          MULTIPLAYER
        </Button>
      </div>
    </div>
  );
};

export default MainMenu;
