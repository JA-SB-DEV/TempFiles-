import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Maximize2, Volume2, VolumeX, RotateCcw, MonitorPlay } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  autoPlay?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, autoPlay = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  let controlsTimeout = useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (autoPlay) {
      video.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }

    const updateProgress = () => {
      setCurrentTime(video.currentTime);
      setProgress((video.currentTime / video.duration) * 100);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setShowControls(true);
    };

    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', updateProgress);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, [src, autoPlay]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (videoRef.current) {
      const newTime = (val / 100) * duration;
      videoRef.current.currentTime = newTime;
      setProgress(val);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeout.current) {
      window.clearTimeout(controlsTimeout.current);
    }
    controlsTimeout.current = window.setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2500);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-black group overflow-hidden flex items-center justify-center rounded-lg shadow-2xl"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video 
        ref={videoRef} 
        src={src} 
        className="max-w-full max-h-[80vh] w-auto h-auto object-contain"
        onClick={togglePlay}
      />
      
      {/* Scanline Effect Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[5] bg-[length:100%_2px,3px_100%] pointer-events-none opacity-50"></div>

      {/* Big Play Button Overlay */}
      {!isPlaying && (
        <button 
          onClick={togglePlay}
          className="absolute z-20 w-20 h-20 bg-violet-600/80 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-violet-500 hover:scale-110 transition-all shadow-[0_0_30px_rgba(139,92,246,0.5)] border border-violet-400"
        >
          <Play size={40} className="ml-1 fill-current" />
        </button>
      )}

      {/* Controls Bar */}
      <div className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* Progress Bar */}
        <div className="relative w-full h-1.5 bg-slate-700/50 rounded-full mb-4 group/progress cursor-pointer">
           <div 
             className="absolute top-0 left-0 h-full bg-violet-500 rounded-full shadow-[0_0_10px_rgba(139,92,246,0.8)]"
             style={{ width: `${progress}%` }}
           >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg scale-125"></div>
           </div>
           <input 
              type="range" 
              min="0" 
              max="100" 
              value={progress}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
           />
        </div>

        <div className="flex items-center justify-between font-mono">
           <div className="flex items-center gap-4">
              <button onClick={togglePlay} className="text-white hover:text-violet-400 transition-colors">
                 {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
              </button>
              
              <div className="flex items-center gap-2 group/vol">
                  <button onClick={toggleMute} className="text-slate-300 hover:text-white">
                      {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-300">
                     <input 
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        defaultValue="1"
                        onChange={(e) => {
                            if(videoRef.current) videoRef.current.volume = Number(e.target.value);
                            setIsMuted(Number(e.target.value) === 0);
                        }}
                        className="w-16 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full ml-2"
                     />
                  </div>
              </div>

              <div className="text-xs text-violet-200 tracking-wider">
                 <span className="text-white font-bold">{formatTime(currentTime)}</span> / <span className="text-slate-400">{formatTime(duration)}</span>
              </div>
           </div>

           <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                   if(videoRef.current) {
                       videoRef.current.currentTime = 0;
                       setProgress(0);
                   }
                }}
                className="text-slate-400 hover:text-white transition-colors"
                title="Replay"
              >
                  <RotateCcw size={18} />
              </button>
              <button 
                onClick={toggleFullscreen}
                className="text-slate-400 hover:text-white transition-colors"
                title="Fullscreen"
              >
                  <Maximize2 size={20} />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;