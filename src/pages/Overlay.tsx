import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Radio, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Choice { key: string; text: string }
interface OverlayState {
  session: { id: string; name: string; status: string; question_duration_seconds: number };
  round: {
    id: string;
    status: "idle" | "live" | "closed" | "resolved";
    duration_seconds: number;
    started_at: string | null;
    closes_at: string | null;
    resolved_at: string | null;
    question: { text: string; choices: Choice[]; correct_choice: string | null; category: string } | null;
  } | null;
  scores: Array<{
    id: string; viewer_handle: string; viewer_display_name: string | null;
    score: number; correct_count: number; answer_count: number;
  }>;
  progress: { played: number; total: number };
}

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/overlay-state`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const Overlay = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<OverlayState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const lastRoundIdRef = useRef<string | null>(null);
  const fetchStateRef = useRef<() => Promise<void>>(async () => {});

  // Realtime: fetch on mount, then refetch on broadcast events.
  // Light safety-net poll (every 15s) covers any missed messages or reconnects.
  useEffect(() => {
    if (!token) return;
    let alive = true;
    const fetchState = async () => {
      try {
        const r = await fetch(`${FUNCTIONS_URL}?token=${encodeURIComponent(token)}`, {
          headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${r.status}`);
        }
        const j = (await r.json()) as OverlayState;
        if (alive) { setState(j); setError(null); }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Failed to load");
      }
    };
    fetchStateRef.current = fetchState;
    fetchState();

    const channel = supabase
      .channel(`overlay:${token}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "round_changed" }, () => { fetchState(); })
      .on("broadcast", { event: "session_changed" }, () => { fetchState(); })
      .on("broadcast", { event: "scores_changed" }, () => { fetchState(); })
      .subscribe();

    // Safety-net refresh every 15s in case of dropped messages
    const safety = setInterval(fetchState, 15000);

    return () => {
      alive = false;
      clearInterval(safety);
      supabase.removeChannel(channel);
    };
  }, [token]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const remaining = useMemo(() => {
    const r = state?.round;
    if (!r || !r.closes_at || r.status !== "live") return 0;
    return Math.max(0, Math.ceil((new Date(r.closes_at).getTime() - now) / 1000));
  }, [state?.round, now]);

  const timerPct = useMemo(() => {
    const r = state?.round;
    if (!r || r.status !== "live") return 0;
    return Math.max(0, Math.min(100, (remaining / r.duration_seconds) * 100));
  }, [state?.round, remaining]);

  // Track new round for animation key
  useEffect(() => {
    if (state?.round?.id) lastRoundIdRef.current = state.round.id;
  }, [state?.round?.id]);

  const sessionFinished = state?.session?.status === "finished";
  const round = state?.round;
  const showLeaderboardOnly = sessionFinished || (!round && (state?.progress.played ?? 0) > 0);

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex items-center justify-center p-4 overflow-hidden">
      {/* 9:16 stage */}
      <div
        className="relative w-full max-w-[480px] aspect-[9/16] rounded-3xl overflow-hidden shadow-2xl border border-border/40"
        style={{
          background:
            "radial-gradient(120% 80% at 20% 0%, hsl(177 90% 55% / 0.18) 0%, transparent 55%), radial-gradient(120% 80% at 80% 100%, hsl(345 95% 58% / 0.22) 0%, transparent 60%), hsl(240 8% 6%)",
        }}
      >
        {/* Top status bar */}
        <div className="absolute top-0 left-0 right-0 z-10 px-5 pt-5 flex items-center justify-between">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/40 backdrop-blur-md border border-border/40">
            <Radio className="w-3 h-3 text-tiktok-pink animate-pulse-live" />
            <span className="text-[10px] font-display font-bold uppercase tracking-widest">Live Trivia</span>
          </div>
          {state && (
            <div className="px-3 py-1.5 rounded-full bg-background/40 backdrop-blur-md border border-border/40 text-[10px] font-mono text-muted-foreground">
              {state.progress.played}/{state.progress.total}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="absolute inset-0 pt-16 pb-5 px-5 flex flex-col">
          {error ? (
            <div className="flex-1 flex items-center justify-center text-center">
              <div className="space-y-2">
                <p className="text-sm text-tiktok-pink font-display">Overlay unavailable</p>
                <p className="text-xs text-muted-foreground">{error}</p>
              </div>
            </div>
          ) : !state ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-tiktok-cyan border-t-transparent animate-spin" />
            </div>
          ) : showLeaderboardOnly ? (
            <FinalLeaderboard scores={state.scores} />
          ) : !round || !round.question ? (
            <WaitingScreen />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={round.id}
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="flex-1 flex flex-col"
              >
                {/* Category + timer */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    {round.question.category}
                  </span>
                  {round.status === "live" && (
                    <div className="flex items-center gap-1.5 text-tiktok-cyan">
                      <Clock className="w-3 h-3" />
                      <span className="text-lg font-display font-bold tabular-nums">{remaining}</span>
                    </div>
                  )}
                </div>

                {/* Timer bar */}
                {round.status === "live" && (
                  <div className="h-1 bg-muted/40 rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full bg-gradient-to-r from-tiktok-cyan to-tiktok-pink transition-[width] duration-300 ease-linear"
                      style={{ width: `${timerPct}%` }}
                    />
                  </div>
                )}

                {/* Question */}
                <div className="bg-background/40 backdrop-blur-md rounded-2xl p-4 mb-3 border border-border/30">
                  <p className="text-base font-display font-semibold leading-snug">
                    {round.question.text}
                  </p>
                </div>

                {/* Choices */}
                <div className="space-y-2 flex-1">
                  {round.question.choices.map((c, idx) => {
                    const isCorrect =
                      round.status === "resolved" && c.key === round.question!.correct_choice;
                    const isWrong =
                      round.status === "resolved" && c.key !== round.question!.correct_choice;
                    return (
                      <motion.div
                        key={c.key}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * idx }}
                        className={[
                          "rounded-xl p-3 border transition-all flex items-center gap-3",
                          isCorrect
                            ? "border-tiktok-cyan bg-tiktok-cyan/15 glow-cyan"
                            : isWrong
                            ? "border-border/30 bg-muted/10 opacity-50"
                            : "border-border/40 bg-background/40 backdrop-blur-md",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "w-9 h-9 rounded-lg flex items-center justify-center font-display font-bold text-base shrink-0",
                            isCorrect
                              ? "bg-tiktok-cyan text-background"
                              : "bg-muted/40 text-foreground",
                          ].join(" ")}
                        >
                          {c.key}
                        </span>
                        <span className="text-sm leading-snug">{c.text}</span>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Reveal banner */}
                {round.status === "resolved" && round.question.correct_choice && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 text-center py-2 rounded-xl bg-tiktok-cyan/15 border border-tiktok-cyan/40"
                  >
                    <span className="text-xs font-display font-bold uppercase tracking-widest text-tiktok-cyan">
                      Answer · {round.question.correct_choice}
                    </span>
                  </motion.div>
                )}

                {/* Mini leaderboard */}
                <MiniLeaderboard scores={state.scores} />
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Footer prompt */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-3">
          <div className="text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
            Type A · B · C · D in chat
          </div>
        </div>
      </div>
    </div>
  );
};

const MiniLeaderboard = ({ scores }: { scores: OverlayState["scores"] }) => {
  if (!scores || scores.length === 0) return null;
  const top = scores.slice(0, 3);
  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center gap-1.5 px-1">
        <Trophy className="w-3 h-3 text-tiktok-pink" />
        <span className="text-[10px] font-display font-bold uppercase tracking-widest text-muted-foreground">
          Top
        </span>
      </div>
      {top.map((s, i) => (
        <div
          key={s.id}
          className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-background/40 backdrop-blur-md border border-border/30"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`text-[10px] font-mono w-4 text-center ${
                i === 0 ? "text-tiktok-pink" : "text-muted-foreground"
              }`}
            >
              #{i + 1}
            </span>
            <span className="text-xs truncate">{s.viewer_display_name || s.viewer_handle}</span>
          </div>
          <span className="text-xs font-display font-bold text-tiktok-cyan tabular-nums">
            {s.score}
          </span>
        </div>
      ))}
    </div>
  );
};

const WaitingScreen = () => (
  <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
    <motion.div
      animate={{ scale: [1, 1.1, 1] }}
      transition={{ duration: 2, repeat: Infinity }}
      className="w-20 h-20 rounded-2xl bg-gradient-to-br from-tiktok-cyan/30 to-tiktok-pink/30 flex items-center justify-center border border-border/40"
    >
      <Radio className="w-8 h-8 text-tiktok-cyan" />
    </motion.div>
    <div className="space-y-1">
      <p className="text-lg font-display font-bold">Get Ready</p>
      <p className="text-xs text-muted-foreground">Next question loading…</p>
    </div>
  </div>
);

const FinalLeaderboard = ({ scores }: { scores: OverlayState["scores"] }) => (
  <div className="flex-1 flex flex-col items-center pt-4">
    <motion.div
      initial={{ scale: 0, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      className="w-16 h-16 rounded-2xl bg-gradient-to-br from-tiktok-pink/30 to-tiktok-cyan/30 flex items-center justify-center border border-border/40 mb-3"
    >
      <Trophy className="w-7 h-7 text-tiktok-pink" />
    </motion.div>
    <p className="text-xl font-display font-bold mb-1">Final Standings</p>
    <p className="text-xs text-muted-foreground mb-5">Thanks for playing!</p>
    <div className="w-full space-y-2">
      {scores.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground">No scores yet</p>
      ) : (
        scores.slice(0, 8).map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 * i }}
            className={[
              "flex items-center justify-between px-3 py-2.5 rounded-xl backdrop-blur-md border",
              i === 0
                ? "bg-tiktok-pink/15 border-tiktok-pink/40 glow-pink"
                : i === 1
                ? "bg-tiktok-cyan/10 border-tiktok-cyan/30"
                : "bg-background/40 border-border/30",
            ].join(" ")}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`text-sm font-display font-bold w-6 text-center ${
                  i === 0
                    ? "text-tiktok-pink"
                    : i === 1
                    ? "text-tiktok-cyan"
                    : "text-muted-foreground"
                }`}
              >
                #{i + 1}
              </span>
              <span className="text-sm truncate">{s.viewer_display_name || s.viewer_handle}</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs">
              <span className="font-mono text-muted-foreground">
                {s.correct_count}/{s.answer_count}
              </span>
              <span className="font-display font-bold text-tiktok-cyan tabular-nums text-base">
                {s.score}
              </span>
            </div>
          </motion.div>
        ))
      )}
    </div>
  </div>
);

export default Overlay;
