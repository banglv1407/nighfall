import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Play, ChevronDown, Moon, Skull, Shield, Eye, User, LogOut } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Game from './pages/Game';
import ProtectedRoute from './components/ProtectedRoute';

// --- COMPONENTS ---

const ParticleBackground = () => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {[...Array(30)].map((_, i) => (
        <div 
          key={i} 
          className="particle absolute rounded-full bg-nightfall-purple/40"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: `${Math.random() * 4 + 1}px`,
            height: `${Math.random() * 4 + 1}px`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${Math.random() * 10 + 10}s`
          }}
        />
      ))}
    </div>
  );
};

const MoonPhase = () => (
  <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 opacity-80 pointer-events-none">
    <div className="relative w-64 h-64 md:w-96 md:h-96 rounded-full bg-nightfall-silver/20 moon-glow flex items-center justify-center">
      <div className="w-56 h-56 md:w-80 md:h-80 rounded-full bg-gradient-radial from-nightfall-silver/40 to-transparent blur-md"></div>
    </div>
  </div>
);

const BloodButton = ({ children, onClick, className = "" }) => (
  <button 
    onClick={onClick}
    className={`relative overflow-hidden group bg-nightfall-purple/20 border border-nightfall-purple text-nightfall-silver font-cinzel font-bold py-3 px-8 rounded-sm transition-all duration-300 hover:text-white hover:border-nightfall-blood hover:shadow-[0_0_15px_rgba(196,30,58,0.6)] ${className}`}
  >
    <span className="relative z-10">{children}</span>
    <div className="absolute inset-0 h-full w-full bg-nightfall-blood translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out blood-drip-bg"></div>
  </button>
);

const PageTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.5, ease: "easeInOut" }}
    className="pt-24 pb-20 min-h-screen relative z-10"
  >
    {children}
  </motion.div>
);

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Hide navbar on auth pages
  if (location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/game') return null;

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'News', path: '/news' },
    { name: 'Characters', path: '/characters' },
    { name: 'Lore', path: '/lore' }
  ];

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${isScrolled ? 'bg-nightfall-bg/95 backdrop-blur-md py-4 border-b border-nightfall-purple/20' : 'bg-transparent py-6'}`}>
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-3 group">
          <Moon className="text-nightfall-purple group-hover:text-nightfall-silver transition-colors" size={28} />
          <span className="font-cinzel font-bold text-2xl tracking-widest text-nightfall-silver text-glow">NIGHTFALL</span>
        </Link>
        
        <div className="hidden md:flex gap-8 text-sm font-medium font-cinzel tracking-wider">
          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              to={link.path} 
              className={`transition-all duration-300 hover:text-nightfall-purple ${location.pathname === link.path ? 'text-nightfall-purple nav-active shadow-purple-glow' : 'text-gray-300'}`}
            >
              {link.name}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-6">
          {user ? (
            <>
              <Link to="/game" className="flex items-center gap-2 bg-[#1a2035] border border-[#8b5cf6]/30 rounded-full px-4 py-1.5 text-sm font-cinzel text-[#e2e8f0] hover:border-[#8b5cf6]/60 transition-all">
                <span>{user.character.emoji}</span>
                <span>{user.username}</span>
              </Link>
              <button onClick={() => { logout(); navigate('/'); }}
                className="text-sm font-cinzel tracking-wider hover:text-nightfall-blood transition-colors flex items-center gap-1">
                <LogOut size={14} /> Leave
              </button>
            </>
          ) : (
            <>
              <Link to="/login">
                <button className="text-sm font-cinzel tracking-wider hover:text-nightfall-blood transition-colors">Log In</button>
              </Link>
              <Link to="/register">
                <BloodButton>Play Now</BloodButton>
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden text-nightfall-silver" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-nightfall-bg border-b border-nightfall-purple/20"
          >
            <div className="flex flex-col px-6 py-4 gap-4 font-cinzel">
              {navLinks.map((link) => (
                <Link 
                  key={link.name} 
                  to={link.path} 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-lg py-2 border-b border-white/5 hover:text-nightfall-purple"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

// --- PAGE COMPONENTS ---

const Hero = () => {
  return (
    <div className="relative w-full h-screen overflow-hidden flex flex-col items-center justify-center pb-20">
      <div className="absolute inset-0 z-0 bg-nightfall-bg">
        <div 
          className="w-full h-full bg-cover bg-center opacity-40 parallax-bg"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1504700610630-ac6aba3536d3?auto=format&fit=crop&q=80&w=2000)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-nightfall-bg via-nightfall-bg/60 to-transparent"></div>
      </div>

      <MoonPhase />

      <div className="relative z-10 flex flex-col items-center w-full max-w-5xl px-4 mt-20">
        <h1 className="font-cinzel text-5xl md:text-7xl font-black text-nightfall-silver mb-4 tracking-[0.2em] text-center text-glow">
          NIGHTFALL
        </h1>
        <p className="font-cinzel text-xl md:text-2xl text-nightfall-blood mb-12 tracking-widest text-center text-shadow-red">
          When the moon rises, the hunt begins.
        </p>

        <button className="group flex items-center justify-center w-20 h-20 rounded-full border-2 border-nightfall-purple/50 bg-nightfall-card/50 backdrop-blur-sm hover:border-nightfall-blood hover:bg-nightfall-blood/20 hover:shadow-[0_0_20px_rgba(196,30,58,0.5)] transition-all duration-500 mb-12">
          <Play className="text-nightfall-silver group-hover:text-white ml-1" fill="currentColor" size={32} />
        </button>

        <div className="flex flex-col items-center bg-nightfall-card/60 backdrop-blur-md p-8 rounded-lg border border-nightfall-purple/30 w-full max-w-3xl hover:border-nightfall-purple/60 transition-colors">
          <p className="text-lg font-cinzel tracking-wider mb-6 text-nightfall-silver">Available on PC, Console & Mobile</p>
          <BloodButton className="text-xl px-12 py-4">Download Now</BloodButton>
        </div>
      </div>

      <div className="absolute bottom-8 flex flex-col items-center animate-bounce-slow opacity-70 cursor-pointer text-nightfall-purple">
        <ChevronDown size={32} className="-mb-4" />
        <ChevronDown size={32} className="opacity-50" />
      </div>
    </div>
  );
};

const NewsSection = () => {
  const newsItems = [
    { title: "Nightfall Closed Beta Registration Now Open!", date: "May 20, 2026", tag: "Announcement" },
    { title: "Character Spotlight: Lukan - The Cursed Wolf", date: "May 18, 2026", tag: "Info" },
    { title: "New Map Revealed: Bloodmoon Keep Dungeon", date: "May 15, 2026", tag: "Update" },
    { title: "Developer Diary: The Art of Deception in Multiplayer", date: "May 12, 2026", tag: "Dev" },
  ];

  return (
    <section className="bg-nightfall-bg py-24 relative z-10">
      <div className="max-w-7xl mx-auto px-4">
        <h3 className="text-4xl font-cinzel font-bold text-center mb-16 tracking-[0.15em] text-nightfall-silver text-glow">
          LATEST WHISPERS
        </h3>
        
        <div className="flex flex-col lg:flex-row gap-8 bg-nightfall-card p-2 rounded-xl border border-nightfall-purple/20 shadow-[0_0_30px_rgba(0,0,0,0.8)]">
          <div className="w-full lg:w-1/2 relative overflow-hidden rounded-lg group">
            <div className="absolute inset-0 bg-nightfall-purple/20 group-hover:bg-transparent transition-colors z-10"></div>
            <img 
              src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1000" 
              alt="Bloodmoon Keep" 
              className="w-full h-[400px] object-cover transition-transform duration-1000 group-hover:scale-110"
            />
            <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black via-black/80 to-transparent z-20">
              <span className="text-nightfall-blood font-cinzel font-bold text-sm tracking-wider mb-2 block">FEATURED</span>
              <h4 className="text-2xl font-cinzel text-white">The Bloodmoon Rises: Season 1 Begins</h4>
            </div>
          </div>

          <div className="w-full lg:w-1/2 flex flex-col p-6">
            <div className="flex border-b border-nightfall-purple/30 mb-6">
              <button className="text-nightfall-silver font-cinzel font-bold pb-3 border-b-2 border-nightfall-purple px-4 text-lg">News</button>
            </div>
            <ul className="flex-1 flex flex-col justify-center gap-4">
              {newsItems.map((item, idx) => (
                <li key={idx} className="group cursor-pointer py-4 border-b border-white/5 last:border-0">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className="text-xs font-cinzel text-nightfall-purple border border-nightfall-purple/50 px-2 py-1 rounded-sm mb-2 inline-block">{item.tag}</span>
                      <p className="text-gray-300 font-medium group-hover:text-nightfall-silver transition-colors text-lg">
                        {item.title}
                      </p>
                    </div>
                    <p className="text-sm text-gray-500 whitespace-nowrap font-cinzel mt-1">{item.date}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-8 text-right">
              <Link to="/news" className="inline-block font-cinzel border border-nightfall-purple text-nightfall-purple px-8 py-2 rounded-sm hover:bg-nightfall-purple hover:text-white transition-all shadow-[0_0_10px_rgba(139,92,246,0.2)] hover:shadow-[0_0_20px_rgba(139,92,246,0.6)]">
                Read All
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Regions = () => {
  const regions = [
    { name: "Silverwood", desc: "The Starting Forest", img: "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&q=80" },
    { name: "Bloodmoon Keep", desc: "Werewolf Stronghold", img: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80" },
    { name: "Ravenwatch", desc: "Hunter's Tower", img: "https://images.unsplash.com/photo-1533630654593-b222d5d44349?auto=format&fit=crop&q=80" },
    { name: "Shadowfen", desc: "Witch's Swamp", img: "https://images.unsplash.com/photo-1504700610630-ac6aba3536d3?auto=format&fit=crop&q=80" },
    { name: "Crystalpeak", desc: "Seer's Mountain", img: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&q=80" }
  ];

  return (
    <section className="bg-nightfall-bg py-20 overflow-hidden relative z-10 border-t border-nightfall-purple/10">
      <h3 className="text-4xl font-cinzel font-bold text-center mb-16 tracking-[0.15em] text-nightfall-silver text-glow">
        REALMS OF TERROR
      </h3>
      <div className="max-w-[1920px] mx-auto px-4 h-[600px]">
        <ul className="flex h-full w-full gap-2 transition-all">
          {regions.map((region, idx) => (
            <li 
              key={idx} 
              className="group relative flex-1 hover:flex-[3] transition-all duration-700 ease-in-out overflow-hidden cursor-pointer rounded-sm border border-transparent hover:border-nightfall-purple/50"
            >
              <div 
                className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-110 opacity-50 group-hover:opacity-100 grayscale group-hover:grayscale-0"
                style={{ backgroundImage: `url(${region.img})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-nightfall-bg via-nightfall-bg/40 to-transparent opacity-90 group-hover:opacity-70 transition-opacity" />
              
              <div className="absolute bottom-10 left-0 w-full text-center z-20 px-4">
                <p className="text-3xl font-cinzel font-bold text-white tracking-widest drop-shadow-[0_5px_5px_rgba(0,0,0,1)] scale-90 group-hover:scale-100 transition-transform duration-500">
                  {region.name}
                </p>
                <p className="text-nightfall-blood font-cinzel mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-200">
                  {region.desc}
                </p>
                <div className="w-0 h-0.5 bg-nightfall-purple mx-auto mt-4 transition-all duration-700 group-hover:w-24 shadow-[0_0_10px_rgba(139,92,246,0.8)]"></div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

// --- SUB PAGES ---

const CharactersPage = () => {
  const chars = [
    { name: "Lukan", role: "Werewolf", icon: <Skull size={40}/>, desc: "Cursed by the blood moon, Lukan must deceive the villagers by day and hunt them by night. His strength is unmatched in beast form." },
    { name: "Elara", role: "Hunter", icon: <Shield size={40}/>, desc: "Armed with silver bolts and traps. If she falls in the night, she takes her attacker down with her." },
    { name: "Morwen", role: "Seer", icon: <Eye size={40}/>, desc: "Can peer into the souls of others. Each night, she learns the true nature of one player, but revealing it makes her a target." },
    { name: "Thalia", role: "Witch", icon: <Moon size={40}/>, desc: "Possesses two potions: one to save a victim of the wolves, and one to poison any player she suspects." }
  ];

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-5xl font-cinzel font-bold text-center mb-16 text-nightfall-silver text-glow mt-10">THE CAST</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {chars.map((char, idx) => (
            <div key={idx} className="bg-nightfall-card border border-nightfall-purple/30 rounded-lg p-8 hover:scale-105 hover:border-nightfall-purple hover:shadow-[0_0_30px_rgba(139,92,246,0.2)] transition-all duration-300 group">
              <div className="text-nightfall-purple mb-6 flex justify-center group-hover:text-nightfall-blood transition-colors group-hover:animate-pulse-slow">
                {char.icon}
              </div>
              <h3 className="text-3xl font-cinzel font-bold text-center text-white mb-2">{char.name}</h3>
              <p className="text-center font-cinzel text-nightfall-blood font-bold tracking-widest mb-6">{char.role}</p>
              <p className="text-gray-400 text-center leading-relaxed">{char.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </PageTransition>
  );
};

const LorePage = () => (
  <PageTransition>
    <div className="max-w-4xl mx-auto px-4 text-center mt-10">
      <h2 className="text-5xl font-cinzel font-bold mb-10 text-nightfall-silver text-glow">THE CHRONICLES OF SILVERWOOD</h2>
      <div className="bg-nightfall-card/50 border border-nightfall-purple/20 p-10 rounded-lg shadow-2xl backdrop-blur-sm">
        <p className="text-lg text-gray-300 leading-loose mb-8 font-serif">
          "For centuries, the village of Silverwood stood as a beacon of light amidst the encroaching darkness of the Shadowfen. But a curse, ancient and blood-bound, has awakened. When the moon turns crimson, the line between man and beast blurs."
        </p>
        <p className="text-lg text-gray-300 leading-loose mb-8 font-serif">
          Trust no one. The neighbor who shared your fire by day may bare fangs at your throat by night. The Hunter readies their silver, the Seer gazes into the abyss, and the Witch brews salvation and death in equal measure.
        </p>
        <p className="text-xl font-cinzel text-nightfall-blood mt-12 font-bold tracking-widest">
          SURVIVE THE NIGHT. TRUST NO ONE.
        </p>
      </div>
    </div>
  </PageTransition>
);

const NewsPage = () => (
  <PageTransition>
    <div className="max-w-5xl mx-auto px-4 mt-10">
      <h2 className="text-5xl font-cinzel font-bold text-center mb-16 text-nightfall-silver text-glow">ALL WHISPERS</h2>
      <div className="space-y-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-nightfall-card p-6 border-l-4 border-nightfall-purple hover:border-nightfall-blood transition-colors flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-2xl font-cinzel text-white mb-2">Patch {1.0 + i * 0.1} - The Blood Moon Rises</h3>
              <p className="text-gray-400">Balancing updates for the Werewolf faction and new visual effects for the Seer's vision...</p>
            </div>
            <BloodButton className="whitespace-nowrap px-6 py-2 text-sm">Read More</BloodButton>
          </div>
        ))}
      </div>
    </div>
  </PageTransition>
);

const CookieBanner = () => {
  const [isVisible, setIsVisible] = useState(true);
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 w-full bg-nightfall-bg/95 backdrop-blur-md text-sm py-4 px-6 z-[1010] flex flex-col md:flex-row items-center justify-center gap-6 border-t border-nightfall-purple/30 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
      <p className="text-gray-300 text-center font-inter">
        We use cookies to track the beasts in the night. By continuing, you accept your fate. {' '}
        <a href="#" className="text-nightfall-purple hover:text-nightfall-blood transition-colors underline decoration-nightfall-purple/50">Read the Grimoire</a>
      </p>
      <button 
        onClick={() => setIsVisible(false)}
        className="bg-nightfall-purple text-white px-8 py-2 rounded-sm font-cinzel font-bold hover:bg-nightfall-blood transition-colors"
      >
        I ACCEPT
      </button>
    </div>
  );
};

// --- MAIN APP COMPONENT ---

const App = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="relative font-inter text-white bg-nightfall-bg min-h-screen selection:bg-nightfall-purple selection:text-white">
      <ParticleBackground />
      <Navbar />
      
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Hero />
              <NewsSection />
              <Regions />
            </motion.div>
          } />
          <Route path="/characters" element={<CharactersPage />} />
          <Route path="/lore" element={<LorePage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/game" element={
            <ProtectedRoute>
              <Game />
            </ProtectedRoute>
          } />
        </Routes>
      </AnimatePresence>

      {/* <CookieBanner /> */}
    </div>
  );
};

export default App;