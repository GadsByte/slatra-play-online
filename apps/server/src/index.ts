import { createServer } from 'node:http';
import {
  ClientToServerEvents,
  HealthResponseDto,
  RoomId,
  ServerToClientEvents,
  SERVER_INFO,
} from '@slatra/shared';
import { Server } from 'socket.io';
import { getServerConfig } from './config';
import { RoomStore } from './roomStore';

const config = getServerConfig();
const store = new RoomStore();

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

function broadcastLobbyRooms() {
  io.emit('lobby:rooms', { rooms: store.listRooms() });
}

function emitRoomState(roomId: RoomId) {
  const room = store.getRoom(roomId);
  if (!room) return;
  io.to(roomId).emit('room:state', { room });
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

    if (result.changes?.leftRoomId) {
      socket.leave(result.changes.leftRoomId);
    }
    socket.join(result.room.id);
    result.changes?.updatedRoomIds.forEach(emitRoomState);
    broadcastLobbyRooms();
  });

  socket.on('room:leave', payload => {
    const result = store.leaveRoom(socket.id, payload.roomId);
    if (result.error) {
      socket.emit('room:error', result.error);
      return;
    }

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

  socket.on('disconnect', () => {
    const result = store.disconnect(socket.id);
    result.changes?.updatedRoomIds.forEach(emitRoomState);
    broadcastLobbyRooms();
  });
});

httpServer.listen(config.port, () => {
  console.log(`[slatra-server] listening on http://localhost:${config.port}`);
});
