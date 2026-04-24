CREATE OR REPLACE FUNCTION public.current_multiplayer_user_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    COALESCE(
      current_setting('request.headers', true)::json->>'x-slatra-user-id',
      current_setting('request.headers', true)::json->>'X-Slatra-User-Id'
    ),
    ''
  )
$$;

CREATE OR REPLACE FUNCTION public.is_room_player(_room_id uuid, _user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.room_players
    WHERE room_id = _room_id
      AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_room_host(_room_id uuid, _user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rooms
    WHERE id = _room_id
      AND host_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.can_create_multiplayer_game(
  _room_id uuid,
  _plague_player_id text,
  _bone_player_id text,
  _user_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND _plague_player_id <> _bone_player_id
    AND EXISTS (
      SELECT 1
      FROM public.rooms
      WHERE id = _room_id
        AND host_id = _user_id
        AND status = 'waiting'
        AND expires_at > now()
    )
    AND EXISTS (
      SELECT 1
      FROM public.room_players
      WHERE room_id = _room_id
        AND user_id = _plague_player_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.room_players
      WHERE room_id = _room_id
        AND user_id = _bone_player_id
    )
$$;

CREATE OR REPLACE FUNCTION public.can_modify_multiplayer_game(
  _game_id uuid,
  _room_id uuid,
  _plague_player_id text,
  _bone_player_id text,
  _user_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND _user_id IN (_plague_player_id, _bone_player_id)
    AND EXISTS (
      SELECT 1
      FROM public.games
      WHERE id = _game_id
        AND room_id = _room_id
        AND plague_player_id = _plague_player_id
        AND bone_player_id = _bone_player_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.rooms
      WHERE id = _room_id
        AND status IN ('waiting', 'in_game')
        AND expires_at > now()
    )
    AND EXISTS (
      SELECT 1
      FROM public.room_players
      WHERE room_id = _room_id
        AND user_id = _user_id
    )
$$;

DROP POLICY IF EXISTS "Anyone can create games" ON public.games;
DROP POLICY IF EXISTS "Anyone can update games" ON public.games;
DROP POLICY IF EXISTS "Anyone can delete games" ON public.games;
DROP POLICY IF EXISTS "Room hosts can create games" ON public.games;
DROP POLICY IF EXISTS "Assigned players can update games" ON public.games;
DROP POLICY IF EXISTS "Assigned players can delete games" ON public.games;

CREATE POLICY "Room hosts can create games"
ON public.games
FOR INSERT
WITH CHECK (
  public.can_create_multiplayer_game(
    room_id,
    plague_player_id,
    bone_player_id,
    public.current_multiplayer_user_id()
  )
);

CREATE POLICY "Assigned players can update games"
ON public.games
FOR UPDATE
USING (
  public.can_modify_multiplayer_game(
    id,
    room_id,
    plague_player_id,
    bone_player_id,
    public.current_multiplayer_user_id()
  )
)
WITH CHECK (
  public.can_modify_multiplayer_game(
    id,
    room_id,
    plague_player_id,
    bone_player_id,
    public.current_multiplayer_user_id()
  )
);

CREATE POLICY "Assigned players can delete games"
ON public.games
FOR DELETE
USING (
  public.can_modify_multiplayer_game(
    id,
    room_id,
    plague_player_id,
    bone_player_id,
    public.current_multiplayer_user_id()
  )
);