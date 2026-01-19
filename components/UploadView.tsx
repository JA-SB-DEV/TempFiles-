import React, { useState, useRef, useCallback } from 'react';
import { TempFile } from '../types';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { encryptFile } from '../utils/crypto';
import { Camera, Video, Upload, Loader2, Database, Clock, Flame, Shield, X, FileText, Image as ImageIcon, Mic, StopCircle, Play, Trash2, Lock, Unlock, AlertTriangle, Eye, ArrowRight, ShieldCheck } from 'lucide-react';

interface UploadViewProps {
  onUploadSuccess: (file: TempFile) => void;
}

type UploadMode = 'file' | 'text' | 'audio';

// Theme Helpers
const getTheme = (mode: UploadMode, fileType?: string) => {
    if (mode === 'text') {
        return {
            color: 'text-amber-400',
            border: 'border-amber-500',
            bg: 'bg-amber-600',
            gradient: 'from-amber-500 to-orange-600',
            shadow: 'shadow-amber-500/20',
            accent: 'text-orange-400'
        };
    }
    if (mode === 'audio' || fileType?.startsWith('audio/')) {
        return {
            color: 'text-pink-400',
            border: 'border-pink-500',
            bg: 'bg-pink-600',
            gradient: 'from-pink-500 to-rose-600',
            shadow: 'shadow-pink-500/20',
            accent: 'text-rose-400'
        };
    }
    if (fileType?.startsWith('video/')) {
        return {
            color: 'text-violet-400',
            border: 'border-violet-500',
            bg: 'bg-violet-600',
            gradient: 'from-violet-600 to-fuchsia-600',
            shadow: 'shadow-violet-500/20',
            accent: 'text-fuchsia-400'
        };
    }
    // Default / Image
    return {
        color: 'text-cyan-400',
        border: 'border-cyan-500',
        bg: 'bg-cyan-600',
        gradient: 'from-cyan-600 to-blue-600',
        shadow: 'shadow-cyan-500/20',
        accent: 'text-cyan-400'
    };
};

const UploadView: React.FC<UploadViewProps> = ({ onUploadSuccess }) => {
  const [mode, setMode] = useState<UploadMode>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  
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
  const theme = getTheme(mode, selectedFile?.type);

  const processFile = (file: File) => {
    if (file.size > 50 * 1024 * 1024) { // 50MB
      alert("El archivo es demasiado grande (Máx 50MB)");
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
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
        processFile(audioFile);
        
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

  const handleInitialSubmit = () => {
    if (mode === 'file' && (!selectedFile || !previewUrl)) return;
    if (mode === 'text' && !textContent.trim()) return;
    if (mode === 'audio' && !selectedFile) return;

    if (!isSupabaseConfigured()) {
      alert("Error: Supabase no está configurado.");
      return;
    }
    
    // Open Confirmation Modal
    setShowConfirmModal(true);
  };

  const executeUpload = async () => {
    setShowConfirmModal(false);
    setIsProcessing(true);
    setProgress(10); 

    let code: string = generateRandomCode(); 
    let fileToEncrypt: File;

    try {
      if (mode === 'text') {
        const blob = new Blob([textContent], { type: 'text/plain' });
        fileToEncrypt = new File([blob], 'secret_note.txt', { type: 'text/plain' });
      } else {
        fileToEncrypt = selectedFile!;
      }
      
      setProgress(30);

      // SECURITY KEY LOGIC:
      // If password exists, the Encryption Key = CODE + PASSWORD
      // If no password, Encryption Key = CODE
      const encryptionKey = password ? (code + password) : code;

      const encryptedBlob = await encryptFile(
        fileToEncrypt, 
        encryptionKey, 
        {
          burnOnRead,
          durationMinutes: duration,
          burnDelaySeconds: burnOnRead ? burnDelay : undefined
        }
      );

      setProgress(50);

      const fileExt = 'enc';
      const fileName = `${code}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const interval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90));
      }, 100);

      const { error: uploadError } = await supabase.storage
        .from('chronos_files')
        .upload(filePath, encryptedBlob, {
          contentType: 'application/octet-stream'
        });

      clearInterval(interval);
      if (uploadError) {
        // Helpful error for missing bucket
        if (uploadError.message.includes("resource") || uploadError.message.includes("bucket")) {
            throw new Error("El 'Bucket' de almacenamiento no existe. Ve a Supabase -> Storage y crea un bucket público llamado 'chronos_files'.");
        }
        throw uploadError;
      }

      setProgress(95);

      const expiresInMs = duration * 60 * 1000;
      const now = Date.now();
      const expiresAt = now + expiresInMs;
      
      let type: TempFile['type'] = 'image';
      if (mode === 'text') type = 'text';
      else if (mode === 'audio' || fileToEncrypt.type.startsWith('audio/')) type = 'audio';
      else if (fileToEncrypt.type.startsWith('video/')) type = 'video';

      const newFile: TempFile = {
        id: crypto.randomUUID(),
        code: code,
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
            code: newFile.code,
            file_path: newFile.fileUrl,
            type: newFile.type,
            mime_type: 'application/encrypted', // Hide real type
            expires_at: new Date(expiresAt).toISOString()
          }
        ]);

      if (dbError) throw dbError;

      setProgress(100);
      onUploadSuccess(newFile);

    } catch (error: any) {
      console.error("Upload failed", error);
      alert(`Error: ${error.message || "Error desconocido"}`);
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setProgress(0);
    setIsRecording(false);
    if (mediaRecorderRef.current) {
        // cleanup
    }
  };

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in relative z-10">
      
      {/* --- CONFIRMATION MODAL --- */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)}></div>
            <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-6 relative z-10 shadow-2xl animate-fade-in">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <ShieldCheck className="text-emerald-400" /> Confirmar Subida
                </h3>
                
                <div className="space-y-4 mb-6">
                    <div className="bg-slate-800 p-3 rounded-xl flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Tipo</span>
                        <span className={`font-semibold ${theme.color} uppercase text-sm`}>
                            {mode === 'text' ? 'Texto Seguro' : selectedFile?.type.split('/')[0] || 'Archivo'}
                        </span>
                    </div>

                    <div className="bg-slate-800 p-3 rounded-xl flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Expiración</span>
                        <span className="font-semibold text-white text-sm flex items-center gap-1">
                            <Clock size={14} /> 
                            {duration === 1440 ? '24 Horas' : duration === 60 ? '1 Hora' : `${duration} Min`}
                        </span>
                    </div>

                    <div className={`p-3 rounded-xl flex items-center justify-between border ${burnOnRead ? 'bg-orange-900/20 border-orange-500/50' : 'bg-slate-800 border-transparent'}`}>
                        <span className="text-slate-400 text-sm">Auto-Destrucción</span>
                        <div className="text-right">
                             <span className={`font-semibold text-sm block ${burnOnRead ? 'text-orange-400' : 'text-slate-500'}`}>
                                {burnOnRead ? 'ACTIVADO' : 'Desactivado'}
                            </span>
                            {burnOnRead && (
                                <span className="text-xs text-orange-300">
                                    Se borra tras {burnDelay}s de lectura
                                </span>
                            )}
                        </div>
                    </div>

                     <div className={`p-3 rounded-xl flex items-center justify-between border ${password ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-slate-800 border-transparent'}`}>
                        <span className="text-slate-400 text-sm">Contraseña</span>
                        <span className={`font-semibold text-sm ${password ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {password ? 'Sí (Capa Extra)' : 'No (Solo Código)'}
                        </span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowConfirmModal(false)}
                        className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={executeUpload}
                        className={`flex-1 py-3 rounded-xl font-bold text-white text-sm shadow-lg flex items-center justify-center gap-2 bg-gradient-to-r ${theme.gradient}`}
                    >
                        Subir <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        </div>
      )}

      {!isSupabaseConfigured() && (
        <div className="mb-4 bg-red-500/20 border border-red-500 rounded-xl p-4 text-red-200 text-sm flex items-start gap-3">
          <Database className="shrink-0" />
          <div>
            <p className="font-bold">Supabase no conectado</p>
          </div>
        </div>
      )}

      <div className={`bg-slate-800/80 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border ${theme.border} transition-colors duration-500`}>
        <div className="flex justify-between items-center mb-6">
             <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Upload className={theme.color} /> Nuevo
            </h2>
            <div className="bg-slate-900 p-1 rounded-lg flex gap-1">
                <button 
                    onClick={() => { setMode('file'); removeFile(); }}
                    className={`p-2 rounded-md transition-all ${mode === 'file' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    <ImageIcon size={18} />
                </button>
                <button 
                    onClick={() => { setMode('audio'); removeFile(); }}
                    className={`p-2 rounded-md transition-all ${mode === 'audio' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    <Mic size={18} />
                </button>
                <button 
                    onClick={() => { setMode('text'); removeFile(); }}
                    className={`p-2 rounded-md transition-all ${mode === 'text' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    <FileText size={18} />
                </button>
            </div>
        </div>
        
        {/* FILE UPLOAD MODE */}
        {mode === 'file' && (
            !selectedFile ? (
                <div 
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed transition-all rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer min-h-[240px] group ${
                    dragActive 
                    ? `${theme.border} bg-slate-700/50 scale-105` 
                    : `border-slate-600 hover:${theme.border} hover:bg-slate-700/30`
                }`}
                >
                <div className={`flex gap-4 mb-6 text-slate-400 group-hover:${theme.color} transition-colors`}>
                    <Camera size={48} />
                    <Video size={48} />
                </div>
                <p className="text-slate-200 font-semibold text-lg">Subir Archivo</p>
                <p className="text-slate-500 mt-2 text-sm text-center">
                    Soporta Fotos y Videos.<br/>
                    Encriptación AES-256.
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
                <div className="relative rounded-2xl overflow-hidden bg-black/40 border border-slate-600 group mb-6">
                    {selectedFile.type.startsWith('video/') ? (
                        <video src={previewUrl!} className="w-full max-h-60 object-contain" />
                    ) : (
                        <img src={previewUrl!} alt="Preview" className="w-full max-h-60 object-contain" />
                    )}
                    <button 
                        onClick={removeFile}
                        className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
                    >
                        <X size={16} />
                    </button>
                    {isProcessing && (
                         <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                             <div className="w-64 h-2 bg-slate-700 rounded-full overflow-hidden mb-4">
                                 <div 
                                    className={`h-full bg-gradient-to-r ${theme.gradient} transition-all duration-300`}
                                    style={{ width: `${progress}%` }}
                                 ></div>
                             </div>
                             <p className={`${theme.color} font-mono animate-pulse`}>Encriptando {progress}%</p>
                         </div>
                    )}
                </div>
            )
        )}

        {/* AUDIO MODE */}
        {mode === 'audio' && (
             <div className="mb-6 rounded-2xl bg-slate-900/50 border border-slate-600 p-6 flex flex-col items-center justify-center min-h-[240px] relative">
                
                {!selectedFile && !isRecording && (
                    <>
                        <button 
                            onClick={startRecording}
                            className={`w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center mb-4 hover:border-pink-500 hover:scale-105 transition-all group shadow-lg`}
                        >
                            <Mic size={32} className="text-slate-400 group-hover:text-pink-500 transition-colors" />
                        </button>
                        <p className="text-slate-300 font-semibold">Toca para grabar</p>
                        <p className="text-slate-500 text-sm mt-2">o sube un archivo</p>
                        <input 
                            type="file" 
                            accept="audio/*" 
                            className="mt-4 text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-700 file:text-pink-400 hover:file:bg-slate-600"
                            onChange={handleFileChange}
                        />
                    </>
                )}

                {isRecording && (
                    <>
                        <div className="animate-pulse w-24 h-24 rounded-full bg-pink-500/20 flex items-center justify-center mb-4 relative">
                            <div className="absolute inset-0 border-4 border-pink-500 rounded-full animate-ping opacity-20"></div>
                            <Mic size={40} className="text-pink-500" />
                        </div>
                        <p className="text-pink-400 font-mono text-2xl font-bold mb-6">{formatTime(recordingTime)}</p>
                        <button 
                            onClick={stopRecording}
                            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 transition-all"
                        >
                            <StopCircle size={20} /> Detener
                        </button>
                    </>
                )}

                {selectedFile && !isRecording && (
                    <div className="w-full">
                        <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-pink-500/30 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-pink-500/20 rounded-full text-pink-400">
                                    <Play size={20} className="fill-current"/>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">Audio Grabado</p>
                                    <p className="text-xs text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                                </div>
                            </div>
                            <button onClick={removeFile} className="p-2 text-slate-400 hover:text-red-400 transition-colors">
                                <Trash2 size={18} />
                            </button>
                        </div>
                        <audio controls src={previewUrl!} className="w-full opacity-80 h-10 mb-2" />
                    </div>
                )}
                
                {isProcessing && (
                     <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20 rounded-2xl">
                         <Loader2 className={`animate-spin ${theme.color} mb-2`} size={32} />
                         <p className={`${theme.color} font-mono text-sm`}>Cifrando Audio...</p>
                     </div>
                )}
             </div>
        )}

        {/* TEXT MODE */}
        {mode === 'text' && (
            <div className="mb-6 relative">
                 <textarea 
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Escribe tu secreto aquí..."
                    className={`w-full h-60 bg-slate-900/50 border border-slate-600 rounded-2xl p-4 text-slate-200 focus:${theme.border} focus:outline-none resize-none font-mono text-sm placeholder-slate-600 transition-colors`}
                    disabled={isProcessing}
                 />
                 {isProcessing && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20 rounded-2xl">
                        <Loader2 className={`animate-spin ${theme.color} mb-2`} size={32} />
                        <p className={`${theme.color} font-mono text-sm`}>Cifrando Nota...</p>
                    </div>
                )}
            </div>
        )}

        {/* OPTIONS & SUBMIT */}
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                {/* Time Selector */}
                <div className="col-span-1 bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                    <label className="text-slate-400 text-xs font-bold uppercase mb-2 block flex items-center gap-1">
                        <Clock size={12} /> Expiración
                    </label>
                    <select 
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className={`w-full bg-slate-800 text-white text-sm rounded-lg p-2 border border-slate-600 focus:${theme.border} focus:outline-none`}
                        disabled={isProcessing}
                    >
                        <option value={1}>1 Minuto</option>
                        <option value={5}>5 Minutos</option>
                        <option value={60}>1 Hora</option>
                        <option value={1440}>1 Día</option>
                    </select>
                </div>

                {/* Burn On Read Toggle */}
                <div 
                    onClick={() => !isProcessing && setBurnOnRead(!burnOnRead)}
                    className={`col-span-1 p-3 rounded-xl border cursor-pointer transition-all ${
                        burnOnRead 
                        ? 'bg-orange-500/20 border-orange-500' 
                        : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'
                    }`}
                >
                    <label className={`text-xs font-bold uppercase mb-2 block flex items-center gap-1 ${burnOnRead ? 'text-orange-400' : 'text-slate-400'}`}>
                        <Flame size={12} /> Auto-Destruir
                    </label>
                    <div className="flex items-center gap-2">
                            <div className={`w-10 h-5 rounded-full p-1 transition-colors ${burnOnRead ? 'bg-orange-500' : 'bg-slate-600'}`}>
                                <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${burnOnRead ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </div>
                            <span className="text-xs text-slate-300">{burnOnRead ? 'Si' : 'No'}</span>
                    </div>
                </div>
            </div>

            {/* Burn Timer Settings (Only if BurnOnRead is active) */}
            {burnOnRead && (
                 <div className="bg-orange-900/10 border border-orange-500/30 rounded-xl p-3 animate-fade-in">
                    <label className="text-orange-400 text-xs font-bold uppercase mb-2 block flex items-center gap-1">
                        <Eye size={12} /> Tiempo de lectura (antes de quemarse)
                    </label>
                    <div className="flex gap-2">
                        {[5, 10, 30, 60].map((sec) => (
                            <button
                                key={sec}
                                onClick={() => setBurnDelay(sec)}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                                    burnDelay === sec 
                                    ? 'bg-orange-500 text-white border-orange-500' 
                                    : 'bg-slate-800 text-slate-400 border-slate-600 hover:border-orange-500/50'
                                }`}
                            >
                                {sec}s
                            </button>
                        ))}
                    </div>
                 </div>
            )}

            {/* Password Toggle */}
            <div className="bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden">
                <div 
                    onClick={() => setShowPasswordInput(!showPasswordInput)}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition-colors"
                >
                    <label className="text-slate-400 text-xs font-bold uppercase flex items-center gap-1 pointer-events-none">
                        <Lock size={12} /> Proteger con Contraseña
                    </label>
                    <div className={`text-xs px-2 py-0.5 rounded ${password ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500'}`}>
                        {password ? 'Activado' : 'Opcional'}
                    </div>
                </div>
                {showPasswordInput && (
                    <div className="p-3 pt-0 animate-fade-in">
                        <input 
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Contraseña extra..."
                            className="w-full bg-slate-800 text-white text-sm rounded-lg p-2 border border-slate-600 focus:border-white focus:outline-none"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                            Si olvidas la contraseña, el archivo será irrecuperable.
                        </p>
                    </div>
                )}
            </div>

            {/* Main Action */}
            <button
                onClick={handleInitialSubmit}
                disabled={isProcessing || !isSupabaseConfigured() || (mode === 'file' && !selectedFile) || (mode === 'text' && !textContent.trim()) || (mode === 'audio' && !selectedFile)}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-xl relative overflow-hidden group mt-2 ${
                    isProcessing || (mode === 'file' && !selectedFile) || (mode === 'text' && !textContent.trim()) || (mode === 'audio' && !selectedFile)
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                    : `bg-gradient-to-r ${theme.gradient} text-white ${theme.shadow}`
                }`}
            >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                {isProcessing ? (
                    <Loader2 className="animate-spin" />
                ) : (
                    <>
                        <Shield size={20} /> Crear {mode === 'text' ? 'Nota' : (mode === 'audio' ? 'Audio' : 'Archivo')} Seguro
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default UploadView;