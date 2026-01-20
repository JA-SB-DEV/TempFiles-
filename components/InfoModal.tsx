import React from 'react';
import { X, Shield, Zap, Lock, EyeOff, FileKey, Flame } from 'lucide-react';

interface InfoModalProps {
  onClose: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col relative max-h-[90vh]">
        
        {/* Decorative Grid BG */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none"></div>

        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50 relative z-10">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Shield size={20} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Sobre Chronos</h2>
                    <p className="text-xs text-slate-500 font-mono">PROTOCOLO DE SEGURIDAD & FUNCIONAMIENTO</p>
                </div>
            </div>
            <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
            >
                <X size={24} />
            </button>
        </div>

        {/* Body */}
        <div className="p-6 md:p-8 overflow-y-auto relative z-10 space-y-8">
            
            {/* Intro */}
            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Zap size={100} />
                </div>
                <h3 className="text-lg font-bold text-cyan-700 dark:text-cyan-400 mb-2 flex items-center gap-2">
                    <Zap size={20} /> ¿Qué es esto?
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed relative z-10">
                    Chronos es una bóveda digital <strong>efímera y privada</strong>. 
                    Diseñada para compartir información sensible (contraseñas, documentos confidenciales, fotos privadas) 
                    sin dejar rastro digital permanente. Los archivos desaparecen automáticamente cuando tú lo decides.
                </p>
            </div>

            {/* How it works Grid */}
            <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Lock size={14} className="text-slate-400"/> Arquitectura de Seguridad
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 hover:border-emerald-500/30 transition-colors">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                            <Lock size={20} />
                        </div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Encriptación E2E</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Tu archivo se cifra en tu dispositivo (AES-GCM 256) <strong>antes</strong> de subir. 
                            El servidor nunca recibe la llave real, solo datos ilegibles.
                        </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 hover:border-violet-500/30 transition-colors">
                        <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400 mb-3">
                            <EyeOff size={20} />
                        </div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Zero-Knowledge</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            No guardamos logs de acceso. No conocemos el contenido. 
                            Sin la llave (el enlace/código), los datos almacenados son basura matemática irrecuperable.
                        </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 hover:border-orange-500/30 transition-colors">
                        <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600 dark:text-orange-400 mb-3">
                            <Flame size={20} />
                        </div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Auto-Destrucción</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Configura archivos para que se "quemen" (eliminen definitivamente) tras ser vistos una vez o 
                            tras un tiempo límite de expiración.
                        </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 hover:border-blue-500/30 transition-colors">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3">
                            <FileKey size={20} />
                        </div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">El Poder del Hash</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            La llave viaja en el fragmento (#) de la URL o en tu código. El servidor solo ve un <strong>Hash SHA-256</strong> del código para indexar, nunca el código real.
                        </p>
                    </div>

                </div>
            </div>

             {/* Footer Note */}
             <div className="text-center text-[10px] text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-800">
                <p>No confíes, verifica. Todo el proceso criptográfico ocurre en tu navegador (Client-Side).</p>
             </div>

        </div>
      </div>
    </div>
  );
};

export default InfoModal;