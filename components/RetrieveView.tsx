import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TempFile } from '../types';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { decryptFile, hashString } from '../utils/crypto';
import AudioPlayer from './AudioPlayer';
import VideoPlayer from './VideoPlayer';
import { Search, Clock, EyeOff, FileImage, FileVideo, AlertTriangle, Loader2, Database, Eye, Flame, Unlock, Shield, FileText, Copy, Check, Music, Lock, KeyRound, X, Maximize2, Terminal, Download, File as FileIcon, Package, Layers } from 'lucide-react';

interface RetrieveViewProps {
  initialCode?: string;
}

// Theme Helper for Retrieval
const getRetrieveTheme = (type?: string) => {
    if (type === 'archive') {
         return {
            color: 'text-indigo-600 dark:text-indigo-400',
            border: 'border-indigo-500/50',
            bg: 'bg-indigo-600',
            gradient: 'from-indigo-500 to-purple-600',
            btnBg: 'bg-indigo-600 hover:bg-indigo-500', 
            ring: 'focus:border-indigo-500'
        };
    }
    if (type === 'text') {
        return {
            color: 'text-amber-600 dark:text-amber-400',
            border: 'border-amber-500/50',
            bg: 'bg-amber-600',
            gradient: 'from-amber-500 to-orange-600',
            btnBg: 'bg-emerald-600 hover:bg-emerald-500', 
            ring: 'focus:border-amber-500'
        };
    }
    if (type === 'audio') {
        return {
            color: 'text-pink-600 dark:text-pink-400',
            border: 'border-pink-500/50',
            bg: 'bg-pink-600',
            gradient: 'from-pink-500 to-rose-600',
            btnBg: 'bg-emerald-600 hover:bg-emerald-500',
            ring: 'focus:border-pink-500'
        };
    }
    if (type === 'video') {
        return {
            color: 'text-violet-600 dark:text-violet-400',
            border: 'border-violet-500/50',
            bg: 'bg-violet-600',
            gradient: 'from-violet-600 to-fuchsia-600',
            btnBg: 'bg-emerald-600 hover:bg-emerald-500',
            ring: 'focus:border-violet-500'
        };
    }
    if (type === 'document') {
        return {
            color: 'text-emerald-600 dark:text-emerald-400',
            border: 'border-emerald-500/50',
            bg: 'bg-emerald-600',
            gradient: 'from-emerald-500 to-teal-600',
            btnBg: 'bg-emerald-600 hover:bg-emerald-500',
            ring: 'focus:border-emerald-500'
        };
    }
    // Default / Image
    return {
        color: 'text-cyan-600 dark:text-cyan-400',
        border: 'border-cyan-500/50',
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
      // 1. Hash the code for DB Lookup (Zero-Knowledge)
      const targetHash = await hashString(targetCode);

      // 2. Query Database using Hash
      const { data, error: dbError } = await supabase
        .from('temp_files')
        .select('*')
        .eq('code', targetHash) // LOOKUP BY HASH
        .single();

      if (dbError || !data) {
        throw new Error("404: Archivo no encontrado o eliminado.");
      }

      // 3. Check Expiration
      const expiresAt = new Date(data.expires_at).getTime();
      if (Date.now() > expiresAt) {
        throw new Error("TTL Expired: Archivo autodestruido.");
      }

      // 4. Get Download URL
      const { data: signedUrlData, error: signedError } = await supabase.storage
        .from('chronos_files')
        .createSignedUrl(data.file_path, 60);

      if (signedError || !signedUrlData) {
         if (signedError?.message.includes("bucket")) {
             throw new Error("Error: Storage bucket inaccesible.");
         }
        throw new Error("Error: Acceso denegado al objeto.");
      }

      // Basic file info before decryption
      // Note: we store 'targetCode' (raw input) in the state 'code' property,
      // because we need the raw code for decryption, not the hash.
      const fileInfo: TempFile = {
        id: data.id,
        code: targetCode, 
        fileUrl: signedUrlData.signedUrl,
        type: data.type as any,
        createdAt: new Date(data.created_at).getTime(),
        expiresAt: expiresAt,
        mimeType: 'application/encrypted'
      };
      
      // Fetch the encrypted blob immediately
      const response = await fetch(signedUrlData.signedUrl);
      if (!response.ok) throw new Error("Error de red al descargar paquete cifrado.");
      const encryptedBlob = await response.blob();
      
      setCachedBlob(encryptedBlob);
      setCachedFileInfo(fileInfo);
      setFoundFile(fileInfo); // Allows timer to start tick

      // 5. Attempt Decryption using raw targetCode (the Key)
      attemptDecryption(encryptedBlob, fileInfo, targetCode);

    } catch (err: any) {
      setError(err.message || "Error desconocido.");
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
          else if (mimeType === 'application/pdf' || 
                   mimeType.includes('document') || 
                   mimeType.includes('msword') || 
                   mimeType.includes('sheet') ||
                   mimeType.includes('presentation')) fileType = 'document';
          else if (mimeType === 'application/zip') fileType = 'archive';

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
             setError("Clave de desencriptación incorrecta.");
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
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-700/50">
          <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white flex items-center gap-3">
            <Terminal className="text-emerald-500 dark:text-emerald-400" /> 
            <span>Terminal de Acceso</span>
          </h2>
          
          <form onSubmit={handleSearch} className="flex flex-col gap-6">
            <div className="relative group">
              <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2 block ml-1">Código de Encriptación</label>
              <div className="relative">
                  <input 
                    type="text" 
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                    placeholder="XXX-XXX"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-4 py-5 text-2xl text-center font-mono text-emerald-600 dark:text-emerald-400 placeholder-slate-400 dark:placeholder-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all uppercase tracking-[0.2em]"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-700 group-focus-within:text-emerald-500/50 transition-colors">
                      <KeyRound size={20} />
                  </div>
              </div>
            </div>
            
            <button 
              type="submit"
              disabled={isSearching || code.length < 3}
              className="w-full font-bold py-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)] flex justify-center items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-1"
            >
              {isSearching ? <Loader2 className="animate-spin" /> : "DESENCRIPTAR Y ABRIR"}
            </button>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-300 animate-pulse text-sm">
              <AlertTriangle className="shrink-0" size={18} />
              <p>{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Decrypting Loading State */}
      {isDecrypting && !isPasswordLocked && (
          <div className="text-center py-24 bg-white/50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-700 backdrop-blur-md">
              <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-emerald-500/30 blur-xl rounded-full animate-pulse"></div>
                  <Loader2 className="animate-spin w-16 h-16 text-emerald-500 dark:text-emerald-400 relative z-10" />
              </div>
              <p className="text-2xl font-mono text-emerald-600 dark:text-emerald-400 font-bold mb-2">ACCESSING...</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">Verificando firma AES-256-GCM</p>
          </div>
      )}

      {/* Password Locked State */}
      {isPasswordLocked && cachedFileInfo && (
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-red-500/30 text-center animate-fade-in relative overflow-hidden">
             {isDecrypting && (
                 <div className="absolute inset-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                      <Loader2 className="animate-spin w-10 h-10 text-red-500 mb-2" />
                      <p className="text-red-500 dark:text-red-400 font-bold animate-pulse font-mono">UNLOCKING...</p>
                 </div>
             )}
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 animate-pulse"></div>
             
             <div className="w-24 h-24 bg-slate-50 dark:bg-slate-950 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-slate-200 dark:ring-slate-800 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                <Lock size={36} className="text-red-500" />
             </div>
             
             <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Acceso Restringido</h3>
             <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 px-4">
                El archivo requiere autenticación de segundo factor (contraseña).
             </p>
             
             <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="relative group">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 group-focus-within:text-red-500 transition-colors" size={20} />
                    <input 
                        type="password" 
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Ingresa la contraseña"
                        autoFocus
                        disabled={isDecrypting}
                        className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-12 pr-4 py-4 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-700 focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50 font-mono"
                    />
                </div>
                <button 
                  type="submit"
                  disabled={isDecrypting}
                  className="w-full font-bold py-4 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white shadow-lg transition-all disabled:opacity-50 hover:shadow-red-500/20"
                >
                  DESBLOQUEAR
                </button>
             </form>
             {error && (
                <p className="mt-6 text-red-500 dark:text-red-400 text-sm font-mono font-bold animate-pulse bg-red-100 dark:bg-red-950/30 p-2 rounded-lg border border-red-500/20">
                    &gt; {error}
                </p>
             )}
          </div>
      )}

      {/* Found & Decrypted State (Success) */}
      {!isPasswordLocked && foundFile && (decryptedUrl || decryptedText) && (
        <div className={`bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border ${theme.border} relative group select-none transition-colors duration-500`}>
          
          {/* Header Bar */}
          <div className="h-14 bg-slate-50 dark:bg-slate-950 flex items-center justify-between px-6 border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500"></div>
                </div>
                <div className="flex items-center gap-2 text-slate-500 text-[10px] font-mono uppercase tracking-widest">
                    <Shield size={12} className={theme.color}/>
                    SECURE VIEWER
                </div>
          </div>

          {/* Timer Badge */}
          <div className="absolute top-16 right-4 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md text-slate-800 dark:text-white px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-200 dark:border-slate-700 shadow-xl z-20 flex items-center gap-2">
            <Clock size={12} className="text-red-500 dark:text-red-400" /> 
            <span className="text-red-600 dark:text-red-100">{timeLeft}</span>
          </div>

          {/* Burn Badge */}
          {foundFile.options?.burnOnRead && (
              <div className={`absolute top-16 left-4 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-xl z-20 transition-all backdrop-blur-md border ${
                  burnStatus === 'burning' ? 'bg-orange-500/90 text-white border-orange-400 animate-pulse' : 
                  burnStatus === 'burnt' ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700' :
                  'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30'
              }`}>
                  <Flame size={12} /> 
                  {burnStatus === 'burnt' ? 'DESTRUIDO' : 
                   burnStatus === 'burning' ? 'INCINERANDO...' : 
                   burnCountdown !== null ? `DESTRUCCIÓN: ${burnCountdown}s` :
                   'AUTO-DESTRUCCIÓN'}
              </div>
          )}
          
          <div className="bg-slate-100 dark:bg-black/80 min-h-[450px] flex items-center justify-center relative overflow-hidden p-1">
             {/* Background Grid inside viewer */}
             <div className="absolute inset-0 bg-grid-pattern opacity-5 dark:opacity-10 pointer-events-none"></div>

            {/* --- BURN ANIMATION CONTAINER --- */}
            <div className={`relative w-full h-full flex items-center justify-center transition-all duration-700 ${!isRevealed ? 'spoiler-blur' : 'revealed'} ${burnStatus === 'burning' ? 'burn-active' : ''}`}>
                
                {foundFile.type === 'video' && decryptedUrl ? (
                   <div className="w-full h-full flex items-center justify-center bg-black rounded-lg overflow-hidden">
                       <VideoPlayer src={decryptedUrl} autoPlay={isRevealed && burnStatus !== 'burning'} />
                   </div>
                ) : foundFile.type === 'audio' && decryptedUrl ? (
                   <div className="w-full max-w-sm px-6">
                        <AudioPlayer src={decryptedUrl} autoPlay={isRevealed && burnStatus !== 'burning'} />
                   </div> 
                ) : foundFile.type === 'text' && decryptedText ? (
                   <div className={`w-full mx-4 h-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-8 rounded-xl font-mono ${theme.color} whitespace-pre-wrap overflow-auto max-h-[60vh] shadow-inner text-sm relative leading-relaxed`}>
                       {decryptedText}
                       {isRevealed && burnStatus !== 'burning' && (
                           <button 
                                onClick={handleCopyText}
                                className="absolute top-4 right-4 p-2 bg-slate-100 dark:bg-slate-900 text-slate-500 rounded-lg hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800"
                           >
                               {textCopied ? <Check size={16} /> : <Copy size={16} />}
                           </button>
                       )}
                   </div>
                ) : (foundFile.type === 'document' || foundFile.type === 'archive') && decryptedUrl ? (
                    <div className="w-full h-full p-4 flex flex-col items-center justify-center gap-6">
                        {foundFile.mimeType === 'application/pdf' ? (
                            <object data={decryptedUrl} type="application/pdf" className="w-full h-[60vh] rounded-lg border border-emerald-500/20 shadow-2xl bg-white">
                                <embed src={decryptedUrl} type="application/pdf" className="w-full h-[60vh] rounded-lg" />
                                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                    <p>Tu navegador no puede visualizar este PDF directamente.</p>
                                </div>
                            </object>
                        ) : (
                            <div className={`text-center p-8 rounded-2xl border flex flex-col items-center ${
                                foundFile.type === 'archive' 
                                ? 'bg-indigo-500/10 dark:bg-indigo-900/10 border-indigo-500/20' 
                                : 'bg-emerald-500/10 dark:bg-emerald-900/10 border-emerald-500/20'
                            }`}>
                                {foundFile.type === 'archive' ? (
                                    <Package size={64} className="text-indigo-500 mx-auto mb-4" />
                                ) : (
                                    <FileIcon size={64} className="text-emerald-500 mx-auto mb-4" />
                                )}
                                
                                <p className={`font-bold mb-2 ${foundFile.type === 'archive' ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                    {foundFile.type === 'archive' ? 'Paquete Comprimido' : 'Documento Descifrado'}
                                </p>
                                <p className={`text-xs font-mono uppercase mb-4 opacity-60 ${foundFile.type === 'archive' ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                    {foundFile.mimeType}
                                </p>
                            </div>
                        )}
                        <a 
                            href={decryptedUrl} 
                            download={`chronos-secure-${foundFile.type === 'archive' ? 'pack.zip' : `file.${foundFile.mimeType.split('/')[1] || 'bin'}`}`}
                            className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all hover:scale-105 text-white ${
                                foundFile.type === 'archive' ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-emerald-500 hover:bg-emerald-600'
                            }`}
                        >
                            <Download size={20} /> DESCARGAR {foundFile.type === 'archive' ? 'ZIP' : 'ARCHIVO'}
                        </a>
                    </div>
                ) : decryptedUrl ? (
                  <div className="relative group cursor-zoom-in" onClick={() => isRevealed && burnStatus === 'pending' && setIsLightboxOpen(true)}>
                      <img 
                        src={decryptedUrl} 
                        alt="Content" 
                        className="max-w-full max-h-[60vh] object-contain transition-transform duration-500 group-hover:scale-[1.02] drop-shadow-2xl rounded-sm" 
                      />
                      {isRevealed && burnStatus === 'pending' && (
                        <div className="absolute bottom-4 right-4 bg-black/60 text-white p-2 rounded-lg backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity border border-white/10">
                            <Maximize2 size={20} />
                        </div>
                      )}
                  </div>
                ) : null}

                {/* Fire Overlay for Animation */}
                {burnStatus === 'burning' && (
                    <div className="absolute inset-0 z-30 flex items-end justify-center pointer-events-none">
                         <div className="w-full h-full bg-orange-500/20 mix-blend-color-dodge animate-pulse absolute inset-0"></div>
                    </div>
                )}
            </div>
            
            {/* Burnt State Message */}
            {burnStatus === 'burnt' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-slate-100 dark:bg-slate-950 text-center animate-fade-in">
                    <div className="w-20 h-20 bg-slate-200 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-300 dark:border-slate-800">
                        <Flame size={40} className="text-slate-500 dark:text-slate-700" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-500 mb-2 font-mono uppercase">Datos Eliminados</h3>
                    <p className="text-slate-500/80 dark:text-slate-600 text-xs">El archivo ha dejado de existir.</p>
                </div>
            )}

            {/* Spoiler Overlay */}
            {!isRevealed && burnStatus === 'pending' && (
                <div 
                    onClick={handleReveal}
                    className="absolute inset-0 flex flex-col items-center justify-center z-10 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                    <div className="relative">
                        <div className={`absolute inset-0 ${theme.bg} opacity-20 blur-xl rounded-full animate-pulse`}></div>
                        <div className="bg-white/80 dark:bg-slate-900/80 p-8 rounded-full border border-slate-200 dark:border-white/10 backdrop-blur-md mb-6 shadow-2xl relative z-10 group-hover:scale-110 transition-transform duration-300">
                            {foundFile.type === 'text' ? <FileText size={48} className="text-slate-800 dark:text-white"/> : 
                            foundFile.type === 'audio' ? <Music size={48} className="text-slate-800 dark:text-white"/> :
                            foundFile.type === 'document' ? <FileIcon size={48} className="text-slate-800 dark:text-white"/> :
                            foundFile.type === 'video' ? <FileVideo size={48} className="text-slate-800 dark:text-white"/> :
                            foundFile.type === 'archive' ? <Package size={48} className="text-slate-800 dark:text-white"/> :
                            <Eye size={48} className="text-slate-800 dark:text-white" />}
                        </div>
                    </div>
                    <p className="text-slate-800 dark:text-white font-black text-2xl tracking-[0.3em] uppercase mb-2">Revelar</p>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-mono border border-slate-300 dark:border-slate-700 px-3 py-1 rounded-full bg-white/50 dark:bg-slate-950/50">
                        {foundFile.type.toUpperCase()} • ENCRIPTADO
                    </p>
                </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-white/5 flex justify-between items-center">
            <p className="text-[10px] text-slate-500 dark:text-slate-600 font-mono break-all">
                HASH: {foundFile.id.split('-')[0]}...{foundFile.id.split('-').pop()}
            </p>
             {burnStatus === 'burnt' && (
                <div className="flex items-center gap-1 text-orange-500/50 text-[10px] uppercase font-bold">
                    <Flame size={10} /> Purged
                </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox / Fullscreen Modal */}
      {isLightboxOpen && decryptedUrl && foundFile?.type === 'image' && (
        <div 
            className="fixed inset-0 z-50 bg-slate-950/95 flex items-center justify-center p-4 animate-fade-in backdrop-blur-xl"
            onClick={() => setIsLightboxOpen(false)}
        >
            <button 
                className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                onClick={() => setIsLightboxOpen(false)}
            >
                <X size={24} />
            </button>
            <img 
                src={decryptedUrl} 
                alt="Fullscreen" 
                className="max-w-full max-h-screen object-contain shadow-2xl rounded-md"
                onClick={(e) => e.stopPropagation()} 
            />
            {foundFile.options?.burnOnRead && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-orange-500/50 px-6 py-3 rounded-full text-white font-bold flex items-center gap-3 animate-pulse shadow-[0_0_30px_rgba(249,115,22,0.3)]">
                    <Flame size={18} className="text-orange-500" /> 
                    <span className="font-mono text-orange-100">
                        {burnCountdown !== null ? `DESTRUCCIÓN: ${burnCountdown}s` : 'AUTO-DESTRUCCIÓN ACTIVA'}
                    </span>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default RetrieveView;