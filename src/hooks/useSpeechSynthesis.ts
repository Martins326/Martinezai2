import { useCallback, useEffect, useRef, useState } from "react";
import { ApiService } from "../services/api";

function makePlayableAudioUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return dataUrl;

  const metadata = dataUrl.slice(0, comma);
  if (!/audio\/(?:L16|pcm)/i.test(metadata)) {
    return dataUrl;
  }

  // Gemini may return raw 16-bit PCM rather than a browser-playable WAV.
  const rateMatch = metadata.match(/rate=(\d+)/i);
  const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
  const raw = atob(dataUrl.slice(comma + 1));
  const pcm = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i++) {
    pcm[i] = raw.charCodeAt(i);
  }

  const wav = new ArrayBuffer(44 + pcm.length);
  const view = new DataView(wav);

  const writeText = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, pcm.length, true);
  new Uint8Array(wav, 44).set(pcm);

  const bytes = new Uint8Array(wav);
  let binary = "";

  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)),
    );
  }

  return `data:audio/wav;base64,${btoa(binary)}`;
}

export function useSpeechSynthesis(defaultVoice = "Kore") {
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(
    null,
  );
  const [isPaused, setIsPaused] = useState(false);
  const [loadingMessageId, setLoadingMessageId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = "";
      audioRef.current = null;
    }

    activeIdRef.current = null;
    setSpeakingMessageId(null);
    setLoadingMessageId(null);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    void audio.play().then(
      () => setIsPaused(false),
      (error) => console.warn("Audio playback could not resume:", error),
    );
  }, []);

  const speak = useCallback(
    async (messageId: string, text: string) => {
      if (!text?.trim()) return;

      // Tapping again while audio is being prepared cancels the pending request.
      if (activeIdRef.current === messageId && loadingMessageId === messageId) {
        stop();
        return;
      }

      // Once playback starts, tapping the same message toggles pause/resume.

      if (activeIdRef.current === messageId && audioRef.current) {
        if (audioRef.current.paused && !audioRef.current.ended) {
          void audioRef.current.play().then(
            () => setIsPaused(false),
            (error) => console.warn("Audio playback failed:", error),
          );
        } else {
          audioRef.current.pause();
          setIsPaused(true);
        }
        return;
      }

      stop();

      const controller = new AbortController();
      requestRef.current = controller;
      activeIdRef.current = messageId;
      setLoadingMessageId(messageId);

      const cleanText = text
        .replace(/```[\s\S]*?```/g, "Code block omitted.")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/https?:\/\/\S+/g, "link")
        .replace(/[#*_~\[\]()]/g, "")
        .trim()
        .slice(0, 5000);

      try {
        const audioUrl = await ApiService.generateTTS(
          cleanText,
          defaultVoice && defaultVoice !== "default" ? defaultVoice : "Kore",
        );

        if (controller.signal.aborted || activeIdRef.current !== messageId) {
          return;
        }

        if (
          typeof audioUrl !== "string" ||
          !audioUrl.startsWith("data:audio/")
        ) {
          throw new Error("Gemini TTS returned an invalid audio response.");
        }

        const audio = new Audio(makePlayableAudioUrl(audioUrl));
        audioRef.current = audio;

        audio.onplaying = () => {
          if (activeIdRef.current === messageId) {
            setLoadingMessageId(null);
            setSpeakingMessageId(messageId);
            setIsPaused(false);
          }
        };

        audio.onended = () => {
          if (activeIdRef.current === messageId) {
            audioRef.current = null;
            activeIdRef.current = null;
            requestRef.current = null;
            setSpeakingMessageId(null);
            setLoadingMessageId(null);
            setIsPaused(false);
          }
        };

        audio.onerror = () => {
          if (activeIdRef.current === messageId) {
            audioRef.current = null;
            activeIdRef.current = null;
            requestRef.current = null;
            setSpeakingMessageId(null);
            setLoadingMessageId(null);
            setIsPaused(false);
          }
        };

        await audio.play();
      } catch (error) {
        if (activeIdRef.current === messageId) {
          activeIdRef.current = null;
          audioRef.current = null;
          requestRef.current = null;
          setSpeakingMessageId(null);
          setLoadingMessageId(null);
          setIsPaused(false);
        }

        console.error("Gemini TTS playback failed:", error);
      }
    },
    [loadingMessageId, defaultVoice, stop],
  );

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return {
    isSupported: true,
    speakingMessageId,
    loadingMessageId,
    isPaused,
    speak,
    pause,
    resume,
    stop,
  };
}
