// Mirror Sketch — Socket.io game server.
// Rooms hold up to 2 players, each with a chosen role (drawer | describer).
// Drawing strokes are relayed live from the drawer to the describer.

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const ORIGIN = process.env.ORIGIN || '*';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ORIGIN, methods: ['GET', 'POST'] },
});

/** @type {Map<string, Room>} */
const rooms = new Map();

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 4; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(code));
  return code;
}

function publicRoomState(room) {
  return {
    code: room.code,
    sceneId: room.sceneId,
    players: room.players.map((p) => ({ id: p.id, role: p.role })),
  };
}

function broadcastRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  io.to(code).emit('room:state', publicRoomState(room));
}

io.on('connection', (socket) => {
  let joinedCode = null;

  socket.on('room:create', (_payload, ack) => {
    const code = makeRoomCode();
    const room = { code, players: [{ id: socket.id, role: null }], sceneId: null };
    rooms.set(code, room);
    socket.join(code);
    joinedCode = code;
    ack?.({ ok: true, code, you: socket.id, state: publicRoomState(room) });
  });

  socket.on('room:join', ({ code }, ack) => {
    const room = rooms.get(code);
    if (!room) return ack?.({ ok: false, error: 'Room not found' });
    if (room.players.length >= 2) return ack?.({ ok: false, error: 'Room is full' });
    room.players.push({ id: socket.id, role: null });
    socket.join(code);
    joinedCode = code;
    ack?.({ ok: true, code, you: socket.id, state: publicRoomState(room) });
    broadcastRoom(code);
  });

  socket.on('role:choose', ({ role }, ack) => {
    if (!joinedCode) return ack?.({ ok: false, error: 'Not in a room' });
    const room = rooms.get(joinedCode);
    if (!room) return ack?.({ ok: false, error: 'Room gone' });
    if (role !== 'drawer' && role !== 'describer') {
      return ack?.({ ok: false, error: 'Invalid role' });
    }
    if (room.players.some((p) => p.id !== socket.id && p.role === role)) {
      return ack?.({ ok: false, error: 'Role already taken' });
    }
    const me = room.players.find((p) => p.id === socket.id);
    if (me) me.role = role;
    ack?.({ ok: true });
    broadcastRoom(joinedCode);
  });

  socket.on('game:start', ({ sceneId }, ack) => {
    if (!joinedCode) return ack?.({ ok: false, error: 'Not in a room' });
    const room = rooms.get(joinedCode);
    if (!room) return ack?.({ ok: false, error: 'Room gone' });
    const roles = new Set(room.players.map((p) => p.role));
    if (room.players.length < 2 || !roles.has('drawer') || !roles.has('describer')) {
      return ack?.({ ok: false, error: 'Both roles must be picked first' });
    }
    room.sceneId = sceneId || null;
    ack?.({ ok: true });
    io.to(joinedCode).emit('game:started', { sceneId: room.sceneId });
    broadcastRoom(joinedCode);
  });

  // Drawing relay — forward to everyone else in the room.
  socket.on('draw:stroke', (payload) => {
    if (!joinedCode) return;
    socket.to(joinedCode).emit('draw:stroke', payload);
  });

  socket.on('draw:clear', () => {
    if (!joinedCode) return;
    io.to(joinedCode).emit('draw:clear');
  });

  socket.on('game:reveal', () => {
    if (!joinedCode) return;
    io.to(joinedCode).emit('game:reveal');
  });

  socket.on('game:reset', () => {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    if (room) room.sceneId = null;
    io.to(joinedCode).emit('game:reset');
    broadcastRoom(joinedCode);
  });

  socket.on('disconnect', () => {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room) return;
    room.players = room.players.filter((p) => p.id !== socket.id);
    if (room.players.length === 0) {
      rooms.delete(joinedCode);
    } else {
      io.to(joinedCode).emit('peer:left', { id: socket.id });
      broadcastRoom(joinedCode);
    }
  });
});

app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

server.listen(PORT, () => {
  console.log(`[mirror-sketch] socket server listening on :${PORT}`);
});
