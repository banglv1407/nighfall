import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import { getUserById, getAllUsers } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: true, credentials: true } });

const PORT = process.env.PORT || 5050;
const JWT_SECRET = process.env.JWT_SECRET || 'nightfall-secret-change-in-prod';

// --- Express ---
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve frontend in production
const distPath = join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => res.sendFile(join(distPath, 'index.html')));

// --- Game State ---
const gameState = {
  phase: 'lobby', // lobby | day | night | vote | gameover
  players: {},    // socketId -> { id, username, gender, hairStyle, hairColor, x, y, isAdmin }
  roomCode: null,
  adminSocketId: null,
};

// --- Socket.IO Auth Middleware ---
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    socket.username = decoded.username;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const user = getUserById(socket.userId);
  if (!user) {
    socket.disconnect();
    return;
  }

  // Add player
  const player = {
    id: user.id,
    username: user.username,
    gender: user.gender,
    hairStyle: user.hair_style,
    hairColor: user.hair_color,
    isAdmin: !!user.is_admin,
    x: 400 + Math.random() * 200,
    y: 300 + Math.random() * 200,
    online: true,
  };

  gameState.players[socket.id] = player;

  // First admin to join gets admin
  if (user.is_admin && !gameState.adminSocketId) {
    gameState.adminSocketId = socket.id;
  }

  socket.join('village');

  // Tell everyone
  io.to('village').emit('game:state', getPublicState());

  socket.on('player:move', (data) => {
    const p = gameState.players[socket.id];
    if (p) {
      p.x = Math.max(0, Math.min(1200, data.x));
      p.y = Math.max(0, Math.min(800, data.y));
      socket.to('village').emit('player:moved', { id: socket.id, x: p.x, y: p.y });
    }
  });

  socket.on('player:interact', (data) => {
    // Emote / wave / action
    io.to('village').emit('player:action', {
      id: socket.id,
      action: data.action || 'wave',
      emoji: data.emoji || '👋',
    });
  });

  socket.on('admin:startGame', () => {
    if (gameState.players[socket.id]?.isAdmin) {
      gameState.phase = 'night';
      io.to('village').emit('game:phase', { phase: 'night' });
      io.to('village').emit('narration:display', {
        text: '🌙 Màn đêm buông xuống... Sói đang đói!',
        duration: 5000,
      });
    }
  });

  socket.on('admin:nextPhase', () => {
    if (gameState.players[socket.id]?.isAdmin) {
      const phases = ['lobby', 'night', 'day', 'vote', 'gameover'];
      const idx = phases.indexOf(gameState.phase);
      if (idx >= 0 && idx < phases.length - 1) {
        gameState.phase = phases[idx + 1];
        io.to('village').emit('game:phase', { phase: gameState.phase });
      }
    }
  });

  socket.on('admin:reset', () => {
    if (gameState.players[socket.id]?.isAdmin) {
      gameState.phase = 'lobby';
      io.to('village').emit('game:phase', { phase: 'lobby' });
      io.to('village').emit('narration:clear');
    }
  });

  socket.on('disconnect', () => {
    delete gameState.players[socket.id];
    if (gameState.adminSocketId === socket.id) {
      gameState.adminSocketId = null;
    }
    io.to('village').emit('game:state', getPublicState());
  });

  // Chat
  socket.on('chat:send', (data) => {
    const p = gameState.players[socket.id];
    if (p && data.text?.trim()) {
      io.to('village').emit('chat:message', {
        username: p.username,
        text: data.text.trim().slice(0, 200),
      });
    }
  });
});

function getPublicState() {
  return {
    phase: gameState.phase,
    players: Object.fromEntries(
      Object.entries(gameState.players).map(([sid, p]) => [
        sid,
        { id: p.id, username: p.username, gender: p.gender, hairStyle: p.hairStyle, hairColor: p.hairColor, x: p.x, y: p.y, isAdmin: p.isAdmin, online: p.online },
      ])
    ),
    adminSocketId: gameState.adminSocketId,
  };
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌙 Nightfall server on port ${PORT}`);
});
