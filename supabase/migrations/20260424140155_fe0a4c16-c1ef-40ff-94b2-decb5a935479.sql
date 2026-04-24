-- Ensure room player entries are removed when their room is removed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'room_players'
      AND constraint_name = 'room_players_room_id_fkey'
  ) THEN
    ALTER TABLE public.room_players
    ADD CONSTRAINT room_players_room_id_fkey
    FOREIGN KEY (room_id)
    REFERENCES public.rooms(id)
    ON DELETE CASCADE;
  END IF;
END;
$$;