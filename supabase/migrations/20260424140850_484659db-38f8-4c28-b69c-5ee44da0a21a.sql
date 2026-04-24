DROP POLICY IF EXISTS "Room hosts can create games" ON public.games;
DROP POLICY IF EXISTS "Assigned players can update games" ON public.games;
DROP POLICY IF EXISTS "Assigned players can delete games" ON public.games;

CREATE OR REPLACE FUNCTION public.create_multiplayer_game(
  _room_id uuid,
  _state jsonb,
  _plague_player_id text,
  _bone_player_id text,
  _user_id text
)
RETURNS public.games
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _game public.games;
BEGIN
  IF NOT public.can_create_multiplayer_game(_room_id, _plague_player_id, _bone_player_id, _user_id) THEN
    RAISE EXCEPTION 'Not allowed to create this game';
  END IF;

  INSERT INTO public.games (
    room_id,
    state,
    plague_player_id,
    bone_player_id,
    version,
    updated_at
  )
  VALUES (
    _room_id,
    _state,
    _plague_player_id,
    _bone_player_id,
    1,
    now()
  )
  ON CONFLICT (room_id)
  DO UPDATE SET
    state = EXCLUDED.state,
    plague_player_id = EXCLUDED.plague_player_id,
    bone_player_id = EXCLUDED.bone_player_id,
    version = 1,
    updated_at = now()
  RETURNING * INTO _game;

  RETURN _game;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_multiplayer_game(
  _game_id uuid,
  _state jsonb,
  _version integer,
  _user_id text
)
RETURNS public.games
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current public.games;
  _game public.games;
BEGIN
  SELECT * INTO _current
  FROM public.games
  WHERE id = _game_id;

  IF _current.id IS NULL THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  IF NOT public.can_modify_multiplayer_game(
    _current.id,
    _current.room_id,
    _current.plague_player_id,
    _current.bone_player_id,
    _user_id
  ) THEN
    RAISE EXCEPTION 'Not allowed to update this game';
  END IF;

  UPDATE public.games
  SET
    state = _state,
    version = _version,
    updated_at = now()
  WHERE id = _game_id
    AND version = _version - 1
  RETURNING * INTO _game;

  IF _game.id IS NULL THEN
    RAISE EXCEPTION 'Game version conflict';
  END IF;

  RETURN _game;
END;
$$;