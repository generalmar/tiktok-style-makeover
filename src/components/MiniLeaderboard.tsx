import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Crown, Medal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Score = Database["public"]["Tables"]["session_scores"]["Row"];
type Answer = Database["public"]["Tables"]["answers"]["Row"];

interface Props {
  sessionId: string | null;
  /** Live round ID for provisional scoring */
  roundId: string | null;
  /** The correct choice for the live round (operator-side). Used to provisionally award points before scoring. */
  correctChoice: string | null;
  /** Round status — only score provisionally while live */
  roundStatus: string | null;
  /** Points awarded per correct answer (matches edge function default = 100) */
  pointsPerCorrect?: number;
}

interface Row {
  handle: string;
  display: string;
  score: number;
  provisional: boolean;
}

const MiniLeaderboard = ({
  sessionId, roundId, correctChoice, roundStatus, pointsPerCorrect = 100,
}: Props) => {
  const [scores, setScores] = useState<Score[]>([]);
  const [liveAnswers, setLiveAnswers] = useState<Answer[]>([]);

  // Persisted scores
  useEffect(() => {
    if (!sessionId) { setScores([]); return; }
    const load = async () => {
      const { data } = await supabase.from("session_scores").select("*")
        .eq("session_id", sessionId).order("score", { ascending: false });
      setScores(data || []);
    };
    load();
    const ch = supabase.channel(`mini-scores:${sessionId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "session_scores", filter: `session_id=eq.${sessionId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  // Live (unscored) answers for current round
  useEffect(() => {
    if (!roundId) { setLiveAnswers([]); return; }
    const load = async () => {
      const { data } = await supabase.from("answers").select("*").eq("round_id", roundId);
      setLiveAnswers(data || []);
    };
    load();
    const ch = supabase.channel(`mini-answers:${roundId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "answers", filter: `round_id=eq.${roundId}` },
        (p) => setLiveAnswers((cur) => {
          const a = p.new as Answer;
          if (cur.find((x) => x.id === a.id)) return cur;
          return [...cur, a];
        }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roundId]);

  const top: Row[] = useMemo(() => {
    const map = new Map<string, Row>();
    for (const s of scores) {
      map.set(s.viewer_handle, {
        handle: s.viewer_handle,
        display: s.viewer_display_name || s.viewer_handle,
        score: s.score,
        provisional: false,
      });
    }
    // Add provisional points for live correct answers (only while round is live and not yet scored)
    if (roundStatus === "live" && correctChoice) {
      for (const a of liveAnswers) {
        // round_control resolves and then writes is_correct + score; before then is_correct is null
        if (a.is_correct !== null) continue;
        if (a.choice !== correctChoice) continue;
        const existing = map.get(a.viewer_handle);
        if (existing) {
          existing.score += pointsPerCorrect;
          existing.provisional = true;
        } else {
          map.set(a.viewer_handle, {
            handle: a.viewer_handle,
            display: a.viewer_display_name || a.viewer_handle,
            score: pointsPerCorrect,
            provisional: true,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.score - a.score).slice(0, 3);
  }, [scores, liveAnswers, roundStatus, correctChoice, pointsPerCorrect]);

  if (!sessionId) return null;

  const rankIcon = (i: number) => {
    if (i === 0) return <Crown className="w-3.5 h-3.5 text-tiktok-pink" />;
    if (i === 1) return <Medal className="w-3.5 h-3.5 text-tiktok-cyan" />;
    return <Trophy className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  return (
    <div className="glass rounded-2xl p-4 w-full max-w-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-tiktok-pink" />
          <h3 className="font-display font-bold text-xs uppercase tracking-wider">Top 3 — Live</h3>
        </div>
        {roundStatus === "live" && (
          <span className="text-[10px] uppercase tracking-wider text-tiktok-pink font-mono animate-pulse">
            • Updating
          </span>
        )}
      </div>
      {top.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">
          Waiting for the first answers…
        </p>
      ) : (
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {top.map((r, i) => (
              <motion.div
                key={r.handle}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
                className={`flex items-center justify-between p-2.5 rounded-lg border ${
                  i === 0
                    ? "border-tiktok-pink/40 bg-tiktok-pink/5"
                    : "border-border/30 bg-muted/20"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xs font-mono w-5 text-center text-muted-foreground">
                    #{i + 1}
                  </span>
                  {rankIcon(i)}
                  <span className="text-sm truncate">{r.display}</span>
                </div>
                <motion.span
                  key={r.score}
                  initial={{ scale: 1.25, color: "hsl(var(--tiktok-cyan))" }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`font-display font-bold text-sm tabular-nums ${
                    r.provisional ? "text-tiktok-cyan" : "text-foreground"
                  }`}
                >
                  {r.score}
                </motion.span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default MiniLeaderboard;
