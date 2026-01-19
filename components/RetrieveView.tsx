import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TempFile } from '../types';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { decryptFile } from '../utils/crypto';
import AudioPlayer from './AudioPlayer';
import { Search, Clock, EyeOff, FileImage, FileVideo, AlertTriangle, Loader2, Database, Eye, Flame, Unlock, Shield, FileText, Copy, Check, Music, Lock, KeyRound, X, Maximize2 } from 'lucide-react';

interface RetrieveViewProps {
  initialCode?: string;
}

// Theme Helper for Retrieval
const getRetrieveTheme = (type?: string) => {
    if (type === 'text') {
        return {
            color: 'text-amber-400',
            border: 'border-amber-500',
            bg: 'bg-amber-600',
            gradient: 'from-amber-500 to-orange-600',
            btnBg: 'bg-emerald-600 hover:bg-emerald-500', // Keep search button emerald
            ring: 'focus:border-amber-500'
        };
    }
    if (type === 'audio') {
        return {
            color: 'text-pink-400',
            border: 'border-pink-500',
            bg: 'bg-pink-600',
            gradient: 'from-pink-500 to-rose-600',
            btnBg: 'bg-emerald-600 hover:bg-emerald-500',
            ring: 'focus:border-pink-500'
        };
    }
    if (type === 'video') {
        return {
            color: 'text-violet-400',
            border: 'border-violet-500',
            bg: 'bg-violet-600',
            gradient: 'from-violet-600 to-fuchsia-600',
            btnBg: 'bg-emerald-600 hover:bg-emerald-500',
            ring: 'focus:border-violet-500'
        };
    }
    // Default / Image
    return {
        color: 'text-cyan-400',
        border: 'border-cyan-500',
        bg: 'bg-cyan-600',
        gradient: 'from-cyan-600 to-blue-600',
        btnBg: 'bg-emerald-600 hover:bg-emerald-500',
        ring: 'focus:border-cyan-500'
    };
};

const RetrieveView: React.FC<RetrieveViewProps> = ({ initialCode }) => {
  const [code, setCode] = useState(initialCode || '');
  const [foundFile, setFoundFile] = useState<TempFile | null>(null);
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  
  // States for UX
  const [isSearching, setIsSearching] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [burnStatus, setBurnStatus] = useState<'pending' | 'burning' | 'burnt'>('pending');
  const [burnCountdown, setBurnCountdown] = useState<number | null>(null);
  const [textCopied, setTextCopied] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Password Protection States
  const [isPasswordLocked, setIsPasswordLocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [cachedBlob, setCachedBlob] = useState<Blob | null>(null);
  const [cachedFileInfo, setCachedFileInfo] = useState<TempFile | null>(null);

  const hasAutoSearched = useRef(false);

  // Dynamic Theme State
  const theme = getRetrieveTheme(foundFile?.type);

  const performSearch = useCallback(async (searchCode: string) => {
    if (!isSupabaseConfigured()) {
        setError("Error: Supabase no está configurado.");
        return;
    }

    setError(null);
    setFoundFile(null);
    setDecryptedUrl(null);
    setDecryptedText(null);
    setIsPasswordLocked(false);
    setPasswordInput('');
    setCachedBlob(null);
    setCachedFileInfo(null);
    setIsSearching(true);
    setBurnStatus('pending');
    setBurnCountdown(null);
    setIsRevealed(false);
    setIsLightboxOpen(false);

    // Sanitize input: only alphanumeric and hyphens
    const targetCode = searchCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');

    try {
      // 1. Query Database
      const { data, error: dbError } = await supabase
        .from('temp_files')
        .select('*')
        .eq('code', targetCode)
        .single();

      if (dbError || !data) {
        throw new Error("Código inválido o archivo no encontrado.");
      }

      // 2. Check Expiration
      const expiresAt = new Date(data.expires_at).getTime();
      if (Date.now() > expiresAt) {
        throw new Error("Este archivo ha expirado.");
      }

      // 3. Get Download URL
      const { data: signedUrlData, error: signedError } = await supabase.storage
        .from('chronos_files')
        .createSignedUrl(data.file_path, 60);

      if (signedError || !signedUrlData) {
         if (signedError?.message.includes("bucket")) {
             throw new Error("Error de configuración: Bucket no encontrado.");
         }
        throw new Error("Error de acceso al archivo.");
      }

      // Basic file info before decryption
      const fileInfo: TempFile = {
        id: data.id,
        code: data.code,
        fileUrl: signedUrlData.signedUrl,
        type: data.type as any,
        createdAt: new Date(data.created_at).getTime(),
        expiresAt: expiresAt,
        mimeType: 'application/encrypted'
      };
      
      // Fetch the encrypted blob immediately
      const response = await fetch(signedUrlData.signedUrl);
      if (!response.ok) throw new Error("Error descargando el archivo cifrado");
      const encryptedBlob = await response.blob();
      
      setCachedBlob(encryptedBlob);
      setCachedFileInfo(fileInfo);
      setFoundFile(fileInfo); // Allows timer to start tick

      // 4. Attempt Decryption (First attempt with just Code)
      attemptDecryption(encryptedBlob, fileInfo, targetCode);

    } catch (err: any) {
      setError(err.message || "Error al buscar.");
      setIsSearching(false);
    }
  }, []);

  const attemptDecryption = async (blob: Blob, fileInfo: TempFile, keyString: string) => {
      setIsDecrypting(true);
      setError(null);

      try {
          // Decrypt Client-Side using the CODE (or CODE+PASS)
          const { blob: decryptedBlob, options, mimeType } = await decryptFile(blob, keyString);
          
          let fileType: TempFile['type'] = 'image';
          if (mimeType === 'text/plain') fileType = 'text';
          else if (mimeType.startsWith('video/')) fileType = 'video';
          else if (mimeType.startsWith('audio/')) fileType = 'audio';

          if (mimeType === 'text/plain') {
            const text = await decryptedBlob.text();
            setDecryptedText(text);
          } else {
            const objectUrl = URL.createObjectURL(decryptedBlob);
            setDecryptedUrl(objectUrl);
          }
          
          // Update file info with real data from inside the encrypted package
          setFoundFile(prev => ({
              ...fileInfo,
              type: fileType,
              mimeType: mimeType,
              options: options
          }));

          // Success - Unlock UI
          setIsPasswordLocked(false);
          setIsSearching(false); 

      } catch (err: any) {
          if (!isPasswordLocked && passwordInput === '') {
             setIsPasswordLocked(true);
             setIsSearching(false);
          } else {
             setError("Contraseña incorrecta.");
          }
      } finally {
          setIsDecrypting(false);
      }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (cachedBlob && cachedFileInfo) {
          const combinedKey = cachedFileInfo.code + passwordInput;
          attemptDecryption(cachedBlob, cachedFileInfo, combinedKey);
      }
  };

  const handleReveal = async () => {
      setIsRevealed(true);

      // Handle Burn on Read
      if (foundFile?.options?.burnOnRead && burnStatus === 'pending') {
          // Calculate delay
          const delaySeconds = foundFile.options?.burnDelaySeconds || 60;
          setBurnCountdown(delaySeconds);

          // Initiate Burn Sequence after delay
          setTimeout(() => {
              setBurnStatus('burning');
              
              // After animation (2s), delete
              setTimeout(async () => {
                   try {
                        if (foundFile?.id) {
                            await supabase.from('temp_files').delete().eq('id', foundFile.id);
                        }
                        setBurnStatus('burnt');
                        setIsLightboxOpen(false); // Close lightbox if open
                    } catch (e) {
                        console.error("Error burning file", e);
                    }
              }, 2000); 
          }, delaySeconds * 1000);
      }
  };

  // Manage Burn Countdown Interval
  useEffect(() => {
    if (burnCountdown !== null && burnCountdown > 0 && burnStatus === 'pending') {
        const timer = setInterval(() => {
            setBurnCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }
  }, [burnCountdown, burnStatus]);

  const handleCopyText = () => {
      if (decryptedText) {
          navigator.clipboard.writeText(decryptedText);
          setTextCopied(true);
          setTimeout(() => setTextCopied(false), 2000);
      }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(code);
  };

  useEffect(() => {
    if (initialCode && !hasAutoSearched.current) {
        hasAutoSearched.current = true;
        performSearch(initialCode);
    }
  }, [initialCode, performSearch]);

  // General Expiration Countdown
  useEffect(() => {
    if (!foundFile) return;

    const interval = setInterval(() => {
      const remaining = foundFile.expiresAt - Date.now();
      if (remaining <= 0) {
        setFoundFile(null);
        setError("El archivo acaba de expirar.");
        setBurnStatus('burning'); 
        setTimeout(() => setBurnStatus('burnt'), 2000);
        clearInterval(interval);
      } else {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [foundFile]);

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in relative z-10">
      
      {/* Search Input State */}
      {!foundFile && !isDecrypting && !isPasswordLocked && (
        <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-slate-700">
          <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
            <Unlock className="text-emerald-400" /> Desencriptar
          </h2>
          
          <form onSubmit={handleSearch} className="flex flex-col gap-4">
            <div>
              <label className="text-slate-400 text-sm mb-2 block">Código de archivo</label>
              <input 
                type="text" 
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                placeholder="Ej. ABC-123"
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-4 text-xl text-center font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors uppercase tracking-widest"
              />
            </div>
            
            <button 
              type="submit"
              disabled={isSearching}
              className="w-full font-bold py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg flex justify-center items-center gap-2 transition-all"
            >
              {isSearching ? <Loader2 className="animate-spin" /> : "Buscar y Abrir"}
            </button>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-200 animate-pulse">
              <EyeOff />
              <p>{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Decrypting Loading State */}
      {isDecrypting && !isPasswordLocked && (
          <div className="text-center py-20 bg-slate-800/50 rounded-2xl border border-slate-700 backdrop-blur-sm">
              <Loader2 className="animate-spin w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <p className="text-xl font-mono text-emerald-400">Desencriptando...</p>
              <p className="text-sm text-slate-400">Verificando firma digital...</p>
          </div>
      )}

      {/* Password Locked State */}
      {isPasswordLocked && cachedFileInfo && (
          <div className="bg-slate-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-red-500/30 text-center animate-fade-in relative overflow-hidden">
             {isDecrypting && (
                 <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                      <Loader2 className="animate-spin w-10 h-10 text-red-500 mb-2" />
                      <p className="text-red-400 font-bold animate-pulse">Desbloqueando...</p>
                 </div>
             )}
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500"></div>
             <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-slate-700">
                <Lock size={32} className="text-red-400" />
             </div>
             <h3 className="text-2xl font-bold text-white mb-2">Archivo Protegido</h3>
             <p className="text-slate-400 text-sm mb-6">
                Este archivo ha sido cifrado con una capa de seguridad adicional.
             </p>
             <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                        type="password" 
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Ingresa la contraseña"
                        autoFocus
                        disabled={isDecrypting}
                        className="w-full bg-slate-900 border border-slate-600 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
                    />
                </div>
                <button 
                  type="submit"
                  disabled={isDecrypting}
                  className="w-full font-bold py-3 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white shadow-lg transition-all disabled:opacity-50"
                >
                  Desbloquear
                </button>
             </form>
             {error && (
                <p className="mt-4 text-red-400 text-sm font-semibold animate-pulse bg-red-500/10 p-2 rounded-lg">
                    {error}
                </p>
             )}
          </div>
      )}

      {/* Found & Decrypted State (Success) */}
      {!isPasswordLocked && foundFile && (decryptedUrl || decryptedText) && (
        <div className={`bg-slate-800 rounded-2xl overflow-hidden shadow-2xl border ${theme.border} relative group select-none transition-colors duration-500`}>
          {/* Timer Badge */}
          <div className="absolute top-4 right-4 bg-red-500/90 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg z-20">
            <Clock size={14} /> {timeLeft}
          </div>

          {/* Burn Badge */}
          {foundFile.options?.burnOnRead && (
              <div className={`absolute top-4 left-4 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg z-20 transition-all ${
                  burnStatus === 'burning' ? 'bg-orange-600 animate-pulse' : 
                  burnStatus === 'burnt' ? 'bg-gray-800' :
                  'bg-orange-500/90'
              }`}>
                  <Flame size={14} /> 
                  {burnStatus === 'burnt' ? 'Destruido' : 
                   burnStatus === 'burning' ? 'Incinerando...' : 
                   burnCountdown !== null ? `Auto-Destrucción en ${burnCountdown}s` :
                   'Auto-Destrucción'}
              </div>
          )}

          <div className={`p-1 bg-gradient-to-r ${theme.gradient}`}></div>
          
          <div className="bg-black/90 min-h-[400px] flex items-center justify-center relative overflow-hidden p-4">
            
            {/* --- BURN ANIMATION CONTAINER --- */}
            <div className={`relative w-full h-full flex items-center justify-center transition-all duration-700 ${!isRevealed ? 'spoiler-blur' : 'revealed'} ${burnStatus === 'burning' ? 'burn-active' : ''}`}>
                
                {foundFile.type === 'video' && decryptedUrl ? (
                  <video src={decryptedUrl} controls={isRevealed && burnStatus !== 'burning'} autoPlay={isRevealed} className="max-w-full max-h-[70vh]" />
                ) : foundFile.type === 'audio' && decryptedUrl ? (
                   <div className="w-full max-w-sm px-6">
                        <AudioPlayer src={decryptedUrl} autoPlay={isRevealed && burnStatus !== 'burning'} />
                   </div> 
                ) : foundFile.type === 'text' && decryptedText ? (
                   <div className={`w-full h-full bg-slate-900 border border-slate-700 p-6 rounded-lg font-mono ${theme.color} whitespace-pre-wrap overflow-auto max-h-[60vh] shadow-inner text-sm relative`}>
                       {decryptedText}
                       {isRevealed && burnStatus !== 'burning' && (
                           <button 
                                onClick={handleCopyText}
                                className="absolute top-2 right-2 p-2 bg-slate-800 text-slate-400 rounded hover:text-white hover:bg-slate-700 transition-colors"
                           >
                               {textCopied ? <Check size={16} /> : <Copy size={16} />}
                           </button>
                       )}
                   </div>
                ) : decryptedUrl ? (
                  <div className="relative group cursor-zoom-in" onClick={() => isRevealed && burnStatus === 'pending' && setIsLightboxOpen(true)}>
                      <img 
                        src={decryptedUrl} 
                        alt="Content" 
                        className="max-w-full max-h-[70vh] object-contain transition-transform group-hover:scale-[1.02]" 
                      />
                      {isRevealed && burnStatus === 'pending' && (
                        <div className="absolute bottom-4 right-4 bg-black/50 text-white p-2 rounded-lg backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                            <Maximize2 size={20} />
                        </div>
                      )}
                  </div>
                ) : null}

                {/* Fire Overlay for Animation */}
                {burnStatus === 'burning' && (
                    <div className="absolute inset-0 z-30 flex items-end justify-center pointer-events-none">
                         <div className="w-full h-full bg-orange-500/30 mix-blend-color-dodge animate-pulse absolute inset-0"></div>
                         <div className="text-6xl animate-bounce mb-20">🔥</div>
                    </div>
                )}
            </div>
            
            {/* Burnt State Message */}
            {burnStatus === 'burnt' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-black text-center animate-fade-in">
                    <Flame size={64} className="text-orange-500 mb-4 animate-pulse" />
                    <h3 className="text-2xl font-bold text-white mb-2">Archivo Incinerado</h3>
                    <p className="text-slate-500">No quedan restos.</p>
                </div>
            )}

            {/* Spoiler Overlay */}
            {!isRevealed && burnStatus === 'pending' && (
                <div 
                    onClick={handleReveal}
                    className="absolute inset-0 flex flex-col items-center justify-center z-10 cursor-pointer hover:bg-white/5 transition-colors"
                >
                    <div className="bg-black/60 p-6 rounded-full border border-white/20 backdrop-blur-md mb-4 shadow-2xl">
                        {foundFile.type === 'text' ? <FileText size={40} className="text-white"/> : 
                         foundFile.type === 'audio' ? <Music size={40} className="text-white"/> :
                         <Eye size={40} className="text-white" />}
                    </div>
                    <p className="text-white font-bold text-xl tracking-widest uppercase">Toca para revelar</p>
                    <p className="text-slate-400 text-sm mt-1">
                        {foundFile.type === 'text' ? 'Nota Secreta' : 
                         foundFile.type === 'audio' ? 'Mensaje de Voz' : 'Archivo Multimedia'}
                    </p>
                    {foundFile.options?.burnOnRead && (
                        <p className="text-orange-400 text-sm mt-2 font-mono">⚠️ Se borrará al abrir</p>
                    )}
                </div>
            )}
          </div>

          <div className="p-6 relative bg-slate-900">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Shield size={16} className={theme.color}/>
              <span className={`text-sm uppercase tracking-wider font-semibold ${theme.color}`}>
                Encriptado con Código
              </span>
            </div>
            
            {burnStatus === 'burnt' && (
                <div className="bg-orange-500/20 border border-orange-500 p-3 rounded-lg text-orange-200 text-sm mb-4 flex gap-2">
                    <Flame size={16} className="shrink-0" />
                    <p>Este archivo ha sido eliminado del servidor permanentemente. Solo existe en tu memoria RAM ahora.</p>
                </div>
            )}
            
            <p className="text-xs text-slate-500 text-center font-mono break-all">
                ID: {foundFile.id.split('-')[0]}...
            </p>
          </div>
        </div>
      )}

      {/* Lightbox / Fullscreen Modal */}
      {isLightboxOpen && decryptedUrl && foundFile?.type === 'image' && (
        <div 
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fade-in backdrop-blur-md"
            onClick={() => setIsLightboxOpen(false)}
        >
            <button 
                className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                onClick={() => setIsLightboxOpen(false)}
            >
                <X size={24} />
            </button>
            <img 
                src={decryptedUrl} 
                alt="Fullscreen" 
                className="max-w-full max-h-screen object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()} 
            />
            {foundFile.options?.burnOnRead && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-orange-600/90 px-4 py-2 rounded-full text-white font-bold flex items-center gap-2 animate-pulse">
                    <Flame size={16} /> 
                    {burnCountdown !== null ? `Destrucción en ${burnCountdown}s` : 'Auto-Destrucción Activa'}
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default RetrieveView;