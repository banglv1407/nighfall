import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Eye, EyeOff, UserPlus, ArrowRight, Check } from 'lucide-react';
import VillagerSprite from '../components/VillagerSprite';
import { useAuth } from '../context/AuthContext';

const CONFIG_API = '/api/auth/config';

const GENDERS = [
  { id: 'male',    label: 'Nam',  emoji: '👨' },
  { id: 'female',  label: 'Nữ',   emoji: '👩' },
  { id: 'neutral', label: 'Khác', emoji: '🧑' },
];

const PREVIEW_SIZE = 110;

export default function Register() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [gender, setGender] = useState('male');
  const [hairStyle, setHairStyle] = useState('short');
  const [hairColor, setHairColor] = useState('#1a1a1a');
  const [hairStyles, setHairStyles] = useState([]);
  const [hairColors, setHairColors] = useState([]);
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetch(CONFIG_API)
      .then(r => r.json())
      .then(data => {
        setHairStyles(data.hairStyles);
        setHairColors(data.hairColors);
      })
      .catch(() => {});
  }, []);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (form.username.length < 3) { setError('Username tối thiểu 3 ký tự'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError('Email không hợp lệ'); return; }
    if (form.password.length < 6) { setError('Mật khẩu tối thiểu 6 ký tự'); return; }
    setStep(2);
  };

  const handleRegister = async () => {
    setError(''); setLoading(true);
    try {
      await register(form.username, form.email, form.password, { gender, hairStyle, hairColor });
      navigate('/game', { replace: true });
    } catch (err) {
      setError(err.message);
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="particle absolute rounded-full bg-[#8b5cf6]/30"
            style={{ left: `${Math.random()*100}%`, top: `${Math.random()*100}%`, width: `${Math.random()*3+1}px`, height: `${Math.random()*3+1}px`, animationDelay: `${Math.random()*5}s`, animationDuration: `${Math.random()*10+10}s` }} />
        ))}
      </div>
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-gradient-radial from-[#8b5cf6]/10 to-transparent blur-3xl pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative z-10 w-full max-w-lg">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <Moon className="text-[#8b5cf6] group-hover:text-[#e8d5b7] transition-colors" size={26} />
            <span className="font-cinzel text-2xl font-black text-[#e8d5b7] tracking-[0.15em]" style={{ textShadow: '0 0 15px rgba(232,213,183,0.4), 0 0 30px rgba(139,92,246,0.3)' }}>NIGHTFALL</span>
          </Link>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-cinzel font-bold transition-all ${step >= 1 ? 'bg-[#8b5cf6] text-white' : 'bg-[#1a2035] text-[#475569]'}`}>1</div>
          <div className="w-10 h-0.5 bg-[#1a2035]"><div className={`h-full bg-[#8b5cf6] transition-all ${step >= 2 ? 'w-full' : 'w-0'}`} /></div>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-cinzel font-bold transition-all ${step >= 2 ? 'bg-[#8b5cf6] text-white' : 'bg-[#1a2035] text-[#475569]'}`}>2</div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="form" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}>
              <div className="bg-[#121829]/80 backdrop-blur-xl border border-[#8b5cf6]/30 rounded-2xl p-8 shadow-2xl" style={{ boxShadow: '0 0 40px rgba(139,92,246,0.15)' }}>
                <h2 className="font-cinzel text-2xl font-bold text-[#e8d5b7] mb-2 text-center tracking-wider">Gia Nhập Làng</h2>
                <p className="text-[#94a3b8] text-sm text-center mb-6 font-inter">Trước hết, cho làng biết tên bạn...</p>
                {error && <div className="bg-[#c41e3a]/20 border border-[#c41e3a]/50 text-[#f87171] px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[#94a3b8] text-xs font-cinzel tracking-wider mb-2">TÊN NHÂN VẬT</label>
                    <input type="text" value={form.username} onChange={e => setForm({...form, username: e.target.value})}
                      className="w-full bg-[#1a2035] border border-[#8b5cf6]/30 rounded-lg px-4 py-3 text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#8b5cf6] focus:shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-all font-inter text-sm"
                      placeholder="Tên của bạn trong làng..." required minLength={3} maxLength={20} />
                  </div>
                  <div>
                    <label className="block text-[#94a3b8] text-xs font-cinzel tracking-wider mb-2">EMAIL</label>
                    <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                      className="w-full bg-[#1a2035] border border-[#8b5cf6]/30 rounded-lg px-4 py-3 text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#8b5cf6] focus:shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-all font-inter text-sm"
                      placeholder="email@example.com" required />
                  </div>
                  <div className="relative">
                    <label className="block text-[#94a3b8] text-xs font-cinzel tracking-wider mb-2">MẬT KHẨU</label>
                    <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                      className="w-full bg-[#1a2035] border border-[#8b5cf6]/30 rounded-lg px-4 py-3 text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#8b5cf6] focus:shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-all font-inter text-sm pr-12"
                      placeholder="••••••••" required minLength={6} />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 bottom-3 text-[#475569] hover:text-[#8b5cf6] transition-colors">
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <button type="submit" className="w-full bg-[#8b5cf6]/20 border border-[#8b5cf6] text-[#e8d5b7] font-cinzel font-bold py-3.5 rounded-lg transition-all duration-300 hover:text-white hover:bg-[#8b5cf6]/40 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] text-sm tracking-wider flex items-center justify-center gap-2">
                    <span className="flex items-center gap-2">TẠO NHÂN VẬT <ArrowRight size={16} /></span>
                  </button>
                </form>
                <p className="text-center mt-5 text-sm text-[#94a3b8] font-inter">
                  Đã có tài khoản?{' '}
                  <Link to="/login" className="text-[#8b5cf6] hover:text-[#c41e3a] transition-colors font-cinzel tracking-wider">ĐĂNG NHẬP</Link>
                </p>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="customize" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <div className="bg-[#121829]/80 backdrop-blur-xl border border-[#8b5cf6]/30 rounded-2xl p-6 shadow-2xl" style={{ boxShadow: '0 0 40px rgba(139,92,246,0.15)' }}>
                <h2 className="font-cinzel text-xl font-bold text-[#e8d5b7] text-center tracking-wider mb-1">Tạo Diện Mạo</h2>
                <p className="text-[#94a3b8] text-xs text-center mb-5 font-inter">Chọn ngoại hình cho nhân vật của bạn</p>

                {error && <div className="bg-[#c41e3a]/20 border border-[#c41e3a]/50 text-[#f87171] px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

                {/* Preview */}
                <div className="flex justify-center mb-6">
                  <div className="bg-[#1a2035] rounded-2xl p-4 border border-[#8b5cf6]/20">
                    <VillagerSprite gender={gender} hairStyle={hairStyle} hairColor={hairColor} size={PREVIEW_SIZE} showLabel username={form.username || 'Bạn'} />
                  </div>
                </div>

                {/* Gender Selection */}
                <div className="mb-5">
                  <label className="block text-[#94a3b8] text-xs font-cinzel tracking-wider mb-2">GIỚI TÍNH</label>
                  <div className="grid grid-cols-3 gap-2">
                    {GENDERS.map(g => (
                      <button key={g.id} onClick={() => setGender(g.id)}
                        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 transition-all duration-200 text-sm font-cinzel font-bold ${
                          gender === g.id
                            ? 'border-[#8b5cf6] bg-[#8b5cf6]/15 text-[#e8d5b7]'
                            : 'border-[#8b5cf6]/20 bg-[#1a2035]/60 text-[#94a3b8] hover:border-[#8b5cf6]/50'
                        }`}>
                        <span className="text-xl">{g.emoji}</span>
                        <span>{g.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hair Style */}
                <div className="mb-4">
                  <label className="block text-[#94a3b8] text-xs font-cinzel tracking-wider mb-2">KIỂU TÓC</label>
                  <div className="grid grid-cols-4 gap-2">
                    {hairStyles.map(hs => (
                      <button key={hs.id} onClick={() => setHairStyle(hs.id)}
                        className={`flex flex-col items-center py-2 rounded-xl border-2 transition-all duration-200 ${
                          hairStyle === hs.id
                            ? 'border-[#8b5cf6] bg-[#8b5cf6]/15'
                            : 'border-[#8b5cf6]/20 bg-[#1a2035]/60 hover:border-[#8b5cf6]/50'
                        }`}>
                        <VillagerSprite gender={gender} hairStyle={hs.id} hairColor={hairColor} size={28} />
                        {hairStyle === hs.id && <Check size={10} className="text-[#8b5cf6] mt-0.5" />}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {hairStyles.map(hs => (
                      <span key={hs.id} onClick={() => setHairStyle(hs.id)}
                        className={`text-[10px] px-2 py-0.5 rounded-full cursor-pointer transition-all font-cinzel ${
                          hairStyle === hs.id ? 'bg-[#8b5cf6]/20 text-[#8b5cf6]' : 'text-[#64748b] hover:text-[#94a3b8]'
                        }`}>
                        {hs.emoji} {hs.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Hair Color */}
                <div className="mb-5">
                  <label className="block text-[#94a3b8] text-xs font-cinzel tracking-wider mb-2">MÀU TÓC</label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {hairColors.map(hc => (
                      <button key={hc.id} onClick={() => setHairColor(hc.id)}
                        className={`flex flex-col items-center py-2 rounded-xl border-2 transition-all duration-200 ${
                          hairColor === hc.id
                            ? 'border-[#8b5cf6] bg-[#8b5cf6]/15'
                            : 'border-[#8b5cf6]/20 bg-[#1a2035]/60 hover:border-[#8b5cf6]/50'
                        }`}>
                        <div className="w-7 h-7 rounded-full border-2 border-white/20" style={{ backgroundColor: hc.id }} />
                        <span className="text-[9px] text-[#94a3b8] mt-0.5">{hc.label}</span>
                        {hairColor === hc.id && <Check size={9} className="text-[#8b5cf6]" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button onClick={() => { setStep(1); setError(''); }}
                    className="flex-1 bg-[#1a2035] border border-[#8b5cf6]/30 text-[#94a3b8] font-cinzel font-bold py-3 rounded-lg hover:border-[#8b5cf6]/60 hover:text-[#e8d5b7] transition-all text-sm tracking-wider">
                    QUAY LẠI
                  </button>
                  <button onClick={handleRegister} disabled={loading}
                    className="flex-1 relative overflow-hidden group bg-[#8b5cf6]/20 border border-[#8b5cf6] text-[#e8d5b7] font-cinzel font-bold py-3 rounded-lg transition-all duration-300 hover:text-white hover:border-[#c41e3a] hover:shadow-[0_0_20px_rgba(196,30,58,0.5)] disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wider flex items-center justify-center gap-2">
                    <span className="relative z-10 flex items-center gap-2">
                      {loading ? <span className="inline-block w-5 h-5 border-2 border-[#e8d5b7] border-t-transparent rounded-full animate-spin" /> : <UserPlus size={16} />}
                      {loading ? 'ĐANG TẠO...' : 'VÀO LÀNG'}
                    </span>
                    <div className="absolute inset-0 h-full w-full bg-[#c41e3a] translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"
                      style={{ clipPath: 'polygon(0 0, 100% 0, 100% 85%, 85% 100%, 75% 85%, 50% 100%, 25% 85%, 15% 100%, 0 85%)' }} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
