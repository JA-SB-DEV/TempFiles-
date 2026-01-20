import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TempFile } from '../types';
import { supabase, isSupabaseConfigured, checkCodeExists } from '../services/supabaseClient';
import { encryptFile, hashString } from '../utils/crypto';
import { Camera, Video, Upload, Loader2, Database, Clock, Flame, Shield, X, FileText, Image as ImageIcon, Mic, StopCircle, Play, Trash2, Lock, ArrowRight, ShieldCheck, Eye, HardDrive, File as FileIcon, Paperclip, Fingerprint, Terminal, Unlock } from 'lucide-react';

interface UploadViewProps {
  onUploadSuccess: (file: TempFile) => void;
}

type UploadMode = 'file' | 'text' | 'audio' | 'document';

// Theme Helpers
const getTheme = (mode: UploadMode, fileType?: string) => {
    if (mode === 'text') {
        return {
            color: 'text-amber-600 dark:text-amber-400',
            border: 'border-amber-500/50',
            focusRing: 'focus:ring-amber-500',
            bg: 'bg-amber-600',
            gradient: 'from-amber-500 to-orange-600',
            shadow: 'shadow-[0_0_30px_rgba(245,158,11,0.2)]',
            accent: 'text-orange-500 dark:text-orange-400'
        };
    }
    if (mode === 'audio' || fileType?.startsWith('audio/')) {
        return {
            color: 'text-pink-600 dark:text-pink-400',
            border: 'border-pink-500/50',
            focusRing: 'focus:ring-pink-500',
            bg: 'bg-pink-600',
            gradient: 'from-pink-500 to-rose-600',
            shadow: 'shadow-[0_0_30px_rgba(236,72,153,0.2)]',
            accent: 'text-rose-500 dark:text-rose-400'
        };
    }
    if (fileType?.startsWith('video/')) {
        return {
            color: 'text-violet-600 dark:text-violet-400',
            border: 'border-violet-500/50',
            focusRing: 'focus:ring-violet-500',
            bg: 'bg-violet-600',
            gradient: 'from-violet-600 to-fuchsia-600',
            shadow: 'shadow-[0_0_30px_rgba(139,92,246,0.2)]',
            accent: 'text-fuchsia-500 dark:text-fuchsia-400'
        };
    }
    if (mode === 'document') {
         return {
            color: 'text-emerald-600 dark:text-emerald-400',
            border: 'border-emerald-500/50',
            focusRing: 'focus:ring-emerald-500',
            bg: 'bg-emerald-600',
            gradient: 'from-emerald-500 to-teal-600',
            shadow: 'shadow-[0_0_30px_rgba(16,185,129,0.2)]',
            accent: 'text-teal-500 dark:text-teal-400'
        };
    }
    // Default / Image
    return {
        color: 'text-cyan-600 dark:text-cyan-400',
        border: 'border-cyan-500/50',
        focusRing: 'focus:ring-cyan-500',
        bg: 'bg-cyan-600',
        gradient: 'from-cyan-500 to-blue-600',
        shadow: 'shadow-[0_0_30px_rgba(6,182,212,0.2)]',
        accent: 'text-cyan-600 dark:text-cyan-400'
    };
};

const UploadView: React.FC<UploadViewProps> = ({ onUploadSuccess }) => {
  const [mode, setMode] = useState<UploadMode>('file');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [textContent, setTextContent] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  
  // Code State
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  
  // Options
  const [duration, setDuration] = useState<number>(5); // minutes
  const [burnOnRead, setBurnOnRead] = useState(false);
  const [burnDelay, setBurnDelay] = useState<number>(10); // seconds
  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  
  // Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Theme
  const theme = getTheme(mode, selectedFiles[0]?.type);

  const processFiles = (files: FileList | File[]) => {
    // Only accept the first file
    if (files.length > 0) {
        const file = files[0];
        if (file.size > 50 * 1024 * 1024) {
            alert("El archivo excede el límite (Máx 50MB)");
            return;
        }
        setSelectedFiles([file]);

        // Set preview
        if (mode === 'document') {
             setPreviewUrl(null);
        } else {
             setPreviewUrl(URL.createObjectURL(file));
        }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) processFiles(e.target.files);
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, []);

  // --- AUDIO RECORDING LOGIC ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], "recording.webm", { type: 'audio/webm' });
        processFiles([audioFile]);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("No se pudo acceder al micrófono. Verifica los permisos.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  // -----------------------------

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 3; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    result += '-';
    for (let i = 0; i < 3; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result; 
  };

  const handleInitialSubmit = async () => {
    if (mode === 'file' && selectedFiles.length === 0) return;
    if (mode === 'text' && !textContent.trim()) return;
    if (mode === 'audio' && selectedFiles.length === 0) return;
    if (mode === 'document' && selectedFiles.length === 0) return;

    if (!isSupabaseConfigured()) {
      alert("Error: Supabase no está configurado.");
      return;
    }

    setIsGeneratingCode(true);

    try {
        let unique = false;
        let code = '';
        let attempts = 0;

        // Ensure Uniqueness using HASHED code to prevent server from seeing raw code during check
        while (!unique && attempts < 10) {
            code = generateRandomCode();
            // Hash the code before checking DB. Server sees Hash, not Code.
            const codeHash = await hashString(code);
            const exists = await checkCodeExists(codeHash);
            if (!exists) unique = true;
            attempts++;
        }

        if (!unique) {
            alert("Error generando un código único. Por favor, inténtalo de nuevo.");
            setIsGeneratingCode(false);
            return;
        }

        setGeneratedCode(code);
        setIsGeneratingCode(false);
        setShowConfirmModal(true);
    } catch (e) {
        console.error("Error checking code uniqueness", e);
        setGeneratedCode(generateRandomCode());
        setIsGeneratingCode(false);
        setShowConfirmModal(true);
    }
  };

  const executeUpload = async () => {
    setShowConfirmModal(false);
    setIsProcessing(true);
    setProgress(0); 
    setStatusMessage('INICIANDO PROTOCOLO...');

    try {
        let fileToEncrypt: File;

        if (mode === 'text') {
            const blob = new Blob([textContent], { type: 'text/plain' });
            fileToEncrypt = new File([blob], 'secret_note.txt', { type: 'text/plain' });
        } else {
            // SINGLE FILE
            fileToEncrypt = selectedFiles[0]!;
        }
    
        setProgress(15);
        setStatusMessage('GENERANDO LLAVES (ECDH)...');
        const code = generatedCode || generateRandomCode();
      
        const encryptionKey = password ? (code + password) : code;

        setTimeout(() => {
            setProgress(30);
            setStatusMessage('CIFRADO AES-GCM-256...');
        }, 800);

        const encryptedBlob = await encryptFile(
            fileToEncrypt, 
            encryptionKey, 
            {
            burnOnRead,
            durationMinutes: duration,
            burnDelaySeconds: burnOnRead ? burnDelay : undefined
            }
        );

        // ZERO KNOWLEDGE ARCHITECTURE
        const codeHash = await hashString(code);

        setTimeout(() => {
            setProgress(60);
            setStatusMessage('SUBIENDO A LA NUBE...');
        }, 1500);

        const fileExt = 'enc';
        const fileName = `${codeHash}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('chronos_files')
            .upload(filePath, encryptedBlob, {
            contentType: 'application/octet-stream'
            });

        if (uploadError) {
            if (uploadError.message.includes("resource") || uploadError.message.includes("bucket")) {
                throw new Error("Bucket 'chronos_files' no encontrado en Supabase.");
            }
            throw uploadError;
        }

        setProgress(90);
        setStatusMessage('FINALIZANDO REGISTRO...');

        const expiresInMs = duration * 60 * 1000;
        const now = Date.now();
        const expiresAt = now + expiresInMs;
        
        // Determine DB Type
        let type: TempFile['type'] = 'image';
        if (mode === 'text') type = 'text';
        else if (mode === 'audio' || fileToEncrypt.type.startsWith('audio/')) type = 'audio';
        else if (fileToEncrypt.type.startsWith('video/')) type = 'video';
        else if (mode === 'document') type = 'document';

        const newFile: TempFile = {
            id: crypto.randomUUID(),
            code: code, // Keep raw code for UI display to user
            fileUrl: filePath,
            type: type,
            createdAt: now,
            expiresAt: expiresAt,
            mimeType: fileToEncrypt.type,
        };

        const { error: dbError } = await supabase
            .from('temp_files')
            .insert([
            {
                code: codeHash, // STORE ONLY THE HASH
                file_path: newFile.fileUrl,
                type: newFile.type,
                mime_type: 'application/encrypted',
                expires_at: new Date(expiresAt).toISOString()
            }
            ]);

        if (dbError) throw dbError;

        setProgress(100);
        setStatusMessage('¡COMPLETADO!');
        
        // Small delay to show 100% before switch
        setTimeout(() => {
            onUploadSuccess(newFile);
        }, 800);

    } catch (error: any) {
      console.error("Upload failed", error);
      alert(`Error: ${error.message || "Error desconocido"}`);
      setIsProcessing(false);
      setProgress(0);
      setStatusMessage('');
    }
  };

  const removeFile = () => {
    setSelectedFiles([]);
    setPreviewUrl(null);
    setProgress(0);
    setStatusMessage('');
    setIsRecording(false);
    setGeneratedCode(null);
    if (mediaRecorderRef.current) {
        // cleanup
    }
  };

  // --- Vault Strength Logic ---
  const calculateStrength = (pass: string) => {
      if (!pass) return { score: 0, label: '', color: 'bg-slate-200' };
      
      let score = 0;
      if (pass.length > 4) score += 20;
      if (pass.length > 8) score += 30;
      if (pass.length > 12) score += 20;
      if (/[A-Z]/.test(pass)) score += 10;
      if (/[0-9]/.test(pass)) score += 10;
      if (/[^A-Za-z0-9]/.test(pass)) score += 10;

      if (score < 40) return { score: 20, label: 'Instantáneo', color: 'bg-red-500' };
      if (score < 70) return { score: 50, label: '3 Semanas', color: 'bg-orange-500' };
      if (score < 90) return { score: 80, label: '50 Años', color: 'bg-yellow-500' };
      return { score: 100, label: '3 Millones de Años', color: 'bg-emerald-500' };
  };

  const strength = calculateStrength(password);

  // --- Cyberpunk Hex Visualization Component ---
  const CyberProgressOverlay = () => {
    const [hexLines, setHexLines] = useState<string[]>([]);
    
    // Generate random hex lines
    useEffect(() => {
        const chars = '0123456789ABCDEF';
        const generateLine = () => {
            let line = '0x';
            for (let i = 0; i < 24; i++) line += chars[Math.floor(Math.random() * 16)];
            return line;
        };

        const interval = setInterval(() => {
            setHexLines(prev => {
                const newLines = [...prev, generateLine()];
                if (newLines.length > 8) newLines.shift(); // Keep only last 8 lines
                return newLines;
            });
        }, 100);

        return () => clearInterval(interval);
    }, []);

    return (
      <div className="absolute inset-0 bg-slate-950/90 z-20 rounded-2xl flex flex-col items-center justify-center p-6 overflow-hidden animate-fade-in font-mono">
          {/* Matrix/Hex Background Effect */}
          <div className="absolute inset-0 opacity-20 pointer-events-none select-none">
             {hexLines.map((line, i) => (
                 <div key={i} className="text-[10px] text-green-500 whitespace-nowrap overflow-hidden">
                     {line} {line}
                 </div>
             ))}
          </div>

          <div className="relative z-10 w-full max-w-[200px] text-center">
              <Loader2 size={40} className="animate-spin text-cyan-500 mx-auto mb-4" />
              <p className="text-cyan-400 font-bold text-sm tracking-widest animate-pulse mb-2">{statusMessage}</p>
              
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                  <div 
                    className="h-full bg-cyan-500 relative transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  >
                      <div className="absolute right-0 top-0 bottom-0 w-2 bg-white blur-[4px]"></div>
                  </div>
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-slate-500">
                  <span>ENCRYPT_V2</span>
                  <span>{Math.round(progress)}%</span>
              </div>
          </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in relative z-10">
      
      {/* --- CONFIRMATION MODAL --- */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)}></div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600/50 w-full max-w-sm rounded-3xl p-6 relative z-10 shadow-2xl animate-fade-in overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500"></div>
                
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
                    <ShieldCheck className="text-emerald-500 dark:text-emerald-400" size={28} /> 
                    <span className="tracking-tight">Confirmar Encriptación</span>
                </h3>
                
                <div className="space-y-4 mb-8">
                    <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center justify-between group">
                        <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Código</span>
                        <span className="font-bold text-cyan-600 dark:text-cyan-400 text-2xl font-mono tracking-widest group-hover:text-cyan-500 dark:group-hover:text-cyan-300 transition-colors">
                            {generatedCode}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                            <span className="text-slate-500 text-[10px] font-bold uppercase block mb-1">Duración</span>
                            <span className="text-slate-700 dark:text-white text-sm font-semibold flex items-center gap-1">
                                <Clock size={14} className="text-cyan-500 dark:text-cyan-400" /> 
                                {duration === 1440 ? '24h' : duration === 60 ? '1h' : `${duration}m`}
                            </span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                             <span className="text-slate-500 text-[10px] font-bold uppercase block mb-1">Auto-Destrucción</span>
                             <span className={`text-sm font-semibold flex items-center gap-1 ${burnOnRead ? 'text-orange-500 dark:text-orange-400' : 'text-slate-400'}`}>
                                <Flame size={14} /> {burnOnRead ? `${burnDelay}s` : 'No'}
                            </span>
                        </div>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl text-xs text-blue-600 dark:text-blue-300 flex gap-2">
                        <Fingerprint size={16} className="shrink-0 mt-0.5" />
                        <p>
                            <strong>Zero-Knowledge:</strong> El servidor solo guardará un <em>Hash matemático</em> de tu código.
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowConfirmModal(false)}
                        className="flex-1 py-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={executeUpload}
                        className={`flex-[2] py-3.5 rounded-xl font-bold text-white dark:text-slate-900 text-sm shadow-lg flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 transition-all`}
                    >
                        Encriptar y Subir <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        </div>
      )}

      {!isSupabaseConfigured() && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 backdrop-blur-md rounded-xl p-4 text-red-600 dark:text-red-200 text-sm flex items-start gap-3">
          <Database className="shrink-0 animate-pulse" />
          <div>
            <p className="font-bold">Error de Conexión</p>
            <p className="text-xs opacity-70 mt-1">Supabase no está configurado correctamente.</p>
          </div>
        </div>
      )}

      <div className={`bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2rem] p-1 shadow-2xl border ${theme.border} transition-colors duration-500 relative`}>
        {/* Glow Effect behind container */}
        <div className={`absolute inset-0 rounded-[2rem] bg-gradient-to-br ${theme.gradient} opacity-5 blur-xl -z-10`}></div>

        <div className="bg-slate-50/50 dark:bg-slate-950/50 rounded-[1.8rem] p-6">
            <div className="flex flex-col gap-6">
                
                {/* Segmented Control - Scrollable on Mobile to prevent cutoff */}
                <div className="bg-slate-200 dark:bg-slate-900 p-1.5 rounded-2xl flex relative border border-slate-300 dark:border-white/5 overflow-x-auto no-scrollbar">
                    {/* Sliding Background */}
                    {/* Note: Width and Position calculations assume 4 items. On narrow screens where scrolling happens, this visual cue still works relative to the container width if min-widths are enforced */}
                    <div 
                        className={`absolute top-1.5 bottom-1.5 rounded-xl bg-white dark:bg-slate-800 shadow-md transition-all duration-300 ease-out border border-slate-200 dark:border-white/5`}
                        style={{
                            left: mode === 'file' ? '0.375rem' : mode === 'audio' ? '25%' : mode === 'text' ? '50%' : '75%',
                            width: 'calc(25% - 0.5rem)',
                            transform: mode === 'audio' ? 'translateX(0.125rem)' : mode === 'text' ? 'translateX(0.125rem)' : mode === 'document' ? 'translateX(-0.375rem)' : 'none'
                        }}
                    ></div>
                    
                    {/* Container to enforce minimum width for buttons */}
                    <div className="flex w-full min-w-[340px]">
                        <button 
                            onClick={() => { setMode('file'); removeFile(); }}
                            className={`flex-1 relative z-10 py-3 rounded-xl flex flex-col items-center gap-1 transition-colors ${mode === 'file' ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            <ImageIcon size={20} />
                            <span className="text-[10px] font-bold uppercase tracking-wider block">Media</span>
                        </button>
                        <button 
                            onClick={() => { setMode('audio'); removeFile(); }}
                            className={`flex-1 relative z-10 py-3 rounded-xl flex flex-col items-center gap-1 transition-colors ${mode === 'audio' ? 'text-pink-600 dark:text-pink-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            <Mic size={20} />
                            <span className="text-[10px] font-bold uppercase tracking-wider block">Voz</span>
                        </button>
                        <button 
                            onClick={() => { setMode('text'); removeFile(); }}
                            className={`flex-1 relative z-10 py-3 rounded-xl flex flex-col items-center gap-1 transition-colors ${mode === 'text' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            <FileText size={20} />
                            <span className="text-[10px] font-bold uppercase tracking-wider block">Nota</span>
                        </button>
                        <button 
                            onClick={() => { setMode('document'); removeFile(); }}
                            className={`flex-1 relative z-10 py-3 rounded-xl flex flex-col items-center gap-1 transition-colors ${mode === 'document' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            <Paperclip size={20} />
                            <span className="text-[10px] font-bold uppercase tracking-wider block">Docs</span>
                        </button>
                    </div>
                </div>
                
                {/* Content Area */}
                <div className="min-h-[260px]">
                    {/* FILE UPLOAD MODE */}
                    {mode === 'file' && (
                        selectedFiles.length === 0 ? (
                            <div 
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`h-[260px] border-2 border-dashed transition-all duration-300 rounded-3xl flex flex-col items-center justify-center cursor-pointer group relative overflow-hidden ${
                                dragActive 
                                ? `${theme.border} bg-cyan-500/10` 
                                : `border-slate-300 dark:border-slate-700 hover:border-cyan-500/50 hover:bg-slate-100 dark:hover:bg-slate-900`
                            }`}
                            >
                                <div className={`w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-900 flex items-center justify-center mb-4 transition-transform duration-500 group-hover:scale-110 border border-slate-300 dark:border-slate-700 group-hover:border-cyan-500/30 shadow-xl`}>
                                    <Upload size={32} className="text-slate-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors" />
                                </div>
                                <p className="text-slate-600 dark:text-slate-300 font-bold text-lg group-hover:text-slate-800 dark:group-hover:text-white transition-colors">Toca o Arrastra</p>
                                <p className="text-slate-500 mt-2 text-xs text-center font-mono uppercase tracking-wide">
                                    Imágenes • Videos
                                </p>
                                <input 
                                    ref={fileInputRef}
                                    type="file" 
                                    accept="image/*,video/*" 
                                    className="hidden" 
                                    onChange={handleFileChange}
                                />
                            </div>
                        ) : (
                            <div className="relative h-[260px] rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 group flex items-center justify-center">
                                {selectedFiles[0].type.startsWith('video/') ? (
                                    <video src={previewUrl!} className="w-full h-full object-contain bg-black" />
                                ) : (
                                    <img src={previewUrl!} alt="Preview" className="w-full h-full object-contain bg-black" />
                                )}
                                
                                <button 
                                    onClick={removeFile}
                                    className="absolute top-3 right-3 bg-white/80 dark:bg-slate-900/80 hover:bg-red-500 text-slate-800 dark:text-white hover:text-white p-2 rounded-full backdrop-blur-md transition-all border border-slate-200 dark:border-white/10 z-10 shadow-sm"
                                >
                                    <X size={18} />
                                </button>
                                {isProcessing && <CyberProgressOverlay />}
                            </div>
                        )
                    )}

                    {/* DOCUMENT MODE */}
                    {mode === 'document' && (
                        selectedFiles.length === 0 ? (
                            <div 
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`h-[260px] border-2 border-dashed transition-all duration-300 rounded-3xl flex flex-col items-center justify-center cursor-pointer group relative overflow-hidden ${
                                dragActive 
                                ? `${theme.border} bg-emerald-500/10` 
                                : `border-slate-300 dark:border-slate-700 hover:border-emerald-500/50 hover:bg-slate-100 dark:hover:bg-slate-900`
                            }`}
                            >
                                <div className={`w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-900 flex items-center justify-center mb-4 transition-transform duration-500 group-hover:scale-110 border border-slate-300 dark:border-slate-700 group-hover:border-emerald-500/30 shadow-xl`}>
                                    <FileIcon size={32} className="text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                                </div>
                                <p className="text-slate-600 dark:text-slate-300 font-bold text-lg group-hover:text-slate-800 dark:group-hover:text-white transition-colors">Subir Documento</p>
                                <p className="text-slate-500 mt-2 text-xs text-center font-mono uppercase tracking-wide">
                                    PDF • DOCX • TXT
                                </p>
                                <input 
                                    ref={fileInputRef}
                                    type="file" 
                                    accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx" 
                                    className="hidden" 
                                    onChange={handleFileChange}
                                />
                            </div>
                        ) : (
                            <div className="relative h-[260px] rounded-3xl overflow-hidden bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 group flex flex-col items-center justify-center">
                                
                                <div className="w-24 h-24 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/20">
                                    <FileIcon size={48} className="text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <p className="text-emerald-600 dark:text-emerald-300 font-bold max-w-[80%] truncate">{selectedFiles[0].name}</p>
                                <p className="text-emerald-600/60 dark:text-emerald-500/50 text-xs font-mono mt-1">{(selectedFiles[0].size / 1024 / 1024).toFixed(2)} MB</p>
                                
                                <button 
                                    onClick={removeFile}
                                    className="absolute top-3 right-3 bg-white/80 dark:bg-slate-900/80 hover:bg-red-500 text-slate-800 dark:text-white hover:text-white p-2 rounded-full backdrop-blur-md transition-all border border-slate-200 dark:border-white/10 z-10 shadow-sm"
                                >
                                    <X size={18} />
                                </button>
                                {isProcessing && <CyberProgressOverlay />}
                            </div>
                        )
                    )}

                    {/* AUDIO MODE */}
                    {mode === 'audio' && (
                        <div className="h-[260px] rounded-3xl bg-slate-100/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700/50 flex flex-col items-center justify-center relative overflow-hidden">
                            
                            {selectedFiles.length === 0 && !isRecording && (
                                <div className="text-center animate-fade-in">
                                    <button 
                                        onClick={startRecording}
                                        className={`w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-800 border-4 border-slate-300 dark:border-slate-700 flex items-center justify-center mb-6 hover:border-pink-500 hover:shadow-[0_0_30px_rgba(236,72,153,0.3)] hover:scale-105 transition-all group shadow-2xl`}
                                    >
                                        <Mic size={40} className="text-slate-400 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors" />
                                    </button>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs font-mono uppercase tracking-widest">Grabar Audio</p>
                                    
                                    <div className="mt-4 flex justify-center">
                                        <label className="cursor-pointer px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-pink-600 dark:text-pink-400 text-xs font-bold transition-colors border border-slate-300 dark:border-slate-700">
                                            Subir Archivo
                                            <input 
                                                type="file" 
                                                accept="audio/*" 
                                                className="hidden"
                                                onChange={handleFileChange}
                                            />
                                        </label>
                                    </div>
                                </div>
                            )}

                            {isRecording && (
                                <>
                                    <div className="absolute inset-0 bg-pink-500/5 animate-pulse"></div>
                                    <div className="relative z-10 flex flex-col items-center">
                                        <div className="w-24 h-24 rounded-full border-4 border-pink-500 flex items-center justify-center mb-6 relative">
                                            <div className="absolute inset-0 bg-pink-500 rounded-full opacity-20 animate-ping"></div>
                                            <Mic size={40} className="text-pink-500" />
                                        </div>
                                        <p className="text-pink-600 dark:text-pink-400 font-mono text-3xl font-bold mb-6 tracking-widest">{formatTime(recordingTime)}</p>
                                        <button 
                                            onClick={stopRecording}
                                            className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-all shadow-lg hover:shadow-red-500/30"
                                        >
                                            <StopCircle size={20} /> DETENER
                                        </button>
                                    </div>
                                </>
                            )}

                            {selectedFiles.length > 0 && !isRecording && (
                                <div className="w-full px-6 animate-fade-in">
                                    <div className="bg-slate-200 dark:bg-slate-950 p-4 rounded-2xl border border-pink-500/30 mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-600 dark:text-pink-400">
                                                <Play size={20} className="ml-1" />
                                            </div>
                                            <div>
                                                <p className="text-slate-800 dark:text-white text-sm font-bold">Nota de Voz</p>
                                                <p className="text-pink-600/60 dark:text-pink-400/60 text-xs font-mono">{(selectedFiles[0].size / 1024).toFixed(1)} KB</p>
                                            </div>
                                        </div>
                                        <button onClick={removeFile} className="text-slate-500 hover:text-red-500 transition-colors p-2">
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                    {previewUrl && <audio controls src={previewUrl!} className="w-full h-10 opacity-60 hover:opacity-100 transition-opacity" />}
                                </div>
                            )}
                            
                            {isProcessing && <CyberProgressOverlay />}
                        </div>
                    )}

                    {/* TEXT MODE */}
                    {mode === 'text' && (
                        <div className="h-[260px] relative">
                            <textarea 
                                value={textContent}
                                onChange={(e) => setTextContent(e.target.value)}
                                placeholder="> Inicia transmisión de texto seguro..."
                                className={`w-full h-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-3xl p-6 text-slate-800 dark:text-slate-200 focus:${theme.border} focus:outline-none resize-none font-mono text-sm placeholder-slate-400 dark:placeholder-slate-600 transition-colors leading-relaxed`}
                                disabled={isProcessing}
                            />
                            {isProcessing && <CyberProgressOverlay />}
                        </div>
                    )}
                </div>

                {/* OPTIONS PANEL */}
                <div className="bg-slate-200 dark:bg-slate-900 rounded-2xl p-4 border border-slate-300 dark:border-slate-800">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3 ml-1">Configuración de Seguridad</p>
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                         {/* Expiration */}
                        <div className="bg-slate-100 dark:bg-slate-950 p-3 rounded-xl border border-slate-300 dark:border-slate-800 flex flex-col justify-between">
                            <label className="text-slate-500 dark:text-slate-400 text-xs font-bold flex items-center gap-1.5 mb-2">
                                <Clock size={12} /> TTL (Tiempo)
                            </label>
                            <select 
                                value={duration}
                                onChange={(e) => setDuration(Number(e.target.value))}
                                className={`w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-xs font-mono rounded-lg p-2 border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-cyan-500 transition-colors`}
                                disabled={isProcessing}
                            >
                                <option value={1}>1 Minuto</option>
                                <option value={5}>5 Minutos</option>
                                <option value={60}>1 Hora</option>
                                <option value={1440}>24 Horas</option>
                            </select>
                        </div>

                        {/* Burn On Read */}
                        <div className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                                burnOnRead 
                                ? 'bg-orange-500/10 border-orange-500/50' 
                                : 'bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-800'
                            }`}
                        >
                            <div 
                                className="cursor-pointer"
                                onClick={() => !isProcessing && setBurnOnRead(!burnOnRead)}
                            >
                                <label className={`text-xs font-bold flex items-center gap-1.5 cursor-pointer ${burnOnRead ? 'text-orange-500 dark:text-orange-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                    <Flame size={12} /> Auto-Destruir
                                </label>
                                <div className="flex justify-between items-center mt-2 w-full">
                                    <span className="text-[10px] text-slate-500">{burnOnRead ? 'Activado' : 'Desactivado'}</span>
                                    <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${burnOnRead ? 'bg-orange-500' : 'bg-slate-400 dark:bg-slate-700'}`}>
                                        <div className={`bg-white w-3 h-3 rounded-full shadow-sm transform transition-transform ${burnOnRead ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Burn Delay Slider */}
                            {burnOnRead && (
                                <div className="mt-3 pt-2 border-t border-slate-300 dark:border-white/10 animate-fade-in">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[9px] text-slate-500 font-bold uppercase">Lectura</span>
                                        <span className="text-[9px] text-orange-500 font-mono font-bold">{burnDelay}s</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="5" 
                                        max="60" 
                                        step="5"
                                        value={burnDelay}
                                        onChange={(e) => setBurnDelay(Number(e.target.value))}
                                        className="w-full h-1 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:rounded-full"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Password */}
                    <div className={`rounded-xl border transition-all overflow-hidden ${showPasswordInput ? 'bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-700' : 'bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-800'}`}>
                         <div 
                            onClick={() => setShowPasswordInput(!showPasswordInput)}
                            className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-900 transition-colors"
                        >
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                <Lock size={12} />
                                <span className="text-xs font-bold">Contraseña Adicional</span>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded border ${password ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-slate-500 border-slate-300 dark:border-slate-700'}`}>
                                {password ? 'ON' : 'OFF'}
                            </span>
                        </div>
                        {showPasswordInput && (
                            <div className="px-3 pb-3 pt-0 animate-fade-in">
                                <input 
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Clave secreta..."
                                    className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm rounded-lg p-2 border border-slate-300 dark:border-slate-700 focus:border-slate-500 dark:focus:border-white focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 font-mono"
                                />
                                {/* Vault Strength Indicator */}
                                {password && (
                                    <div className="mt-2 animate-fade-in">
                                        <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-1">
                                            <div 
                                                className={`h-full transition-all duration-500 ease-out ${strength.color}`}
                                                style={{ width: `${strength.score}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px]">
                                             <span className="text-slate-400 font-bold uppercase tracking-wider">Estimación de Crackeo</span>
                                             <span className={`font-mono font-bold ${strength.color.replace('bg-', 'text-')}`}>{strength.label}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Action */}
                <button
                    onClick={handleInitialSubmit}
                    disabled={isProcessing || isGeneratingCode || !isSupabaseConfigured() || (mode === 'file' && selectedFiles.length === 0) || (mode === 'text' && !textContent.trim()) || (mode === 'audio' && selectedFiles.length === 0) || (mode === 'document' && selectedFiles.length === 0)}
                    className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg relative overflow-hidden group ${
                        isProcessing || isGeneratingCode || (mode === 'file' && selectedFiles.length === 0) || (mode === 'text' && !textContent.trim()) || (mode === 'audio' && selectedFiles.length === 0) || (mode === 'document' && selectedFiles.length === 0)
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50' 
                        : `bg-gradient-to-r ${theme.gradient} text-white ${theme.shadow} hover:brightness-110 hover:-translate-y-0.5`
                    }`}
                >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    {isProcessing || isGeneratingCode ? (
                        <Loader2 className="animate-spin" />
                    ) : (
                        <>
                            <Shield size={20} /> CREAR ARCHIVO SEGURO
                        </>
                    )}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default UploadView;