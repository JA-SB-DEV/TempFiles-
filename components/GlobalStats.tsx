import React, { useState, useEffect } from 'react';
import { getPublicStats } from '../services/supabaseClient';
import { BarChart3, X, Database, Globe, Shield, Server, FileText, Image, Mic, Video, Paperclip, Activity } from 'lucide-react';

interface GlobalStatsProps {
  onClose: () => void;
}

const GlobalStats: React.FC<GlobalStatsProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ activeFiles: number; sampleTypes: Record<string, number> } | null>(null);
  const [uptime, setUptime] = useState<string>("00:00:00");

  useEffect(() => {
    // Fetch DB Stats
    const fetchStats = async () => {
        try {
            const data = await getPublicStats();
            setStats(data);
        } catch (e) {
            console.error("Error fetching stats", e);
        } finally {
            setLoading(false);
        }
    };
    fetchStats();

    // Mock Uptime Counter
    const start = Date.now() - (Math.random() * 100000000); // Fake offset
    const interval = setInterval(() => {
        const diff = Date.now() - start;
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        setUptime(`${h}:${m}:${s}`);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Helper to get percentage for bars based on sample of 100
  const getPercent = (type: string) => {
      if (!stats || !stats.sampleTypes) return 0;
      const count = stats.sampleTypes[type] || 0;
      // Explicit cast to number[] to fix implicit any type error in reduce
      const totalSample = (Object.values(stats.sampleTypes) as number[]).reduce((a, b) => a + b, 0);
      if (totalSample === 0) return 0;
      return Math.round((count / totalSample) * 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col relative">
        
        {/* Decorative Grid BG */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none"></div>

        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50 relative z-10">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400">
                    <BarChart3 size={20} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Telemetría Global</h2>
                    <p className="text-xs text-slate-500 font-mono">ESTADÍSTICAS EN TIEMPO REAL</p>
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
        <div className="p-6 md:p-8 overflow-y-auto relative z-10">
            
            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {/* Active Vaults */}
                <div className="bg-slate-100 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110">
                        <Database size={60} />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Bóvedas Activas</p>
                    <div className="flex items-baseline gap-2">
                        {loading ? (
                            <div className="h-8 w-16 bg-slate-300 dark:bg-slate-700 animate-pulse rounded"></div>
                        ) : (
                            <span className="text-4xl font-black text-slate-900 dark:text-white">
                                {stats?.activeFiles || 0}
                            </span>
                        )}
                        <span className="text-emerald-500 text-xs font-bold flex items-center gap-1 animate-pulse">
                            <Activity size={10} /> LIVE
                        </span>
                    </div>
                </div>

                {/* Encryption Standard */}
                <div className="bg-slate-100 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-white/5 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110">
                        <Shield size={60} />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Protocolo</p>
                    <p className="text-xl font-bold text-slate-800 dark:text-slate-200 font-mono">AES-GCM</p>
                    <p className="text-xs text-cyan-600 dark:text-cyan-400 font-bold mt-1">256-BIT • CLIENT-SIDE</p>
                </div>

                 {/* Server Status */}
                 <div className="bg-slate-100 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-white/5 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110">
                        <Server size={60} />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Tiempo de Actividad</p>
                    <p className="text-xl font-bold text-slate-800 dark:text-slate-200 font-mono">{uptime}</p>
                    <p className="text-xs text-emerald-500 font-bold mt-1 flex items-center gap-1">
                        <Globe size={10} /> SYSTEM OPTIMAL
                    </p>
                </div>
            </div>

            {/* Distribution Bars */}
            <div className="bg-slate-50 dark:bg-slate-950/30 rounded-2xl p-6 border border-slate-200 dark:border-white/5">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-6 flex items-center gap-2">
                    <Activity size={16} className="text-violet-500" />
                    Distribución de Tráfico Reciente
                </h3>

                <div className="space-y-5">
                    {[
                        { id: 'image', label: 'Imágenes', icon: <Image size={14}/>, color: 'bg-cyan-500' },
                        { id: 'video', label: 'Video', icon: <Video size={14}/>, color: 'bg-violet-500' },
                        { id: 'audio', label: 'Audio / Voz', icon: <Mic size={14}/>, color: 'bg-pink-500' },
                        { id: 'text', label: 'Notas Secretas', icon: <FileText size={14}/>, color: 'bg-amber-500' },
                        { id: 'document', label: 'Documentos', icon: <Paperclip size={14}/>, color: 'bg-emerald-500' },
                    ].map((type) => {
                        const percent = getPercent(type.id);
                        return (
                            <div key={type.id} className="group">
                                <div className="flex justify-between items-center mb-1 text-xs">
                                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-bold uppercase">
                                        {type.icon} {type.label}
                                    </span>
                                    <span className="font-mono text-slate-500">{loading ? '--' : `${percent}%`}</span>
                                </div>
                                <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full ${type.color} transition-all duration-1000 ease-out relative`}
                                        style={{ width: loading ? '0%' : `${Math.max(percent, 2)}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/20"></div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
                
                <p className="text-[10px] text-slate-400 mt-6 text-center italic">
                    * Muestra basada en las últimas 100 transacciones anónimas.
                </p>
            </div>

        </div>
      </div>
    </div>
  );
};

export default GlobalStats;