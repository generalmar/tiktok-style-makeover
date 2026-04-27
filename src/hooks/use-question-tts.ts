import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Module-level singleton audio element. Created lazily so SSR/tests don't crash.
 * Reusing one element + priming it via a user gesture is what allows subsequent
 * programmatic `.play()` calls (auto-advance rounds) to bypass autoplay blocking.
 */
let sharedAudio: HTMLAudioElement | null = null;
let primed = false;

// 1-second silent MP3 (base64) used to prime the audio element on first gesture.
const SILENT_MP3 =
  "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//F1Ffi/8/xUi/9/wMA/4AAAAANIAAAAACDg/4AAAAACAAACAAEXm/4ANAAAAYAVCJEDgFkVMBlpAQNECgQEzhwYWGgYUEikxYECgaQQAAAAEAQRwAAAAAOAAACAAAAAAAA";

function ensureAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = "auto";
  }
  return sharedAudio;
}

/**
 * Call this from inside a user-gesture event handler (e.g. onClick) BEFORE any
 * `await`. It plays a silent clip on the shared audio element so the browser
 * marks it as "user-activated" — every subsequent .play() (even from async
 * code) will then be allowed.
 */
export function primeAudio(): void {
  if (primed) return;
  const audio = ensureAudio();
  if (!audio) return;
  try {
    audio.src = SILENT_MP3;
    audio.muted = true;
    const p = audio.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        primed = true;
      }).catch(() => {
        // Even a failed silent play sometimes still grants activation; mark primed
        // so we don't keep retrying. Real plays will surface their own errors.
        audio.muted = false;
        primed = true;
      });
    } else {
      audio.muted = false;
      primed = true;
    }
  } catch {
    primed = true;
  }
}

// Auto-prime on the first global user gesture so the operator doesn't have to
// click a special button.
if (typeof window !== "undefined") {
  const handler = () => {
    primeAudio();
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("keydown", handler);
    window.removeEventListener("touchstart", handler);
  };
  window.addEventListener("pointerdown", handler, { once: false });
  window.addEventListener("keydown", handler, { once: false });
  window.addEventListener("touchstart", handler, { once: false });
}

/**
 * Plays a TTS reading of `text` once, the first time it's seen for the given `roundId`.
 */
export function useQuestionTTS({
  roundId,
  text,
  voiceId,
  enabled = true,
}: {
  roundId: string | null | undefined;
  text: string | null | undefined;
  voiceId: string | null | undefined;
  enabled?: boolean;
}) {
  const playedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    if (!roundId || !text || !voiceId) return;

    const cacheKey = `tts_played_${roundId}`;
    if (playedRef.current.has(roundId)) return;
    if (typeof window !== "undefined" && sessionStorage.getItem(cacheKey)) {
      playedRef.current.add(roundId);
      return;
    }
    playedRef.current.add(roundId);
    sessionStorage.setItem(cacheKey, "1");

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("tts-question", {
          body: { text, voice_id: voiceId },
        });
        if (cancelled || error || !data?.audio) {
          if (error) console.warn("[TTS] invoke error:", error);
          return;
        }
        const url = `data:${data.mime || "audio/mpeg"};base64,${data.audio}`;
        const audio = ensureAudio();
        if (!audio) return;
        // Stop any previous playback and load new clip on the SAME primed element.
        try { audio.pause(); } catch { /* noop */ }
        audio.src = url;
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.then === "function") {
          playPromise.catch((err) => {
            console.warn(
              "[TTS] playback blocked — click anywhere on the page to enable voice.",
              err,
            );
          });
        }
      } catch (e) {
        console.warn("[TTS] playback failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roundId, text, voiceId, enabled]);
}
