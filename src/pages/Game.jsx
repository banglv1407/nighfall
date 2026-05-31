import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import VillagerSprite from '../components/VillagerSprite';
import Village3D from '../game/Village3D';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Moon, LogOut, Users, Send, ChevronRight, ChevronLeft, SkipForward, RotateCcw, Play, Eye, Shield, Skull, Heart, Award } from 'lucide-react';

const SOCKET_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5050'
  : window.location.origin;

const EMOTES = [
  { action: 'wave',    emoji: '👋', label: 'Vẫy' },
  { action: 'dance',   emoji: '💃', label: 'Nhảy' },
  { action: 'angry',   emoji: '😤', label: 'Giận' },
  { action: 'cry',     emoji: '😭', label: 'Khóc' },
  { action: 'laugh',   emoji: '😂', label: 'Cười' },
  { action: 'thumbsup', emoji: '👍', label: 'Like' },
  { action: 'fear',    emoji: '😱', label: 'Sợ' },
  { action: 'think',   emoji: '🤔', label: 'Nghĩ' },
];

const PHASE_DATA = {
  lobby:   { label: 'Sảnh Chờ',   color: '#8b5cf6' },
  night:   { label: '🌙 Ban Đêm',  color: '#1e1b4b' },
  day:     { label: '☀️ Ban Ngày', color: '#f59e0b' },
  vote:    { label: '🗳️ Bỏ Phiếu', color: '#dc2626' },
  defense: { label: '⚖️ Biện Hộ',  color: '#a855f7' },
  revote:  { label: '⚖️ Biểu Quyết', color: '#ec4899' },
  gameover:{ label: '🏁 Kết Thúc',  color: '#10b981' },
};

const ROLE_METADATA = {
  werewolf: { name: 'Ma Sói', color: '#ef4444', icon: Skull, desc: 'Đêm thức dậy cùng bầy sói để cắn chết một dân làng. Đạt số lượng bằng hoặc hơn dân làng để thắng.', team: 'Sói' },
  seer:     { name: 'Tiên Tri', color: '#3b82f6', icon: Eye, desc: 'Đêm soi một người chơi để xem người đó thuộc phe Sói hay phe Dân.', team: 'Dân Làng' },
  witch:    { name: 'Phù Thủy', color: '#8b5cf6', icon: Award, desc: 'Có 1 bình thuốc sinh tử cứu người và 1 bình thuốc độc hại người (dùng 1 lần/game mỗi loại).', team: 'Dân Làng' },
  guard:    { name: 'Bảo Vệ', color: '#10b981', icon: Shield, desc: 'Đêm chọn bảo vệ một người khỏi Sói (không chọn trùng 1 người 2 đêm liên tiếp).', team: 'Dân Làng' },
  hunter:   { name: 'Thợ Săn', color: '#f59e0b', icon: TargetSymbol, desc: 'Khi chết, bạn được quyền nổ súng bắn chết ngay lập tức một người chơi khác.', team: 'Dân Làng' },
  cupid:    { name: 'Cupid', color: '#ec4899', icon: Heart, desc: 'Đêm đầu tiên ghép đôi 2 người chơi. Nếu 1 người chết, người kia sẽ tự sát chết theo.', team: 'Dân Làng' },
  angel:    { name: 'Thiên Sứ', color: '#f43f5e', icon: Moon, desc: 'Nếu bạn bị cắn chết đêm đầu hoặc treo cổ ngày đầu, bạn lập tức thắng cuộc.', team: 'Thứ Ba' },
  elder:    { name: 'Già Làng', color: '#e2e8f0', icon: Users, desc: 'Có 2 mạng trước Sói. Nếu bị dân làng treo cổ, tất cả chức năng phe Dân sẽ mất năng lực.', team: 'Dân Làng' },
  jester:   { name: 'Thằng Ngốc', color: '#d946ef', icon: Award, desc: 'Mục tiêu là lừa dân làng treo cổ mình. Bạn thắng ngay lập tức nếu bị treo cổ.', team: 'Thứ Ba' },
  villager: { name: 'Dân Thường', color: '#94a3b8', icon: Users, desc: 'Không có năng lực đêm. Sử dụng lập luận, đối thoại để tìm Sói và vote treo cổ.', team: 'Dân Làng' },
  spectator: { name: 'Quản Trò (Host)', color: '#f59e0b', icon: Shield, desc: 'Bạn là người quản trò. Bạn không tham gia chơi trực tiếp nhưng có quyền năng điều phối và quan sát toàn bộ thân phận của mọi người chơi.', team: 'Host' },
};

function TargetSymbol(props) {
  return <Skull {...props} className="text-[#f59e0b]" />;
}

// ============================================================
// CinematicNarration (Typewriter cinematic text effects)
// ============================================================
const CinematicNarration = ({ text, type }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let current = '';
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        current += text[i];
        setDisplayedText(current);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 20); // Fast typewriting (20ms per char)
    return () => clearInterval(interval);
  }, [text]);

  const isWerewolfKill = type === 'werewolf_kill';
  const isNightStart = type === 'night_start';
  const isVote = type === 'voting_start' || type === 'defense_start' || type === 'revote_start' || type === 'execution';
  const isSpared = type === 'spared';
  const isGameOver = type?.startsWith('game_over') || type === 'jester_win';

  // Master container shake for werewolf bite
  const containerVariants = {
    initial: { scale: 1 },
    animate: isWerewolfKill ? {
      x: [0, -12, 12, -12, 12, -6, 6, -3, 3, 0],
      y: [0, 6, -6, 6, -6, 3, -3, 1.5, -1.5, 0],
      transition: { duration: 1.0, ease: "easeInOut", delay: 0.1 }
    } : {}
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`absolute inset-0 z-50 flex flex-col items-center justify-center p-8 pointer-events-none select-none overflow-hidden ${
        isWerewolfKill ? 'bg-black/90' : 'bg-black/85 backdrop-blur-md'
      }`}
    >
      {/* 🩸 BLOOD SPLATTER VIGNETTE OVERLAY (pulsing, scary heartbeat vignette) */}
      {isWerewolfKill && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.75, 0.55, 0.75, 0.55] }}
          transition={{ duration: 12, ease: "linear" }}
          className="absolute inset-0 border-[35px] border-red-955/45 pointer-events-none mix-blend-multiply shadow-[inset_0_0_90px_rgba(127,29,29,0.9)] z-20"
        />
      )}

      {/* 🩸 DRIFTING DRIZZLING BLOOD DRIPS */}
      {isWerewolfKill && (
        <div className="absolute inset-x-0 top-0 h-56 pointer-events-none overflow-hidden flex justify-around z-10 opacity-70">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: [-60, 0, 100], opacity: [0, 0.9, 0] }}
              transition={{
                duration: 2.5 + Math.random() * 3.5,
                repeat: Infinity,
                delay: Math.random() * 2,
                ease: "easeIn"
              }}
              className="w-1 bg-red-800 rounded-b-full shadow-[0_0_8px_rgba(220,38,38,0.7)]"
              style={{ 
                height: `${20 + Math.random() * 45}px`, 
                opacity: 0.6 + Math.random() * 0.4 
              }}
            />
          ))}
        </div>
      )}

      {/* ⚔️ RED GLOWING DIAGONAL CLAW SLASHES (Rips across the screen!) */}
      {isWerewolfKill && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-15">
          <div className="relative w-full max-w-2xl h-80 flex flex-col justify-center gap-10">
            {/* Claw 1 */}
            <motion.div 
              initial={{ width: 0, opacity: 0, rotate: -25, scaleX: 0 }}
              animate={{ width: ["0%", "130%", "130%", "0%"], opacity: [0, 1, 1, 0], scaleX: [0.3, 1, 1, 0.3], x: ["-15%", "115%"] }}
              transition={{ duration: 1.3, times: [0, 0.25, 0.8, 1], ease: "easeInOut", delay: 0.15 }}
              className="h-3.5 bg-gradient-to-r from-red-700 via-red-500 to-transparent blur-[1px] shadow-[0_0_20px_rgba(220,38,38,0.9)]"
            />
            {/* Claw 2 */}
            <motion.div 
              initial={{ width: 0, opacity: 0, rotate: -25, scaleX: 0 }}
              animate={{ width: ["0%", "130%", "130%", "0%"], opacity: [0, 1, 1, 0], scaleX: [0.3, 1, 1, 0.3], x: ["-5%", "125%"] }}
              transition={{ duration: 1.3, times: [0, 0.25, 0.8, 1], ease: "easeInOut", delay: 0.3 }}
              className="h-4 bg-gradient-to-r from-red-700 via-red-500 to-transparent blur-[1.5px] shadow-[0_0_25px_rgba(220,38,38,1.0)]"
            />
            {/* Claw 3 */}
            <motion.div 
              initial={{ width: 0, opacity: 0, rotate: -25, scaleX: 0 }}
              animate={{ width: ["0%", "130%", "130%", "0%"], opacity: [0, 1, 1, 0], scaleX: [0.3, 1, 1, 0.3], x: ["-15%", "115%"] }}
              transition={{ duration: 1.3, times: [0, 0.25, 0.8, 1], ease: "easeInOut", delay: 0.45 }}
              className="h-3 bg-gradient-to-r from-red-700 via-red-500 to-transparent blur-[1px] shadow-[0_0_20px_rgba(220,38,38,0.9)]"
            />
          </div>
        </div>
      )}

      {/* 🌫️ GOTHIC DRIFTING NIGHT MIST FOR NIGHTFALL PHASES */}
      {isNightStart && (
        <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none opacity-50 select-none overflow-hidden z-10">
          <motion.div 
            animate={{ x: ["-15%", "15%", "-15%"] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
            className="absolute w-[130%] h-full bg-gradient-to-t from-[#0e0c25]/30 to-transparent blur-3xl"
          />
        </div>
      )}

      {/* ⚖️ GOLDEN / AMBER VIGNETTE JUDGEMENT DAY OVERLAY */}
      {isVote && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.4, 0.3, 0.4] }}
          transition={{ duration: 10, ease: "linear" }}
          className="absolute inset-0 border-[20px] border-amber-955/20 pointer-events-none shadow-[inset_0_0_60px_rgba(217,119,6,0.4)] z-20"
        />
      )}

      {/* 🏆 GLORIOUS GAME OVER GOLD WIN OVERLAY */}
      {isGameOver && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.65, 0.5, 0.65] }}
          transition={{ duration: 10, ease: "linear" }}
          className="absolute inset-0 border-[25px] border-emerald-955/20 pointer-events-none shadow-[inset_0_0_70px_rgba(16,185,129,0.5)] z-20"
        />
      )}

      {/* Cinematic Text Block with shake variant */}
      <motion.div
        variants={containerVariants}
        initial="initial"
        animate="animate"
        className="max-w-3xl text-center space-y-7 z-30 select-none"
      >
        {/* Dynamic header icon */}
        {isWerewolfKill ? (
          <motion.div
            animate={{ scale: [0.95, 1.25, 1.25, 0.95], rotate: [0, -10, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="mx-auto mb-4 relative flex items-center justify-center w-24 h-24 text-red-500 filter drop-shadow-[0_0_20px_rgba(239,68,68,0.7)]"
          >
            <Skull className="w-16 h-16" />
          </motion.div>
        ) : isNightStart ? (
          <motion.div
            animate={{ rotate: 360, scale: [0.95, 1.05, 0.95] }}
            transition={{ rotate: { duration: 40, repeat: Infinity, ease: "linear" }, scale: { duration: 6, repeat: Infinity, ease: "easeInOut" } }}
            className="mx-auto mb-4 relative flex items-center justify-center w-20 h-20 text-[#a78bfa] filter drop-shadow-[0_0_15px_rgba(167,139,250,0.6)]"
          >
            <Moon className="w-14 h-14" />
          </motion.div>
        ) : isVote ? (
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="mx-auto mb-4 flex items-center justify-center w-20 h-20 text-amber-500 filter drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]"
          >
            <Shield className="w-14 h-14" />
          </motion.div>
        ) : isGameOver ? (
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="mx-auto mb-4 flex items-center justify-center w-24 h-24 text-emerald-400 filter drop-shadow-[0_0_20px_rgba(52,211,153,0.7)]"
          >
            <Skull className="w-16 h-16" />
          </motion.div>
        ) : (
          <Moon className="text-[#8b5cf6] w-14 h-14 mx-auto animate-pulse mb-2" />
        )}

        <p className={`font-cinzel text-xl md:text-3xl font-bold tracking-wider leading-relaxed text-glow ${
          isWerewolfKill ? 'text-red-500 font-extrabold shadow-red-glow animate-pulse' : 'text-[#e8d5b7]'
        }`}>
          {displayedText}
        </p>

        <div className={`w-32 h-0.5 mx-auto mt-4 animate-pulse bg-gradient-to-r ${
          isWerewolfKill 
            ? 'from-transparent via-red-600 to-transparent shadow-[0_0_8px_rgba(220,38,38,0.8)]' 
            : 'from-transparent via-[#8b5cf6] to-transparent shadow-glow'
        }`} />
      </motion.div>
    </motion.div>
  );
};

export default function Game() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const villageRef = useRef(null);
  const chatEndRef = useRef(null);

  // States
  const [socket, setSocket] = useState(null);
  const [players, setPlayers] = useState({});
  const [mySocketId, setMySocketId] = useState(null);
  const [phase, setPhase] = useState('lobby');
  const [narration, setNarration] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatMsg, setChatMsg] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [emotes, setEmotes] = useState({});
  
  // Game session states
  const [myRole, setMyRole] = useState(null);
  const [allies, setAllies] = useState([]);
  const [loverPartner, setLoverPartner] = useState(null);
  const [actionRequest, setActionRequest] = useState(null);
  const [actionResult, setActionResult] = useState(null);
  
  // Selection targets
  const [selectedTarget1, setSelectedTarget1] = useState('');
  const [selectedTarget2, setSelectedTarget2] = useState('');
  
  // Realtime vote states
  const [votes, setVotes] = useState({});
  const [voteCounts, setVoteCounts] = useState({});
  const [defendantSocketId, setDefendantSocketId] = useState(null);
  const [revotes, setRevotes] = useState({ killVotes: 0, saveVotes: 0 });
  const [gameOverData, setGameOverData] = useState(null);

  // Autoscroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  // Chat console draggable & resizable states
  const [chatPosition, setChatPosition] = useState({ x: 0, y: 0 });
  const [chatSize, setChatSize] = useState({ width: 500, height: 260 });
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize position once window size is available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const initialWidth = 500;
      const initialHeight = 260;
      setChatPosition({
        x: Math.max(20, (window.innerWidth - initialWidth) / 2),
        y: Math.max(100, window.innerHeight - initialHeight - 80),
      });
      setChatSize({ width: initialWidth, height: initialHeight });
      setIsInitialized(true);
    }
  }, []);

  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, posX: 0, posY: 0 });

  const handleDragStart = (e) => {
    if (e.target.closest('input') || e.target.closest('button') || e.target.closest('select')) return;
    
    dragRef.current.isDragging = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    dragRef.current.posX = chatPosition.x;
    dragRef.current.posY = chatPosition.y;
    
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  };

  const handleDragMove = (e) => {
    if (!dragRef.current.isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    
    const newX = Math.max(10, Math.min(window.innerWidth - chatSize.width - 10, dragRef.current.posX + dx));
    const newY = Math.max(60, Math.min(window.innerHeight - chatSize.height - 10, dragRef.current.posY + dy));
    
    setChatPosition({ x: newX, y: newY });
  };

  const handleDragEnd = () => {
    dragRef.current.isDragging = false;
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  };

  const resizeRef = useRef({ isResizing: false, startX: 0, startY: 0, startWidth: 0, startHeight: 0 });

  const handleResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    resizeRef.current.isResizing = true;
    resizeRef.current.startX = e.clientX;
    resizeRef.current.startY = e.clientY;
    resizeRef.current.startWidth = chatSize.width;
    resizeRef.current.startHeight = chatSize.height;
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = (e) => {
    if (!resizeRef.current.isResizing) return;
    const dx = e.clientX - resizeRef.current.startX;
    const dy = e.clientY - resizeRef.current.startY;
    
    const newWidth = Math.max(340, Math.min(800, resizeRef.current.startWidth + dx));
    const newHeight = Math.max(180, Math.min(500, resizeRef.current.startHeight + dy));
    
    setChatSize({ width: newWidth, height: newHeight });
  };

  const handleResizeEnd = () => {
    resizeRef.current.isResizing = false;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  // Connect socket
  useEffect(() => {
    const token = localStorage.getItem('nf_token');
    if (!token) { navigate('/login', { replace: true }); return; }

    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => {
      setMySocketId(s.id);
      console.log('🔌 Connected to Socket.IO Server on ID:', s.id);
    });

    s.on('game:state', (state) => {
      setPlayers(state.players);
      setPhase(state.phase);
      setDefendantSocketId(state.defendantSocketId);
      setVotes(state.votes || {});
      setVoteCounts(state.voteCounts || {});
      setRevotes(state.revotes || { killVotes: 0, saveVotes: 0 });
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

    s.on('game:phase', ({ phase: newPhase }) => {
      setPhase(newPhase);
      setActionResult(null);
      setActionRequest(null);
      setSelectedTarget1('');
      setSelectedTarget2('');
      if (newPhase === 'lobby') {
        setMyRole(null);
        setAllies([]);
        setLoverPartner(null);
        setGameOverData(null);
      }
    });

    s.on('role:reveal', ({ role, allies: wolfAllies }) => {
      setMyRole(role);
      setAllies(wolfAllies || []);
    });

    s.on('lover:reveal', ({ partnerUsername }) => {
      setLoverPartner(partnerUsername);
    });

    s.on('action:request', (req) => {
      setActionRequest(req);
    });

    s.on('action:result', ({ text }) => {
      setActionResult(text);
      setActionRequest(null);
    });

    s.on('werewolf:voteUpdate', ({ targetId, voter }) => {
      const targetName = players[targetId]?.username || 'Dân Làng';
      setChatLog(prev => [...prev, { username: '🐺 Kênh Sói', text: `Sói [${voter}] chọn cắn [${targetName}]` }]);
    });

    s.on('game:over', (data) => {
      setPhase('gameover');
      setGameOverData(data);
      setNarration({ text: `🏆 KẾT QUẢ: PHE ${data.winner || 'GAME OVER'} CHIẾN THẮNG!`, visible: true });
    });

    s.on('narration:display', ({ text, duration }) => {
      setNarration({ text, visible: true });
      setTimeout(() => setNarration(null), duration || 5000);
    });

    s.on('narration:clear', () => setNarration(null));

    s.on('death:announce', ({ deadPlayerIds }) => {
      // Handled
    });

    s.on('vote:update', ({ votes: vMap, counts: cMap }) => {
      setVotes(vMap || {});
      setVoteCounts(cMap || {});
    });

    s.on('revote:update', (revoteData) => {
      setRevotes(revoteData);
    });

    s.on('chat:message', ({ username, text }) => {
      setChatLog(prev => [...prev.slice(-50), { username, text, time: Date.now() }]);
    });

    s.on('error', (err) => {
      alert(`⚠️ Lỗi: ${err.message}`);
    });

    setSocket(s);
    return () => { s.close(); setSocket(null); };
  }, [navigate]);

  // Handle 3D click-to-move
  const handleMoveTo = useCallback((x3d, z3d) => {
    if (socket && players[mySocketId]?.isAlive) {
      socket.emit('player:move', { x: x3d, y: z3d });
      setPlayers(prev => prev[mySocketId]
        ? { ...prev, [mySocketId]: { ...prev[mySocketId], x: x3d, y: z3d } }
        : prev);
    }
  }, [socket, mySocketId, players]);

  // Emote
  const doEmote = (emote) => {
    if (socket && players[mySocketId]?.isAlive) socket.emit('player:interact', emote);
  };

  // Chat
  const sendChat = () => {
    if (!chatMsg.trim() || !socket) return;
    socket.emit('chat:send', { text: chatMsg.trim() });
    setChatMsg('');
  };

  // Admin Actions
  const adminAction = (action) => {
    if (socket && players[mySocketId]?.isAdmin) socket.emit(action);
  };

  // Cast vote
  const castVote = (targetSid) => {
    if (socket && phase === 'vote') {
      const newTarget = votes[mySocketId] === targetSid ? null : targetSid;
      socket.emit('vote:cast', { targetPlayerId: newTarget });
    }
  };

  // Cast revote
  const castRevote = (decision) => {
    if (socket && phase === 'revote') {
      socket.emit('vote:revote', { action: decision });
    }
  };

  // Submit Night Action
  const submitNightAction = (type) => {
    if (!socket || !actionRequest) return;
    
    if (type === 'cupid_link') {
      if (!selectedTarget1 || !selectedTarget2 || selectedTarget1 === selectedTarget2) {
        alert('Vui lòng chọn 2 người yêu nhau khác nhau!');
        return;
      }
      socket.emit('game:action', { actionType: 'cupid_link', loverId1: selectedTarget1, loverId2: selectedTarget2 });
    } else if (type === 'witch_heal') {
      socket.emit('game:action', { actionType: 'witch_heal' });
    } else if (type === 'witch_pass') {
      socket.emit('game:action', { actionType: 'witch_pass' });
    } else {
      const tgt = selectedTarget1;
      if (!tgt) { alert('Vui lòng chọn một mục tiêu!'); return; }
      socket.emit('game:action', { actionType: type, targetId: tgt });
    }
  };

  const playerList = Object.entries(players);
  const me = players[mySocketId];
  const isAdmin = me?.isAdmin;
  const isAlive = me?.isAlive;

  const handleLogout = () => { logout(); navigate('/', { replace: true }); };

  return (
    <div className="fixed inset-0 bg-[#0a0e1a] flex flex-col overflow-hidden font-inter text-[#e2e8f0]">
      {/* ===== TOP BAR ===== */}
      <div className="relative z-30 bg-[#121829]/95 backdrop-blur-md border-b border-[#8b5cf6]/20 px-6 py-3 flex items-center justify-between shrink-0 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-4">
          <Moon className="text-[#8b5cf6] animate-pulse" size={24} />
          <span className="font-cinzel font-black text-[#e8d5b7] text-lg tracking-[0.2em] text-glow">NIGHTFALL</span>
          <span className="px-3 py-1 rounded-full text-xs font-cinzel font-bold tracking-wider shadow-[0_0_10px_rgba(139,92,246,0.2)] border border-[#8b5cf6]/30"
            style={{ backgroundColor: (PHASE_DATA[phase]?.color || '#8b5cf6') + '25', color: PHASE_DATA[phase]?.color }}>
            {PHASE_DATA[phase]?.label || phase}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-[#94a3b8] font-cinzel flex items-center gap-1.5 bg-[#1a2035] px-3 py-1.5 rounded-full border border-white/5">
            <Users size={14} className="text-[#8b5cf6]" /> {playerList.length} Dân Làng
          </span>
          {user && (
            <div className="flex items-center gap-3.5 bg-[#1a2035] border border-[#8b5cf6]/30 rounded-full pl-3 pr-2.5 py-1.5 hover:border-[#8b5cf6]/60 transition-colors">
              <span className="text-xs font-cinzel text-[#e2e8f0] font-bold">{user.username}</span>
              {me && !me.isAlive && <span className="text-[10px] bg-[#ef4444]/20 border border-[#ef4444]/40 text-[#ef4444] font-bold px-2 py-0.5 rounded-full font-cinzel">CHẾT</span>}
              {isAdmin && <span className="text-[10px] text-[#f59e0b] font-cinzel px-2.5 py-0.5 rounded-full bg-[#f59e0b]/15 border border-[#f59e0b]/30">HOST</span>}
            </div>
          )}
          <button onClick={handleLogout} className="text-[#64748b] hover:text-[#ef4444] transition-colors p-2 bg-[#1a2035] rounded-full border border-white/5" title="Rời làng">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* ===== MAIN CONTAINER ===== */}
      <div className="flex-1 flex relative overflow-hidden">
        
        {/* Left Side: Game Screen */}
        <div className="flex-1 relative flex flex-col min-w-0">
          
          {/* Game Role HUD Indicator */}
          {phase !== 'lobby' && myRole && ROLE_METADATA[myRole] && (
            <div className="absolute top-4 left-4 z-20 max-w-sm rounded-xl p-4 bg-[#121829]/95 backdrop-blur-md border border-[#8b5cf6]/30 shadow-2xl">
              <div className="flex items-center gap-3 mb-2">
                {React.createElement(ROLE_METADATA[myRole].icon, { className: "w-6 h-6", style: { color: ROLE_METADATA[myRole].color } })}
                <div>
                  <h4 className="text-xs font-cinzel tracking-widest text-[#94a3b8]">VAI TRÒ CỦA BẠN</h4>
                  <h2 className="text-md font-cinzel font-bold text-glow" style={{ color: ROLE_METADATA[myRole].color }}>
                    {ROLE_METADATA[myRole].name}
                  </h2>
                </div>
              </div>
              <p className="text-xs text-[#94a3b8] leading-relaxed mb-1.5">{ROLE_METADATA[myRole].desc}</p>
              <div className="flex flex-wrap gap-2 text-[10px] font-bold font-cinzel">
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">Phe: {ROLE_METADATA[myRole].team}</span>
                {allies.length > 0 && <span className="px-2 py-0.5 rounded bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444]">Đồng bọn: {allies.join(', ')}</span>}
                {loverPartner && <span className="px-2 py-0.5 rounded bg-[#ec4899]/10 border border-[#ec4899]/20 text-[#ec4899] flex items-center gap-1">💖 Người yêu: {loverPartner}</span>}
              </div>
            </div>
          )}

          {/* Real-time Interaction Panels on Canvas overlay */}
          <div className="absolute inset-0 z-0">
            <Village3D
              ref={villageRef}
              players={players}
              mySocketId={mySocketId}
              onMoveTo={handleMoveTo}
              phase={phase}
              emotes={emotes}
            />
          </div>

          {/* Typewriter Cinematic Narration Overlay */}
          <AnimatePresence>
            {narration && (
              <CinematicNarration text={narration.text} type={narration.type} />
            )}
          </AnimatePresence>

          {/* Game Over Recap Modal */}
          {phase === 'gameover' && gameOverData && (
            <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-2xl bg-[#121829]/95 border border-[#8b5cf6]/40 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[85vh] select-none text-glow"
              >
                {/* Header */}
                <div className="text-center border-b border-[#8b5cf6]/20 pb-4 mb-4">
                  <Award className="text-[#f59e0b] w-12 h-12 mx-auto animate-bounce mb-2" />
                  <h2 className="text-2xl font-cinzel font-black text-[#e8d5b7] tracking-widest uppercase">
                    KẾT THÚC TRÒ CHƠI
                  </h2>
                  <p className="text-sm font-cinzel font-bold text-[#ef4444] tracking-wider mt-1">
                    {gameOverData.winner} CHIẾN THẮNG
                  </p>
                </div>

                {/* Log list */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mb-6 space-y-4 font-inter text-sm">
                  <h3 className="font-cinzel text-xs text-[#64748b] tracking-wider mb-2">📜 NHẬT KÝ CHIẾN TÍCH NGÔI LÀNG</h3>
                  
                  {gameOverData.historyLogs && gameOverData.historyLogs.length > 0 ? (
                    gameOverData.historyLogs.map((log, index) => {
                      const isNight = log.nightNumber !== undefined;
                      return (
                        <div 
                          key={index}
                          className="p-4 bg-[#1a2035]/60 border border-white/5 rounded-xl space-y-2.5 hover:border-[#8b5cf6]/30 transition-colors"
                        >
                          <h4 className={`font-cinzel font-bold text-xs tracking-widest ${
                            isNight ? 'text-[#8b5cf6]' : 'text-[#f59e0b]'
                          }`}>
                            {isNight ? `🌙 ĐÊM SỐ ${log.nightNumber}` : `☀️ NGÀY SỐ ${log.dayNumber}`}
                          </h4>

                          <div className="space-y-1.5 text-xs text-[#e2e8f0]/90 leading-relaxed font-sans pl-1 border-l-2 border-white/10">
                            {isNight ? (
                              <>
                                {log.cupidLink && (
                                  <p className="flex items-center gap-1.5">
                                    <span className="text-[#ec4899]">💖 Cupid:</span> Kết duyên cho <span className="font-bold text-white">{log.cupidLink.lover1}</span> và <span className="font-bold text-white">{log.cupidLink.lover2}</span> thành đôi uyên ương.
                                  </p>
                                )}
                                {log.werewolfTarget ? (
                                  <p className="flex items-center gap-1.5">
                                    <span className="text-[#ef4444]">🐺 Bầy Sói:</span> Chọn cắn chết <span className="font-bold text-white">{log.werewolfTarget}</span>.
                                  </p>
                                ) : (
                                  <p className="flex items-center gap-1.5">
                                    <span className="text-[#ef4444]">🐺 Bầy Sói:</span> Đêm nay lặng im, không cắn ai.
                                  </p>
                                )}
                                {log.seerTarget && (
                                  <p className="flex items-center gap-1.5">
                                    <span className="text-[#3b82f6]">🔮 Tiên Tri:</span> Soi thân phận <span className="font-bold text-white">{log.seerTarget.username}</span>, phát hiện là <span className={`font-bold ${log.seerTarget.isWolf ? 'text-[#ef4444]' : 'text-[#10b981]'}`}>{log.seerTarget.isWolf ? 'Phe Sói' : 'Phe Dân'}</span>.
                                  </p>
                                )}
                                {log.guardTarget && (
                                  <p className="flex items-center gap-1.5">
                                    <span className="text-[#10b981]">🛡️ Bảo Vệ:</span> Lựa chọn bảo vệ <span className="font-bold text-white">{log.guardTarget}</span> đêm nay.
                                  </p>
                                )}
                                {log.witchAction === 'heal' && (
                                  <p className="flex items-center gap-1.5">
                                    <span className="text-[#a855f7]">🧙 Phù Thủy:</span> Sử dụng bình thuốc <span className="font-bold text-[#10b981]">CỨU SỐNG</span> mục tiêu bị Sói cắn.
                                  </p>
                                )}
                                {log.witchAction && typeof log.witchAction === 'object' && log.witchAction.type === 'poison' && (
                                  <p className="flex items-center gap-1.5">
                                    <span className="text-[#a855f7]">🧙 Phù Thủy:</span> Sử dụng bình thuốc <span className="font-bold text-[#ef4444]">ĐỘC SÁT</span> người chơi <span className="font-bold text-white">{log.witchAction.username}</span>.
                                  </p>
                                )}
                                {log.witchAction === 'pass' && (
                                  <p className="flex items-center gap-1.5">
                                    <span className="text-[#a855f7]">🧙 Phù Thủy:</span> Quyết định <span className="text-gray-400">KHÔNG DÙNG THUỐC</span> đêm nay.
                                  </p>
                                )}
                                {log.deaths.length > 0 ? (
                                  <p className="flex items-center gap-1.5 pt-1 text-[#ef4444] border-t border-white/5">
                                    <span className="font-bold">💀 Tử Sĩ:</span> Ban mai lên, người chơi <span className="font-bold text-white">{log.deaths.join(', ')}</span> đã qua đời.
                                  </p>
                                ) : (
                                  <p className="flex items-center gap-1.5 pt-1 text-[#10b981] border-t border-white/5">
                                    <span className="font-bold">🕊️ Yên Bình:</span> Đêm nay trôi qua êm đềm, không có ai ngã xuống.
                                  </p>
                                )}
                              </>
                            ) : (
                              <>
                                <p className="flex items-center gap-1.5">
                                  <span>⚖️ Bị Cáo:</span> Đưa người chơi <span className="font-bold text-white">{log.defendant}</span> lên giàn treo cổ.
                                </p>
                                <p className="flex items-center gap-1.5 text-gray-400">
                                  <span>🗳️ Biểu Quyết:</span> Có <span className="font-bold text-[#ef4444]">{log.killVotes} phiếu GIẾT</span> và <span className="font-bold text-[#10b981]">{log.saveVotes} phiếu CỨU</span>.
                                </p>
                                {log.result === 'executed' ? (
                                  <p className="flex items-center gap-1.5 text-[#ef4444] font-bold">
                                    <span>💀 Kết án:</span> Dân làng đồng lòng treo cổ <span className="font-bold text-white">{log.defendant}</span>.
                                  </p>
                                ) : (
                                  <p className="flex items-center gap-1.5 text-[#10b981] font-bold">
                                    <span>🕊️ Tha bổng:</span> Dân làng bỏ phiếu tha thứ cho <span className="font-bold text-white">{log.defendant}</span>.
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-[#475569] text-center mt-8 font-cinzel tracking-wider">Không tìm thấy ghi chép sự kiện.</p>
                  )}
                </div>

                {/* Footer buttons */}
                <div className="flex gap-4">
                  {isAdmin && (
                    <button 
                      onClick={() => adminAction('admin:reset')}
                      className="flex-1 py-3 rounded-xl bg-[#f59e0b]/20 border border-[#f59e0b]/30 text-[#f59e0b] font-cinzel text-xs font-bold hover:bg-[#f59e0b]/30 transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                    >
                      🔄 THIẾT LẬP LẠI LÀNG (RESET)
                    </button>
                  )}
                  {!isAdmin && (
                    <div className="flex-1 text-center text-xs text-[#64748b] font-cinzel py-3 bg-white/5 rounded-xl border border-white/5">
                      Vui lòng đợi Host thiết lập lại màn chơi mới...
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}

          {/* Draggable & Resizable Floating Chat Console */}
          {isInitialized && (
            <div 
              style={{
                position: 'absolute',
                left: `${chatPosition.x}px`,
                top: `${chatPosition.y}px`,
                width: `${chatSize.width}px`,
                height: `${chatSize.height}px`,
              }}
              className="z-20 bg-black/75 border border-[#8b5cf6]/35 backdrop-blur-md rounded-2xl flex flex-col shadow-2xl hover:border-[#8b5cf6]/60 transition-colors shadow-[0_10px_35px_rgba(0,0,0,0.8)] overflow-hidden select-none"
            >
              {/* Drag Header Bar */}
              <div 
                onMouseDown={handleDragStart}
                className="px-4 py-2 bg-gradient-to-r from-[#8b5cf6]/10 to-transparent border-b border-white/5 flex items-center justify-between cursor-move shrink-0 select-none text-[11px] font-cinzel font-bold text-[#e2e8f0]/80 tracking-widest"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6] animate-pulse" />
                  <span>💬 KÊNH CHAT HỘI THOẠI</span>
                </div>
                <div className="flex gap-1">
                  <div className="w-1 h-2 border-l border-white/20" />
                  <div className="w-1 h-2 border-l border-white/20" />
                  <div className="w-1 h-2 border-l border-white/20" />
                </div>
              </div>

              {/* Scrollable messages with larger text */}
              <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar pr-3 pl-4 py-3 select-text max-h-full">
                {chatLog.length === 0 ? (
                  <p className="text-xs text-[#475569] text-center mt-8 font-cinzel tracking-wider">Làng đang lặng im trong sương mù...</p>
                ) : (
                  chatLog.map((msg, i) => {
                    const isWolfLog = msg.username.startsWith('🐺');
                    const isSystem = msg.username.startsWith('⚙️') || msg.username.startsWith('👻');
                    return (
                      <div key={i} className="text-sm leading-relaxed border-b border-white/5 pb-1">
                        <span className={`font-bold font-cinzel text-[13px] ${
                          isWolfLog ? 'text-[#ef4444]' : isSystem ? 'text-[#f59e0b]' : 'text-[#a78bfa]'
                        }`}>
                          {msg.username}:
                        </span>{' '}
                        <span className="text-[#f1f5f9] text-sm break-words font-medium">{msg.text}</span>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>
              
              {/* Chat Inputs */}
              <div className="flex gap-2 border-t border-white/10 px-4 py-3 shrink-0">
                <input type="text" value={chatMsg} onChange={e => setChatMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                  className="flex-1 bg-[#1a2035]/80 border border-[#8b5cf6]/20 rounded-xl px-4 py-2 text-sm text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#8b5cf6]/60 transition-colors"
                  placeholder={phase === 'night' && me?.role === 'werewolf' ? 'Thì thầm bí mật bầy sói...' : 'Nhập tin nhắn vào làng...'} />
                <button onClick={sendChat}
                  className="px-4 bg-[#8b5cf6]/20 rounded-xl hover:bg-[#8b5cf6]/40 transition-colors text-[#8b5cf6] flex items-center justify-center">
                  <Send size={14} />
                </button>
              </div>

              {/* Resize Handle (Bottom-Right Corner) */}
              <div 
                onMouseDown={handleResizeStart}
                className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5 select-none"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" className="text-white/20 hover:text-[#8b5cf6] transition-colors">
                  <line x1="6" y1="0" x2="6" y2="6" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="0" y1="6" x2="6" y2="6" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="4" y1="2" x2="4" y2="4" stroke="currentColor" strokeWidth="1" />
                  <line x1="2" y1="4" x2="4" y2="4" stroke="currentColor" strokeWidth="1" />
                </svg>
              </div>
            </div>
          )}

          {/* Action Pad Widget (Trời Tối) */}
          {phase === 'night' && isAlive && actionRequest && (
            <div className="absolute bottom-64 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-md bg-[#121829]/95 backdrop-blur-md border border-[#8b5cf6]/40 rounded-2xl p-5 shadow-2xl">
              <h3 className="font-cinzel text-[#e8d5b7] font-bold text-center tracking-wider mb-4 flex items-center justify-center gap-2">
                🌙 KÍCH HOẠT NĂNG LỰC ĐÊM
              </h3>
              
              <div className="space-y-4">
                {/* Cupid Links */}
                {actionRequest.actions.includes('cupid_link') && (
                  <div className="space-y-3">
                    <label className="text-xs text-[#94a3b8] font-cinzel">Chọn 2 người để ghép đôi yêu nhau:</label>
                    <select value={selectedTarget1} onChange={e => setSelectedTarget1(e.target.value)}
                      className="w-full bg-[#1a2035] border border-[#8b5cf6]/20 rounded-xl px-3 py-2 text-xs text-white">
                      <option value="">Chọn Người Thứ 1...</option>
                      {actionRequest.targets.map(t => (
                        <option key={t.socketId} value={t.socketId}>{t.username}</option>
                      ))}
                    </select>
                    <select value={selectedTarget2} onChange={e => setSelectedTarget2(e.target.value)}
                      className="w-full bg-[#1a2035] border border-[#8b5cf6]/20 rounded-xl px-3 py-2 text-xs text-white">
                      <option value="">Chọn Người Thứ 2...</option>
                      {actionRequest.targets.map(t => (
                        <option key={t.socketId} value={t.socketId}>{t.username}</option>
                      ))}
                    </select>
                    <button onClick={() => submitNightAction('cupid_link')}
                      className="w-full py-2.5 bg-[#ec4899] hover:bg-[#db2777] font-cinzel font-bold text-xs text-white rounded-xl transition-all shadow-[0_0_15px_rgba(236,72,153,0.3)]">
                      💘 GHÉP ĐÔI UYÊN ƯƠNG
                    </button>
                  </div>
                )}

                {/* Seer Inspect */}
                {actionRequest.actions.includes('seer_inspect') && (
                  <div className="space-y-3">
                    <label className="text-xs text-[#94a3b8] font-cinzel">Chọn 1 người để soi thân phận:</label>
                    <select value={selectedTarget1} onChange={e => setSelectedTarget1(e.target.value)}
                      className="w-full bg-[#1a2035] border border-[#8b5cf6]/20 rounded-xl px-3 py-2 text-xs text-white">
                      <option value="">Chọn một Dân Làng...</option>
                      {actionRequest.targets.map(t => (
                        <option key={t.socketId} value={t.socketId}>{t.username}</option>
                      ))}
                    </select>
                    <button onClick={() => submitNightAction('seer_inspect')}
                      className="w-full py-2.5 bg-[#3b82f6] hover:bg-[#2563eb] font-cinzel font-bold text-xs text-white rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                      🔮 SOI XEM CÓ PHẢI SÓI
                    </button>
                  </div>
                )}

                {/* Guard Protect */}
                {actionRequest.actions.includes('guard_protect') && (
                  <div className="space-y-3">
                    <label className="text-xs text-[#94a3b8] font-cinzel">Chọn 1 người để bảo vệ đêm nay:</label>
                    <select value={selectedTarget1} onChange={e => setSelectedTarget1(e.target.value)}
                      className="w-full bg-[#1a2035] border border-[#8b5cf6]/20 rounded-xl px-3 py-2 text-xs text-white">
                      <option value="">Chọn một Dân Làng...</option>
                      {actionRequest.targets.map(t => (
                        <option key={t.socketId} value={t.socketId}>{t.username}</option>
                      ))}
                    </select>
                    <button onClick={() => submitNightAction('guard_protect')}
                      className="w-full py-2.5 bg-[#10b981] hover:bg-[#059669] font-cinzel font-bold text-xs text-white rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                      🛡️ BẢO VỆ MỤC TIÊU
                    </button>
                  </div>
                )}

                {/* Werewolf Kill */}
                {actionRequest.actions.includes('werewolf_kill') && (
                  <div className="space-y-3">
                    <label className="text-xs text-[#ef4444] font-cinzel">Chọn 1 người để cắn chết:</label>
                    <select value={selectedTarget1} onChange={e => setSelectedTarget1(e.target.value)}
                      className="w-full bg-[#1a2035] border border-[#ef4444]/20 rounded-xl px-3 py-2 text-xs text-white">
                      <option value="">Chọn Nạn Nhân...</option>
                      {actionRequest.targets.map(t => (
                        <option key={t.socketId} value={t.socketId}>{t.username}</option>
                      ))}
                    </select>
                    <button onClick={() => submitNightAction('werewolf_kill')}
                      className="w-full py-2.5 bg-[#ef4444] hover:bg-[#dc2626] font-cinzel font-bold text-xs text-white rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                      🐺 CẮN CHẾT MỤC TIÊU
                    </button>
                  </div>
                )}

                {/* Witch Actions */}
                {(actionRequest.actions.includes('witch_heal') || actionRequest.actions.includes('witch_poison')) && (
                  <div className="space-y-3">
                    {actionRequest.killedTargetUsername ? (
                      <p className="text-xs text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/20 p-2.5 rounded-lg leading-relaxed text-center">
                        ⚠️ Đêm nay Sói muốn cắn chết: <span className="font-bold text-white">{actionRequest.killedTargetUsername}</span>.
                      </p>
                    ) : (
                      <p className="text-xs text-[#94a3b8] text-center">Bầy Sói dường như không cắn ai đêm nay.</p>
                    )}

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {actionRequest.hasHeal ? (
                        <button onClick={() => submitNightAction('witch_heal')}
                          className="py-2 bg-[#10b981] hover:bg-[#059669] text-xs font-cinzel font-bold text-white rounded-xl transition-all">
                          🧪 DÙNG BÌNH CỨU
                        </button>
                      ) : (
                        <button disabled className="py-2 bg-white/5 border border-white/5 text-xs font-cinzel text-gray-500 rounded-xl cursor-not-allowed">
                          Đã Hết Bình Cứu
                        </button>
                      )}

                      <button onClick={() => submitNightAction('witch_pass')}
                        className="py-2 bg-white/10 hover:bg-white/20 text-xs font-cinzel font-bold text-white rounded-xl transition-all">
                        ⏩ BỎ QUA LƯỢT
                      </button>
                    </div>

                    <div className="pt-2 border-t border-[#8b5cf6]/10 space-y-2">
                      <label className="text-xs text-[#94a3b8] font-cinzel block">Hoặc dùng bình độc hại một người:</label>
                      <div className="flex gap-2">
                        <select value={selectedTarget1} onChange={e => setSelectedTarget1(e.target.value)}
                          className="flex-1 bg-[#1a2035] border border-[#8b5cf6]/20 rounded-xl px-2.5 py-1.5 text-xs text-white">
                          <option value="">Chọn người hạ độc...</option>
                          {actionRequest.targets.map(t => (
                            <option key={t.socketId} value={t.socketId}>{t.username}</option>
                          ))}
                        </select>
                        {actionRequest.hasPoison ? (
                          <button onClick={() => submitNightAction('witch_poison')}
                            className="px-3 bg-[#dc2626] hover:bg-[#b91c1c] text-xs font-cinzel font-bold text-white rounded-xl transition-all">
                            💀 ĐỘC SÁT
                          </button>
                        ) : (
                          <button disabled className="px-3 bg-white/5 text-xs text-gray-500 rounded-xl cursor-not-allowed">
                            Hết
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action feedback popup */}
          {actionResult && (
            <div className="absolute bottom-64 left-1/2 -translate-x-1/2 z-20 bg-[#121829]/95 backdrop-blur-md border border-[#3b82f6]/40 px-6 py-3.5 rounded-2xl shadow-2xl text-center max-w-sm">
              <p className="text-xs text-white font-cinzel leading-relaxed">{actionResult}</p>
            </div>
          )}

          {/* Giant Revote Panel Overlay (CHỌN GIẾT hoặc CỨU) */}
          {phase === 'revote' && isAlive && mySocketId !== defendantSocketId && (
            <div className="absolute bottom-64 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-md bg-[#121829]/95 backdrop-blur-md border border-[#8b5cf6]/30 rounded-2xl p-5 shadow-2xl text-center">
              <h3 className="font-cinzel text-[#e2e8f0] font-bold tracking-wider mb-2">⚖️ BIỂU QUYẾT TREO CỔ</h3>
              <p className="text-xs text-[#94a3b8] mb-4">Bạn quyết định như thế nào với bị cáo?</p>
              
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => castRevote('kill')}
                  className="py-3 bg-[#ef4444] hover:bg-[#dc2626] font-cinzel font-black text-xs text-white rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                  💀 TREO CỔ (GIẾT)
                </button>
                <button onClick={() => castRevote('save')}
                  className="py-3 bg-[#10b981] hover:bg-[#059669] font-cinzel font-black text-xs text-white rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  🕊️ THA BỔNG (CỨU)
                </button>
              </div>
              
              {revotes && (
                <div className="flex justify-around items-center mt-4 pt-3 border-t border-white/5 text-[10px] font-cinzel text-[#94a3b8]">
                  <span>GIẾT: <span className="font-bold text-[#ef4444] text-xs">{revotes.killVotes || 0}</span></span>
                  <span>CỨU: <span className="font-bold text-[#10b981] text-xs">{revotes.saveVotes || 0}</span></span>
                </div>
              )}
            </div>
          )}

          {/* Map Controls hint overlay */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-[#475569] font-cinzel tracking-wider pointer-events-none z-10">
            🖱️ Kéo chuột xoay · Click đất để di chuyển · Scroll zoom
          </div>
        </div>

        {/* ===== SIDEBAR TOGGLE ===== */}
        <button onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-[#121829] border border-[#8b5cf6]/20 rounded-l-lg p-1.5 text-[#64748b] hover:text-[#8b5cf6] transition-colors shadow-lg">
          {sidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* ===== SIDEBAR PANEL ===== */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="shrink-0 bg-[#121829]/95 backdrop-blur-md border-l border-[#8b5cf6]/20 flex flex-col overflow-hidden"
            >
              {/* Player List */}
              <div className="p-4 border-b border-[#8b5cf6]/10 flex flex-col">
                <h3 className="font-cinzel text-xs text-[#64748b] tracking-wider mb-3">DÂN LÀNG ({playerList.length})</h3>
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto custom-scrollbar">
                  {playerList.map(([sid, p]) => {
                    const hasVoted = votes[mySocketId] === sid;
                    const voteCount = voteCounts[sid] || 0;
                    return (
                      <div key={sid}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-all ${
                          sid === mySocketId ? 'bg-[#8b5cf6]/15 border border-[#8b5cf6]/30' : 'hover:bg-white/5 border border-transparent'
                        } ${!p.isAlive ? 'opacity-40' : ''}`}>
                        <VillagerSprite gender={p.gender} hairStyle={p.hairStyle} hairColor={p.hairColor} size={22} />
                        
                        <div className="flex-1 min-w-0">
                          <div className="font-cinzel text-[#e2e8f0] truncate flex items-center gap-1.5">
                            <span className={!p.isAlive ? 'line-through text-gray-500' : ''}>{p.username}</span>
                            {p.isAdmin && <span className="text-[#f59e0b] text-[10px]" title="Host">👑</span>}
                            {p.isBot && <span className="text-[#3b82f6] text-[8px] px-1 py-0.5 rounded bg-[#3b82f6]/10 border border-[#3b82f6]/30 font-bold font-cinzel">BOT</span>}
                            {sid === defendantSocketId && <span className="text-[#a855f7] text-[10px] font-bold">⚖️ BỊ CÁO</span>}
                          </div>
                        </div>

                        {/* Real-time Vote Badge triggers */}
                        {phase === 'vote' && isAlive && p.isAlive && sid !== mySocketId && !p.isAdmin && p.role !== 'spectator' && (
                          <button onClick={() => castVote(sid)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-cinzel transition-all border ${
                              hasVoted 
                                ? 'bg-[#ef4444]/20 border-[#ef4444]/40 text-[#ef4444]' 
                                : 'bg-white/5 border-white/10 hover:border-[#ef4444]/50 hover:text-[#ef4444]'
                            }`}>
                            VOTE
                          </button>
                        )}

                        {/* Render active vote counts */}
                        {voteCount > 0 && (
                          <span className="w-5 h-5 rounded-full bg-[#ef4444]/20 border border-[#ef4444]/40 text-[#ef4444] font-bold font-cinzel text-[10px] flex items-center justify-center shadow-lg">
                            {voteCount}
                          </span>
                        )}

                        <span className={`w-1.5 h-1.5 rounded-full ${p.online ? 'bg-[#10b981]' : 'bg-[#64748b]'}`} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Emotes */}
              <div className="p-4 border-b border-[#8b5cf6]/10 flex-1 overflow-y-auto custom-scrollbar min-h-0">
                <h3 className="font-cinzel text-xs text-[#64748b] tracking-wider mb-2.5">CẢM XÚC</h3>
                <div className="grid grid-cols-4 gap-1.5 mb-6">
                  {EMOTES.map(em => (
                    <button key={em.action} onClick={() => doEmote(em)}
                      disabled={!isAlive}
                      className={`p-2 rounded-xl bg-[#1a2035]/60 hover:bg-[#8b5cf6]/20 transition-colors text-center text-lg ${!isAlive ? 'opacity-30 cursor-not-allowed' : ''}`}
                      title={em.label}>
                      {em.emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Master Admin / Host HUD Panel */}
              {isAdmin && (
                <div className="p-4 border-t border-[#f59e0b]/30 bg-[#f59e0b]/5 shadow-[0_-4px_20px_rgba(245,158,11,0.05)]">
                  <h3 className="font-cinzel text-xs text-[#f59e0b] tracking-wider mb-3 flex items-center justify-between">
                    <span>👑 BẢN ĐIỀU KHIỂN HOST</span>
                    <span className="text-[10px] opacity-75">Full Disclosure</span>
                  </h3>
                  
                  {/* Admin secret reveal role rosters */}
                  {phase !== 'lobby' && (
                    <div className="mb-3 max-h-[100px] overflow-y-auto text-[9px] font-cinzel text-[#94a3b8] space-y-1 custom-scrollbar border border-[#f59e0b]/20 rounded-lg p-2 bg-[#121829]">
                      <div className="font-bold border-b border-[#f59e0b]/10 pb-0.5 mb-1 text-[#f59e0b]">DANH SÁCH VAI TRÒ ẨN:</div>
                      {playerList.map(([sid, p]) => (
                        <div key={sid} className="flex justify-between">
                          <span>{p.username}:</span>
                          <span className="font-bold uppercase" style={{ color: ROLE_METADATA[p.role]?.color || '#fff' }}>
                            {ROLE_METADATA[p.role]?.name || p.role} {!p.isAlive && '(CHẾT)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {phase === 'lobby' && (
                      <button onClick={() => adminAction('admin:startGame')}
                        className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#f59e0b]/20 border border-[#f59e0b]/30 text-[#f59e0b] font-cinzel text-xs font-bold hover:bg-[#f59e0b]/30 transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                        <Play size={14} /> KHỞI CHẠY GAME
                      </button>
                    )}
                    {phase !== 'lobby' && phase !== 'gameover' && (
                      <button onClick={() => adminAction('admin:nextPhase')}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#8b5cf6]/20 border border-[#8b5cf6]/30 text-[#8b5cf6] font-cinzel text-xs font-bold hover:bg-[#8b5cf6]/30 transition-all">
                        <SkipForward size={14} /> PHASE
                      </button>
                    )}
                    <button onClick={() => adminAction('admin:reset')}
                      className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#ef4444]/25 border border-[#ef4444]/35 text-[#ef4444] font-cinzel text-xs font-bold hover:bg-[#ef4444]/35 transition-all">
                      <RotateCcw size={14} /> RESET
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
