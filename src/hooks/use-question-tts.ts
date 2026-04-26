import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Plays a TTS reading of `text` once, the first time it's seen for the given `roundId`.
 * - Skips if `enabled` is false or no text/roundId.
 * - Caches "already played" by round id to avoid replays on remounts/refreshes.
 * - Returns nothing; fire-and-forget.
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
        if (cancelled || error || !data?.audio) return;
        const url = `data:${data.mime || "audio/mpeg"};base64,${data.audio}`;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.play().catch(() => {
          // Autoplay blocked — silent fallback. The countdown will still proceed.
        });
      } catch (e) {
        console.warn("TTS playback failed:", e);
      }
    })();

    return () => {
      cancelled = true;
      try {
        audioRef.current?.pause();
        audioRef.current = null;
      } catch {
        /* noop */
      }
    };
  }, [roundId, text, voiceId, enabled]);
}
