

# Prepare Multiplayer for Real Implementation with Supabase Realtime

Supabase can absolutely be self-hosted on a Linux VM — it's an open-source platform with official Docker Compose self-hosting support. For now we'll build against the Supabase client SDK, which works identically whether pointed at Supabase Cloud or a self-hosted instance.

## What changes

### 1. Define multiplayer types (`src/multiplayer/types.ts`)
Create clean TypeScript interfaces that will drive all multiplayer state:
- `Room` — id, name, host_id, host_name, is_private, room_code, status, created_at
- `RoomPlayer` — id, room_id, user_id, display_name, is_host, is_ready
- `MultiplayerUser` — id (from Supabase auth or anonymous), display_name

### 2. Set up Supabase tables & RLS
Create database tables via migration:
- **`rooms`** — stores room metadata (name, host, code, private flag, status)
- **`room_players`** — join table linking users to rooms with ready state
- RLS policies so players can only modify their own ready state, hosts can update/delete their rooms

### 3. Create a multiplayer context (`src/multiplayer/MultiplayerContext.tsx`)
A React context + provider that:
- Manages the current user identity (anonymous Supabase auth or display-name-based)
- Exposes functions: `createRoom`, `joinRoom`, `leaveRoom`, `setReady`, `listRooms`
- Subscribes to Supabase Realtime channels for live room/player updates

### 4. Rewrite Lobby page — remove all mock data
- Remove `INITIAL_ROOMS` and `MockRoom` interface
- Fetch rooms from Supabase on mount via the context
- Subscribe to realtime inserts/updates/deletes on the `rooms` table
- `handleCreateRoom` inserts into Supabase and navigates
- `handleJoin` inserts into `room_players` and navigates
- Room list updates live as other players create/join

### 5. Rewrite Room page — remove all mock data
- Remove hardcoded `players` array, `isHost = true`, `roomName = 'The Blood Pit'`
- Fetch room + players from Supabase on mount
- Subscribe to realtime changes on `room_players` for this room
- Ready toggle updates the player's row in Supabase
- Player list renders from live data
- "START GAME" checks both players are ready, updates room status

### 6. Update Entry page
- On "CONTINUE", create an anonymous Supabase session (or just store display name — auth can come later)
- Store user identity in the multiplayer context

### 7. Connect Supabase to the project
- Use Lovable's Supabase integration to provision the project
- The same Supabase client SDK will work when you later point it at a self-hosted instance by changing the URL and anon key

## Files created/modified

| File | Action |
|------|--------|
| `src/multiplayer/types.ts` | Create — shared interfaces |
| `src/multiplayer/MultiplayerContext.tsx` | Create — context + Supabase realtime logic |
| `supabase/migrations/001_multiplayer_rooms.sql` | Create — rooms + room_players tables + RLS |
| `src/pages/MultiplayerLobby.tsx` | Rewrite — remove mocks, use context |
| `src/pages/MultiplayerRoom.tsx` | Rewrite — remove mocks, use context |
| `src/pages/MultiplayerEntry.tsx` | Minor update — integrate with context |
| `src/App.tsx` | Wrap multiplayer routes in provider |

## What stays the same
- Local game (`/local`) — completely untouched
- Main menu, Rules page, "More Slatra" link — unchanged
- All visual styling and theme — preserved exactly

