import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import VillagerSprite from '../components/VillagerSprite';
import Village3D from '../game/Village3D';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Moon, LogOut, Users, Send, ChevronRight, ChevronLeft, SkipForward, RotateCcw, Play, Sun } from 'lucide-react';

const SOCKET_URL = window.location.origin;

const EMOTES = [
  { action: 'wave',    emoji: '👋', label: 'Vẫy' },
  { action: 'dance',   emoji: '💃', label: 'Nhảy' },
  { action: 'angry',   emoji: '😤', label: 'Giận' },
  { action: 'cry',     emoji: '😭', label: 'Khóc' },
  { action: 'laugh',   emoji: '😂', label: 'Cười' },
  { action: 'thumbsup', emoji: '👍', label: 'Like' },
  { action: 'fear',    emoji: '😱', label: 'Sợ' },
  { action: 'think',   emoji: '🤔', label: 'Suy nghĩ' },
];

const PHASE_DATA = {
  lobby:   { label: 'Sảnh Chờ',   color: '#8b5cf6' },
  night:   { label: '🌙 Ban Đêm',  color: '#1e1b4b' },
  day:     { label: '☀️ Ban Ngày', color: '#f59e0b' },
  vote:    { label: '🗳️ Bỏ Phiếu', color: '#dc2626' },
  gameover:{ label: '🏁 Kết Thúc',  color: '#10b981' },
};

export default function Game() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const villageRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [players, setPlayers] = useState({});
  const [mySocketId, setMySocketId] = useState(null);
  const [phase, setPhase] = useState('lobby');
  const [narration, setNarration] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatMsg, setChatMsg] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [emotes, setEmotes] = useState({});

  // Connect socket
  useEffect(() => {
    const token = localStorage.getItem('nf_token');
    if (!token) { navigate('/login', { replace: true }); return; }

    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => setMySocketId(s.id));

    s.on('game:state', (state) => {
      setPlayers(state.players);
      setPhase(state.phase);
    });

    s.on('player:moved', ({ id, x, y }) => {
      setPlayers(prev => prev[id] ? { ...prev, [id]: { ...prev[id], x, y } } : prev);
    });

    s.on('player:action', ({ id, action, emoji }) => {
      setEmotes(prev => ({ ...prev, [id]: { emoji, time: Date.now() } }));
      setTimeout(() => setEmotes(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      }), 2000);
    });

    s.on('game:phase', ({ phase: newPhase }) => setPhase(newPhase));

    s.on('game:over', (data) => {
      setPhase('gameover');
      setNarration({ text: `🏆 ${data.winner || 'Game Over!'}`, visible: true });
    });

    s.on('narration:display', ({ text, duration }) => {
      setNarration({ text, visible: true });
      setTimeout(() => setNarration(null), duration || 5000);
    });

    s.on('narration:clear', () => setNarration(null));

    s.on('chat:message', ({ username, text }) => {
      setChatLog(prev => [...prev.slice(-50), { username, text, time: Date.now() }]);
    });

    setSocket(s);
    return () => { s.close(); setSocket(null); };
  }, []);

  // Handle 3D click-to-move
  const handleMoveTo = useCallback((x3d, z3d) => {
    if (socket) {
      // Convert 3D coords (x,z) to our game coords (x,y)
      socket.emit('player:move', { x: x3d, y: z3d });
      setPlayers(prev => prev[mySocketId]
        ? { ...prev, [mySocketId]: { ...prev[mySocketId], x: x3d, y: z3d } }
        : prev);
    }
  }, [socket, mySocketId]);

  // Emote
  const doEmote = (emote) => {
    if (socket) socket.emit('player:interact', emote);
  };

  // Chat
  const sendChat = () => {
    if (!chatMsg.trim() || !socket) return;
    socket.emit('chat:send', { text: chatMsg.trim() });
    setChatLog(prev => [...prev.slice(-50), {
      username: players[mySocketId]?.username || '???',
      text: chatMsg.trim(),
      time: Date.now(),
    }]);
    setChatMsg('');
  };

  // Admin
  const adminAction = (action) => {
    if (socket && players[mySocketId]?.isAdmin) socket.emit(action);
  };

  const playerList = Object.entries(players);
  const me = players[mySocketId];
  const isAdmin = me?.isAdmin;

  const handleLogout = () => { logout(); navigate('/', { replace: true }); };

  return (
    <div className="fixed inset-0 bg-[#0d0d1a] flex flex-col overflow-hidden font-inter">
      {/* ===== TOP BAR ===== */}
      <div className="relative z-30 bg-[#121829]/90 backdrop-blur-md border-b border-[#8b5cf6]/20 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Moon className="text-[#8b5cf6]" size={20} />
          <span className="font-cinzel font-bold text-[#e8d5b7] text-sm tracking-widest">NIGHTFALL</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-cinzel font-bold tracking-wider"
            style={{ backgroundColor: PHASE_DATA[phase]?.color + '30', color: PHASE_DATA[phase]?.color }}>
            {PHASE_DATA[phase]?.label || phase}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#64748b] font-cinzel flex items-center gap-1">
            <Users size={12} /> {playerList.length}
          </span>
          {user && (
            <div className="flex items-center gap-2 bg-[#1a2035]/80 border border-[#8b5cf6]/20 rounded-full px-2.5 py-1">
              <VillagerSprite gender={user.gender} hairStyle={user.hairStyle} hairColor={user.hairColor} size={22} />
              <span className="text-xs font-cinzel text-[#e2e8f0]">{user.username}</span>
              {isAdmin && <span className="text-[9px] text-[#f59e0b] font-cinzel px-1.5 py-0.5 rounded bg-[#f59e0b]/10">ADMIN</span>}
            </div>
          )}
          <button onClick={handleLogout} className="text-[#64748b] hover:text-[#c41e3a] transition-colors p-1" title="Rời làng">
            <LogOut size={15} />
          </button>
        </div>
      </div>

      {/* ===== MAIN: 3D VILLAGE + SIDEBAR ===== */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* 3D Village Canvas */}
        <div className="flex-1 relative">
          <Village3D
            ref={villageRef}
            players={players}
            mySocketId={mySocketId}
            onMoveTo={handleMoveTo}
            phase={phase}
          />

          {/* Narration overlay */}
          <AnimatePresence>
            {narration && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-6 py-3 rounded-xl bg-black/70 backdrop-blur-sm border border-[#8b5cf6]/30 pointer-events-none"
              >
                <p className="font-cinzel text-sm text-[#e8d5b7] text-center tracking-wider">{narration.text}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls hint */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-[#475569] font-cinzel tracking-wider pointer-events-none z-10">
            🖱️ Kéo chuột xoay · Click đất để di chuyển · Scroll zoom
          </div>
        </div>

        {/* ===== SIDEBAR TOGGLE ===== */}
        <button onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-[#121829] border border-[#8b5cf6]/20 rounded-l-lg p-1.5 text-[#64748b] hover:text-[#8b5cf6] transition-colors">
          {sidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* ===== SIDEBAR ===== */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="shrink-0 bg-[#121829]/95 backdrop-blur-md border-l border-[#8b5cf6]/20 flex flex-col overflow-hidden"
            >
              {/* Player List */}
              <div className="p-3 border-b border-[#8b5cf6]/10">
                <h3 className="font-cinzel text-xs text-[#64748b] tracking-wider mb-2">DÂN LÀNG ({playerList.length})</h3>
                <div className="space-y-1 max-h-[180px] overflow-y-auto custom-scrollbar">
                  {playerList.map(([sid, p]) => (
                    <div key={sid}
                      className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs ${
                        sid === mySocketId ? 'bg-[#8b5cf6]/10' : 'hover:bg-white/5'
                      }`}>
                      <VillagerSprite gender={p.gender} hairStyle={p.hairStyle} hairColor={p.hairColor} size={20} />
                      <span className="font-cinzel text-[#e2e8f0] flex-1 truncate">
                        {p.username}
                        {p.isAdmin && <span className="text-[#f59e0b] ml-1">👑</span>}
                      </span>
                      <span className={`w-1.5 h-1.5 rounded-full ${p.online ? 'bg-[#10b981]' : 'bg-[#64748b]'}`} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Emotes */}
              <div className="p-3 border-b border-[#8b5cf6]/10">
                <h3 className="font-cinzel text-xs text-[#64748b] tracking-wider mb-2">CẢM XÚC</h3>
                <div className="grid grid-cols-4 gap-1.5">
                  {EMOTES.map(em => (
                    <button key={em.action} onClick={() => doEmote(em)}
                      className="p-1.5 rounded-lg bg-[#1a2035]/60 hover:bg-[#8b5cf6]/20 transition-colors text-center text-lg"
                      title={em.label}>
                      {em.emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                  {chatLog.length === 0 ? (
                    <p className="text-[10px] text-[#475569] text-center mt-4 font-cinzel">Chưa có tin nhắn...</p>
                  ) : (
                    chatLog.map((msg, i) => (
                      <div key={i} className="text-[11px]">
                        <span className="font-cinzel text-[#8b5cf6]">{msg.username}:</span>{' '}
                        <span className="text-[#94a3b8]">{msg.text}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 border-t border-[#8b5cf6]/10 flex gap-1">
                  <input type="text" value={chatMsg} onChange={e => setChatMsg(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendChat()}
                    className="flex-1 bg-[#1a2035] border border-[#8b5cf6]/20 rounded-lg px-2.5 py-1.5 text-xs text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#8b5cf6]"
                    placeholder="Chat..." />
                  <button onClick={sendChat}
                    className="p-1.5 bg-[#8b5cf6]/20 rounded-lg hover:bg-[#8b5cf6]/40 transition-colors text-[#8b5cf6]">
                    <Send size={14} />
                  </button>
                </div>
              </div>

              {/* Admin panel */}
              {isAdmin && (
                <div className="p-3 border-t border-[#f59e0b]/30 bg-[#f59e0b]/5">
                  <h3 className="font-cinzel text-xs text-[#f59e0b] tracking-wider mb-2">👑 ADMIN</h3>
                  <div className="grid grid-cols-2 gap-1.5">
                    {phase === 'lobby' && (
                      <button onClick={() => adminAction('admin:startGame')}
                        className="col-span-2 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-[#f59e0b]/20 border border-[#f59e0b]/30 text-[#f59e0b] font-cinzel text-xs font-bold hover:bg-[#f59e0b]/30 transition-all">
                        <Play size={12} /> BẮT ĐẦU GAME
                      </button>
                    )}
                    {(phase === 'night' || phase === 'day') && (
                      <button onClick={() => adminAction('admin:nextPhase')}
                        className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-[#8b5cf6]/20 border border-[#8b5cf6]/30 text-[#8b5cf6] font-cinzel text-xs font-bold hover:bg-[#8b5cf6]/30 transition-all">
                        <SkipForward size={12} /> PHASE
                      </button>
                    )}
                    <button onClick={() => adminAction('admin:reset')}
                      className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-[#c41e3a]/20 border border-[#c41e3a]/30 text-[#c41e3a] font-cinzel text-xs font-bold hover:bg-[#c41e3a]/30 transition-all">
                      <RotateCcw size={12} /> RESET
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
