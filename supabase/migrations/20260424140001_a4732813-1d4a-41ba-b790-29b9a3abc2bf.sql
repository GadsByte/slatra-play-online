-- Add a 60-minute expiry timestamp to multiplayer rooms.
ALTER TABLE public.rooms
ADD COLUMN expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '60 minutes');

-- Backfill existing rooms using their creation time so stale rooms become eligible for cleanup.
UPDATE public.rooms
SET expires_at = created_at + interval '60 minutes';

-- Speed up expiry checks.
CREATE INDEX idx_rooms_expires_at ON public.rooms (expires_at);

-- Ensure game rows are removed when their room is removed.
ALTER TABLE public.games
ADD CONSTRAINT games_room_id_fkey
FOREIGN KEY (room_id)
REFERENCES public.rooms(id)
ON DELETE CASCADE;

-- Delete expired rooms. Cascades clean up players and games.
CREATE OR REPLACE FUNCTION public.delete_expired_multiplayer_rooms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rooms
  WHERE expires_at <= now();
END;
$$;

-- Run expiry cleanup whenever rooms are read/created/updated through the app.
CREATE OR REPLACE FUNCTION public.cleanup_expired_multiplayer_rooms_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.delete_expired_multiplayer_rooms();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_expired_rooms_after_room_change ON public.rooms;
CREATE TRIGGER cleanup_expired_rooms_after_room_change
AFTER INSERT OR UPDATE ON public.rooms
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_expired_multiplayer_rooms_trigger();