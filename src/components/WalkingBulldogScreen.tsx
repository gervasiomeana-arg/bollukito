import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  RotateCcw,
  Sliders,
  Volume2,
  VolumeX,
  Play,
  Square,
  MessageCircle,
  Phone,
  CheckCircle2,
  ChevronRight,
  Move
} from 'lucide-react';

interface WalkingBulldogScreenProps {
  hotelName?: string;
}

interface SpeechPhase {
  id: number;
  textToSpeak: string;
  displayHeadline: string;
  displaySubtitle: string;
  highlightWords: string[];
  pose: 'presenting' | 'walking';
  durationMs: number;
  showPhoneCard?: boolean;
}

export function WalkingBulldogScreen({ hotelName = 'Hotel Bolluk' }: WalkingBulldogScreenProps) {
  const [isEnabled, setIsEnabled] = useState(true);
  const [position, setPosition] = useState({ x: 72, y: 64 }); // % of screen
  const [facingDirection, setFacingDirection] = useState<1 | -1>(-1); // 1 = right, -1 = left
  const [isWalking, setIsWalking] = useState(false);
  const [isTrickSpinning, setIsTrickSpinning] = useState(false);
  const [currentPose, setCurrentPose] = useState<'walking' | 'presenting'>('presenting');
  const [speechBubble, setSpeechBubble] = useState<string | null>('¡Tocame para escucharme hablar! 🐾🎙️');

  // Stored preferences with localStorage persistence
  const [dogSize, setDogSize] = useState<'sm' | 'md' | 'lg' | 'xl'>(() => {
    return (localStorage.getItem('bollukito_dog_size') as any) || 'lg';
  });
  const movementSpeed = 3.6; // seconds transition

  // Voice & Video Presentation States
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState<number>(-1);
  const [isMuted, setIsMuted] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [showMayaStyleOverlay, setShowMayaStyleOverlay] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const bubbleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speechIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Script matched to the Maya style presentation
  const speechScript: SpeechPhase[] = [
    {
      id: 1,
      textToSpeak: `¡Hola! Soy Bollukito, tu asistente virtual en ${hotelName}.`,
      displayHeadline: 'BOLLUKITO',
      displaySubtitle: `¡Hola! Soy Bollukito, tu asistente virtual en ${hotelName}`,
      highlightWords: ['Bollukito', 'asistente', 'virtual'],
      pose: 'presenting',
      durationMs: 4000,
    },
    {
      id: 2,
      textToSpeak: '¿Querés reservar tu habitación? Escribime y lo resolvemos en segundos.',
      displayHeadline: 'RESERVAS AL INSTANTE',
      displaySubtitle: '¿Querés reservar tu habitación? Escribime y lo resolvemos en segundos.',
      highlightWords: ['reservar', 'segundos'],
      pose: 'walking',
      durationMs: 4200,
    },
    {
      id: 3,
      textToSpeak: '¿Precios, promociones o consultar si somos Pet-Friendly? ¡También te ayudo con eso!',
      displayHeadline: 'CONSULTAS Y PET-FRIENDLY',
      displaySubtitle: '¿Precios, promociones o Pet-Friendly? También te ayudo con eso.',
      highlightWords: ['Precios', 'Pet-Friendly', 'ayudo'],
      pose: 'presenting',
      durationMs: 4400,
    },
    {
      id: 4,
      textToSpeak: 'Sin llamadas, sin esperas, sin vueltas. La mejor tarifa garantizada sin comisiones.',
      displayHeadline: 'SIN ESPERAS NI COMISIONES',
      displaySubtitle: 'Sin llamadas, sin esperas, sin vueltas. Empezá a resolver todo desde tu celular.',
      highlightWords: ['Sin llamadas', 'sin esperas', 'tu celular'],
      pose: 'walking',
      durationMs: 4400,
    },
    {
      id: 5,
      textToSpeak: 'Chateá con nosotros acá en la web o agendá nuestro WhatsApp:',
      displayHeadline: 'CONTACTO DIRECTO',
      displaySubtitle: 'Chateá con nosotros acá en la web o agendá este número:',
      highlightWords: ['WhatsApp', 'web', 'número'],
      pose: 'presenting',
      durationMs: 3800,
    },
    {
      id: 6,
      textToSpeak: 'Dos dos tres, cinco uno ocho, nueve dos cinco cuatro.',
      displayHeadline: 'WHATSAPP OFICIAL',
      displaySubtitle: '📱 223 518 9254',
      highlightWords: ['223', '518', '9254'],
      pose: 'presenting',
      showPhoneCard: true,
      durationMs: 5000,
    },
  ];

  // Sync settings to localStorage
  useEffect(() => {
    localStorage.setItem('bollukito_dog_size', dogSize);
  }, [dogSize]);

  // Audio synthesis chime bell (Hotel Concierge Desk Chime)
  const playConciergeBell = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime); // High crystalline chime
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
      // AudioContext not allowed before user interaction
    }
  };

  // Stop speech playback
  const stopPresentation = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (speechIntervalRef.current) {
      clearTimeout(speechIntervalRef.current);
    }
    setIsSpeaking(false);
    setShowMayaStyleOverlay(false);
    setCurrentPhaseIndex(-1);
    setCurrentPose('presenting');
  }, []);

  // Play next speech phrase in sequence
  const playPhase = useCallback(
    (index: number) => {
      if (index >= speechScript.length) {
        // Finished all phrases
        setTimeout(() => {
          setIsSpeaking(false);
          setShowMayaStyleOverlay(false);
          setCurrentPhaseIndex(-1);
          setSpeechBubble('¡Listo! ¿Querés que reservemos? 🐾🛎️');
        }, 1200);
        return;
      }

      setCurrentPhaseIndex(index);
      const phase = speechScript[index];
      setCurrentPose(phase.pose);

      // Speak using Web Speech API
      if (!isMuted && typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(phase.textToSpeak);
          utterance.lang = 'es-AR';
          utterance.rate = 1.0;
          utterance.pitch = 1.08; // Friendly mascot tone

          const voices = window.speechSynthesis.getVoices();
          const esVoice =
            voices.find((v) => v.lang.startsWith('es-AR')) ||
            voices.find((v) => v.lang.startsWith('es-')) ||
            voices.find((v) => v.lang.includes('es'));
          if (esVoice) utterance.voice = esVoice;

          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.warn('Speech synthesis error', e);
        }
      }

      // Automatically advance to next phase after duration
      speechIntervalRef.current = setTimeout(() => {
        playPhase(index + 1);
      }, phase.durationMs);
    },
    [isMuted, speechScript]
  );

  // Start complete presentation like Maya's video
  const startFullPresentation = () => {
    setHasUserInteracted(true);
    stopPresentation();
    playConciergeBell();
    setIsSpeaking(true);
    setShowMayaStyleOverlay(true);

    // Position Bollukito at presentation spot (right side of chat)
    setPosition({ x: 74, y: 58 });
    setFacingDirection(-1);

    setTimeout(() => {
      playPhase(0);
    }, 400);
  };

  const showBark = (text?: string) => {
    if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current);
    const chosen = text || '¡Guau! 🐾';
    setSpeechBubble(chosen);
    bubbleTimeoutRef.current = setTimeout(() => {
      setSpeechBubble(null);
    }, 3500);
  };

  const doTrick = () => {
    if (isSpeaking) {
      stopPresentation();
      return;
    }
    setIsTrickSpinning(true);
    showBark('¡Miren mi truco! 🌀✨');
    setTimeout(() => {
      setIsTrickSpinning(false);
    }, 1200);
  };

  // Autonomous wandering around the screen (only when not speaking)
  useEffect(() => {
    if (!isEnabled || isSpeaking) return;

    const wanderInterval = setInterval(() => {
      if (isTrickSpinning || isSpeaking) return;

      // Roam across screen area covering the WhatsApp view
      const newX = Math.floor(Math.random() * 60) + 20;
      const newY = Math.floor(Math.random() * 50) + 24;

      // Determine facing direction based on destination
      setPosition((current) => {
        const deltaX = newX - current.x;
        if (Math.abs(deltaX) > 2) {
          setFacingDirection(deltaX > 0 ? 1 : -1);
        }
        return current;
      });

      // Switch to trotting pose while moving
      setIsWalking(true);
      setCurrentPose('walking');
      setPosition({ x: newX, y: newY });

      // After arrival, switch back to cute presenting/idle pose
      setTimeout(() => {
        setIsWalking(false);
        setCurrentPose('presenting');
        if (Math.random() < 0.28) {
          showBark();
        }
      }, 3600);
    }, 7600);

    return () => clearInterval(wanderInterval);
  }, [isEnabled, isSpeaking, isTrickSpinning]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current);
      if (speechIntervalRef.current) clearTimeout(speechIntervalRef.current);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!isEnabled) {
    return (
      <div className="fixed bottom-3 right-3 z-50">
        <button
          onClick={() => setIsEnabled(true)}
          className="bg-slate-900/90 hover:bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-xl border border-emerald-500/40 flex items-center space-x-2 transition-transform hover:scale-105"
        >
          <span>🐾 Activar a Bollukito</span>
        </button>
      </div>
    );
  }

  // Display sizes for prominent visibility
  const sizeClasses = {
    sm: 'w-40 h-40', // 160px
    md: 'w-56 h-56 sm:w-64 sm:h-64', // 224px - 256px
    lg: 'w-72 h-72 sm:w-80 sm:h-80', // 288px - 320px (Default)
    xl: 'w-88 h-88 sm:w-96 sm:h-96', // 352px - 384px (Gigante)
  };

  const activePhase = currentPhaseIndex >= 0 ? speechScript[currentPhaseIndex] : null;

  return (
    <>
      {/* MAYA STYLE OVERLAY: Dynamic Cartoon Subtitle & Header Presentation */}
      {showMayaStyleOverlay && activePhase && (
        <div className="fixed inset-0 z-40 pointer-events-none flex flex-col justify-between p-4 sm:p-8 animate-in fade-in duration-300">
          {/* Top Title Banner like Maya's reel */}
          <div className="w-full flex justify-center pt-2 sm:pt-4 pointer-events-auto">
            <div className="bg-slate-950/90 backdrop-blur-md border-2 border-amber-400/80 rounded-2xl px-6 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center space-x-3 animate-in slide-in-from-top-4 duration-300">
              <span className="text-2xl animate-bounce">🐾</span>
              <div className="text-center">
                <h2 className="text-lg sm:text-2xl font-black text-white tracking-wide uppercase drop-shadow-md">
                  BOLLUKITO
                </h2>
                <p className="text-xs sm:text-sm font-bold text-amber-300 tracking-wider uppercase">
                  Nuestro Asistente Virtual • Hotel Bolluk
                </p>
              </div>
              <span className="text-2xl animate-pulse">🛎️</span>
            </div>
          </div>

          {/* Center/Bottom Subtitles Box exactly like Maya in the video */}
          <div className="w-full flex flex-col items-center pb-24 sm:pb-28 pointer-events-auto">
            {activePhase.showPhoneCard ? (
              /* Phone number reveal card like at the end of the video */
              <div className="bg-slate-950/95 border-2 border-emerald-400 rounded-3xl p-6 shadow-2xl text-center max-w-md w-full animate-in zoom-in-95 duration-300 backdrop-blur-lg">
                <span className="inline-block bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider mb-3">
                  WhatsApp Oficial • Hotel Bolluk
                </span>
                <div className="text-3xl sm:text-4xl font-black text-white tracking-widest font-mono drop-shadow-lg mb-4 flex items-center justify-center space-x-3">
                  <Phone className="w-8 h-8 text-emerald-400 animate-bounce" />
                  <span className="text-emerald-300">223 518 9254</span>
                </div>
                <div className="flex gap-2">
                  <a
                    href="https://wa.me/5492235189254"
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-2xl flex items-center justify-center space-x-2 text-sm shadow-lg transition-transform hover:scale-105"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>Abrir Chat de WhatsApp</span>
                  </a>
                  <button
                    onClick={stopPresentation}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-sm"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              /* Word-by-word subtitle card styled like reels */
              <div className="bg-black/90 border border-white/20 rounded-2xl px-6 py-4 max-w-xl text-center shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200">
                <p className="text-white text-base sm:text-xl font-extrabold leading-snug drop-shadow-md">
                  {activePhase.displaySubtitle.split(' ').map((word, i) => {
                    const cleanWord = word.replace(/[.,?!¿¡]/g, '');
                    const isHighlighted = activePhase.highlightWords.some(
                      (h) => h.toLowerCase() === cleanWord.toLowerCase()
                    );
                    return (
                      <span
                        key={i}
                        className={`inline-block mr-1.5 transition-colors duration-200 ${
                          isHighlighted
                            ? 'text-amber-300 scale-105 font-black drop-shadow-[0_2px_8px_rgba(251,191,36,0.6)]'
                            : 'text-slate-100'
                        }`}
                      >
                        {word}
                      </span>
                    );
                  })}
                </p>

                {/* Animated Voice Audio Waves */}
                <div className="flex items-center justify-center space-x-1 mt-3">
                  <div className="w-1 bg-amber-400 rounded-full animate-sound-wave" style={{ animationDelay: '0ms' }} />
                  <div className="w-1 bg-emerald-400 rounded-full animate-sound-wave" style={{ animationDelay: '150ms' }} />
                  <div className="w-1 bg-amber-300 rounded-full animate-sound-wave" style={{ animationDelay: '300ms' }} />
                  <div className="w-1 bg-emerald-300 rounded-full animate-sound-wave" style={{ animationDelay: '450ms' }} />
                  <div className="w-1 bg-amber-400 rounded-full animate-sound-wave" style={{ animationDelay: '200ms' }} />
                  <span className="text-[11px] font-bold text-slate-300 ml-2">
                    Hablando en vivo...
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Walking & Speaking French Bulldog Mascot */}
      <div
        style={{
          left: `${position.x}vw`,
          top: `${position.y}vh`,
          transition: `left ${movementSpeed}s cubic-bezier(0.25, 1, 0.5, 1), top ${movementSpeed}s cubic-bezier(0.25, 1, 0.5, 1)`,
        }}
        className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-1/2 select-none"
      >
        <div className="relative pointer-events-auto">
          {/* Speech bubble */}
          {speechBubble && !showMayaStyleOverlay && (
            <div
              onClick={startFullPresentation}
              className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-950/95 text-white text-xs font-black px-4 py-2 rounded-full shadow-2xl border-2 border-amber-400 whitespace-nowrap animate-bounce flex items-center space-x-2 z-10 cursor-pointer hover:scale-105 transition-transform"
              title="¡Haz clic para escuchar el mensaje completo!"
            >
              <Volume2 className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>{speechBubble}</span>
            </div>
          )}

          {/* Bulldog Character Body */}
          <div
            onClick={() => {
              if (!isSpeaking) {
                startFullPresentation();
              } else {
                doTrick();
              }
            }}
            style={{
              transform: `scaleX(${facingDirection})`,
            }}
            className={`cursor-pointer transition-transform duration-300 relative ${
              isTrickSpinning
                ? 'animate-bollukito-spin'
                : isSpeaking
                ? 'animate-cartoon-talk'
                : isWalking
                ? 'animate-cartoon-trot'
                : 'animate-bollukito-happy'
            }`}
            title="¡Tocame para escuchar mi presentación como asistente virtual! 🐾🎙️"
          >
            {/* Ground Contact Shadow */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4/5 h-6 bg-black/35 rounded-full blur-[7px] pointer-events-none transition-all duration-300 scale-95" />

            {/* Glowing ring while talking */}
            {isSpeaking && (
              <div className="absolute inset-0 rounded-full bg-amber-400/15 filter blur-xl animate-pulse -z-10" />
            )}

            {/* Mascot Image */}
            <div className="relative flex items-center justify-center">
              <img
                src="/bollukito.jpg"
                alt="Bollukito Bulldog Francés"
                className={`${sizeClasses[dogSize]} rounded-full object-cover shadow-2xl ring-4 ring-amber-400/80 hover:brightness-110 active:scale-95 transition-transform`}
                draggable={false}
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Floating Control Dock (Bottom Right) */}
      <div className="fixed bottom-3 right-3 z-50 flex items-center space-x-2 bg-slate-950/95 backdrop-blur-md text-white px-3.5 py-2 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.6)] border border-amber-400/40 text-xs select-none">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="font-bold text-[11px] text-amber-300 hidden sm:inline">
          Bollukito 🐾
        </span>

        {/* Big Highlight Button: Play Speech Presentation */}
        <button
          onClick={isSpeaking ? stopPresentation : startFullPresentation}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-black shadow-lg transition-all ${
            isSpeaking
              ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
              : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 hover:scale-105'
          }`}
          title="Escuchar la presentación de Bollukito con voz y cartel estilo Maya"
        >
          {isSpeaking ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Detener</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" />
              <span>🎙️ ¡Escuchar a Bollukito!</span>
            </>
          )}
        </button>

        {/* Walk / Roam across WhatsApp Screen */}
        <button
          onClick={() => {
            const randomX = Math.floor(Math.random() * 55) + 20;
            const randomY = Math.floor(Math.random() * 45) + 25;
            setFacingDirection(randomX > position.x ? 1 : -1);
            setIsWalking(true);
            setCurrentPose('walking');
            setPosition({ x: randomX, y: randomY });
            showBark('¡Paseando por WhatsApp! 🐾');
            setTimeout(() => {
              setIsWalking(false);
              setCurrentPose('presenting');
            }, 3600);
          }}
          title="Hacer que Bollukito camine por la pantalla de WhatsApp"
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-[11px] transition-colors"
        >
          <Move className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden md:inline">Pasear</span>
        </button>

        {/* Call to Center */}
        <button
          onClick={() => {
            setPosition({ x: 50, y: 50 });
            setIsWalking(true);
            setCurrentPose('walking');
            setTimeout(() => {
              setIsWalking(false);
              setCurrentPose('presenting');
            }, 2500);
            showBark('¡Aquí estoy! 🐾');
          }}
          title="Llamar al perrito al centro"
          className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-[11px] font-semibold transition-colors"
        >
          📍 Centro
        </button>

        {/* Trick button */}
        <button
          onClick={doTrick}
          title="Giro 360°"
          className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-[11px] transition-colors"
        >
          🌀 Truco
        </button>

        {/* Quick Size Toggle */}
        <button
          onClick={() => {
            const order: ('sm' | 'md' | 'lg' | 'xl')[] = ['sm', 'md', 'lg', 'xl'];
            const next = order[(order.indexOf(dogSize) + 1) % order.length];
            setDogSize(next);
          }}
          title="Cambiar tamaño en pantalla"
          className="px-2 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 text-[10px] uppercase font-black tracking-wide border border-amber-400/30"
        >
          {dogSize}
        </button>

        {/* Open settings modal */}
        <button
          onClick={() => setIsModalOpen(true)}
          title="Ajustes de Bollukito"
          className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setIsEnabled(false)}
          title="Ocultar perrito"
          className="text-slate-400 hover:text-red-400 px-1 font-bold text-xs"
        >
          ✕
        </button>
      </div>

      {/* Adjustments & Voice Settings Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base text-white">
                  Ajustes de Bollukito • Asistente Virtual 🐾
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Preview Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center space-x-4">
                <div className="w-20 h-20 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src="/bollukito.jpg"
                    alt="Bollukito"
                    className="w-16 h-16 rounded-xl object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center space-x-1.5">
                    <span>Bollukito (Caricatura 3D)</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Activo
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Bulldog francés con chaleco de conserje, teléfono y animación completa de voz y movimiento.
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  startFullPresentation();
                }}
                className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black py-3 rounded-xl flex items-center justify-center space-x-2 shadow-lg text-sm transition-transform hover:scale-[1.02]"
              >
                <Volume2 className="w-5 h-5" />
                <span>▶️ Iniciar Presentación Completa con Voz</span>
              </button>

              {/* Size Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  Tamaño del perrito en pantalla:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'sm', label: 'Pequeño', desc: '160px' },
                    { id: 'md', label: 'Mediano', desc: '240px' },
                    { id: 'lg', label: 'Grande', desc: '300px' },
                    { id: 'xl', label: 'Gigante', desc: '380px' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setDogSize(s.id as any)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        dogSize === s.id
                          ? 'border-amber-400 bg-amber-500/20 text-white font-black shadow-md'
                          : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-bold">{s.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{s.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice Sound Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-slate-200">
                    {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-200">Voz hablada con audio</p>
                    <p className="text-[10px] text-slate-400">Pronunciación en español para locución</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    isMuted
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {isMuted ? 'Silenciado' : 'Activado'}
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-950/80 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2 rounded-xl text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
