import React, { useState, useEffect, useRef, useCallback, type DragEvent } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Square,
  MessageCircle,
  Phone,
  Upload,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  CheckCircle2,
  Sliders,
  ArrowUpDown
} from 'lucide-react';
import { saveVideoPermanently, getPermanentVideo, deletePermanentVideo } from '../utils/videoStorage';

interface FixedBollukitoAssistantProps {
  hotelName?: string;
  phoneNumber?: string;
}

interface ScriptLine {
  id: number;
  text: string;
  durationMs: number;
  highlightWords: string[];
  isFinalNumber?: boolean;
}

export function FixedBollukitoAssistant({
  hotelName = 'Hotel Bolluk',
  phoneNumber = '223 518 9254',
}: FixedBollukitoAssistantProps) {
  // Minimize/expand state
  const [isMinimized, setIsMinimized] = useState(false);

  // Video & Chroma states - initialized without obsolete video
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isStoredLocally, setIsStoredLocally] = useState(true);
  const [useChromaKey, setUseChromaKey] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  // Video aspect ratio & centering control (960x640 is 1.5 ratio)
  const [videoAspect, setVideoAspect] = useState<number>(1.5);
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>(() => {
    return (localStorage.getItem('bollukito_fit_mode') as any) || 'contain';
  });
  const [videoAlignment, setVideoAlignment] = useState<'center' | 'top' | 'bottom'>(() => {
    return (localStorage.getItem('bollukito_video_align') as any) || 'center';
  });

  // Position preference: 'whatsapp-top' (in the frame of WhatsApp screen), 'whatsapp-center', 'whatsapp-bottom'
  const [positionPreference, setPositionPreference] = useState<'whatsapp-top' | 'whatsapp-center' | 'whatsapp-bottom'>(() => {
    return (localStorage.getItem('bollukito_position_preference') as any) || 'whatsapp-top';
  });


  // Visibility control: Bollukito appears, gives the welcome, and then disappears
  const [isVisible, setIsVisible] = useState(true);
  const [hasFinishedWelcome, setHasFinishedWelcome] = useState(false);
  const farewellTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Speech presentation state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1);
  const [speechBubble, setSpeechBubble] = useState<string | null>(
    '¡Hola! Soy Bollukito, tu asistente virtual 🐾🛎️'
  );

  // Settings & tuning
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [sizePreference, setSizePreference] = useState<'md' | 'lg'>(() => {
    return (localStorage.getItem('bollukito_fixed_size') as any) || 'lg';
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const speechTimerRef = useRef<NodeJS.Timeout | null>(null);
  const bubbleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Script identical to the user's Luma video
  const scriptLines: ScriptLine[] = [
    {
      id: 1,
      text: `Hola, soy Bollukito, tu asistente virtual en ${hotelName}.`,
      durationMs: 4000,
      highlightWords: ['Bollukito', 'asistente', 'virtual'],
    },
    {
      id: 2,
      text: '¿Querés reservar tu habitación? Escribime y lo resolvemos en segundos.',
      durationMs: 4200,
      highlightWords: ['reservar', 'segundos'],
    },
    {
      id: 3,
      text: 'Precios, promociones, o consultar si somos pet-friendly, también te ayudo con eso.',
      durationMs: 4500,
      highlightWords: ['Precios', 'pet-friendly', 'ayudo'],
    },
    {
      id: 4,
      text: 'Sin llamadas, sin esperas, sin vueltas. Empezá a resolver todo desde tu celular.',
      durationMs: 4400,
      highlightWords: ['Sin llamadas', 'sin esperas', 'tu celular'],
    },
    {
      id: 5,
      text: `Chateá con nosotros acá en la web o agendá nuestro WhatsApp: ${phoneNumber}.`,
      durationMs: 5000,
      highlightWords: ['WhatsApp', '223', '518', '9254'],
      isFinalNumber: true,
    },
  ];

  // Save size and position preferences
  useEffect(() => {
    localStorage.setItem('bollukito_fixed_size', sizePreference);
  }, [sizePreference]);

  useEffect(() => {
    localStorage.setItem('bollukito_position_preference', positionPreference);
  }, [positionPreference]);

  // Load permanent video from IndexedDB or server fallback
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const blob = await getPermanentVideo();
        if (blob && isMounted) {
          const localUrl = URL.createObjectURL(blob);
          setVideoUrl(localUrl);
          setIsStoredLocally(true);
          return;
        }
      } catch (err) {
        console.warn('Error reading from IndexedDB:', err);
      }

      try {
        const res = await fetch('/api/video-status');
        const data = await res.json();
        if (data && data.exists && data.url && isMounted) {
          setVideoUrl(data.url);
          // Cache in IndexedDB
          fetch(data.url)
            .then((r) => r.blob())
            .then((b) => {
              saveVideoPermanently(b);
              if (isMounted) setIsStoredLocally(true);
            })
            .catch(() => {});
        }
      } catch (e) {
        // Fallback to static 3D model
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  // Concierge chime sound effect
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {}
  };

  // Video Black Background Chroma Key Loop
  useEffect(() => {
    if (!videoUrl || !useChromaKey) {
      setIsVideoPlaying(false);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let animId: number;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const render = () => {
      if (video.readyState >= 2) {
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(video, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const len = data.length;

        // Key out solid black/dark backdrop from Luma video
        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const maxChannel = Math.max(r, g, b);

          if (maxChannel < 32) {
            // Pure black / dark shadows -> full transparency
            data[i + 3] = 0;
          } else if (maxChannel < 55) {
            // Anti-aliased soft edge
            const factor = (maxChannel - 32) / 23;
            data[i + 3] = Math.round(255 * factor);
          }
        }

        ctx.putImageData(imgData, 0, 0);
        setIsVideoPlaying(true);
      }
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [videoUrl, useChromaKey]);

  // Handle Speech Progression
  const playSpeechStep = useCallback(
    (index: number) => {
      if (index >= scriptLines.length) {
        setIsSpeaking(false);
        setCurrentLineIndex(-1);
        setSpeechBubble('🐾 ¡Listo! Te espero en el chat de WhatsApp aquí abajo para armar tu reserva. ¡Escribime tus fechas! 👇');

        if (farewellTimerRef.current) clearTimeout(farewellTimerRef.current);
        farewellTimerRef.current = setTimeout(() => {
          setIsVisible(false);
          setHasFinishedWelcome(true);
          const inputEl = document.getElementById('whatsapp-chat-input');
          if (inputEl) {
            inputEl.focus();
          }
        }, 2200);
        return;
      }

      setCurrentLineIndex(index);
      const line = scriptLines[index];
      setSpeechBubble(line.text);

      // Web Speech API Voice synthesis only when custom video audio is not available
      if (!videoUrl && !isMuted && typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(line.text);
          utterance.lang = 'es-AR';
          utterance.rate = 1.0;
          utterance.pitch = 1.05;

          const voices = window.speechSynthesis.getVoices();
          const esVoice =
            voices.find((v) => v.lang.startsWith('es-AR')) ||
            voices.find((v) => v.lang.startsWith('es-')) ||
            voices.find((v) => v.lang.includes('es'));
          if (esVoice) utterance.voice = esVoice;

          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.warn('Speech error', e);
        }
      }

      speechTimerRef.current = setTimeout(() => {
        playSpeechStep(index + 1);
      }, line.durationMs);
    },
    [isMuted, scriptLines]
  );

  // Drag and drop handlers
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Unmute and play with voice
  const handleUnmuteAndPlay = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setIsMuted(false);
    playChime();
    setIsSpeaking(true);

    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1.0;
      videoRef.current.play().catch((err) => {
        console.warn('Video playback with audio error:', err);
      });
    }

    setSpeechBubble('🐾 ¡Escuchando la voz de Bollukito! 🛎️');
  };

  // Start complete presentation with full voice sound
  const startPresentation = () => {
    stopPresentation();
    playChime();
    setIsSpeaking(true);
    setIsMuted(false);

    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.muted = false;
      videoRef.current.volume = 1.0;
      videoRef.current.play().catch((err) => {
        console.warn('Video playback error:', err);
      });
    }

    playSpeechStep(0);
  };

  // Stop presentation
  const stopPresentation = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
    }
    if (farewellTimerRef.current) {
      clearTimeout(farewellTimerRef.current);
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setIsSpeaking(false);
    setCurrentLineIndex(-1);
  }, []);

  // User directly skips to chat
  const handleGoToChatDirectly = useCallback(() => {
    stopPresentation();
    setSpeechBubble('🐾 ¡Te espero en el chat de WhatsApp! 👇');
    if (farewellTimerRef.current) clearTimeout(farewellTimerRef.current);
    farewellTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      setHasFinishedWelcome(true);
      const inputEl = document.getElementById('whatsapp-chat-input');
      if (inputEl) {
        inputEl.focus();
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 350);
  }, [stopPresentation]);

  // Handle when video finishes naturally
  const handleVideoEnded = useCallback(() => {
    setIsSpeaking(false);
    setCurrentLineIndex(-1);
    setSpeechBubble('🐾 ¡Listo! Te espero en el chat de WhatsApp aquí abajo para armar tu reserva. ¡Escribime tus fechas! 👇');
    if (farewellTimerRef.current) clearTimeout(farewellTimerRef.current);
    farewellTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      setHasFinishedWelcome(true);
      const inputEl = document.getElementById('whatsapp-chat-input');
      if (inputEl) {
        inputEl.focus();
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 2200);
  }, []);

  // Auto-trigger welcome when visitor arrives
  useEffect(() => {
    const timer = setTimeout(() => {
      startPresentation();
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  // Upload custom Bollukito video file (.mp4, .mov, .webm)
  const handleFileUpload = async (file: File) => {
    // Flexible validation: check MIME type or common extensions
    const isVideo =
      file.type.startsWith('video/') ||
      /\.(mp4|mov|webm|m4v|mkv)$/i.test(file.name);

    if (!isVideo) {
      alert(`El archivo "${file.name}" no parece ser un video compatible. Por favor selecciona un archivo .mp4, .mov o .webm.`);
      return;
    }

    setIsUploading(true);
    setUploadMessage('Procesando video de Bollukito...');
    setSpeechBubble('🐾 Subiendo y procesando video...');

    try {
      // 1. Save in IndexedDB for instant offline and browser reload persistence
      await saveVideoPermanently(file);

      // 2. Set blob URL for instantaneous playback
      const localUrl = URL.createObjectURL(file);
      setVideoUrl(localUrl);
      setIsStoredLocally(true);

      // 3. Immediately start video playback
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.src = localUrl;
          videoRef.current.currentTime = 0;
          videoRef.current.muted = true; // Muted enables instant autoplay in modern browsers
          videoRef.current.play().catch((err) => {
            console.log('Video autoplay caught:', err);
          });
        }
      }, 50);

      // 4. Send raw binary stream directly to server (up to 150MB, fast, zero base64 memory overhead)
      try {
        const res = await fetch('/api/upload-video-binary', {
          method: 'POST',
          headers: { 'Content-Type': file.type || 'video/mp4' },
          body: file,
        });
        if (res.ok) {
          console.log('Video saved to server storage successfully');
        }
      } catch (serverErr) {
        console.warn('Server upload background note:', serverErr);
      }

      setShowSettingsModal(false);
      setUploadMessage('¡Video cargado con éxito! 🐾🎬');
      setSpeechBubble('¡Guau! ¡Tu video de Bollukito se cargó con éxito! 🐾🎬');

      // Clear input element so re-uploading the same file works
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (e: any) {
      console.error('Error saving video:', e);
      alert('Hubo un inconveniente al guardar el video: ' + (e?.message || 'Error desconocido'));
      setSpeechBubble('🐾 No se pudo cargar el video.');
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadMessage(null), 5000);
    }
  };

  // Clean up
  useEffect(() => {
    return () => {
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
      if (farewellTimerRef.current) clearTimeout(farewellTimerRef.current);
      if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Current active line for highlighting
  const activeLine = currentLineIndex >= 0 ? scriptLines[currentLineIndex] : null;

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleFileUpload(e.target.files[0]);
          }
        }}
      />

      {/* Floating button when Bollukito has completed welcome and disappeared */}
      {!isVisible && (
        <div className="fixed bottom-4 right-4 z-40 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <button
            onClick={() => {
              setIsVisible(true);
              setIsMinimized(false);
              startPresentation();
            }}
            className="group bg-gradient-to-r from-emerald-800 to-[#075e54] hover:from-emerald-700 hover:to-[#064d45] text-white font-bold text-xs px-4 py-2.5 rounded-full shadow-2xl border border-emerald-400/50 flex items-center space-x-2.5 transition-all hover:scale-105 active:scale-95"
            title="Volver a escuchar la bienvenida de Bollukito"
          >
            <div className="relative">
              <img
                src="/bollukito_avatar.jpg?v=5"
                alt="Bollukito"
                className="w-7 h-7 rounded-full object-cover ring-2 ring-amber-300 shadow-md group-hover:rotate-6 transition-transform"
              />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping"></span>
            </div>
            <div className="flex flex-col items-start leading-none">
              <span className="text-[11px] font-extrabold text-amber-300">🐾 Ver bienvenida</span>
              <span className="text-[9px] text-emerald-200">Bollukito en video</span>
            </div>
          </button>
        </div>
      )}

      {/* FIXED BOLLUKITO AT THE RIGHT OF THE SCREEN (HUGGING THE WHATSAPP FRAME) */}
      {isVisible && (
        <aside
          id="fixed-bollukito-assistant"
          style={{
            // Keeps Bollukito directly hugging the WhatsApp frame's right edge
            // WhatsApp is centered at max-w-4xl (896px), so its right edge is at 50vw + 448px.
            // On desktop, Bollukito sits 4-8px right next to WhatsApp.
            // On smaller viewports, clamp ensures he stays comfortably within screen bounds.
            left: 'max(0.75rem, min(calc(50vw + 452px), calc(100vw - 340px)))',
          }}
          className={`fixed z-40 flex flex-col items-start pointer-events-none select-none transition-all duration-300 ${
            positionPreference === 'whatsapp-top'
              ? 'top-20 sm:top-24 xl:top-28'
              : positionPreference === 'whatsapp-center'
              ? 'top-1/2 -translate-y-1/2'
              : 'bottom-20 sm:bottom-24'
          }`}
        >
          {/* Minimized Pill */}
          {isMinimized ? (
            <button
              onClick={() => setIsMinimized(false)}
              className="pointer-events-auto bg-slate-900/95 hover:bg-slate-900 text-white border-2 border-amber-400/70 px-4 py-2.5 rounded-full shadow-2xl flex items-center space-x-2 transition-transform hover:scale-105"
            >
              <div className="w-7 h-7 rounded-full bg-amber-400/20 flex items-center justify-center overflow-hidden border border-amber-400/40">
                <img
                  src="/bollukito_avatar.jpg?v=5"
                  alt="Bollukito Miniatura"
                  className="w-7 h-7 object-cover"
                />
              </div>
              <span className="text-xs font-black text-amber-300">🐾 Bollukito Asistente</span>
              <ChevronDown className="w-4 h-4 text-slate-300" />
            </button>
          ) : (
            <div className="pointer-events-auto flex flex-col items-end">
              {/* Dynamic Speech Bubble or Live Subtitles */}
              {speechBubble && (
                <div
                  onClick={startPresentation}
                  className={`mb-2 mr-2 max-w-[280px] sm:max-w-[320px] rounded-2xl p-3.5 shadow-2xl border transition-all cursor-pointer ${
                    isSpeaking
                      ? 'bg-slate-950/95 border-amber-400 text-white'
                      : 'bg-slate-900/95 hover:bg-slate-900 border-slate-700 text-slate-100 hover:border-amber-400/60'
                  }`}
                >
                  {/* Speaker Header */}
                  <div className="flex items-center justify-between mb-1 pb-1 border-b border-white/10 text-[11px]">
                    <span className="font-extrabold text-amber-300 flex items-center space-x-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Bollukito • Hotel Bolluk</span>
                    </span>
                    {isSpeaking && (
                      <span className="flex items-center space-x-1 text-[10px] text-emerald-400 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                        <span>Hablando...</span>
                      </span>
                    )}
                  </div>

                  {/* Subtitle Words */}
                  <p className="text-xs font-semibold leading-relaxed">
                    {activeLine
                      ? activeLine.text.split(' ').map((word, i) => {
                          const cleanWord = word.replace(/[.,?!¿¡:]/g, '');
                          const isHigh = activeLine.highlightWords.some(
                            (h) => h.toLowerCase() === cleanWord.toLowerCase()
                          );
                          return (
                            <span
                              key={i}
                              className={`inline-block mr-1 transition-colors ${
                                isHigh
                                  ? 'text-amber-300 font-black drop-shadow-[0_1px_4px_rgba(251,191,36,0.6)]'
                                  : 'text-slate-100'
                              }`}
                            >
                              {word}
                            </span>
                          );
                        })
                      : speechBubble}
                  </p>

                  {/* Direct Action: Jump to chat immediately */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGoToChatDirectly();
                    }}
                    className="mt-2.5 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md transition-transform hover:scale-[1.02]"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>💬 Empezar a chatear y reservar</span>
                  </button>

                  {/* If final phrase, show quick WhatsApp phone link */}
                  {activeLine?.isFinalNumber && (
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <a
                        href={`https://wa.me/549${phoneNumber.replace(/\s+/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-1.5 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md transition-transform hover:scale-105"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Escribir al WhatsApp: {phoneNumber}</span>
                      </a>
                    </div>
                  )}
                </div>
              )}

            {/* Character Stage & Podium */}
            <div
              className={`relative group rounded-3xl transition-all ${
                isDraggingFile
                  ? 'ring-4 ring-amber-400 ring-offset-4 ring-offset-slate-900 scale-105'
                  : ''
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Uploading progress overlay */}
              {isUploading && (
                <div className="absolute inset-0 z-35 bg-slate-950/92 rounded-3xl flex flex-col items-center justify-center p-4 text-center backdrop-blur-md">
                  <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <span className="text-xs font-bold text-white">Subiendo video de Bollukito...</span>
                  <span className="text-[11px] text-amber-300 mt-1">{uploadMessage || 'Guardando en alta calidad'}</span>
                </div>
              )}

              {/* If no video is uploaded yet, prominent 1-click upload helper */}
              {!videoUrl && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-[11px] px-3.5 py-1.5 rounded-full shadow-xl border border-amber-300 flex items-center space-x-1.5 whitespace-nowrap transition-transform hover:scale-105 pointer-events-auto"
                  title="Haz clic para seleccionar tu video .mp4 de Bollukito"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>📂 Cargar mi video .mp4</span>
                </button>
              )}

              {/* Dragging active overlay */}
              {isDraggingFile && (
                <div className="absolute inset-0 z-30 bg-slate-950/90 border-2 border-dashed border-amber-400 rounded-3xl flex flex-col items-center justify-center p-4 text-center backdrop-blur-sm animate-pulse">
                  <Upload className="w-8 h-8 text-amber-400 mb-2" />
                  <span className="text-xs font-bold text-white">¡Soltá tu video .mp4 acá!</span>
                  <span className="text-[10px] text-amber-300">Se vinculará a Bollukito</span>
                </div>
              )}

              {/* Mascot 3D Stage Card */}
              <div
                className="relative flex flex-col items-center justify-center transition-all"
                style={{
                  width: sizePreference === 'lg' ? '320px' : '280px',
                  maxWidth: 'calc(100vw - 32px)',
                }}
              >
                {/* Background Pedestal & Ambient Glow */}
                <div className="absolute inset-x-4 bottom-2 h-16 bg-gradient-to-t from-slate-950/80 via-slate-900/40 to-transparent rounded-3xl -z-10 border-b border-amber-400/30" />
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-4/5 h-6 bg-black/40 rounded-full blur-[8px] -z-10" />

                {/* Direct Video Playback (User's Luma Video) */}
                {videoUrl ? (
                  <div
                    className="relative w-full rounded-2xl overflow-hidden border-2 border-amber-400/80 shadow-[0_20px_45px_rgba(0,0,0,0.7)] bg-slate-950 flex items-center justify-center group/vid"
                    style={{
                      aspectRatio: `${videoAspect}`,
                    }}
                  >
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      poster="/bollukito_stage.jpg?v=5"
                      playsInline
                      autoPlay
                      loop
                      muted={isMuted}
                      onLoadedMetadata={(e) => {
                        const v = e.currentTarget;
                        if (v.videoWidth && v.videoHeight) {
                          setVideoAspect(v.videoWidth / v.videoHeight);
                        }
                      }}
                      onEnded={handleVideoEnded}
                      onClick={isMuted ? handleUnmuteAndPlay : (isSpeaking ? stopPresentation : startPresentation)}
                      className={`w-full h-full ${
                        fitMode === 'cover' ? 'object-cover' : 'object-contain'
                      } ${
                        videoAlignment === 'top'
                          ? 'object-top'
                          : videoAlignment === 'bottom'
                          ? 'object-bottom'
                          : 'object-center'
                      } cursor-pointer transition-transform duration-300 group-hover/vid:scale-[1.01]`}
                    />

                    {/* Prominent Unmute callout banner when muted */}
                    {isMuted && (
                      <button
                        onClick={handleUnmuteAndPlay}
                        className="absolute inset-x-3 bottom-3 z-30 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-200 text-slate-950 font-black text-xs py-2 px-3 rounded-xl shadow-2xl border-2 border-amber-300 flex items-center justify-center space-x-2 animate-bounce pointer-events-auto cursor-pointer"
                        title="Toca para activar el sonido y escuchar la voz de Bollukito"
                      >
                        <Volume2 className="w-4 h-4 fill-slate-950 text-slate-950 animate-pulse" />
                        <span>🔊 Toca para escuchar la voz</span>
                      </button>
                    )}

                    {/* Live Voice active badge when unmuted */}
                    {!isMuted && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMuted(true);
                          if (videoRef.current) videoRef.current.muted = true;
                        }}
                        className="absolute top-2.5 right-2.5 z-25 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg flex items-center space-x-1.5 animate-pulse pointer-events-auto"
                        title="Clic para silenciar"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Voz Activa</span>
                      </button>
                    )}

                    {/* Overlay play/unmute button when hovered */}
                    {!isSpeaking && !isMuted && (
                      <div
                        onClick={startPresentation}
                        className="absolute inset-0 bg-black/25 flex items-center justify-center cursor-pointer opacity-0 group-hover/vid:opacity-100 transition-opacity"
                      >
                        <div className="w-12 h-12 rounded-full bg-amber-400/90 text-slate-950 flex items-center justify-center shadow-xl">
                          <Play className="w-6 h-6 fill-current ml-0.5" />
                        </div>
                      </div>
                    )}

                    {/* Change video button on active video */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="absolute bottom-2.5 right-2.5 z-20 bg-slate-950/80 hover:bg-slate-900 text-amber-300 text-[10px] font-bold px-2 py-1 rounded-lg border border-amber-400/50 flex items-center space-x-1 shadow transition-all hover:scale-105 pointer-events-auto"
                      title="Cambiar video de Bollukito"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Cambiar</span>
                    </button>
                  </div>
                ) : (
                  /* 3D Mascot Stage Card with New Bollukito */
                  <div
                    onClick={isSpeaking ? stopPresentation : startPresentation}
                    className="relative w-full aspect-[3/2] rounded-2xl overflow-hidden border-2 border-amber-400/70 shadow-[0_16px_36px_rgba(0,0,0,0.6)] bg-slate-950 flex items-center justify-center cursor-pointer group/card"
                  >
                    <img
                      src="/bollukito_stage.jpg?v=5"
                      alt="Bollukito Asistente Virtual 3D"
                      className={`w-full h-full object-contain object-center transition-transform duration-300 group-hover/card:scale-105 ${
                        isSpeaking ? 'brightness-110' : ''
                      }`}
                      draggable={false}
                      referrerPolicy="no-referrer"
                    />

                    {/* Badge */}
                    <div className="absolute top-2.5 left-2.5 bg-slate-950/85 backdrop-blur-sm border border-amber-400/60 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow flex items-center space-x-1">
                      <span>🐾 Bollukito Oficial</span>
                    </div>

                    {/* Upload button directly on stage */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="absolute bottom-2.5 right-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black px-3 py-1.5 rounded-xl shadow-xl border border-amber-300 flex items-center space-x-1.5 transition-transform hover:scale-105 pointer-events-auto"
                      title="Subir video .mp4 de Bollukito"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Cargar .mp4</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Fixed Control Bar Attached Beneath Bollukito */}
              <div className="mt-2 bg-slate-950/95 backdrop-blur-md border border-slate-700/80 rounded-2xl px-3 py-2 shadow-2xl flex items-center space-x-2 text-xs">
                {/* Big Voice Button */}
                <button
                  onClick={isMuted ? handleUnmuteAndPlay : (isSpeaking ? stopPresentation : startPresentation)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-all shadow-md ${
                    isSpeaking
                      ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                      : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 hover:scale-105'
                  }`}
                  title={isSpeaking ? 'Detener voz' : 'Escuchar presentación de Bollukito'}
                >
                  {isSpeaking ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Detener</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>🎙️ Escuchar voz</span>
                    </>
                  )}
                </button>

                {/* Direct Go to Chat button */}
                <button
                  onClick={handleGoToChatDirectly}
                  className="px-2.5 py-1.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1 shadow-md transition-all hover:scale-105"
                  title="Ir directamente al chat de WhatsApp y empezar a reservar"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Ir al chat</span>
                </button>

                {/* Direct WhatsApp button */}
                <a
                  href={`https://wa.me/549${phoneNumber.replace(/\s+/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir WhatsApp oficial"
                  className="p-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                </a>

                {/* Sound mute toggle button */}
                <button
                  onClick={isMuted ? handleUnmuteAndPlay : () => {
                    setIsMuted(true);
                    if (videoRef.current) videoRef.current.muted = true;
                  }}
                  title={isMuted ? 'Activar sonido de la voz' : 'Silenciar'}
                  className={`p-1.5 rounded-xl transition-all flex items-center space-x-1 ${
                    isMuted
                      ? 'bg-amber-400 text-slate-950 font-black px-2 animate-pulse ring-2 ring-amber-300'
                      : 'bg-white/10 hover:bg-white/20 text-slate-300'
                  }`}
                >
                  {isMuted ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-slate-950" />
                      <span className="text-[10px]">Activar</span>
                    </>
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                </button>

                {/* Quick Position Switcher */}
                <button
                  onClick={() => {
                    setPositionPreference((prev) => {
                      if (prev === 'whatsapp-top') return 'whatsapp-center';
                      if (prev === 'whatsapp-center') return 'whatsapp-bottom';
                      return 'whatsapp-top';
                    });
                  }}
                  title={`Subir/Bajar posición (Actual: ${
                    positionPreference === 'whatsapp-top'
                      ? 'Arriba marco WhatsApp'
                      : positionPreference === 'whatsapp-center'
                      ? 'Centro'
                      : 'Abajo'
                  })`}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-300 transition-colors"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>

                {/* Settings / Upload modal */}
                <button
                  onClick={() => setShowSettingsModal(true)}
                  title="Ajustes y estado del asistente"
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>

                {/* Minimize button */}
                <button
                  onClick={() => setIsMinimized(true)}
                  title="Minimizar perrito a la esquina"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
      )}

      {/* Settings & Video Upload Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base text-white">
                  Bollukito • Asistente Virtual Fijo
                </h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Preview */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center space-x-4">
                <div className="w-20 h-20 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src="/bollukito_avatar.jpg?v=5"
                    alt="Bollukito 3D"
                    className="w-16 h-16 rounded-xl object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center space-x-1.5">
                    <span>Bollukito • Asistente Oficial</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Fijo a la derecha
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Cachorro Bulldog Francés vaquita con chaleco verde bosque de Hotel Bolluk y medalla dorada.
                  </p>
                </div>
              </div>

              {/* Permanent status notice */}
              <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-3 flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-emerald-300">Video grabado permanentemente (HD)</div>
                  <p className="text-emerald-100/80 text-[11px] mt-0.5">
                    Tu video está guardado en el servidor y en la memoria del navegador. No se borrará al reiniciar ni al cambiar de pestaña.
                  </p>
                </div>
              </div>

              {/* Upload video button */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Archivo de video activo:
                </label>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-amber-400/60 hover:border-amber-400 rounded-xl p-3 text-center cursor-pointer transition-all hover:bg-slate-800/60 bg-slate-950/50 flex flex-col items-center justify-center space-y-1"
                >
                  <Upload className="w-5 h-5 text-amber-400" />
                  <span className="text-xs font-bold text-white">
                    Reemplazar por otro archivo .mp4
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Se guarda automáticamente con respaldo redundante
                  </span>
                </button>
              </div>

              {/* Framing & Centering Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  Encuadre y Centrado del Personaje:
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    onClick={() => {
                      setFitMode('contain');
                      localStorage.setItem('bollukito_fit_mode', 'contain');
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      fitMode === 'contain'
                        ? 'border-amber-400 bg-amber-500/20 text-white font-black'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400'
                    }`}
                  >
                    <div className="text-xs font-bold">Centrado Completo</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">Sin recortes (100% visible)</div>
                  </button>
                  <button
                    onClick={() => {
                      setFitMode('cover');
                      localStorage.setItem('bollukito_fit_mode', 'cover');
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      fitMode === 'cover'
                        ? 'border-amber-400 bg-amber-500/20 text-white font-black'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400'
                    }`}
                  >
                    <div className="text-xs font-bold">Relleno Dinámico</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">Ocupa todo el recuadro</div>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setVideoAlignment('top');
                      localStorage.setItem('bollukito_video_align', 'top');
                    }}
                    className={`p-1.5 rounded-lg border text-center text-xs transition-all ${
                      videoAlignment === 'top'
                        ? 'border-amber-400 bg-amber-400/20 text-amber-300 font-bold'
                        : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    Arriba
                  </button>
                  <button
                    onClick={() => {
                      setVideoAlignment('center');
                      localStorage.setItem('bollukito_video_align', 'center');
                    }}
                    className={`p-1.5 rounded-lg border text-center text-xs transition-all ${
                      videoAlignment === 'center'
                        ? 'border-amber-400 bg-amber-400/20 text-amber-300 font-bold'
                        : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    Centro (Óptimo)
                  </button>
                  <button
                    onClick={() => {
                      setVideoAlignment('bottom');
                      localStorage.setItem('bollukito_video_align', 'bottom');
                    }}
                    className={`p-1.5 rounded-lg border text-center text-xs transition-all ${
                      videoAlignment === 'bottom'
                        ? 'border-amber-400 bg-amber-400/20 text-amber-300 font-bold'
                        : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    Abajo
                  </button>
                </div>
              </div>

              {/* Sound & Voice Test */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Sonido y Voz de Bollukito</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {isMuted ? 'Silenciado actualmente' : 'Voz activa a volumen máximo'}
                  </div>
                </div>
                <button
                  onClick={handleUnmuteAndPlay}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs px-3 py-1.5 rounded-lg shadow transition-transform hover:scale-105"
                >
                  🔊 Probar Voz
                </button>
              </div>

              {/* Position Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  Posición de Bollukito en pantalla:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setPositionPreference('whatsapp-top')}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      positionPreference === 'whatsapp-top'
                        ? 'border-amber-400 bg-amber-500/20 text-white font-black'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400'
                    }`}
                  >
                    <div className="text-xs font-bold">Marco WhatsApp</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">Arriba derecha</div>
                  </button>
                  <button
                    onClick={() => setPositionPreference('whatsapp-center')}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      positionPreference === 'whatsapp-center'
                        ? 'border-amber-400 bg-amber-500/20 text-white font-black'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400'
                    }`}
                  >
                    <div className="text-xs font-bold">Centro</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">Medio derecha</div>
                  </button>
                  <button
                    onClick={() => setPositionPreference('whatsapp-bottom')}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      positionPreference === 'whatsapp-bottom'
                        ? 'border-amber-400 bg-amber-500/20 text-white font-black'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400'
                    }`}
                  >
                    <div className="text-xs font-bold">Inferior</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">Elevado</div>
                  </button>
                </div>
              </div>

              {/* Size Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  Tamaño de Bollukito:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSizePreference('md')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      sizePreference === 'md'
                        ? 'border-amber-400 bg-amber-500/20 text-white font-black'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400'
                    }`}
                  >
                    <div className="text-xs font-bold">Mediano</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Discreto y elegante</div>
                  </button>
                  <button
                    onClick={() => setSizePreference('lg')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      sizePreference === 'lg'
                        ? 'border-amber-400 bg-amber-500/20 text-white font-black'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400'
                    }`}
                  >
                    <div className="text-xs font-bold">Grande (Destacado)</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Máxima presencia visual</div>
                  </button>
                </div>
              </div>

              {/* WhatsApp phone number config info */}
              <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Número de WhatsApp vinculado:
                  </span>
                  <span className="font-mono text-emerald-400 font-bold text-sm">
                    {phoneNumber}
                  </span>
                </div>
                <a
                  href={`https://wa.me/549${phoneNumber.replace(/\s+/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs"
                >
                  Probar
                </a>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-slate-950/80 border-t border-slate-800 flex justify-between items-center text-xs">
              {videoUrl && (
                <button
                  onClick={async () => {
                    await deletePermanentVideo();
                    setVideoUrl(null);
                  }}
                  className="text-slate-400 hover:text-red-400 flex items-center space-x-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restablecer a 3D nativo</span>
                </button>
              )}
              <button
                onClick={() => setShowSettingsModal(false)}
                className="ml-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl text-xs"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
