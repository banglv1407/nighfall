import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import { getUserById } from './db.js';
import { getRandomNarration } from './narration.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: true, credentials: true } });

const PORT = process.env.PORT || 5050;
const JWT_SECRET = process.env.JWT_SECRET || 'nightfall-secret-change-in-prod';

// --- Express Setup ---
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve frontend in production
const distPath = join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => res.sendFile(join(distPath, 'index.html')));

// --- Master Game State ---
const gameState = {
  phase: 'lobby',      // lobby | night | day | vote | defense | revote | gameover
  players: {},          // socketId -> Player details
  adminSocketId: null,
  nightNumber: 0,
  dayNumber: 0,
  
  // Realtime game session stats
  roleAssignments: {},  // role -> list of socketIds
  nightActions: {
    werewolfTarget: null,
    seerTarget: null,
    guardTarget: null,
    witchHeal: false,
    witchPoison: null,
    cupidLover1: null,
    cupidLover2: null,
    witchDone: false,
    cupidDone: false,
  },
  lastNextPhaseClickTime: 0,
  
  // Witch inventory tracking
  witchHasHeal: true,
  witchHasPoison: true,
  
  // Last night casualties
  lastNightCasualties: [],
  
  // Discussion / Voting data
  votes: {},            // voterSocketId -> targetSocketId
  defendantSocketId: null,
  revotes: {},          // voterSocketId -> 'kill' | 'save'
  
  // Chat cooldown track
  chatCooldowns: {},    // socketId -> timestamp of last message
  historyLogs: [],
};

// --- Socket.IO Handshake JWT Validation ---
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token provided'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    socket.username = decoded.username;
    next();
  } catch {
    next(new Error('Invalid authorization token'));
  }
});

io.on('connection', (socket) => {
  const user = getUserById(socket.userId);
  if (!user) {
    socket.disconnect();
    return;
  }

  // Check if this user was already in the game state (e.g. reconnected under a new socket.id)
  let existingSocketId = Object.keys(gameState.players).find(
    sid => gameState.players[sid].id === user.id
  );

  let player;
  if (existingSocketId) {
    // Reconnection! Migrate the player object to the new socket.id
    player = gameState.players[existingSocketId];
    player.online = true;
    
    // Update reference to the new socket.id
    delete gameState.players[existingSocketId];
    gameState.players[socket.id] = player;

    console.log(`🔌 Player reconnected: ${player.username} (migrated from ${existingSocketId} to ${socket.id})`);
    
    // Update lover's pointer to the new socket.id if linked
    Object.keys(gameState.players).forEach(sid => {
      if (gameState.players[sid].loverId === existingSocketId) {
        gameState.players[sid].loverId = socket.id;
      }
    });

    // Update active night action targets to the new socket.id
    if (gameState.nightActions.werewolfTarget === existingSocketId) {
      gameState.nightActions.werewolfTarget = socket.id;
    }
    if (gameState.nightActions.seerTarget === existingSocketId) {
      gameState.nightActions.seerTarget = socket.id;
    }
    if (gameState.nightActions.guardTarget === existingSocketId) {
      gameState.nightActions.guardTarget = socket.id;
    }
    if (gameState.nightActions.witchPoison === existingSocketId) {
      gameState.nightActions.witchPoison = socket.id;
    }
    if (gameState.nightActions.cupidLover1 === existingSocketId) {
      gameState.nightActions.cupidLover1 = socket.id;
    }
    if (gameState.nightActions.cupidLover2 === existingSocketId) {
      gameState.nightActions.cupidLover2 = socket.id;
    }

    // Update votes/revotes with the new socket.id
    if (gameState.votes[existingSocketId]) {
      gameState.votes[socket.id] = gameState.votes[existingSocketId];
      delete gameState.votes[existingSocketId];
    }
    Object.keys(gameState.votes).forEach(voterId => {
      if (gameState.votes[voterId] === existingSocketId) {
        gameState.votes[voterId] = socket.id;
      }
    });

    if (gameState.revotes[existingSocketId]) {
      gameState.revotes[socket.id] = gameState.revotes[existingSocketId];
      delete gameState.revotes[existingSocketId];
    }

    if (gameState.defendantSocketId === existingSocketId) {
      gameState.defendantSocketId = socket.id;
    }

    // If they were admin, update adminSocketId
    if (player.isAdmin) {
      gameState.adminSocketId = socket.id;
    }
  } else {
    // New connection! Setup dynamic player profile
    player = {
      id: user.id,
      username: user.username,
      gender: user.gender,
      hairStyle: user.hair_style,
      hairColor: user.hair_color,
      isAdmin: !!user.is_admin,
      x: (Math.random() - 0.5) * 8,
      y: (Math.random() - 0.5) * 8,
      online: true,
      
      // In-game stats
      isAlive: true,
      role: user.is_admin ? 'spectator' : 'villager',
      loverId: null,      // SocketId of partner if linked by Cupid
      guardLastProtected: null,
    };

    gameState.players[socket.id] = player;

    // First admin connection claims Host
    if (user.is_admin && !gameState.adminSocketId) {
      gameState.adminSocketId = socket.id;
    }

    console.log(`🔌 Player connected: ${player.username} (${socket.id})`);
  }

  socket.join('village');
  io.to('village').emit('game:state', getPublicState());

  // --- MOVEMENT HANDLER ---
  socket.on('player:move', (data) => {
    const p = gameState.players[socket.id];
    if (p && p.isAlive && gameState.phase !== 'defense') {
      p.x = Math.max(-22, Math.min(22, data.x));
      p.y = Math.max(-22, Math.min(22, data.y));
      socket.to('village').emit('player:moved', { id: socket.id, x: p.x, y: p.y });
    }
  });

  // --- EMOTES ---
  socket.on('player:interact', (data) => {
    const p = gameState.players[socket.id];
    if (p && p.isAlive) {
      io.to('village').emit('player:action', {
        id: socket.id,
        action: data.action || 'wave',
        emoji: data.emoji || '👋',
      });
    }
  });

  // --- REAL-TIME SERVER-AUTHORITATIVE VOICE STREAM BROADCAST ---
  socket.on('voice:stream', (buffer) => {
    const sender = gameState.players[socket.id];
    if (!sender) return;

    // Stream binary voice chunks to eligible village players based on active phase rules
    Object.keys(gameState.players).forEach(sid => {
      if (sid === socket.id) return; // Do not echo back to sender
      const receiver = gameState.players[sid];
      if (!receiver || !receiver.online) return;

      // Rule 1: Dead players are muted to the living, and can only talk in the Spirit World (Ghost chat)
      if (!sender.isAlive) {
        if (!receiver.isAlive) {
          io.to(sid).emit('voice:broadcast', { senderId: socket.id, buffer });
        }
        return;
      }

      // Rule 2: Living players cannot hear whispers of the dead
      if (!receiver.isAlive) return;

      // Rule 3: Ban Đêm (Night Phase) -> Only Werewolves can talk & coordinate together in private channels
      if (gameState.phase === 'night') {
        if (sender.role === 'werewolf' && receiver.role === 'werewolf') {
          io.to(sid).emit('voice:broadcast', { senderId: socket.id, buffer });
        }
        return;
      }

      // Rule 4: Biện Hộ (Defense Phase) -> Only the designated defendant is unmuted to defend themselves
      if (gameState.phase === 'defense') {
        if (socket.id === gameState.defendantSocketId) {
          io.to(sid).emit('voice:broadcast', { senderId: socket.id, buffer });
        }
        return;
      }

      // Default (Day, Vote, Lobby, GameOver) -> All living players can speak and hear each other in real-time
      io.to(sid).emit('voice:broadcast', { senderId: socket.id, buffer });
    });
  });

  // --- SECURE NIGHT GAME ACTIONS ---
  socket.on('game:action', (data) => {
    const p = gameState.players[socket.id];
    if (!p || !p.isAlive || gameState.phase !== 'night') return;
    
    const { actionType, targetId } = data; // targetId is socketId of target player
    const targetPlayer = gameState.players[targetId];
    if (!targetPlayer && actionType !== 'witch_pass' && actionType !== 'witch_heal' && actionType !== 'cupid_link') return;

    if (targetPlayer && (targetPlayer.role === 'spectator' || targetPlayer.isAdmin) && actionType !== 'witch_pass' && actionType !== 'witch_heal') {
      socket.emit('error', { message: 'Không thể tương tác với Quản Trò!' });
      return;
    }

    console.log(`🎮 Game action by ${p.username} (${p.role}): ${actionType} -> ${targetPlayer ? targetPlayer.username : 'None'}`);

    switch (p.role) {
      case 'seer':
        if (actionType === 'seer_inspect' && targetPlayer && targetPlayer.isAlive) {
          gameState.nightActions.seerTarget = targetId;
          const isWolf = targetPlayer.role === 'werewolf';
          socket.emit('action:result', {
            success: true,
            text: `🔮 Kết quả soi: ${targetPlayer.username} là ${isWolf ? '🐺 PHE SÓI' : '👤 PHE DÂN'}!`,
          });
          logSystemMsg(`[Tiên Tri] đã soi cầu ${targetPlayer.username}.`);
        }
        break;

      case 'guard':
        if (actionType === 'guard_protect' && targetPlayer && targetPlayer.isAlive) {
          if (p.guardLastProtected === targetId) {
            socket.emit('error', { message: 'Không thể bảo vệ cùng một người 2 đêm liên tiếp!' });
            return;
          }
          gameState.nightActions.guardTarget = targetId;
          p.guardLastProtected = targetId;
          socket.emit('action:result', {
            success: true,
            text: `🛡️ Bạn đã chọn bảo vệ ${targetPlayer.username} đêm nay.`,
          });
          logSystemMsg(`[Bảo Vệ] đã bảo vệ ${targetPlayer.username}.`);
        }
        break;

      case 'werewolf':
        if (actionType === 'werewolf_kill' && targetPlayer && targetPlayer.isAlive) {
          gameState.nightActions.werewolfTarget = targetId;
          // Notify other wolves of selection
          Object.keys(gameState.players).forEach(sid => {
            if (gameState.players[sid].role === 'werewolf' && sid !== socket.id) {
              io.to(sid).emit('werewolf:voteUpdate', { targetId, voter: p.username });
            }
          });
          socket.emit('action:result', {
            success: true,
            text: `🐺 Bạn đã vote cắn chết ${targetPlayer.username}.`,
          });
          logSystemMsg(`[Đàn Sói] chọn cắn ${targetPlayer.username}.`);
          
          // Witch updates about target
          syncWitchPrompts();
        }
        break;

      case 'witch':
        if (actionType === 'witch_heal' && gameState.witchHasHeal) {
          gameState.nightActions.witchHeal = true;
          gameState.nightActions.witchDone = true;
          socket.emit('action:result', { success: true, text: '🧙 Bạn đã dùng BÌNH CỨU đêm nay.' });
          logSystemMsg(`[Phù Thủy] dùng bình cứu.`);
        } else if (actionType === 'witch_poison' && gameState.witchHasPoison && targetPlayer && targetPlayer.isAlive) {
          gameState.nightActions.witchPoison = targetId;
          gameState.nightActions.witchDone = true;
          socket.emit('action:result', { success: true, text: `🧙 Bạn đã dùng BÌNH ĐỘC lên ${targetPlayer.username}.` });
          logSystemMsg(`[Phù Thủy] dùng bình độc lên ${targetPlayer.username}.`);
        } else if (actionType === 'witch_pass') {
          gameState.nightActions.witchDone = true;
          socket.emit('action:result', { success: true, text: '🧙 Bạn quyết định không dùng thuốc đêm nay.' });
        }
        break;

      case 'cupid':
        if (actionType === 'cupid_link' && gameState.nightNumber === 1) {
          const { loverId1, loverId2 } = data;
          if (gameState.players[loverId1] && gameState.players[loverId2]) {
            gameState.nightActions.cupidLover1 = loverId1;
            gameState.nightActions.cupidLover2 = loverId2;
            gameState.players[loverId1].loverId = loverId2;
            gameState.players[loverId2].loverId = loverId1;
            gameState.nightActions.cupidDone = true;
            
            socket.emit('action:result', { success: true, text: '💘 Bạn đã kết duyên cho hai người thành đôi.' });
            
            // Notify lovers
            io.to(loverId1).emit('lover:reveal', { partnerUsername: gameState.players[loverId2].username });
            io.to(loverId2).emit('lover:reveal', { partnerUsername: gameState.players[loverId1].username });
            logSystemMsg(`[Cupid] ghép đôi ${gameState.players[loverId1].username} và ${gameState.players[loverId2].username}.`);
          }
        }
        break;
    }
  });

  // --- DAYTIME VOTES CAST ---
  socket.on('vote:cast', (data) => {
    const p = gameState.players[socket.id];
    if (!p || !p.isAlive || gameState.phase !== 'vote') return;

    const { targetPlayerId } = data; // targetPlayerId is socket.id of target
    if (targetPlayerId === socket.id) {
      socket.emit('error', { message: 'Bạn không thể tự vote chính mình!' });
      return;
    }

    if (targetPlayerId) {
      const targetPlayer = gameState.players[targetPlayerId];
      if (targetPlayer && (targetPlayer.role === 'spectator' || targetPlayer.isAdmin)) {
        socket.emit('error', { message: 'Không thể bỏ phiếu cho Quản Trò!' });
        return;
      }
      gameState.votes[socket.id] = targetPlayerId;
    } else {
      delete gameState.votes[socket.id];
    }

    // Broadcast realtime voting statistics
    io.to('village').emit('vote:update', getVoteCounts());
  });

  // --- REVOTE (KILL OR CỨU) ---
  socket.on('vote:revote', (data) => {
    const p = gameState.players[socket.id];
    if (!p || !p.isAlive || gameState.phase !== 'revote') return;
    if (socket.id === gameState.defendantSocketId) {
      socket.emit('error', { message: 'Bị cáo không được biểu quyết!' });
      return;
    }

    const { action } = data; // 'kill' | 'save'
    if (action === 'kill' || action === 'save') {
      gameState.revotes[socket.id] = action;
    }

    // Broadcast revote stats
    io.to('village').emit('revote:update', getRevoteCounts());
  });

  // --- CHAT WITH RULES & COOLDOWNS ---
  socket.on('chat:send', (data) => {
    const p = gameState.players[socket.id];
    if (!p || !data.text?.trim()) return;

    // 1. Dead players chat room filter (ghost room)
    if (!p.isAlive) {
      socket.emit('chat:message', { username: '👻 Hệ Thống Linh Hồn', text: 'Bạn đã chết! Chỉ các linh hồn khác mới nghe thấy tiếng thì thầm.' });
      Object.keys(gameState.players).forEach(sid => {
        if (!gameState.players[sid].isAlive) {
          io.to(sid).emit('chat:message', { username: `👻 ${p.username} (Linh Hồn)`, text: data.text.trim().slice(0, 200) });
        }
      });
      return;
    }

    // 2. Chat blocks in Night Phase (except Werewolves whispering)
    if (gameState.phase === 'night') {
      if (p.role === 'werewolf') {
        // Send werewolf secret channels
        Object.keys(gameState.players).forEach(sid => {
          if (gameState.players[sid].role === 'werewolf') {
            io.to(sid).emit('chat:message', { username: `🐺 Sói ${p.username}`, text: data.text.trim().slice(0, 200) });
          }
        });
      } else {
        socket.emit('error', { message: 'Trời tối rồi, dân làng không thể giao tiếp!' });
      }
      return;
    }

    // 3. Defense Phase strict restriction (only defendant talks)
    if (gameState.phase === 'defense' && socket.id !== gameState.defendantSocketId) {
      socket.emit('error', { message: 'Bị cáo đang biện hộ, vui lòng giữ im lặng!' });
      return;
    }

    // 4. Rate limiting - 10 seconds cooldown
    const now = Date.now();
    const lastMsgTime = gameState.chatCooldowns[socket.id] || 0;
    if (now - lastMsgTime < 10000 && !p.isAdmin) {
      const remaining = Math.ceil((10000 - (now - lastMsgTime)) / 1000);
      socket.emit('error', { message: `Bạn gửi tin nhắn quá nhanh! Vui lòng đợi ${remaining}s.` });
      return;
    }

    gameState.chatCooldowns[socket.id] = now;

    // Normal broadcast
    io.to('village').emit('chat:message', {
      username: p.username,
      text: data.text.trim().slice(0, 200),
    });
  });

  // --- ADMIN PHASE OVERRIDES ---
  socket.on('admin:startGame', () => {
    if (gameState.players[socket.id]?.isAdmin && gameState.phase === 'lobby') {
      startGameSession();
    }
  });

  socket.on('admin:nextPhase', () => {
    if (gameState.players[socket.id]?.isAdmin) {
      const incomplete = checkIncompleteActions();
      const now = Date.now();
      const lastClick = gameState.lastNextPhaseClickTime || 0;
      
      if (incomplete && (now - lastClick > 4000)) {
        gameState.lastNextPhaseClickTime = now;
        socket.emit('error', { 
          message: `Chưa đủ hành động! ${incomplete} Bấm Next Phase một lần nữa trong vòng 4 giây để bắt buộc qua màn.` 
        });
        return;
      }
      
      gameState.lastNextPhaseClickTime = 0;
      advanceGamePhase();
    }
  });

  socket.on('admin:reset', () => {
    if (gameState.players[socket.id]?.isAdmin) {
      resetGameSession();
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Player disconnected: ${player.username} (${socket.id})`);
    
    const p = gameState.players[socket.id];
    if (p) {
      if (gameState.phase === 'lobby') {
        // In lobby phase, players can join/leave freely
        delete gameState.players[socket.id];
        delete gameState.chatCooldowns[socket.id];
        
        if (gameState.adminSocketId === socket.id) {
          gameState.adminSocketId = Object.keys(gameState.players).find(sid => gameState.players[sid].isAdmin) || null;
        }
      } else {
        // During an active game, just mark them as offline to preserve their role, coords, and state
        p.online = false;
      }
    }

    io.to('village').emit('game:state', getPublicState());
  });
});

// --- HELPER FUNCTION: GET REAL-TIME VOTE MAPS ---
function getVoteCounts() {
  const counts = {};
  Object.values(gameState.votes).forEach(targetId => {
    counts[targetId] = (counts[targetId] || 0) + 1;
  });
  return { votes: gameState.votes, counts };
}

function getRevoteCounts() {
  const killVotes = Object.values(gameState.revotes).filter(v => v === 'kill').length;
  const saveVotes = Object.values(gameState.revotes).filter(v => v === 'save').length;
  return { revotes: gameState.revotes, killVotes, saveVotes };
}

// --- HELPER: LOG SECRET GAME AUDITS TO ADMIN ---
function logSystemMsg(text) {
  console.log(`[SYS] ${text}`);
  if (gameState.adminSocketId) {
    io.to(gameState.adminSocketId).emit('chat:message', {
      username: '⚙️ LOG ADMIN',
      text,
    });
  }
}

// --- SECURE AUTHENTICATED STATE OUTPUT ---
function getPublicState() {
  return {
    phase: gameState.phase,
    players: Object.fromEntries(
      Object.entries(gameState.players).map(([sid, p]) => [
        sid,
        {
          id: p.id,
          username: p.username,
          gender: p.gender,
          hairStyle: p.hairStyle,
          hairColor: p.hairColor,
          x: p.x,
          y: p.y,
          isAdmin: p.isAdmin,
          online: p.online,
          
          // Secure fields visible to others
          isAlive: p.isAlive,
          loverId: p.loverId, 
          role: p.role === 'spectator' ? 'spectator' : undefined,
          isBot: p.isBot,
        },
      ])
    ),
    adminSocketId: gameState.adminSocketId,
    defendantSocketId: gameState.defendantSocketId,
    votes: getVoteCounts().votes,
    voteCounts: getVoteCounts().counts,
    revotes: getRevoteCounts(),
  };
}

// --- GAME LOGIC: SESSION LAUNCHER ---
function startGameSession() {
  const initialSids = Object.keys(gameState.players);
  if (initialSids.length === 0) return;

  const realPlayers = initialSids.filter(sid => !gameState.players[sid].isAdmin);
  let total = realPlayers.length;

  // Add bots if total real players is less than 10
  if (total < 10) {
    const botsNeeded = 10 - total;
    console.log(`🤖 Seeding ${botsNeeded} bots to reach minimum of 10 players.`);
    
    const botNames = [
      "Linh_Hồn_Gió", "Sói_Cô_Độc", "Thợ_Săn_Bão", "Phù_Thủy_Đá", 
      "Bác_Thợ_Rèn", "Chị_May_Vá", "Dân_Chài_Anh", "Cô_Bán_Hoa", 
      "Trưởng_Làng_Lão", "Thầy_Cúng_Nam", "Chú_Tiều_Phu", "Cô_Thủ_Thư",
      "Anh_Lính_Gác", "Bác_Sĩ_Tâm", "Thầy_Đồ_Nho", "Bé_Bán_Diêm"
    ];
    
    // Shuffle bot names
    const shuffledNames = botNames.sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < botsNeeded; i++) {
      const botId = `bot_${Math.random().toString(36).substr(2, 9)}`;
      const name = shuffledNames[i % shuffledNames.length];
      const genders = ["male", "female"];
      const hairStyles = ["short", "long", "ponytail", "curly", "bun", "mohawk", "wavy"];
      const hairColors = ["#1a1a1a", "#d97706", "#991b1b", "#2563eb", "#059669", "#7c3aed"];
      
      gameState.players[botId] = {
        id: botId,
        username: `🤖 ${name}`,
        gender: genders[Math.floor(Math.random() * genders.length)],
        hairStyle: hairStyles[Math.floor(Math.random() * hairStyles.length)],
        hairColor: hairColors[Math.floor(Math.random() * hairColors.length)],
        isAdmin: false,
        x: (Math.random() - 0.5) * 12,
        y: (Math.random() - 0.5) * 12,
        online: true,
        isAlive: true,
        role: 'villager',
        loverId: null,
        guardLastProtected: null,
        isBot: true,
      };
    }
  }

  // Recalculate player list including bots
  const sids = Object.keys(gameState.players);
  const playerSids = sids.filter(sid => !gameState.players[sid].isAdmin);
  total = playerSids.length;

  console.log(`🚀 Starting game session with ${total} players (including bots, excluding Host).`);
  logSystemMsg(`Bắt đầu chia bài cho ${total} người chơi (bao gồm cả Bots).`);

  // 1. Reset dynamic stats
  gameState.nightNumber = 0;
  gameState.dayNumber = 0;
  gameState.witchHasHeal = true;
  gameState.witchHasPoison = true;
  gameState.historyLogs = [];
  
  sids.forEach(sid => {
    gameState.players[sid].isAlive = true;
    gameState.players[sid].loverId = null;
    gameState.players[sid].guardLastProtected = null;
    if (gameState.players[sid].isAdmin) {
      gameState.players[sid].role = 'spectator';
    } else {
      gameState.players[sid].role = 'villager';
    }
  });

  // 2. Distribute Roles (Dynamic ratio with fallback for developers' solo/duo testing)
  if (total === 0 && gameState.adminSocketId) {
    // Solo test fallback: Host is Werewolf
    gameState.players[gameState.adminSocketId].role = 'werewolf';
  } else {
    const shuffled = [...playerSids].sort(() => Math.random() - 0.5);
    
    if (total === 1) {
      gameState.players[shuffled[0]].role = 'werewolf';
    } else if (total === 2) {
      gameState.players[shuffled[0]].role = 'werewolf';
      gameState.players[shuffled[1]].role = 'seer';
    } else if (total === 3) {
      gameState.players[shuffled[0]].role = 'werewolf';
      gameState.players[shuffled[1]].role = 'seer';
      gameState.players[shuffled[2]].role = 'witch';
    } else if (total === 4) {
      gameState.players[shuffled[0]].role = 'werewolf';
      gameState.players[shuffled[1]].role = 'seer';
      gameState.players[shuffled[2]].role = 'witch';
      gameState.players[shuffled[3]].role = 'guard';
    } else if (total === 5) {
      gameState.players[shuffled[0]].role = 'werewolf';
      gameState.players[shuffled[1]].role = 'seer';
      gameState.players[shuffled[2]].role = 'witch';
      gameState.players[shuffled[3]].role = 'guard';
      gameState.players[shuffled[4]].role = 'hunter';
    } else {
      // >=6 Standard Distribution rules
      let wolvesCount = 2;
      if (total >= 13) wolvesCount = 3;
      if (total >= 17) wolvesCount = 4;
      if (total >= 23) wolvesCount = 5;

      let index = 0;
      // Werewolves
      for (let i = 0; i < wolvesCount; i++) {
        gameState.players[shuffled[index++]].role = 'werewolf';
      }
      // Seer
      gameState.players[shuffled[index++]].role = 'seer';
      // Guard
      gameState.players[shuffled[index++]].role = 'guard';
      // Witch
      gameState.players[shuffled[index++]].role = 'witch';
      
      // Hunter (>=9 players)
      if (total >= 9) {
        gameState.players[shuffled[index++]].role = 'hunter';
        // Cupid (>=9 players)
        gameState.players[shuffled[index++]].role = 'cupid';
      }
      // Angel (>=13 players)
      if (total >= 13) {
        gameState.players[shuffled[index++]].role = 'angel';
        gameState.players[shuffled[index++]].role = 'elder';
      }
      // Jester (>=17 players)
      if (total >= 17) {
        gameState.players[shuffled[index++]].role = 'jester';
      }
    }
  }

  // 3. Reveal private roles to each socket individually
  Object.keys(gameState.players).forEach(sid => {
    const p = gameState.players[sid];
    const allies = [];
    if (p.role === 'werewolf') {
      Object.keys(gameState.players).forEach(osid => {
        if (gameState.players[osid].role === 'werewolf' && osid !== sid) {
          allies.push(gameState.players[osid].username);
        }
      });
    }
    io.to(sid).emit('role:reveal', {
      role: p.role,
      allies,
    });
  });

  // Move phase
  enterNightPhase();
}

function enterNightPhase() {
  gameState.phase = 'night';
  gameState.nightNumber++;
  
  // Clear daytime caches
  gameState.votes = {};
  gameState.defendantSocketId = null;
  gameState.revotes = {};
  
  // Clear night actions
  gameState.nightActions = {
    werewolfTarget: null,
    seerTarget: null,
    guardTarget: null,
    witchHeal: false,
    witchPoison: null,
    cupidLover1: null,
    cupidLover2: null,
    witchDone: false,
    cupidDone: false,
  };

  io.to('village').emit('game:phase', { phase: 'night' });
  io.to('village').emit('game:state', getPublicState());
  
  const text = getRandomNarration('night_start');
  io.to('village').emit('narration:display', {
    text,
    type: 'night_start',
    duration: 30000,
  });

  // Prompt nighttime requests privately
  Object.keys(gameState.players).forEach(sid => {
    const p = gameState.players[sid];
    if (!p.isAlive) return;

    const aliveOthers = Object.entries(gameState.players)
      .filter(([osid, op]) => op.isAlive && osid !== sid && op.role !== 'spectator' && !op.isAdmin)
      .map(([osid, op]) => ({ socketId: osid, username: op.username }));

    if (p.role === 'seer') {
      io.to(sid).emit('action:request', {
        actions: ['seer_inspect'],
        targets: aliveOthers,
      });
    } else if (p.role === 'guard') {
      // Filter out the protected player from last night
      const validTargets = aliveOthers.filter(t => t.socketId !== p.guardLastProtected);
      io.to(sid).emit('action:request', {
        actions: ['guard_protect'],
        targets: validTargets,
      });
    } else if (p.role === 'werewolf') {
      io.to(sid).emit('action:request', {
        actions: ['werewolf_kill'],
        targets: aliveOthers,
      });
    } else if (p.role === 'cupid' && gameState.nightNumber === 1) {
      io.to(sid).emit('action:request', {
        actions: ['cupid_link'],
        targets: aliveOthers,
      });
    }
  });

  // Delay witch's trigger so she knows who is targeted
  setTimeout(() => {
    syncWitchPrompts();
  }, 1000);

  // Automatically execute bots night actions
  simulateBotNightActions();
}

function syncWitchPrompts() {
  if (gameState.phase !== 'night') return;
  
  // Find Witch
  Object.keys(gameState.players).forEach(sid => {
    const p = gameState.players[sid];
    if (p.role === 'witch' && p.isAlive) {
      const targetSid = gameState.nightActions.werewolfTarget;
      const targetName = targetSid && gameState.players[targetSid] 
        ? gameState.players[targetSid].username 
        : null;

      const aliveOthers = Object.entries(gameState.players)
        .filter(([osid, op]) => op.isAlive && osid !== sid && op.role !== 'spectator' && !op.isAdmin)
        .map(([osid, op]) => ({ socketId: osid, username: op.username }));

      io.to(sid).emit('action:request', {
        actions: ['witch_heal', 'witch_poison', 'witch_pass'],
        targets: aliveOthers,
        killedTargetUsername: targetName,
        hasHeal: gameState.witchHasHeal,
        hasPoison: gameState.witchHasPoison,
      });
    }
  });
}

function enterDaytimePhase() {
  gameState.phase = 'day';
  gameState.dayNumber++;
  
  // 1. Resolve nighttime decisions
  const wolfTarget = gameState.nightActions.werewolfTarget;
  const guardTarget = gameState.nightActions.guardTarget;
  const witchHeal = gameState.nightActions.witchHeal;
  const witchPoison = gameState.nightActions.witchPoison;
  
  const killedSids = [];

  // Werewolf resolution
  if (wolfTarget) {
    let saved = false;
    if (wolfTarget === guardTarget) {
      // Protected by Guard
      saved = true;
      logSystemMsg(`[Bảo Vệ] bảo vệ thành công ${gameState.players[wolfTarget].username} trước vuốt Sói.`);
    }
    if (witchHeal && gameState.witchHasHeal) {
      // Saved by Witch Potion
      saved = true;
      gameState.witchHasHeal = false; // consume heal potion
      logSystemMsg(`[Phù Thủy] cứu sống ${gameState.players[wolfTarget].username}.`);
    }

    // Elder (Già Làng) resilience checks
    const targetPlayer = gameState.players[wolfTarget];
    if (!saved && targetPlayer.role === 'elder') {
      // First bite is non-lethal to Già Làng
      if (!gameState.elderBittenOnce) {
        gameState.elderBittenOnce = true;
        saved = true;
        logSystemMsg(`[Già Làng] chống chọi thành công nhát cắn đầu tiên.`);
      }
    }

    if (!saved) {
      killedSids.push(wolfTarget);
    }
  }

  // Witch Poison resolution
  if (witchPoison && gameState.witchHasPoison) {
    killedSids.push(witchPoison);
    gameState.witchHasPoison = false; // consume poison potion
  }

  // Cupid Lovers link effect
  killedSids.forEach(ksid => {
    const p = gameState.players[ksid];
    if (p && p.loverId && gameState.players[p.loverId]?.isAlive) {
      const partnerId = p.loverId;
      killedSids.push(partnerId);
      logSystemMsg(`[Tình Yêu] ${gameState.players[partnerId].username} tự sát theo người yêu ${p.username}.`);
    }
  });

  // Deduplicate and process deaths
  const uniqueKilled = [...new Set(killedSids)];
  uniqueKilled.forEach(ksid => {
    if (gameState.players[ksid]) {
      gameState.players[ksid].isAlive = false;
    }
  });

  gameState.lastNightCasualties = uniqueKilled;

  // Build dead player positions for ActionDirector
  const deadPlayerPositions = {};
  uniqueKilled.forEach(sid => {
    const p = gameState.players[sid];
    if (p) {
      deadPlayerPositions[sid] = { x: p.x, y: p.y };
    }
  });

  io.to('village').emit('game:phase', { phase: 'day' });
  io.to('village').emit('death:announce', { deadPlayerIds: uniqueKilled, deadPlayerPositions });
  
  let text = "";
  if (uniqueKilled.length === 0) {
    text = getRandomNarration('no_deaths');
  } else {
    const deadNames = uniqueKilled.map(sid => gameState.players[sid]?.username).join(', ');
    text = getRandomNarration('deaths', { names: deadNames });
  }

  io.to('village').emit('narration:display', {
    text,
    type: uniqueKilled.length === 0 ? 'no_deaths' : 'werewolf_kill',
    duration: 30000,
    cinematic: uniqueKilled.length > 0 ? {
      deadPlayerIds: uniqueKilled,
      deadPlayerPositions,
      wolfTarget: gameState.nightActions.werewolfTarget,
      wolfTargetPosition: gameState.nightActions.werewolfTarget && gameState.players[gameState.nightActions.werewolfTarget]
        ? { x: gameState.players[gameState.nightActions.werewolfTarget].x, y: gameState.players[gameState.nightActions.werewolfTarget].y }
        : null,
    } : null,
  });

  io.to('village').emit('game:state', getPublicState());
  logSystemMsg(`Trời sáng. Người chết đêm nay: ${uniqueKilled.length}`);

  // Hunter shot resolution check
  const hunterDied = uniqueKilled.some(sid => gameState.players[sid]?.role === 'hunter');
  if (hunterDied) {
    logSystemMsg(`Thợ Săn đã chết! Hệ thống mở quyền phản sát.`);
  }

  // Compile Night Logs
  const nightLog = {
    nightNumber: gameState.nightNumber,
    cupidLink: null,
    werewolfTarget: wolfTarget ? gameState.players[wolfTarget]?.username : null,
    seerTarget: gameState.nightActions.seerTarget ? {
      username: gameState.players[gameState.nightActions.seerTarget]?.username,
      isWolf: gameState.players[gameState.nightActions.seerTarget]?.role === 'werewolf'
    } : null,
    guardTarget: guardTarget ? gameState.players[guardTarget]?.username : null,
    witchAction: witchHeal ? 'heal' : (witchPoison ? { type: 'poison', username: gameState.players[witchPoison]?.username } : 'pass'),
    deaths: uniqueKilled.map(sid => gameState.players[sid]?.username).filter(Boolean),
  };

  if (gameState.nightNumber === 1 && gameState.nightActions.cupidLover1 && gameState.nightActions.cupidLover2) {
    nightLog.cupidLink = {
      lover1: gameState.players[gameState.nightActions.cupidLover1]?.username,
      lover2: gameState.players[gameState.nightActions.cupidLover2]?.username
    };
  }

  if (!gameState.historyLogs) {
    gameState.historyLogs = [];
  }
  gameState.historyLogs.push(nightLog);

  // Check Win conditions
  checkWinConditions();
}

function enterVotingPhase() {
  gameState.phase = 'vote';
  gameState.votes = {};
  
  io.to('village').emit('game:phase', { phase: 'vote' });
  io.to('village').emit('game:state', getPublicState());
  
  const text = getRandomNarration('voting_start');
  io.to('village').emit('narration:display', {
    text,
    type: 'voting_start',
    duration: 30000,
  });

  // Automatically execute bots voting actions
  simulateBotDaytimeVotes();
}

function enterDefensePhase() {
  // Aggregate votes
  const counts = {};
  Object.values(gameState.votes).forEach(tid => {
    counts[tid] = (counts[tid] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  
  if (sorted.length === 0 || sorted[0][1] === 0) {
    // No votes cast -> Skip back to Night
    logSystemMsg('Không ai bỏ phiếu -> Bỏ qua treo cổ, sang đêm mới.');
    enterNightPhase();
    return;
  }

  const highestVotedSid = sorted[0][0];
  const defendant = gameState.players[highestVotedSid];

  if (!defendant) {
    enterNightPhase();
    return;
  }

  gameState.phase = 'defense';
  gameState.defendantSocketId = highestVotedSid;
  gameState.revotes = {};

  io.to('village').emit('game:phase', { phase: 'defense' });
  io.to('village').emit('game:state', getPublicState());

  const text = getRandomNarration('defense_start', { name: defendant.username });
  io.to('village').emit('narration:display', {
    text,
    type: 'defense_start',
    duration: 30000,
  });
}

function enterRevotePhase() {
  gameState.phase = 'revote';
  gameState.revotes = {};

  io.to('village').emit('game:phase', { phase: 'revote' });
  io.to('village').emit('game:state', getPublicState());

  const defendant = gameState.players[gameState.defendantSocketId];
  io.to('village').emit('narration:display', {
    text: `🗳️ BIỂU QUYẾT TREO CỔ: Hãy chọn GIẾT (Kill) hoặc CỨU (Save) đối với ${defendant?.username || 'Bị Cáo'}!`,
    type: 'revote_start',
    duration: 30000,
  });

  // Automatically execute bots revotes
  simulateBotRevotes();
}

function resolveExecutionPhase() {
  const { killVotes, saveVotes } = getRevoteCounts();
  const defendant = gameState.players[gameState.defendantSocketId];

  if (!defendant) {
    enterNightPhase();
    return;
  }

  const executionLog = {
    dayNumber: gameState.dayNumber,
    defendant: defendant.username,
    killVotes,
    saveVotes,
    result: (killVotes >= saveVotes && killVotes > 0) ? 'executed' : 'spared',
  };
  if (!gameState.historyLogs) {
    gameState.historyLogs = [];
  }
  gameState.historyLogs.push(executionLog);

  logSystemMsg(`Kết quả biểu quyết treo cổ ${defendant.username}: TREO ${killVotes} vs CỨU ${saveVotes}`);

  if (killVotes >= saveVotes && killVotes > 0) {
    // Hang target
    defendant.isAlive = false;
    
    // Check Jester / Thằng Ngốc win condition
    if (defendant.role === 'jester') {
      gameState.phase = 'gameover';
      io.to('village').emit('game:phase', { phase: 'gameover' });
      io.to('village').emit('game:over', { 
        winner: `🃏 Thằng Ngốc (${defendant.username}) đã bị treo cổ! Phe Thứ Ba thắng cuộc!`,
        historyLogs: gameState.historyLogs
      });
      io.to('village').emit('narration:display', {
        text: `🃏 TRÒ CHƠI KẾT THÚC: Thằng Ngốc ${defendant.username} đã dụ dân làng treo cổ mình thành công! Thằng Ngốc thắng!`,
        type: 'jester_win',
        duration: 30000,
      });
      return;
    }

    // Check Elder / Già Làng execution penalty
    if (defendant.role === 'elder') {
      logSystemMsg(`[Già Làng] bị dân làng treo cổ! Phe dân mất năng lực.`);
      // Strip dynamic special roles powers
      Object.keys(gameState.players).forEach(sid => {
        const p = gameState.players[sid];
        if (p.role === 'seer' || p.role === 'guard' || p.role === 'witch') {
          p.role = 'villager';
          io.to(sid).emit('role:reveal', { role: 'villager' });
        }
      });
    }

    const text = getRandomNarration('execution', { name: defendant.username });
    io.to('village').emit('narration:display', {
      text,
      type: 'execution',
      duration: 30000,
      cinematic: {
        defendantSocketId: gameState.defendantSocketId,
        defendantPosition: { x: defendant.x, y: defendant.y },
      },
    });
  } else {
    const text = getRandomNarration('spared', { name: defendant.username });
    io.to('village').emit('narration:display', {
      text,
      type: 'spared',
      duration: 30000,
      cinematic: {
        defendantSocketId: gameState.defendantSocketId,
        defendantPosition: { x: defendant.x, y: defendant.y },
      },
    });
  }

  // Clear defendant
  gameState.defendantSocketId = null;
  io.to('village').emit('game:state', getPublicState());

  // Check win conditions
  const won = checkWinConditions();
  if (!won) {
    enterNightPhase();
  }
}

function checkWinConditions() {
  const players = Object.values(gameState.players);
  const alivePlayers = players.filter(p => p.isAlive);
  
  const wolves = alivePlayers.filter(p => p.role === 'werewolf');
  const villagers = alivePlayers.filter(p => p.role !== 'werewolf' && p.role !== 'spectator');

  console.log(`🔍 Win check: Alive=${alivePlayers.length}, Wolves=${wolves.length}, Villagers=${villagers.length}`);

  // 1. Werewolf victory condition
  if (wolves.length >= villagers.length) {
    gameState.phase = 'gameover';
    
    // Build winner positions for cinematic
    const winnerPositions = wolves.filter(w => !w.isBot).map(w => {
      const sid = Object.keys(gameState.players).find(key => gameState.players[key] === w);
      return sid ? { socketId: sid, x: w.x, y: w.y } : null;
    }).filter(Boolean);

    io.to('village').emit('game:phase', { phase: 'gameover' });
    io.to('village').emit('game:over', { 
      winner: '🐺 ĐÀN SÓI',
      historyLogs: gameState.historyLogs,
      winnerPositions,
    });
    io.to('village').emit('narration:display', {
      text: `🏆 TRÒ CHƠI KẾT THÚC: Phe Sói cắn nuốt toàn bộ ngôi làng! Phe Sói thắng cuộc!`,
      type: 'game_over_wolves',
      duration: 30000,
    });
    return true;
  }

  // 2. Villager victory condition
  if (wolves.length === 0) {
    gameState.phase = 'gameover';
    
    const winnerPositions = villagers.filter(v => !v.isBot).map(v => {
      const sid = Object.keys(gameState.players).find(key => gameState.players[key] === v);
      return sid ? { socketId: sid, x: v.x, y: v.y } : null;
    }).filter(Boolean);

    io.to('village').emit('game:phase', { phase: 'gameover' });
    io.to('village').emit('game:over', { 
      winner: '👤 DÂN LÀNG',
      historyLogs: gameState.historyLogs,
      winnerPositions,
    });
    io.to('village').emit('narration:display', {
      text: `🏆 TRÒ CHƠI KẾT THÚC: Dân làng đã tiêu diệt hoàn toàn lũ Sói độc ác! Dân Làng thắng cuộc!`,
      type: 'game_over_villagers',
      duration: 30000,
    });
    return true;
  }

  return false;
}

function checkIncompleteActions() {
  const current = gameState.phase;
  
  if (current === 'night') {
    const wolves = Object.values(gameState.players).filter(p => p.isAlive && p.role === 'werewolf');
    if (wolves.length > 0 && !gameState.nightActions.werewolfTarget) {
      return 'Bầy sói chưa chọn cắn nạn nhân.';
    }

    const seers = Object.values(gameState.players).filter(p => p.isAlive && p.role === 'seer');
    if (seers.length > 0 && !gameState.nightActions.seerTarget) {
      return 'Tiên tri chưa soi thân phận.';
    }

    const guards = Object.values(gameState.players).filter(p => p.isAlive && p.role === 'guard');
    if (guards.length > 0 && !gameState.nightActions.guardTarget) {
      return 'Bảo vệ chưa chọn người bảo vệ.';
    }

    const witches = Object.values(gameState.players).filter(p => p.isAlive && p.role === 'witch');
    if (witches.length > 0 && !gameState.nightActions.witchDone) {
      return 'Phù thủy chưa sử dụng thuốc độc/cứu hoặc bỏ qua.';
    }

    const cupids = Object.values(gameState.players).filter(p => p.isAlive && p.role === 'cupid');
    if (gameState.nightNumber === 1 && cupids.length > 0 && !gameState.nightActions.cupidDone) {
      return 'Cupid chưa kết đôi uyên ương.';
    }
  }

  if (current === 'vote') {
    const alivePlayers = Object.values(gameState.players).filter(p => p.isAlive && p.role !== 'spectator');
    const votedCount = Object.keys(gameState.votes).length;
    if (votedCount < alivePlayers.length) {
      return `Còn ${alivePlayers.length - votedCount} dân làng chưa hoàn thành bỏ phiếu.`;
    }
  }

  if (current === 'revote') {
    const aliveVoters = Object.entries(gameState.players).filter(([sid, p]) => p.isAlive && p.role !== 'spectator' && sid !== gameState.defendantSocketId);
    const revotedCount = Object.keys(gameState.revotes).length;
    if (revotedCount < aliveVoters.length) {
      return `Còn ${aliveVoters.length - revotedCount} dân làng chưa biểu quyết treo cổ.`;
    }
  }

  return null;
}

function advanceGamePhase() {
  const current = gameState.phase;
  logSystemMsg(`[ADMIN] Next Phase clicked. Current: ${current}`);

  switch (current) {
    case 'lobby':
      startGameSession();
      break;
    case 'night':
      enterDaytimePhase();
      break;
    case 'day':
      enterVotingPhase();
      break;
    case 'vote':
      enterDefensePhase();
      break;
    case 'defense':
      enterRevotePhase();
      break;
    case 'revote':
      resolveExecutionPhase();
      break;
    case 'gameover':
      resetGameSession();
      break;
  }
}

function resetGameSession() {
  gameState.phase = 'lobby';
  gameState.nightNumber = 0;
  gameState.dayNumber = 0;
  gameState.defendantSocketId = null;
  gameState.votes = {};
  gameState.revotes = {};
  gameState.lastNightCasualties = [];
  
  // Purge players who disconnected during the game, and reset active players
  Object.keys(gameState.players).forEach(sid => {
    const p = gameState.players[sid];
    if (!p.online) {
      delete gameState.players[sid];
    } else {
      p.isAlive = true;
      p.role = p.isAdmin ? 'spectator' : 'villager';
      p.loverId = null;
      p.guardLastProtected = null;
    }
  });

  io.to('village').emit('game:phase', { phase: 'lobby' });
  io.to('village').emit('narration:clear');
  io.to('village').emit('game:state', getPublicState());
  logSystemMsg('Thiết lập lại phòng chờ Lobby.');
}

// ============================================================
// 🤖 AUTHORITATIVE BOT SIMULATION & GAMEPLAY DECISIONS ENGINE
// ============================================================

function simulateBotNightActions() {
  if (gameState.phase !== 'night') return;

  const players = Object.values(gameState.players);
  const aliveBots = players.filter(p => p.isBot && p.isAlive);

  aliveBots.forEach(p => {
    const sid = Object.keys(gameState.players).find(key => gameState.players[key] === p);
    if (!sid) return;

    const aliveOthers = Object.entries(gameState.players)
      .filter(([osid, op]) => op.isAlive && osid !== sid && op.role !== 'spectator' && !op.isAdmin)
      .map(([osid, op]) => ({ socketId: osid, username: op.username }));

    if (aliveOthers.length === 0) return;

    if (p.role === 'seer' && !gameState.nightActions.seerTarget) {
      const target = aliveOthers[Math.floor(Math.random() * aliveOthers.length)];
      gameState.nightActions.seerTarget = target.socketId;
      logSystemMsg(`[BOT Tiên Tri] ${p.username} âm thầm soi thân phận.`);
    } 
    
    else if (p.role === 'guard' && !gameState.nightActions.guardTarget) {
      const validTargets = aliveOthers.filter(t => t.socketId !== p.guardLastProtected);
      if (validTargets.length > 0) {
        const target = validTargets[Math.floor(Math.random() * validTargets.length)];
        gameState.nightActions.guardTarget = target.socketId;
        p.guardLastProtected = target.socketId;
        logSystemMsg(`[BOT Bảo Vệ] ${p.username} chọn người bảo vệ.`);
      }
    } 
    
    else if (p.role === 'werewolf') {
      if (!gameState.nightActions.werewolfTarget) {
        const nonWolves = aliveOthers.filter(t => gameState.players[t.socketId]?.role !== 'werewolf');
        if (nonWolves.length > 0) {
          const target = nonWolves[Math.floor(Math.random() * nonWolves.length)];
          gameState.nightActions.werewolfTarget = target.socketId;
          logSystemMsg(`[BOT Sói] ${p.username} cắn ${target.username}.`);
        }
      }
    } 
    
    else if (p.role === 'cupid' && gameState.nightNumber === 1 && !gameState.nightActions.cupidDone) {
      if (aliveOthers.length >= 2) {
        const shuffled = [...aliveOthers].sort(() => Math.random() - 0.5);
        const loverId1 = shuffled[0].socketId;
        const loverId2 = shuffled[1].socketId;
        
        gameState.nightActions.cupidLover1 = loverId1;
        gameState.nightActions.cupidLover2 = loverId2;
        gameState.players[loverId1].loverId = loverId2;
        gameState.players[loverId2].loverId = loverId1;
        gameState.nightActions.cupidDone = true;
        
        if (!gameState.players[loverId1].isBot) {
          io.to(loverId1).emit('lover:reveal', { partnerUsername: gameState.players[loverId2].username });
        }
        if (!gameState.players[loverId2].isBot) {
          io.to(loverId2).emit('lover:reveal', { partnerUsername: gameState.players[loverId1].username });
        }
        logSystemMsg(`[BOT Cupid] ghép đôi ${shuffled[0].username} và ${shuffled[1].username}.`);
      }
    }
  });

  setTimeout(() => {
    simulateBotWitchActions();
  }, 1200);
}

function simulateBotWitchActions() {
  if (gameState.phase !== 'night') return;

  const players = Object.values(gameState.players);
  const witch = players.find(p => p.isBot && p.isAlive && p.role === 'witch');
  if (!witch) return;

  const sid = Object.keys(gameState.players).find(key => gameState.players[key] === witch);
  if (!sid) return;

  const aliveOthers = Object.entries(gameState.players)
    .filter(([osid, op]) => op.isAlive && osid !== sid && op.role !== 'spectator' && !op.isAdmin)
    .map(([osid, op]) => ({ socketId: osid, username: op.username }));

  if (gameState.nightActions.witchDone) return;

  const targetSid = gameState.nightActions.werewolfTarget;
  
  if (targetSid && gameState.witchHasHeal && Math.random() < 0.6) {
    gameState.nightActions.witchHeal = true;
    gameState.nightActions.witchDone = true;
    logSystemMsg(`[BOT Phù Thủy] cứu sống ${gameState.players[targetSid].username}.`);
  } else if (gameState.witchHasPoison && Math.random() < 0.2 && aliveOthers.length > 0) {
    const victim = aliveOthers[Math.floor(Math.random() * aliveOthers.length)];
    gameState.nightActions.witchPoison = victim.socketId;
    gameState.nightActions.witchDone = true;
    logSystemMsg(`[BOT Phù Thủy] đầu độc ${victim.username}.`);
  } else {
    gameState.nightActions.witchDone = true;
    logSystemMsg(`[BOT Phù Thủy] quyết định không dùng thuốc.`);
  }
}

function simulateBotDaytimeVotes() {
  Object.entries(gameState.players).forEach(([sid, p]) => {
    if (p.isBot && p.isAlive) {
      const validTargets = Object.keys(gameState.players).filter(
        osid => osid !== sid && gameState.players[osid].isAlive && gameState.players[osid].role !== 'spectator' && !gameState.players[osid].isAdmin
      );
      if (validTargets.length > 0) {
        const targetSid = validTargets[Math.floor(Math.random() * validTargets.length)];
        gameState.votes[sid] = targetSid;
      }
    }
  });
  io.to('village').emit('vote:update', getVoteCounts());
}

function simulateBotRevotes() {
  Object.entries(gameState.players).forEach(([sid, p]) => {
    if (p.isBot && p.isAlive && sid !== gameState.defendantSocketId) {
      gameState.revotes[sid] = Math.random() > 0.55 ? 'kill' : 'save';
    }
  });
  io.to('village').emit('revote:update', getRevoteCounts());
}

// --- BOT SYSTEM: AUTOMATIC MOVEMENT INTERVAL ---
setInterval(() => {
  if (gameState.phase === 'lobby' || gameState.phase === 'day' || gameState.phase === 'vote') {
    Object.entries(gameState.players).forEach(([sid, p]) => {
      if (p.isBot && p.isAlive && Math.random() < 0.25) {
        const angle = Math.random() * Math.PI * 2;
        const r = 3 + Math.random() * 11;
        p.x = Math.cos(angle) * r;
        p.y = Math.sin(angle) * r;
        io.to('village').emit('player:moved', { id: sid, x: p.x, y: p.y });
      }
    });
  }
}, 4000);

// --- SERVER ON PORT MOUNT ---
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌙 Nightfall server on port ${PORT}`);
});
