import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import UploadView from './components/UploadView';
import RetrieveView from './components/RetrieveView';
import { TempFile } from './types';
import { Hourglass, ShieldCheck, Copy, CheckCircle2, QrCode, ArrowLeft, Zap, Github, Repeat, Link as LinkIcon, Eye, ExternalLink } from 'lucide-react';

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

  // Canvas Refs for Particles
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- Check URL Params on Load ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam) {
      setExternalCode(codeParam);
      setView('retrieve');
      
      // Clean URL without reloading
      window.history.replaceState({}, document.title, window.location.pathname);
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
      const count = Math.floor((window.innerWidth * window.innerHeight) / 15000);
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: Math.random() * 2,
          color: Math.random() > 0.5 ? 'rgba(100, 200, 255, ' : 'rgba(255, 100, 200, '
        });
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around screen
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + (Math.random() * 0.3 + 0.1) + ')';
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
  }, []);

  // --- QR Code Generation ---
  useEffect(() => {
    if (uploadedFile) {
      const generateQR = async () => {
        try {
          // Determine color based on file type
          let colorDark = '#ffffff'; // Default white
          if (uploadedFile.type === 'image') colorDark = '#22d3ee'; // Cyan
          else if (uploadedFile.type === 'audio') colorDark = '#f472b6'; // Pink
          else if (uploadedFile.type === 'video') colorDark = '#a78bfa'; // Violet
          else if (uploadedFile.type === 'text') colorDark = '#fbbf24'; // Amber

          // Create the full URL for the QR code
          const shareUrl = `${window.location.origin}?code=${uploadedFile.code}`;

          const url = await QRCode.toDataURL(shareUrl, {
            width: 400,
            margin: 2,
            color: {
              dark: colorDark,
              light: '#00000000' // Transparent background
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
        const link = `${window.location.origin}?code=${uploadedFile.code}`;
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
    <div className="min-h-screen relative overflow-hidden text-slate-200 font-sans selection:bg-cyan-500/30">
      
      {/* Background Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none opacity-60" />
      <div className="absolute inset-0 bg-grid-pattern opacity-20 z-0 pointer-events-none"></div>

      {/* Main Container */}
      <div className="relative z-10 flex flex-col min-h-screen">
        
        {/* Header */}
        <header className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={resetApp}>
                <Hourglass className="text-cyan-400 animate-pulse" />
                <h1 className="text-2xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-600">
                    CHRONOS
                </h1>
            </div>
            {!uploadedFile && (
                <nav className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700 backdrop-blur-md">
                    <button 
                        onClick={() => setView('upload')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'upload' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        Subir
                    </button>
                    <button 
                        onClick={() => setView('retrieve')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'retrieve' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        Recuperar
                    </button>
                </nav>
            )}
        </header>

        {/* Content Area */}
        <main className="flex-1 flex flex-col items-center justify-center p-4">
            
            {/* Success View */}
            {uploadedFile ? (
                <div className="w-full max-w-md animate-fade-in">
                    <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-600 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
                        
                        {/* Top Decoration */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500"></div>

                        <div className="flex flex-col items-center mb-6">
                            <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mb-4">
                                <ShieldCheck size={32} className="text-cyan-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">¡Archivo Seguro!</h2>
                            <p className="text-slate-400 text-sm mt-1">Listo para compartir</p>
                        </div>

                        {/* Code Display */}
                        <div className="bg-slate-900 rounded-2xl p-6 mb-6 border border-slate-700 relative group">
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-2">Código de Acceso</p>
                            <div className="text-4xl font-mono font-bold text-cyan-400 tracking-wider mb-2 select-all">
                                {uploadedFile.code}
                            </div>
                            
                            <div className="flex gap-2 mt-4">
                                <button 
                                    onClick={handleCopyCode}
                                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-slate-300 text-sm font-semibold flex items-center justify-center gap-2"
                                >
                                    {copySuccess ? <CheckCircle2 size={16} className="text-emerald-400"/> : <Copy size={16}/>}
                                    {copySuccess ? "Copiado" : "Copiar Código"}
                                </button>
                                <button 
                                    onClick={handleCopyLink}
                                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-slate-300 text-sm font-semibold flex items-center justify-center gap-2"
                                >
                                    {linkCopySuccess ? <CheckCircle2 size={16} className="text-emerald-400"/> : <LinkIcon size={16}/>}
                                    {linkCopySuccess ? "Link Copiado" : "Copiar Link"}
                                </button>
                            </div>
                        </div>

                        {/* QR Code */}
                        {qrCodeUrl && (
                            <div className="flex justify-center mb-6 relative group">
                                <div className="p-4 bg-white rounded-2xl shadow-lg transform transition-transform hover:scale-105 duration-300">
                                    <img src={qrCodeUrl} alt="QR Access Code" className="w-48 h-48" />
                                </div>
                                <div className="absolute -bottom-8 text-slate-500 text-xs">Escanea para abrir directo</div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3 flex-col">
                            <button 
                                onClick={handleGoToRetrieve}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                            >
                                <Eye size={18} /> Ver / Desencriptar Ahora
                            </button>
                            
                            <button 
                                onClick={resetApp}
                                className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                            >
                                <Repeat size={18} /> Subir Otro Archivo
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

        {/* Footer */}
        <footer className="p-6 text-center text-slate-600 text-xs font-mono">
            <p className="flex items-center justify-center gap-2">
                <Zap size={12} /> Powered by Supabase
            </p>
        </footer>

      </div>
    </div>
  );
}