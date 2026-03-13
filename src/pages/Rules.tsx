import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const Rules = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-display text-4xl font-black tracking-widest text-foreground">HOW TO PLAY</h1>
          <p className="font-body text-muted-foreground text-lg">Everything you need to know to wage war.</p>
        </div>

        <Separator className="bg-border" />

        {/* Overview */}
        <section className="space-y-3">
          <h2 className="font-display text-xl tracking-wider text-primary">OVERVIEW</h2>
          <p className="font-body text-foreground leading-relaxed">
            SLATRA is a tactical skirmish game for two players. Each player commands a warband of six units on an 8×6 grid. The goal: destroy your opponent's forces or seize control of the battlefield's objectives. Matches are brutal, fast, and unforgiving.
          </p>
        </section>

        {/* Factions */}
        <section className="space-y-3">
          <h2 className="font-display text-xl tracking-wider text-primary">FACTIONS</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded p-4 space-y-2">
              <h3 className="font-display text-sm tracking-wider text-plague-light">THE PLAGUE ORDER</h3>
              <p className="font-body text-foreground text-sm leading-relaxed">
                Pestilent zealots who wield filth and flame. Their Medic cleanses with Filth Scorch, their Heavy unleashes the Flame of Wulfgrim, and their Captain inspires with the Aura of Death.
              </p>
            </div>
            <div className="bg-card border border-border rounded p-4 space-y-2">
              <h3 className="font-display text-sm tracking-wider text-bone-light">THE BONE LEGION</h3>
              <p className="font-body text-foreground text-sm leading-relaxed">
                Skeletal warriors bound by ancient duty. Their Medic performs the Last Rite, their Heavy strikes with Fists of Magma, and their Captain raises the Banner of Iron Faith.
              </p>
            </div>
          </div>
        </section>

        <Separator className="bg-border" />

        {/* Setup */}
        <section className="space-y-3">
          <h2 className="font-display text-xl tracking-wider text-primary">SETUP</h2>
          <ol className="font-body text-foreground space-y-2 list-decimal list-inside leading-relaxed">
            <li><strong className="text-foreground">Hazard Placement</strong> — Place 3 hazard tiles in the middle rows (3–6). Hazards deal 1 damage to any unit that enters them.</li>
            <li><strong className="text-foreground">Objective Roll</strong> — Roll to place objective tokens on the board. Objectives can be interacted with for powerful effects.</li>
            <li><strong className="text-foreground">Deployment</strong> — The Plague Order deploys their 6 units in rows 1–2, then the Bone Legion deploys in rows 7–8. Each warband has 3 Grunts, 1 Medic, 1 Heavy, and 1 Captain.</li>
            <li><strong className="text-foreground">Initiative</strong> — Both players roll. The winner chooses who goes first each round.</li>
          </ol>
        </section>

        {/* Units */}
        <section className="space-y-3">
          <h2 className="font-display text-xl tracking-wider text-primary">UNITS</h2>
          <div className="overflow-x-auto">
            <table className="w-full font-body text-sm border border-border">
              <thead>
                <tr className="bg-secondary">
                  <th className="font-display tracking-wider text-left p-2 text-foreground">Unit</th>
                  <th className="font-display tracking-wider text-center p-2 text-foreground">HP</th>
                  <th className="font-display tracking-wider text-center p-2 text-foreground">Move</th>
                  <th className="font-display tracking-wider text-center p-2 text-foreground">Attack</th>
                </tr>
              </thead>
              <tbody className="text-foreground">
                <tr className="border-t border-border"><td className="p-2">Grunt</td><td className="text-center p-2">6</td><td className="text-center p-2">3</td><td className="text-center p-2">1d6</td></tr>
                <tr className="border-t border-border"><td className="p-2">Medic</td><td className="text-center p-2">6</td><td className="text-center p-2">2</td><td className="text-center p-2">1d4</td></tr>
                <tr className="border-t border-border"><td className="p-2">Heavy</td><td className="text-center p-2">10</td><td className="text-center p-2">2</td><td className="text-center p-2">2d6</td></tr>
                <tr className="border-t border-border"><td className="p-2">Captain</td><td className="text-center p-2">12</td><td className="text-center p-2">3</td><td className="text-center p-2">2d6</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <Separator className="bg-border" />

        {/* Turn Structure */}
        <section className="space-y-3">
          <h2 className="font-display text-xl tracking-wider text-primary">TURN STRUCTURE</h2>
          <p className="font-body text-foreground leading-relaxed">
            Players alternate activating one unit at a time. When you activate a unit, you may:
          </p>
          <ul className="font-body text-foreground space-y-1 list-disc list-inside leading-relaxed">
            <li><strong>Move</strong> — up to the unit's movement value in cardinal directions (no diagonals). You cannot pass through other units or hazards.</li>
            <li><strong>Attack</strong> — target an adjacent enemy unit. Roll your attack dice and deal that much damage.</li>
            <li><strong>Use Ability</strong> — each specialist unit has a unique ability (once per activation).</li>
            <li><strong>Interact with Objective</strong> — if adjacent to an objective token, interact for a random effect (roll 1d6).</li>
          </ul>
          <p className="font-body text-foreground leading-relaxed">
            Once activated, a unit cannot act again until the next round. A round ends when all units on both sides have been activated.
          </p>
        </section>

        {/* Combat */}
        <section className="space-y-3">
          <h2 className="font-display text-xl tracking-wider text-primary">COMBAT</h2>
          <p className="font-body text-foreground leading-relaxed">
            Attacks hit automatically — just roll damage. Units behind other friendly units gain <strong>half cover</strong>, halving incoming damage (rounded down). When a unit reaches 0 HP, it dies and leaves a <strong>corpse marker</strong> that blocks movement.
          </p>
        </section>

        {/* Abilities */}
        <section className="space-y-3">
          <h2 className="font-display text-xl tracking-wider text-primary">SPECIAL ABILITIES</h2>
          <div className="space-y-2 font-body text-foreground text-sm leading-relaxed">
            <div className="bg-card border border-border rounded p-3">
              <strong className="font-display text-xs tracking-wider text-plague-light">FILTH SCORCH</strong>
              <span className="text-muted-foreground"> (Plague Medic)</span>
              <p>Remove a corpse marker from an adjacent tile and deal 2 damage to all adjacent enemies.</p>
            </div>
            <div className="bg-card border border-border rounded p-3">
              <strong className="font-display text-xs tracking-wider text-plague-light">FLAME OF WULFGRIM</strong>
              <span className="text-muted-foreground"> (Plague Heavy)</span>
              <p>Deal 1d4 damage in a 3-tile cone in the unit's facing direction.</p>
            </div>
            <div className="bg-card border border-border rounded p-3">
              <strong className="font-display text-xs tracking-wider text-plague-light">AURA OF DEATH</strong>
              <span className="text-muted-foreground"> (Plague Captain)</span>
              <p>All friendly units within 2 tiles gain +1 damage on their next attack.</p>
            </div>
            <div className="bg-card border border-border rounded p-3">
              <strong className="font-display text-xs tracking-wider text-bone-light">LAST RITE</strong>
              <span className="text-muted-foreground"> (Bone Medic)</span>
              <p>Once per game, save an adjacent friendly unit that would die, leaving it at 1 HP instead.</p>
            </div>
            <div className="bg-card border border-border rounded p-3">
              <strong className="font-display text-xs tracking-wider text-bone-light">FISTS OF MAGMA</strong>
              <span className="text-muted-foreground"> (Bone Heavy)</span>
              <p>Push an adjacent enemy 2 tiles away and pin them, preventing movement next activation.</p>
            </div>
            <div className="bg-card border border-border rounded p-3">
              <strong className="font-display text-xs tracking-wider text-bone-light">BANNER OF IRON FAITH</strong>
              <span className="text-muted-foreground"> (Bone Captain)</span>
              <p>All friendly units within 2 tiles gain +2 HP (cannot exceed max).</p>
            </div>
          </div>
        </section>

        <Separator className="bg-border" />

        {/* Winning */}
        <section className="space-y-3">
          <h2 className="font-display text-xl tracking-wider text-primary">WINNING THE GAME</h2>
          <p className="font-body text-foreground leading-relaxed">
            Destroy all enemy units to win. If your Captain falls, you may choose to <strong>forfeit</strong> — but only cowards surrender. Fight to the last.
          </p>
        </section>

        <Separator className="bg-border" />

        <div className="text-center pb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="font-display tracking-wider text-muted-foreground hover:text-foreground"
          >
            ← BACK TO MENU
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Rules;
