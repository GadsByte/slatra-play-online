CREATE TABLE public.games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL UNIQUE,
  state JSONB NOT NULL,
  plague_player_id TEXT NOT NULL,
  bone_player_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view games"
ON public.games
FOR SELECT
USING (true);

CREATE POLICY "Anyone can create games"
ON public.games
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update games"
ON public.games
FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete games"
ON public.games
FOR DELETE
USING (true);

ALTER TABLE public.games REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;

CREATE INDEX idx_games_room_id ON public.games(room_id);