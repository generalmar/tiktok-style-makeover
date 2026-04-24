import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface Choice { key: string; text: string }

interface Props {
  roundId: string | null;
  choices: Choice[];
  correctChoice?: string | null;
  showCorrect?: boolean;
}

const KEY_STYLES: Record<string, string> = {
  A: "bg-tiktok-cyan text-background",
  B: "bg-[hsl(280_85%_60%)] text-background",
  C: "bg-tiktok-pink text-background",
  D: "bg-[hsl(150_70%_55%)] text-background",
};

const BAR_FILL: Record<string, string> = {
  A: "bg-tiktok-cyan/70",
  B: "bg-[hsl(280_85%_60%)]/70",
  C: "bg-tiktok-pink/70",
  D: "bg-[hsl(150_70%_55%)]/70",
};

const AnswerDistribution = ({ roundId, choices, correctChoice, showCorrect }: Props) => {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    setCounts({});
    if (!roundId) return;

    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from("answers")
        .select("choice")
        .eq("round_id", roundId);
      if (!alive) return;
      const next: Record<string, number> = {};
      (data || []).forEach((a: { choice: string }) => {
        next[a.choice] = (next[a.choice] || 0) + 1;
      });
      setCounts(next);
    };
    load();

    const ch = supabase
      .channel(`answers:${roundId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "answers", filter: `round_id=eq.${roundId}` },
        (payload) => {
          const choice = (payload.new as { choice?: string })?.choice;
          if (!choice) return;
          setCounts((prev) => ({ ...prev, [choice]: (prev[choice] || 0) + 1 }));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "answers", filter: `round_id=eq.${roundId}` },
        () => { load(); },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [roundId]);

  const total = useMemo(
    () => Object.values(counts).reduce((a, b) => a + b, 0),
    [counts],
  );

  return (
    <div className="glass rounded-2xl p-6 w-full max-w-2xl space-y-3">
      <h3 className="font-display font-bold text-sm uppercase tracking-wider">
        Answer Distribution
      </h3>
      <div className="space-y-2">
        {choices.map((c) => {
          const count = counts[c.key] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isCorrect = showCorrect && correctChoice === c.key;
          return (
            <div key={c.key} className="flex items-center gap-3">
              <span
                className={`w-9 h-9 rounded-md flex items-center justify-center font-display font-bold text-sm shrink-0 ${
                  KEY_STYLES[c.key] ?? "bg-muted text-foreground"
                }`}
              >
                {c.key}
              </span>
              <div
                className={`relative flex-1 h-9 rounded-md overflow-hidden bg-muted/20 border ${
                  isCorrect ? "border-tiktok-cyan/60" : "border-border/30"
                }`}
              >
                <motion.div
                  className={`absolute inset-y-0 left-0 ${BAR_FILL[c.key] ?? "bg-muted-foreground/40"}`}
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
                <div className="relative h-full flex items-center px-3 text-sm font-mono tabular-nums">
                  {pct}%
                </div>
              </div>
              <span className="w-8 text-right text-xs font-mono tabular-nums text-muted-foreground">
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AnswerDistribution;
