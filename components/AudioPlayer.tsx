import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  autoPlay?: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, autoPlay = false }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (autoPlay) {
      audio.play().catch(e => console.log("Autoplay prevented", e));
    }

    const updateProgress = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const setAudioData = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [src, autoPlay]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (audioRef.current) {
      const newTime = (val / 100) * duration;
      audioRef.current.currentTime = newTime;
      setProgress(val);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Generate visual bars for the "waveform"
  const bars = Array.from({ length: 20 }).map((_, i) => {
    // Random height for aesthetics, slightly animated via CSS if playing
    const height = Math.max(20, Math.random() * 100); 
    return (
      <div 
        key={i}
        className={`w-1 bg-pink-500 rounded-full transition-all duration-300 ${isPlaying ? 'animate-pulse' : 'opacity-50'}`}
        style={{ 
          height: `${isPlaying ? Math.max(20, Math.random() * 40 + 20) : 20}%`,
          animationDelay: `${i * 0.05}s`
        }}
      />
    );
  });

  return (
    <div className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-inner">
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {/* Top Row: Waveform & Time */}
      <div className="flex items-center justify-between mb-4 h-16 bg-slate-800/50 rounded-xl px-4 overflow-hidden relative">
         <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-80 h-full py-2">
            {bars}
         </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button 
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-pink-500 hover:bg-pink-400 text-white flex items-center justify-center transition-transform hover:scale-105 shadow-lg shadow-pink-500/20"
        >
          {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </button>

        <div className="flex-1 flex flex-col justify-center">
           <input 
              type="range" 
              min="0" 
              max="100" 
              value={progress} 
              onChange={handleSeek}
              className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-pink-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg"
           />
           <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
           </div>
        </div>

        <button onClick={toggleMute} className="text-slate-400 hover:text-white transition-colors">
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>
    </div>
  );
};

export default AudioPlayer;