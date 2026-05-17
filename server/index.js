// Mirror Sketch — Socket.io game server.
// Rooms hold up to 2 players, each with a chosen role (drawer | describer).
// Drawing strokes are relayed live from the drawer to the describer.
// Sling War rooms extend the room state with game phase + layout data.

const express = require('express');
const http = require('http');
const {Server} = require('socket.io');

const PORT = process.env.PORT || 3000;
const ORIGIN = process.env.ORIGIN || '*';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {origin: ORIGIN, methods: ['GET', 'POST']},
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

function makeDefaultGame(gameType) {
    if (gameType === 'sling-war') {
        return {
            phase: 'waiting',
            triviaTurn: 'player1',
            triviaAsked: false,
            battleActive: false,
            battleResult: null,
        };
    }
    return null;
}

function getPlayer(gameType, p) {
    let basicPlayer = {
        id: p.id,
        role: p.role,
    };

    if (gameType === "sling-war") {
        return {
            ...basicPlayer,
            ready: p.ready,
            layout: p.layout,
            awarded: p.awarded,
            points: p.points,
            powerUps: p.powerUps,
            heartsDestroyed: p.heartsDestroyed,
        };
    }

    return basicPlayer;
}

function publicRoomState(room) {
    return {
        code: room.code,
        sceneId: room.sceneId,
        spectator: room.spectator,
        players: room.players.map((p) => getPlayer(room.gameType, p)),
        game: room.game,
        gameType: room.gameType,
    };
}

function broadcastRoom(code) {
    const room = rooms.get(code);
    if (!room) return;
    io.to(code).emit('room:state', publicRoomState(room));
}

io.on('connection', (socket) => {
    let joinedCode = null;

    socket.on('room:create', (payload, ack) => {
        const gameType = payload?.gameType || 'mirror-sketch';
        const code = makeRoomCode();
        const room = {
            code,
            gameType,
            game: makeDefaultGame(gameType),
            players: [{id: socket.id, role: null}],
            sceneId: null,
            spectator: true,
            strokeHistory: [],
        };
        rooms.set(code, room);
        socket.join(code);
        joinedCode = code;
        ack?.({ok: true, code, you: socket.id, state: publicRoomState(room)});
        broadcastRoom(code);
    });

    socket.on('room:join', (payload, ack) => {
        const {code, gameType} = payload || {};
        const room = rooms.get(code);
        if (!room) return ack?.({ok: false, error: 'Room not found'});
        if (room.players.length >= 2) return ack?.({ok: false, error: 'Room is full'});
        room.players.push({id: socket.id, role: null});
        socket.join(code);
        joinedCode = code;
        ack?.({ok: true, code, you: socket.id, state: publicRoomState(room)});
        broadcastRoom(code);
    });

    socket.on('room:settings', (payload, ack) => {
        if (!joinedCode) return ack?.({ok: false, error: 'Not in a room'});
        const room = rooms.get(joinedCode);
        if (!room) return ack?.({ok: false, error: 'Room gone'});
        const me = room.players.find((p) => p.id === socket.id);
        if (!me || me.role !== 'describer') {
            return ack?.({ok: false, error: 'Only the describer can change this'});
        }
        room.spectator = !!payload?.spectator;
        ack?.({ok: true});
        broadcastRoom(joinedCode);
    });

    socket.on('role:choose', (payload, ack) => {
        if (!joinedCode) return ack?.({ok: false, error: 'Not in a room'});
        const room = rooms.get(joinedCode);
        if (!room) return ack?.({ok: false, error: 'Room gone'});
        if (payload?.role !== 'drawer' && payload?.role !== 'describer' && payload?.role !== 'player1' && payload?.role !== 'player2') {
            return ack?.({ok: false, error: 'Invalid role'});
        }
        const me = room.players.find((p) => p.id === socket.id);
        if (!me) {
            return ack?.({ok: false, error: 'Not in this room'});
        }
        // Auto-swap: if the partner already has this role and I have a role to give
        // back, hand them my old role so the room stays balanced (one of each).
        const other = room.players.find((p) => p.id !== socket.id && p.role === payload.role);
        if (other) {
            other.role = me.role !== null ? me.role : null;
            other.ready = false;
        }

        me.role = payload.role;
        me.ready = false;

        ack?.({ok: true});
        broadcastRoom(joinedCode);
    });

    socket.on('game:start', (payload, ack) => {
        if (!joinedCode) return ack?.({ok: false, error: 'Not in a room'});
        const room = rooms.get(joinedCode);
        if (!room) return ack?.({ok: false, error: 'Room gone'});
        const roles = new Set(room.players.map((p) => p.role));
        if (room.players.length < 2 || !roles.has('drawer') || !roles.has('describer')) {
            return ack?.({ok: false, error: 'Both roles must be picked first'});
        }
        room.sceneId = payload?.sceneId || null;
        room.strokeHistory = [];
        ack?.({ok: true});
        io.to(joinedCode).emit('game:started', {sceneId: room.sceneId, spectator: room.spectator});
        broadcastRoom(joinedCode);
    });

    // ─────────────────────────────────────────────
    // Sling War — game events
    // ─────────────────────────────────────────────

    // Player signals ready (during building or battle)
    socket.on('game:ready', () => {
        if (!joinedCode) {
            return;
        }

        const room = rooms.get(joinedCode);
        if (!room || !room.game) {
            return;
        }

        const currentPlayer = room.players.find((p) => p.id === socket.id);
        if (currentPlayer === null) {
            return ack?.({ok: false, error: 'Player not in the room'});
        }

        currentPlayer.ready = !currentPlayer.ready;
        // If all players ready, transition to building
        if (room.players.length === 2 && !room.players.some(p => !p.ready) && room.game.phase === 'waiting') {
            room.game.phase = 'building';
        }
        broadcastRoom(joinedCode);
    });

    // Player places a block during building
    socket.on('game:layout', (payload) => {
        if (!joinedCode) return;
        const room = rooms.get(joinedCode);
        if (!room || !room.game) return;
        const layout = payload?.layout;
        if (!layout) return;
        room.game.layouts = layout;
        broadcastRoom(joinedCode);
    });

    // Player confirms they asked their trivia question
    socket.on('game:trivia-asked', (payload) => {
        if (!joinedCode) return;
        const room = rooms.get(joinedCode);
        if (!room || !room.game) return;
        const slot = payload?.slot;
        if (!slot || slot !== 'p1' && slot !== 'p2') return;
        const askKey = slot === 'p1' ? 'p1' : 'p2';
        // Only allow if it's this player's trivia turn
        if (room.game.triviaTurn !== slot) return;
        room.game.triviaAsked = true;
        // Award point if the opponent's answer was correct
        const awardedKey = slot === 'p1' ? 'p1Awarded' : 'p2Awarded';
        const pointsKey = slot === 'p1' ? 'p1Points' : 'p2Points';
        // The opponent is the other slot — they answer, and we wait for award
        // Actually: slot asked, opponent answers, then anyone awards
        broadcastRoom(joinedCode);
    });

    // Award point to a player (triggered by the answering player confirming)
    socket.on('game:trivia-awarded', (payload) => {
        if (!joinedCode) return;
        const room = rooms.get(joinedCode);
        if (!room || !room.game) return;
        const toSlot = payload?.toSlot;
        if (!toSlot || toSlot !== 'p1' && toSlot !== 'p2') return;
        const pointsKey = toSlot === 'p1' ? 'p1Points' : 'p2Points';
        const powerUpKey = toSlot === 'p1' ? 'p1PowerUps' : 'p2PowerUps';
        room.game[pointsKey] += 1;
        room.game[powerUpKey] += 1;
        // Reset trivia state, swap turn
        room.game.triviaTurn = room.game.triviaTurn === 'p1' ? 'p2' : 'p1';
        room.game.triviaAsked = false;
        broadcastRoom(joinedCode);
    });

    // Player signals ready for battle
    socket.on('game:battle-ready', (payload) => {
        if (!joinedCode) return;
        const room = rooms.get(joinedCode);
        if (!room || !room.game) return;
        const slot = payload?.slot;
        if (!slot || slot !== 'p1' && slot !== 'p2') return;
        const key = slot === 'p1' ? 'p1Ready' : 'p2Ready';
        room.game[key] = true;
        // If both players ready and game was in building phase, start battle
        if (room.game.p1Ready && room.game.p2Ready && room.game.phase === 'battle') {
            room.game.battleActive = true;
        }
        broadcastRoom(joinedCode);
    });

    // Battle physics state sync (throttled on client side)
    socket.on('game:battle-sync', (payload) => {
        if (!joinedCode) return;
        const room = rooms.get(joinedCode);
        if (!room) return;
        // Forward to the other player
        const other = room.players.find((p) => p.id !== socket.id);
        if (other) {
            io.to(other.id).emit('game:battle-sync', payload);
        }
    });

    // Buy a power-up
    socket.on('game:power-up', (payload) => {
        if (!joinedCode) return;
        const room = rooms.get(joinedCode);
        if (!room || !room.game) return;
        const powerUpId = payload?.powerUpId;
        if (!powerUpId) return;
        const playerSlot = socket.id === room.players[0]?.id ? 'p1' : 'p2';
        const powerUpKey = playerSlot === 'p1' ? 'p1PowerUps' : 'p2PowerUps';
        const costMap = {heavy_ammo: 1, explosive_shot: 2};
        const cost = costMap[powerUpId] || 0;
        if (room.game[powerUpKey] < cost) return;
        room.game[powerUpKey] -= cost;
        broadcastRoom(joinedCode);
    });

    // Drawing relay — forward to everyone else in the room.
    // In surprise mode (spectator=false) the describer must not see strokes
    // until the reveal, so we buffer them server-side and replay on demand.
    socket.on('draw:stroke', (payload) => {
        if (!joinedCode) return;
        const room = rooms.get(joinedCode);
        if (!room) return;
        if (room.spectator) {
            socket.to(joinedCode).emit('draw:stroke', payload);
        } else {
            room.strokeHistory.push(payload);
        }
    });

    socket.on('draw:clear', () => {
        if (!joinedCode) return;
        const room = rooms.get(joinedCode);
        if (room) room.strokeHistory = [];
        io.to(joinedCode).emit('draw:clear');
    });

    // Drawer asked to undo their last stroke. In spectator mode the describer
    // is mirroring live and re-runs its own undo; in surprise mode the strokes
    // are buffered server-side, so we drop the trailing stroke group here.
    socket.on('draw:undo', () => {
        if (!joinedCode) return;
        const room = rooms.get(joinedCode);
        if (!room) return;
        if (room.spectator) {
            socket.to(joinedCode).emit('draw:undo');
        } else if (room.strokeHistory.length > 0) {
            const lastId = room.strokeHistory[room.strokeHistory.length - 1].strokeId;
            let cut = room.strokeHistory.length;
            while (cut > 0 && room.strokeHistory[cut - 1].strokeId === lastId) cut -= 1;
            room.strokeHistory = room.strokeHistory.slice(0, cut);
        }
    });

    socket.on('game:reveal', () => {
        if (!joinedCode) return;
        const room = rooms.get(joinedCode);
        if (!room) return;
        if (!room.spectator && room.strokeHistory.length > 0) {
            const describer = room.players.find((p) => p.role === 'describer');
            if (describer) io.to(describer.id).emit('draw:replay', room.strokeHistory);
        }
        io.to(joinedCode).emit('game:reveal');
    });

    socket.on('game:reset', () => {
        if (!joinedCode) return;
        const room = rooms.get(joinedCode);
        if (room) {
            room.sceneId = null;
            room.strokeHistory = [];
        }
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
            io.to(joinedCode).emit('peer:left', {id: socket.id});
            broadcastRoom(joinedCode);
        }
    });
});

app.get('/health', (_req, res) => res.json({ok: true, rooms: rooms.size}));

server.listen(PORT, () => {
    console.log(`[mirror-sketch] socket server listening on :${PORT}`);
});
