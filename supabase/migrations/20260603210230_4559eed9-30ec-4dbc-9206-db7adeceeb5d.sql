CREATE OR REPLACE FUNCTION public.update_multiplayer_game(_game_id uuid, _state jsonb, _version integer, _user_id text)
 RETURNS games
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _current public.games;
  _game public.games;
  _current_player text;
  _expected_user text;
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

  -- Turn ownership: only the player whose turn it is in the CURRENT stored
  -- state may write the next state. Falls back to membership check (above)
  -- when currentPlayer is absent (e.g. game_over cleanup writes).
  _current_player := _current.state->>'currentPlayer';
  IF _current_player IN ('plague', 'bone') AND (_current.state->>'phase') <> 'game_over' THEN
    _expected_user := CASE _current_player
      WHEN 'plague' THEN _current.plague_player_id
      WHEN 'bone'   THEN _current.bone_player_id
    END;
    IF _user_id <> _expected_user THEN
      RAISE EXCEPTION 'Not your turn';
    END IF;
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
$function$;