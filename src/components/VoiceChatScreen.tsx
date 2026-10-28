import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  AudioLines,
  CircleStop,
  Mic,
  MicOff,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
  Waves,
} from "lucide-react";

import { useVoiceInput } from "../hooks/useVoiceInput";

interface VoiceChatScreenProps {
  onClose: () => void;
  onAsk: (text: string) => Promise<string>;
  onStopSpeaking: () => void;
  onSpeak: (id: string, text: string) => void;
  isLight: boolean;
  isSpeaking: boolean;
}

const WAVE_HEIGHTS = [
  12, 20, 28, 16, 34, 23, 38, 18,
  30, 14, 24, 34, 17, 27, 12,
];

export function VoiceChatScreen({
  onClose,
  onAsk,
  onStopSpeaking,
  onSpeak,
  isLight,
  isSpeaking,
}: VoiceChatScreenProps) {
  const [lastQuestion, setLastQuestion] = useState("");
  const [lastAnswer, setLastAnswer] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");

  const [status, setStatus] = useState(
    "Tap the microphone when you are ready.",
  );

  const [busy, setBusy] = useState(false);

  const busyRef = useRef(false);
  const isSpeakingRef = useRef(isSpeaking);

  const onAskRef = useRef(onAsk);
  const onSpeakRef = useRef(onSpeak);
  const onStopSpeakingRef = useRef(onStopSpeaking);

  // Keep speech callbacks stable while always using current props.
  isSpeakingRef.current = isSpeaking;
  onAskRef.current = onAsk;
  onSpeakRef.current = onSpeak;
  onStopSpeakingRef.current = onStopSpeaking;

  const handleFinalTranscript = useCallback((text: string) => {
    const question = text.trim();

    if (!question || busyRef.current) return;

    busyRef.current = true;
    setBusy(true);
    setLastQuestion(question);
    setLiveTranscript("");
    setLastAnswer("");
    setStatus("Thinking through your question…");

    // Stop current audio before processing the next question.
    onStopSpeakingRef.current();

    void onAskRef.current(question)
      .then((answer) => {
        if (!answer.trim()) {
          setStatus(
            "No response was generated. Please try again.",
          );
          return;
        }

        setLastAnswer(answer);

        setStatus(
          "Martins AI is speaking. You can interrupt at any time.",
        );

        onSpeakRef.current(
          `voice-${Date.now()}`,
          answer,
        );
      })
      .catch((error: unknown) => {
        setStatus(
          error instanceof Error
            ? error.message
            : "Voice chat failed. Please try again.",
        );
      })
      .finally(() => {
        busyRef.current = false;
        setBusy(false);
      });
  }, []);

  const handleTranscriptChange = useCallback(
    (transcript: string) => {
      setLiveTranscript(transcript);

      // Interrupt playback as soon as the user starts talking.
      if (
        transcript.trim() &&
        isSpeakingRef.current
      ) {
        onStopSpeakingRef.current();
        setStatus("Interrupted — listening to you…");
      }
    },
    [],
  );

  const {
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
  } = useVoiceInput({
    onFinalTranscript: handleFinalTranscript,
    onTranscriptChange: handleTranscriptChange,
  });

  // Stop microphone and audio when leaving the screen.
  useEffect(() => {
    return () => {
      stopListening();
      onStopSpeakingRef.current();
    };
  }, [stopListening]);

  const handleClose = () => {
    stopListening();
    onStopSpeakingRef.current();
    onClose();
  };

  const headline = busy
    ? "Thinking it through"
    : isSpeaking
      ? "Speaking to you"
      : isListening
        ? "I’m listening"
        : "Ready when you are";

  const description = error || status;

  const backgroundStyle: React.CSSProperties = {
    background: isLight
      ? "radial-gradient(ellipse at 50% 22%, rgba(139,92,246,0.13), transparent 42%), linear-gradient(155deg, #fbfbff 0%, #f3f4fa 53%, #f8f8fc 100%)"
      : "radial-gradient(ellipse at 50% 22%, rgba(124,92,255,0.18), transparent 42%), radial-gradient(ellipse at 80% 78%, rgba(59,130,246,0.08), transparent 35%), linear-gradient(155deg, #0c0c16 0%, #10111d 48%, #0b0c12 100%)",
    color: isLight ? "#202238" : "#f7f7ff",
  };

  const panelStyle: React.CSSProperties = {
    background: isLight
      ? "rgba(255,255,255,0.76)"
      : "rgba(22,23,38,0.66)",

    borderColor: isLight
      ? "rgba(67,70,110,0.12)"
      : "rgba(175,178,220,0.12)",

    boxShadow: isLight
      ? "0 18px 60px rgba(48,49,90,0.08)"
      : "0 24px 80px rgba(0,0,0,0.22)",
  };

  const mutedStyle: React.CSSProperties = {
    color: isLight ? "#777a94" : "#9295b1",
  };

  return (
    <section
      className="absolute inset-0 z-40 flex flex-col overflow-hidden"
      aria-label="Voice chat"
      style={backgroundStyle}
    >
      {/* Atmospheric background accents */}
      <div
        className="pointer-events-none absolute -left-28 top-1/3 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl"
        aria-hidden="true"
      />

      {/* Top navigation */}
      <header
        className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b px-3 py-3.5 sm:px-5 sm:py-4"
        style={{
          borderColor: isLight
            ? "rgba(67,70,110,0.12)"
            : "rgba(175,178,220,0.12)",

          background: isLight
            ? "rgba(255,255,255,0.54)"
            : "rgba(12,13,23,0.48)",

          backdropFilter: "blur(22px)",
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Return to chat"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition hover:-translate-x-0.5"
            style={{
              borderColor: isLight
                ? "rgba(67,70,110,0.13)"
                : "rgba(175,178,220,0.13)",

              background: isLight
                ? "rgba(255,255,255,0.8)"
                : "rgba(255,255,255,0.04)",
            }}
          >
            <ArrowLeft size={19} />
          </button>

          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white"
            style={{
              background:
                "linear-gradient(145deg, #9b72ff, #5b5dea)",
              boxShadow:
                "0 8px 24px rgba(105,91,244,0.30)",
            }}
          >
            <AudioLines size={20} />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold tracking-tight sm:text-base">
              Martins Voice
            </h2>

            <p
              className="mt-0.5 truncate text-[10px] font-medium sm:text-xs"
              style={mutedStyle}
            >
              Natural, hands-free conversation
            </p>
          </div>
        </div>

        {/* Live activity status */}
        <div
          className="flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1.5 sm:px-3"
          style={{
            borderColor: isLight
              ? "rgba(67,70,110,0.12)"
              : "rgba(175,178,220,0.12)",

            background: isLight
              ? "rgba(255,255,255,0.7)"
              : "rgba(255,255,255,0.035)",
          }}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              busy || isListening || isSpeaking
                ? "animate-pulse bg-emerald-400"
                : "bg-neutral-400"
            }`}
          />

          <span className="hidden text-[10px] font-bold tracking-wide sm:inline">
            {busy
              ? "PROCESSING"
              : isSpeaking
                ? "SPEAKING"
                : isListening
                  ? "LISTENING"
                  : "VOICE MODE"}
          </span>

          <span className="text-[10px] font-semibold sm:hidden">
            {busy
              ? "Working"
              : isSpeaking
                ? "Speaking"
                : isListening
                  ? "Live"
                  : "Ready"}
          </span>
        </div>
      </header>

      {/* Main voice experience */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-5 sm:px-6 sm:py-8">
        <div className="my-auto flex w-full max-w-2xl flex-col items-center py-5 text-center sm:py-7">
          {/* Product labels */}
          <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-wide"
              style={{
                borderColor: isLight
                  ? "rgba(124,92,246,0.18)"
                  : "rgba(167,139,250,0.20)",

                background: isLight
                  ? "rgba(139,92,246,0.07)"
                  : "rgba(139,92,246,0.10)",

                color: isLight ? "#6d55d9" : "#c4b5fd",
              }}
            >
              <Sparkles size={12} />
              AI VOICE STUDIO
            </span>

            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold"
              style={{
                borderColor: isLight
                  ? "rgba(67,70,110,0.12)"
                  : "rgba(175,178,220,0.12)",

                ...mutedStyle,
              }}
            >
              <ShieldCheck size={12} />
              Private to this conversation
            </span>
          </div>

          {/* Animated voice orb */}
          <div className="relative mb-7 flex h-48 w-48 items-center justify-center sm:h-56 sm:w-56">
            <div
              className={`absolute inset-1 rounded-full border transition-all duration-700 ${
                isListening
                  ? "scale-100 border-violet-400/50"
                  : "scale-95 border-violet-400/20"
              }`}
              style={{
                boxShadow: isListening
                  ? "0 0 70px rgba(139,92,246,0.13), inset 0 0 42px rgba(139,92,246,0.06)"
                  : "none",
              }}
            />

            <div
              className={`absolute inset-5 rounded-full border transition-all duration-700 ${
                isSpeaking
                  ? "scale-105 border-indigo-400/50"
                  : "border-indigo-400/15"
              }`}
            />

            {(isListening || isSpeaking || busy) && (
              <div
                className="absolute inset-0 animate-ping rounded-full border border-violet-400/20"
                style={{ animationDuration: "2.4s" }}
              />
            )}

            <div
              className={`relative flex h-32 w-32 items-center justify-center rounded-[2.5rem] text-white transition-all duration-500 sm:h-36 sm:w-36 ${
                isListening || isSpeaking
                  ? "scale-105"
                  : "scale-100"
              }`}
              style={{
                background: busy
                  ? "linear-gradient(145deg, #7c73ff, #5363db)"
                  : isSpeaking
                    ? "linear-gradient(145deg, #8b5cf6, #4f46e5)"
                    : isListening
                      ? "linear-gradient(145deg, #a855f7, #6455e9)"
                      : "linear-gradient(145deg, #8b5cf6, #5755dc)",

                boxShadow:
                  isListening || isSpeaking || busy
                    ? "0 0 58px rgba(123,92,246,0.32), inset 0 1px 0 rgba(255,255,255,0.25)"
                    : "0 20px 50px rgba(99,91,235,0.25), inset 0 1px 0 rgba(255,255,255,0.22)",
              }}
            >
              <div className="absolute inset-2 rounded-[2rem] border border-white/15" />

              {busy ? (
                <Waves size={42} className="animate-pulse" strokeWidth={1.6} />
              ) : isSpeaking ? (
                <Volume2 size={42} className="animate-pulse" strokeWidth={1.6} />
              ) : isListening ? (
                <Mic size={42} className="animate-pulse" strokeWidth={1.6} />
              ) : (
                <AudioLines size={42} strokeWidth={1.6} />
              )}
            </div>
          </div>

          {/* Live status */}
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {headline}
          </h1>

          <p
            className="mt-2 max-w-md text-sm leading-6 sm:text-[15px]"
            style={mutedStyle}
          >
            {description}
          </p>

          {/* Animated audio visualizer */}
          <div
            className="mt-5 flex h-9 items-center justify-center gap-1.5"
            aria-hidden="true"
          >
            {WAVE_HEIGHTS.map((height, index) => (
              <span
                key={index}
                className={`w-1 rounded-full transition-all ${
                  isListening || isSpeaking || busy
                    ? "animate-pulse bg-violet-500"
                    : "bg-violet-500/30"
                }`}
                style={{
                  height: `${
                    isListening || isSpeaking || busy
                      ? height
                      : Math.max(4, height * 0.22)
                  }px`,

                  animationDelay: `${index * 55}ms`,
                  animationDuration: `${450 + (index % 4) * 130}ms`,
                }}
              />
            ))}
          </div>

          {/* In-progress speech transcript */}
          {liveTranscript && isListening && (
            <div
              className="mt-4 w-full max-w-lg rounded-2xl border px-4 py-3 text-left"
              style={panelStyle}
            >
              <div
                className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.13em]"
                style={{
                  color: isLight ? "#7c5ce7" : "#b7a6ff",
                }}
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                Live transcript
              </div>

              <p className="text-sm leading-6">
                {liveTranscript}
              </p>
            </div>
          )}

          {/* Most recent voice exchange */}
          {(lastQuestion || lastAnswer) && (
            <div className="mt-5 grid w-full max-w-lg gap-3 text-left">
              {lastQuestion && (
                <div
                  className="rounded-2xl border px-4 py-3.5"
                  style={panelStyle}
                >
                  <div
                    className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.13em]"
                    style={mutedStyle}
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full"
                      style={{
                        background: isLight
                          ? "rgba(124,92,246,0.10)"
                          : "rgba(124,92,246,0.16)",

                        color: isLight
                          ? "#7158db"
                          : "#c4b5fd",
                      }}
                    >
                      <Mic size={11} />
                    </span>

                    You asked
                  </div>

                  <p className="text-sm leading-6">
                    {lastQuestion}
                  </p>
                </div>
              )}

              {lastAnswer && (
                <div
                  className="rounded-2xl border px-4 py-3.5"
                  style={panelStyle}
                >
                  <div
                    className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.13em]"
                    style={{
                      color: isLight ? "#7158db" : "#c4b5fd",
                    }}
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full"
                      style={{
                        background: isLight
                          ? "rgba(124,92,246,0.10)"
                          : "rgba(124,92,246,0.16)",
                      }}
                    >
                      <Sparkles size={11} />
                    </span>

                    Martins AI
                  </div>

                  <p className="max-h-28 overflow-y-auto whitespace-pre-wrap text-sm leading-6">
                    {lastAnswer}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Browser microphone support warning */}
          {!isSupported && (
            <div
              role="alert"
              className="mt-5 max-w-md rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-left text-sm text-rose-500"
            >
              Speech recognition is not supported in this browser. Try
              a compatible browser and allow microphone access.
            </div>
          )}

          {/* Main voice controls */}
          <div className="mt-7 flex w-full max-w-lg flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled={!isSupported || busy}
              onClick={() => {
                if (isListening) {
                  stopListening();
                  setLiveTranscript("");
                  setStatus(
                    "Microphone paused. Tap the microphone to continue.",
                  );
                } else {
                  onStopSpeakingRef.current();
                  startListening();
                  setStatus("Listening for your question…");
                }
              }}
              className="inline-flex min-h-14 flex-1 items-center justify-center gap-2.5 rounded-2xl px-6 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: isListening
                  ? "linear-gradient(135deg, #e94875, #c73566)"
                  : "linear-gradient(135deg, #8b5cf6, #5554dc)",

                boxShadow: isListening
                  ? "0 10px 28px rgba(225,62,112,0.22)"
                  : "0 10px 28px rgba(99,91,235,0.28)",
              }}
            >
              {isListening ? (
                <>
                  <MicOff size={19} />
                  Stop listening
                </>
              ) : (
                <>
                  <Mic size={19} />
                  Start talking
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onStopSpeakingRef.current();

                setStatus(
                  "Audio stopped. You can keep talking whenever you are ready.",
                );
              }}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-sm font-semibold transition hover:-translate-y-0.5"
              style={{
                borderColor: isLight
                  ? "rgba(67,70,110,0.15)"
                  : "rgba(175,178,220,0.16)",

                background: isLight
                  ? "rgba(255,255,255,0.68)"
                  : "rgba(255,255,255,0.045)",
              }}
            >
              {isSpeaking ? (
                <CircleStop size={17} />
              ) : (
                <Square size={15} />
              )}

              Interrupt audio
            </button>
          </div>

          <p
            className="mt-5 max-w-md text-[11px] leading-5"
            style={mutedStyle}
          >
            Speak naturally. Martins AI will respond aloud, and you can
            interrupt the response at any time.
          </p>
        </div>
      </div>
    </section>
  );
}