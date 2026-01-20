import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import UploadView from './components/UploadView';
import RetrieveView from './components/RetrieveView';
import SystemAudit from './components/SystemAudit';
import GlobalStats from './components/GlobalStats';
import { TempFile } from './types';
import { Hourglass, ShieldCheck, Copy, CheckCircle2, QrCode, ArrowLeft, Zap, Github, Repeat, Link as LinkIcon, Eye, ExternalLink, Infinity, Sun, Moon, Activity, BarChart3 } from 'lucide-react';

// --- Particle System Types ---
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
}

export default function App() {
  const [view, setView] = useState<'upload' | 'retrieve'>('upload');
  const [uploadedFile, setUploadedFile] = useState<TempFile | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [linkCopySuccess, setLinkCopySuccess] = useState(false);
  const [externalCode, setExternalCode] = useState<string>('');
  
  // Modals
  const [showAudit, setShowAudit] = useState(false);
  const [showStats, setShowStats] = useState(false);
  
  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('theme');
        if (stored === 'dark' || stored === 'light') return stored;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  // Canvas Refs for Particles
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- Theme Effect ---
  useEffect(() => {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // --- Check URL Params (and Fragments) on Load ---
  useEffect(() => {
    // Priority: Check Fragment (Hash) first for privacy-first sharing
    // e.g. domain.com/#code=ABC-123
    let code = '';
    
    if (window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const hashCode = hashParams.get('code');
        if (hashCode) code = hashCode;
    }

    // Fallback: Check Query Params (Legacy support)
    if (!code) {
        const params = new URLSearchParams(window.location.search);
        const queryCode = params.get('code');
        if (queryCode) code = queryCode;
    }

    if (code) {
      setExternalCode(code);
      setView('retrieve');
      // Clean URL without reloading to hide code from visual inspection if desired, 
      // though typically keeping it there allows refresh. 
      // For privacy from browser history, we can't do much, but the Fragment prevents Server Logs.
    }
  }, []);

  // --- Particle Animation Logic ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createParticles = () => {
      const count = Math.floor((window.innerWidth * window.innerHeight) / 20000); 
      particles = [];
      for (let i = 0; i < count; i++) {
        // Adjust colors based on theme, though these are re-calc'd on render loop usually.
        // For simplicity, we keep cyan/violet but vary opacity.
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.2, 
          vy: (Math.random() - 0.5) * 0.2,
          size: Math.random() * 2,
          color: Math.random() > 0.5 ? 'rgb(34, 211, 238)' : 'rgb(167, 139, 250)' 
        });
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        // Lower opacity for particles in light mode
        const alpha = theme === 'dark' ? (Math.random() * 0.3 + 0.1) : (Math.random() * 0.2 + 0.05);
        ctx.fillStyle = p.color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener('resize', resize);
    resize();
    createParticles();
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme]); // Re-run if theme changes to adjust particle opacity logic

  // --- QR Code Generation ---
  useEffect(() => {
    if (uploadedFile) {
      const generateQR = async () => {
        try {
          // Use Hash-based URL for sharing (Privacy friendly)
          const shareUrl = `${window.location.origin}/#code=${uploadedFile.code}`;

          // Always use high contrast black on white/transparent for logic, but we render on white bg
          const url = await QRCode.toDataURL(shareUrl, {
            width: 400,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#00000000'
            }
          });
          setQrCodeUrl(url);
        } catch (err) {
          console.error(err);
        }
      };
      generateQR();
    }
  }, [uploadedFile]);

  // --- Handlers ---
  const handleUploadSuccess = (file: TempFile) => {
    setUploadedFile(file);
  };

  const handleCopyCode = () => {
    if (uploadedFile) {
      navigator.clipboard.writeText(uploadedFile.code);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleCopyLink = () => {
    if (uploadedFile) {
        // Use Hash-based URL
        const link = `${window.location.origin}/#code=${uploadedFile.code}`;
        navigator.clipboard.writeText(link);
        setLinkCopySuccess(true);
        setTimeout(() => setLinkCopySuccess(false), 2000);
    }
  };

  const handleGoToRetrieve = () => {
      if (uploadedFile) {
          setExternalCode(uploadedFile.code);
          setUploadedFile(null);
          setView('retrieve');
      }
  };

  const resetApp = () => {
    setUploadedFile(null);
    setQrCodeUrl('');
    setExternalCode('');
    setView('upload');
  };

  return (
    <div className="min-h-screen relative overflow-hidden text-slate-800 dark:text-slate-200 font-sans selection:bg-cyan-500/30">
      
      {/* Background Atmosphere */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] animate-blob mix-blend-multiply dark:mix-blend-screen pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-[100px] animate-blob animation-delay-2000 mix-blend-multiply dark:mix-blend-screen pointer-events-none"></div>
      <div className="absolute inset-0 bg-grid-pattern z-0 pointer-events-none"></div>
      <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none opacity-40" />

      {/* Main Container */}
      <div className="relative z-10 flex flex-col min-h-screen">
        
        {/* Header */}
        <header className="p-6 flex flex-col md:flex-row items-center justify-between gap-4 max-w-5xl mx-auto w-full">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={resetApp}>
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-400 blur-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
                  <Hourglass className="text-cyan-600 dark:text-cyan-400 relative z-10 transition-transform group-hover:rotate-180 duration-700" size={32} />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">
                      CHRONOS
                  </h1>
                  <p className="text-[10px] text-cyan-600 dark:text-cyan-400/80 font-mono tracking-widest uppercase">Bóveda de Datos Efímera</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                {/* Stats Button */}
                 <button 
                    onClick={() => setShowStats(true)}
                    className="p-2.5 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-md border border-slate-200 dark:border-slate-700 hover:scale-105 transition-transform hover:text-violet-500 dark:hover:text-violet-400"
                    title="Estadísticas Globales"
                >
                    <BarChart3 size={18} />
                </button>

                {/* Audit Button */}
                <button 
                    onClick={() => setShowAudit(true)}
                    className="p-2.5 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-md border border-slate-200 dark:border-slate-700 hover:scale-105 transition-transform hover:text-cyan-500 dark:hover:text-cyan-400"
                    title="Auditoría del Sistema"
                >
                    <Activity size={18} />
                </button>

                {/* Theme Toggle */}
                <button 
                    onClick={toggleTheme}
                    className="p-2.5 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-md border border-slate-200 dark:border-slate-700 hover:scale-105 transition-transform"
                    aria-label="Toggle Theme"
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                {!uploadedFile && (
                    <nav className="flex p-1 bg-white/50 dark:bg-slate-900/60 rounded-full border border-slate-200 dark:border-slate-700/50 backdrop-blur-md shadow-lg ml-2">
                        <button 
                            onClick={() => setView('upload')}
                            className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 ${view === 'upload' ? 'bg-cyan-500 text-white dark:text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
                        >
                            Subir
                        </button>
                        <button 
                            onClick={() => setView('retrieve')}
                            className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 ${view === 'retrieve' ? 'bg-emerald-500 text-white dark:text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
                        >
                            Recuperar
                        </button>
                    </nav>
                )}
            </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 flex flex-col items-center justify-center p-4 w-full max-w-5xl mx-auto">
            
            {/* Success View */}
            {uploadedFile ? (
                <div className="w-full max-w-md animate-fade-in perspective-1000">
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden group">
                        
                        {/* Top Glow */}
                        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-cyan-500/10 to-transparent pointer-events-none"></div>

                        <div className="flex flex-col items-center mb-8 relative z-10">
                            <div className="w-20 h-20 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(6,182,212,0.3)] transform rotate-3 group-hover:rotate-0 transition-transform duration-500">
                                <ShieldCheck size={40} className="text-white drop-shadow-md" />
                            </div>
                            <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-1">¡Cifrado Exitoso!</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">El archivo está seguro en la nube</p>
                        </div>

                        {/* Code Display */}
                        <div className="bg-slate-100 dark:bg-black/40 rounded-2xl p-6 mb-8 border border-slate-200 dark:border-slate-700/50 relative overflow-hidden">
                            <div className="absolute inset-0 bg-grid-pattern opacity-10 dark:opacity-30"></div>
                            <p className="text-[10px] text-cyan-600 dark:text-cyan-400/80 uppercase font-bold tracking-[0.2em] mb-3 relative z-10">Código de Acceso</p>
                            <div className="text-5xl font-mono font-bold text-slate-900 dark:text-white tracking-wider mb-4 select-all drop-shadow-[0_0_10px_rgba(34,211,238,0.5)] relative z-10">
                                {uploadedFile.code}
                            </div>
                            
                            <div className="flex gap-2 relative z-10">
                                <button 
                                    onClick={handleCopyCode}
                                    className="flex-1 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 shadow-sm"
                                >
                                    {copySuccess ? <CheckCircle2 size={16} className="text-emerald-500 dark:text-emerald-400"/> : <Copy size={16}/>}
                                    {copySuccess ? "Copiado" : "Copiar Código"}
                                </button>
                                <button 
                                    onClick={handleCopyLink}
                                    className="flex-1 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 shadow-sm"
                                >
                                    {linkCopySuccess ? <CheckCircle2 size={16} className="text-emerald-500 dark:text-emerald-400"/> : <LinkIcon size={16}/>}
                                    {linkCopySuccess ? "Link Copiado" : "Copiar Link"}
                                </button>
                            </div>
                        </div>

                        {/* QR Code */}
                        {qrCodeUrl && (
                            <div className="flex justify-center mb-8 relative group/qr">
                                {/* Removed dark mode blend/invert classes to keep QR always black on white for reliability */}
                                <div className="p-3 bg-white rounded-2xl shadow-xl transform transition-all group-hover/qr:scale-105 group-hover/qr:shadow-2xl ring-4 ring-slate-200 dark:ring-cyan-500/20 border border-slate-100 dark:border-transparent">
                                    <img src={qrCodeUrl} alt="QR Access Code" className="w-40 h-40" />
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={handleGoToRetrieve}
                                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-900 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:-translate-y-1"
                            >
                                <Eye size={20} /> Ver / Desencriptar Ahora
                            </button>
                            
                            <button 
                                onClick={resetApp}
                                className="w-full py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                <Repeat size={20} /> Subir Otro Archivo
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* Main Views */
                <>
                    {view === 'upload' ? (
                        <UploadView onUploadSuccess={handleUploadSuccess} />
                    ) : (
                        <RetrieveView initialCode={externalCode} key={externalCode} />
                    )}
                </>
            )}

        </main>

        {/* Audit Modal */}
        {showAudit && <SystemAudit onClose={() => setShowAudit(false)} />}
        
        {/* Stats Modal */}
        {showStats && <GlobalStats onClose={() => setShowStats(false)} />}

        {/* Footer */}
        <footer className="p-6 text-center flex flex-col md:flex-row items-center justify-center gap-4 text-slate-500 dark:text-slate-600 text-[10px] font-mono uppercase tracking-widest relative z-20">
            <p className="flex items-center justify-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
                <Zap size={12} /> Almacenamiento Seguro vía Supabase
            </p>
        </footer>

      </div>
    </div>
  );
}