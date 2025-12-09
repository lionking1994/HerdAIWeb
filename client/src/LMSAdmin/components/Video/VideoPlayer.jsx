import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw } from 'lucide-react';

const isYouTubeUrl = (url) => {
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  return youtubeRegex.test(url);
};

const getYouTubeVideoId = (url) => {
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(youtubeRegex);
  return match ? match[1] : null;
};

export function VideoPlayer({
  src,
  title,
  onProgress,
  onComplete,
  initialTime = 0
}) {
  const videoRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const containerRef = useRef(null);
  const youtubePlayerInstanceRef = useRef(null); // Use ref for player instance
  const progressIntervalRef = useRef(null); // Use ref for interval

  const [isYouTube, setIsYouTube] = useState(false);
  const [youtubePlayer, setYoutubePlayer] = useState(null);
  const [progressInterval, setProgressInterval] = useState(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isUserSeeking, setIsUserSeeking] = useState(false); // Track user-initiated seeking

  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // 1) Detect mode and reset
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsUserSeeking(false); // Reset user seeking state
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (progressInterval) {
      clearInterval(progressInterval);
      setProgressInterval(null);
    }

    const isYT = isYouTubeUrl(src);
    setIsYouTube(isYT);

    if (!isYT && youtubePlayerInstanceRef.current) {
      youtubePlayerInstanceRef.current.destroy();
      youtubePlayerInstanceRef.current = null;
      setYoutubePlayer(null);
    }

    if (!isYT && videoRef.current) {
      videoRef.current.pause();
    }
  }, [src]);

  // 2) Setup video event listeners for normal video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isYouTube) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if (initialTime > 0) video.currentTime = initialTime;
    };
    const handleTimeUpdate = () => {
      if (!isSeeking) {
        const ct = video.currentTime;
        setCurrentTime(ct);
        onProgress?.(ct, video.duration);
      }
    };
    const handleSeeked = () => {
      setIsSeeking(false);
      const ct = video.currentTime;
      setCurrentTime(ct);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      onComplete?.();
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('ended', handleEnded);
    };
  }, [isYouTube, src, initialTime, onProgress, onComplete, isSeeking]);

  // 3) Load YouTube iframe
  useEffect(() => {
    if (!isYouTube) return;
    
    // Destroy existing player if src changed OR if we need to apply new initialTime
    if (youtubePlayerInstanceRef.current && youtubePlayerInstanceRef.current.getVideoData) {
      const currentVideoId = getYouTubeVideoId(src);
      const playingVideoData = youtubePlayerInstanceRef.current.getVideoData();
      const playingVideoId = playingVideoData?.video_id;
      
      if (currentVideoId !== playingVideoId) {
        youtubePlayerInstanceRef.current.destroy();
        youtubePlayerInstanceRef.current = null;
        setYoutubePlayer(null);
      } else {
        // For same video, only seek if user hasn't manually sought and initialTime is different
        if (initialTime > 0 && !isUserSeeking) {
          const currentPlayerTime = youtubePlayerInstanceRef.current.getCurrentTime();
          const timeDifference = Math.abs(currentPlayerTime - initialTime);
          
          // Only seek if there's a significant difference (more than 5 seconds) to avoid unnecessary seeks
          if (timeDifference > 5) {
            try {
              youtubePlayerInstanceRef.current.seekTo(initialTime, true);
              setCurrentTime(initialTime);
              const dur = youtubePlayerInstanceRef.current.getDuration();
              if (dur > 0) {
                onProgress?.(initialTime, dur);
              }
            } catch (error) {
              console.warn('YouTube seekTo error:', error);
            }
          }
        }
        return; // Same video, handled above
      }
    }
    
    if (!window.YT) {
      // Check if script is already loading to avoid duplicates
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = () => initYouTube();
    } else {
      initYouTube();
    }
  }, [isYouTube, src, initialTime]);

  const initYouTube = () => {
    if (!youtubePlayerRef.current) return;
    const videoId = getYouTubeVideoId(src);
    if (!videoId) return;



    const player = new window.YT.Player(youtubePlayerRef.current, {
      height: '100%',
      width: '100%',
      videoId,
      playerVars: {
        autoplay: 0,
        controls: 1, // Enable YouTube's native controls
        modestbranding: 1,
        rel: 0,
        start: Math.floor(initialTime),
        origin: window.location.origin,
        iv_load_policy: 3, // Hide video annotations
        disablekb: 0, // Enable keyboard controls
        fs: 1, // Enable fullscreen button
        playsinline: 1, // Play inline on mobile
        enablejsapi: 1 // Enable JavaScript API for better control
      },
      events: {
        onReady: (e) => {
          youtubePlayerInstanceRef.current = e.target; // Store in ref
          setYoutubePlayer(e.target); // Keep state for re-renders
          const dur = e.target.getDuration();
          if (dur > 0 && !isNaN(dur)) {
            setDuration(dur);
          }
          
          // Always use seekTo for precise positioning, even if start param was used
          // This ensures the position is set correctly regardless of initial load timing
          if (initialTime > 0) {
            // Use a small delay to ensure the video is fully loaded
            setTimeout(() => {
              e.target.seekTo(initialTime, true);
              setCurrentTime(initialTime);
              onProgress?.(initialTime, dur);
            }, 200);
          } else {
            // Only get current time if no initial time to set
            const ct = e.target.getCurrentTime();
            setCurrentTime(ct);
            onProgress?.(ct, dur);
          }
        },
        onStateChange: (e) => {
          // Update playing state based on YouTube player state
          const isCurrentlyPlaying = e.data === window.YT.PlayerState.PLAYING;
          setIsPlaying(isCurrentlyPlaying);
          
          const stateNames = {
            [-1]: 'UNSTARTED',
            [0]: 'ENDED',
            [1]: 'PLAYING',
            [2]: 'PAUSED',
            [3]: 'BUFFERING',
            [5]: 'CUED'
          };
          
          if (e.data === window.YT.PlayerState.PLAYING) {
            // Clear user seeking flag when playing starts (user finished seeking)
            setIsUserSeeking(false);
            // Use a small delay to ensure youtubePlayer state is set
            setTimeout(() => startYTInterval(), 100);
          } else if (e.data === window.YT.PlayerState.PAUSED) {
            stopYTInterval();
          } else if (e.data === window.YT.PlayerState.ENDED) {
            stopYTInterval();
            onComplete?.();
          } else if (e.data === window.YT.PlayerState.BUFFERING) {
            // Set user seeking flag during buffering as it often indicates seeking
            setIsUserSeeking(true);
            // Continue tracking during buffering with delay
            setTimeout(() => startYTInterval(), 100);
          }
        }
      }
    });
  };

  const startYTInterval = () => {
    stopYTInterval();
    
    const interval = setInterval(() => {
      // Access player from ref to avoid stale closure
      const currentPlayer = youtubePlayerInstanceRef.current;
      const currentIsSeeking = isSeeking;
      const currentIsUserSeeking = isUserSeeking;
      
      // Reduce conflict with YouTube's native controls by being more conservative
      if (currentPlayer && typeof currentPlayer.getCurrentTime === 'function' && !currentIsSeeking && !currentIsUserSeeking) {
        try {
          const ct = currentPlayer.getCurrentTime();
          const dur = currentPlayer.getDuration();
          
          // Only update if we have valid values and significant change (reduce micro-updates)
          if (dur > 0 && !isNaN(dur) && !isNaN(ct)) {
            const timeDiff = Math.abs(ct - currentTime);
            
            // Only update if time difference is significant (more than 0.5 seconds) or it's the first update
            if (timeDiff > 0.5 || currentTime === 0) {
              setDuration(dur);
              setCurrentTime(ct);
              onProgress?.(ct, dur);
            }
          }
        } catch (error) {
          console.error('YouTube progress tracking error:', error);
        }
      } else if (!currentPlayer) {
        stopYTInterval();
      }
    }, 2000); // Increase interval to 2 seconds to reduce conflicts
    
    progressIntervalRef.current = interval; // Store in ref
    setProgressInterval(interval); // Keep state for compatibility
  };

  const stopYTInterval = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (progressInterval) {
      clearInterval(progressInterval);
      setProgressInterval(null);
    }
  };

  // 4) Cleanup on unmount
  useEffect(() => {
    return () => {
      stopYTInterval();
      if (youtubePlayerInstanceRef.current?.destroy) {
        youtubePlayerInstanceRef.current.destroy();
      }
    };
  }, []);

  const togglePlay = () => {
    // Only handle regular video controls, YouTube handles its own
    if (!isYouTube && videoRef.current) {
      isPlaying ? videoRef.current.pause() : videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e) => {
    // Only handle regular video seeking, YouTube handles its own
    if (!isYouTube && videoRef.current) {
      const pct = parseFloat(e.target.value) / 100;
      const target = pct * duration;
      setIsSeeking(true);
      setCurrentTime(target);
      videoRef.current.currentTime = target;
    }
  };

  const handleVolumeChange = (e) => {
    // Only handle regular video volume, YouTube handles its own
    if (!isYouTube && videoRef.current) {
      const vol = parseFloat(e.target.value) / 100;
      videoRef.current.volume = vol;
      setVolume(vol);
      setIsMuted(vol === 0);
    }
  };

  const toggleMute = () => {
    // Only handle regular video mute, YouTube handles its own
    if (!isYouTube && videoRef.current) {
      videoRef.current.volume = isMuted ? volume : 0;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el || !el.isConnected) return;
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else el.requestFullscreen();
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (t) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative bg-black rounded-lg overflow-hidden group"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {isYouTube ? (
        <div ref={youtubePlayerRef} className="w-full aspect-video" />
      ) : (
        <video
          ref={videoRef}
          src={src.startsWith('https') ? src : `${process.env.REACT_APP_API_URL}${src}`}
          className="w-full aspect-video"
          onClick={togglePlay}
        />
      )}

      {/* Only show custom controls for non-YouTube videos */}
      {!isYouTube && (
        <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <button onClick={togglePlay} className="bg-white/20 hover:bg-white/30 rounded-full p-4">
            {isPlaying ? <Pause className="h-8 w-8 text-white" /> : <Play className="h-8 w-8 text-white" />}
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="mb-4">
            <input
              type="range"
              min="0"
              max="100"
              value={pct}
              onChange={handleSeek}
              onMouseDown={() => setIsSeeking(true)}
              onMouseUp={() => !isYouTube && setIsSeeking(false)}
              className="w-full h-1 bg-white/30 rounded-lg cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={togglePlay} className="text-white">
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <div className="flex items-center space-x-2">
                <button onClick={toggleMute} className="text-white">
                  {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume * 100}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-white/30 rounded-lg cursor-pointer"
                />
              </div>
              <div className="text-white text-sm">{formatTime(currentTime)} / {formatTime(duration)}</div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  // Only handle regular video rewind, YouTube handles its own
                  if (!isYouTube && videoRef.current) {
                    const newTime = Math.max(0, currentTime - 10);
                    setIsSeeking(true);
                    setCurrentTime(newTime);
                    videoRef.current.currentTime = newTime;
                  }
                }}
                className="text-white"
                title="Rewind 10 seconds"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
              <button onClick={toggleFullscreen} className="text-white">
                <Maximize className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
