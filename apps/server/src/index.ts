import { createServer } from 'node:http';
import {
  ClientToServerEvents,
  HealthResponseDto,
  RoomId,
  ServerToClientEvents,
  SERVER_INFO,
} from '@slatra/shared';
import { Server } from 'socket.io';
import { getServerConfig } from './config.js';
import { MatchStore } from './matchStore.js';
import { RoomStore } from './roomStore.js';

const config = getServerConfig();
const store = new RoomStore();
const matchStore = new MatchStore();

const httpServer = createServer((request, response) => {
  if (request.url === '/health') {
    const payload: HealthResponseDto = {
      name: SERVER_INFO.name,
      status: 'ok',
      rooms: store.roomCount,
      connections: store.connectionCount,
      transport: 'socket.io',
    };

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(payload));
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ message: 'Not found' }));
});

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: config.clientOrigin,
  },
});

function cleanupRemovedMatches(roomIds: string[] = []) {
  roomIds.forEach(roomId => {
    matchStore.deleteMatch(roomId);
  });
}

function cleanupEndedMatches(roomIds: string[] = []) {
  roomIds.forEach(roomId => {
    matchStore.deleteMatch(roomId);
  });
}

function broadcastLobbyRooms() {
  io.emit('lobby:rooms', { rooms: store.listRooms() });
}

function emitRoomState(roomId: RoomId) {
  const room = store.getRoom(roomId);
  if (!room) return;
  io.to(roomId).emit('room:state', { room });
}

function emitMatchState(roomId: RoomId) {
  const match = matchStore.getMatch(roomId);
  if (!match) return;
  io.to(roomId).emit('match:state', { match });
}

io.on('connection', socket => {
  socket.emit('lobby:rooms', { rooms: store.listRooms() });

  socket.on('session:set-name', payload => {
    if (!payload.displayName.trim()) {
      socket.emit('room:error', { message: 'Display name is required.' });
      return;
    }

    const player = store.registerPlayer(socket.id, payload.displayName);
    socket.emit('session:ready', { player });
    const currentRoomId = store.getPlayer(socket.id)?.roomId;
    if (currentRoomId) {
      emitRoomState(currentRoomId);
      emitMatchState(currentRoomId);
    }
    broadcastLobbyRooms();
  });

  socket.on('lobby:list-rooms', () => {
    socket.emit('lobby:rooms', { rooms: store.listRooms() });
  });

  socket.on('room:create', payload => {
    const result = store.createRoom(socket.id, payload);
    if (result.error) {
      socket.emit('room:error', result.error);
      return;
    }
    if (!result.room) return;

    cleanupRemovedMatches(result.changes?.removedRoomIds);
    cleanupEndedMatches(result.changes?.clearedMatchRoomIds);

    if (result.changes?.leftRoomId) {
      socket.leave(result.changes.leftRoomId);
    }
    socket.join(result.room.id);
    result.changes?.updatedRoomIds.forEach(emitRoomState);
    broadcastLobbyRooms();
  });

  socket.on('room:join', payload => {
    const result = store.joinRoom(socket.id, payload);
    if (result.notFound) {
      socket.emit('room:not-found', { roomIdOrCode: payload.roomIdOrCode });
      return;
    }
    if (result.error) {
      socket.emit('room:error', result.error);
      return;
    }
    if (!result.room) return;

    cleanupRemovedMatches(result.changes?.removedRoomIds);
    cleanupEndedMatches(result.changes?.clearedMatchRoomIds);

    if (result.changes?.leftRoomId) {
      socket.leave(result.changes.leftRoomId);
    }
    socket.join(result.room.id);
    result.changes?.updatedRoomIds.forEach(emitRoomState);
    if (result.room.status === 'in_game') {
      emitMatchState(result.room.id);
    }
    broadcastLobbyRooms();
  });

  socket.on('room:leave', payload => {
    const result = store.leaveRoom(socket.id, payload.roomId);
    if (result.error) {
      socket.emit('room:error', result.error);
      return;
    }

    cleanupRemovedMatches(result.changes?.removedRoomIds);
    cleanupEndedMatches(result.changes?.clearedMatchRoomIds);

    if (result.roomId) {
      socket.leave(result.roomId);
    }

    result.changes?.updatedRoomIds.forEach(emitRoomState);
    broadcastLobbyRooms();
  });

  socket.on('room:set-ready', payload => {
    const result = store.setReady(socket.id, payload);
    if (result.error) {
      socket.emit('room:error', result.error);
      return;
    }
    if (!result.room) return;

    emitRoomState(result.room.id);
    broadcastLobbyRooms();
  });

  socket.on('room:start-match', payload => {
    const player = store.getPlayer(socket.id);
    if (!player) {
      socket.emit('match:error', { roomId: payload.roomId, message: 'Register a display name before starting a match.' });
      return;
    }

    const room = store.getRoom(payload.roomId);
    if (!room || !room.players.some(roomPlayer => roomPlayer.id === player.id)) {
      socket.emit('match:error', { roomId: payload.roomId, message: 'You are not in that room.' });
      return;
    }

    if (room.hostPlayerId !== player.id) {
      socket.emit('match:error', { roomId: payload.roomId, message: 'Only the host can start the match.' });
      return;
    }

    if (room.status === 'in_game' && room.activeMatchId) {
      emitRoomState(room.id);
      emitMatchState(room.id);
      return;
    }

    if (room.players.length !== room.maxPlayers) {
      socket.emit('match:error', { roomId: payload.roomId, message: 'Both players must be present before starting the match.' });
      return;
    }

    if (!room.players.every(roomPlayer => roomPlayer.ready)) {
      socket.emit('match:error', { roomId: payload.roomId, message: 'Both players must be ready before starting the match.' });
      return;
    }

    const match = matchStore.createMatch(room.id);
    const updatedRoom = store.markRoomInGame(room.id, match.id);
    if (!updatedRoom) {
      socket.emit('match:error', { roomId: payload.roomId, message: 'Unable to start the match right now.' });
      return;
    }

    emitRoomState(updatedRoom.id);
    emitMatchState(updatedRoom.id);
    broadcastLobbyRooms();
  });

  socket.on('disconnect', () => {
    const result = store.disconnect(socket.id);
    cleanupRemovedMatches(result.changes?.removedRoomIds);
    cleanupEndedMatches(result.changes?.clearedMatchRoomIds);
    result.changes?.updatedRoomIds.forEach(emitRoomState);
    broadcastLobbyRooms();
  });
});

httpServer.listen(config.port, () => {
  console.log(`[slatra-server] listening on http://localhost:${config.port}`);
});
