import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Moon, Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/game';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background particles */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="particle absolute rounded-full bg-[#8b5cf6]/30"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${Math.random() * 10 + 10}s`,
            }}
          />
        ))}
      </div>

      {/* Moon glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-gradient-radial from-[#8b5cf6]/10 to-transparent blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <Moon className="text-[#8b5cf6] group-hover:text-[#e8d5b7] transition-colors" size={32} />
            <span className="font-cinzel text-3xl font-black text-[#e8d5b7] tracking-[0.15em]"
              style={{ textShadow: '0 0 15px rgba(232,213,183,0.4), 0 0 30px rgba(139,92,246,0.3)' }}>
              NIGHTFALL
            </span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-[#121829]/80 backdrop-blur-xl border border-[#8b5cf6]/30 rounded-2xl p-8 shadow-2xl"
          style={{ boxShadow: '0 0 40px rgba(139,92,246,0.15), inset 0 1px 0 rgba(139,92,246,0.1)' }}>
          
          <h2 className="font-cinzel text-2xl font-bold text-[#e8d5b7] mb-2 text-center tracking-wider">
            Welcome Back
          </h2>
          <p className="text-[#94a3b8] text-sm text-center mb-8 font-inter">
            The hunt continues...
          </p>

          {error && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className="bg-[#c41e3a]/20 border border-[#c41e3a]/50 text-[#f87171] px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[#94a3b8] text-xs font-cinzel tracking-wider mb-2">USERNAME</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#1a2035] border border-[#8b5cf6]/30 rounded-lg px-4 py-3 text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#8b5cf6] focus:shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-all font-inter text-sm"
                placeholder="Enter your username"
                required
                minLength={3}
                maxLength={20}
              />
            </div>

            <div className="relative">
              <label className="block text-[#94a3b8] text-xs font-cinzel tracking-wider mb-2">PASSWORD</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#1a2035] border border-[#8b5cf6]/30 rounded-lg px-4 py-3 text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#8b5cf6] focus:shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-all font-inter text-sm pr-12"
                placeholder="••••••••"
                required
                minLength={6}
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 bottom-3 text-[#475569] hover:text-[#8b5cf6] transition-colors">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full relative overflow-hidden group bg-[#8b5cf6]/20 border border-[#8b5cf6] text-[#e8d5b7] font-cinzel font-bold py-3.5 rounded-lg transition-all duration-300 hover:text-white hover:border-[#c41e3a] hover:shadow-[0_0_20px_rgba(196,30,58,0.5)] disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wider flex items-center justify-center gap-2"
            >
              <span className="relative z-10 flex items-center gap-2">
                {loading ? (
                  <span className="inline-block w-5 h-5 border-2 border-[#e8d5b7] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <LogIn size={18} />
                )}
                {loading ? 'ENTERING...' : 'ENTER THE NIGHT'}
              </span>
              <div className="absolute inset-0 h-full w-full bg-[#c41e3a] translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"
                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 85%, 85% 100%, 75% 85%, 50% 100%, 25% 85%, 15% 100%, 0 85%)' }}
              />
            </button>
          </form>

          <p className="text-center mt-8 text-sm text-[#94a3b8] font-inter">
            Not yet marked by fate?{' '}
            <Link to="/register" className="text-[#8b5cf6] hover:text-[#c41e3a] transition-colors font-cinzel tracking-wider">
              CLAIM YOUR IDENTITY
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
