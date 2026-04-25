import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Play, RotateCcw, SkipForward, Square, Copy, Loader2, Trophy, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import AnswerDistribution from "./AnswerDistribution";
import MiniLeaderboard from "./MiniLeaderboard";
import { useAccount } from "@/contexts/AccountContext";

type Session = Database["public"]["Tables"]["sessions"]["Row"];
type Round = Database["public"]["Tables"]["rounds"]["Row"];
type Question = Database["public"]["Tables"]["questions"]["Row"];
type Score = Database["public"]["Tables"]["session_scores"]["Row"];
type SessionQueueItem = Pick<Database["public"]["Tables"]["session_questions"]["Row"], "question_id" | "position" | "played">;

interface Props {
  selectedIds: Set<string>;
  onClearSelection: () => void;
  onActiveQuestionChange?: (questionId: string | null) => void;
}

const GameStage = ({ selectedIds, onClearSelection, onActiveQuestionChange }: Props) => {
  const { currentAccount } = useAccount();
  const [session, setSession] = useState<Session | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [now, setNow] = useState<number>(Date.now());
  const [duration, setDuration] = useState(25);
  const [busy, setBusy] = useState(false);
  const [sessionQueue, setSessionQueue] = useState<SessionQueueItem[]>([]);
  const [playedIds, setPlayedIds] = useState<Set<string>>(new Set());
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [revealAnswer, setRevealAnswer] = useState(false);
  const autoAdvanceTimer = useRef<number | null>(null);
  const lastAdvancedRound = useRef<string | null>(null);

  // Tick every second for countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Load active session (most recent non-finished)
  const loadSession = async () => {
    const { data } = await supabase.from("sessions").select("*")
      .neq("status", "finished")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    setSession(data || null);
    if (data) {
      setDuration(data.question_duration_seconds);
      setAutoAdvance((data as any).auto_advance ?? true);
    }
  };

  useEffect(() => { loadSession(); }, []);

  const loadRoundForSession = async (sessionId: string) => {
    const { data: r } = await supabase.from("rounds").select("*")
      .eq("session_id", sessionId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    setRound(r || null);
    if (r) {
      const { data: q } = await supabase.from("questions").select("*").eq("id", r.question_id).maybeSingle();
      setCurrentQuestion(q || null);
    } else {
      setCurrentQuestion(null);
    }
  };

  const loadScoresForSession = async (sessionId: string) => {
    const { data } = await supabase.from("session_scores").select("*")
      .eq("session_id", sessionId).order("score", { ascending: false }).limit(20);
    setScores(data || []);
  };

  const loadQueueForSession = async (sessionId: string) => {
    const { data, error } = await supabase.from("session_questions")
      .select("question_id, position, played")
      .eq("session_id", sessionId)
      .order("position");
    if (error) {
      toast.error(error.message);
      return;
    }
    const queue = (data || []) as SessionQueueItem[];
    setSessionQueue(queue);
    setPlayedIds(new Set(queue.filter((item) => item.played).map((item) => item.question_id)));
  };

  // Subscribe to session updates + load rounds/scores
  useEffect(() => {
    if (!session) { setRound(null); setCurrentQuestion(null); setScores([]); setSessionQueue([]); setPlayedIds(new Set()); return; }

    loadRoundForSession(session.id);
    loadScoresForSession(session.id);
    loadQueueForSession(session.id);

    const ch = supabase.channel(`session:${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rounds", filter: `session_id=eq.${session.id}` },
        () => { loadRoundForSession(session.id); loadQueueForSession(session.id); })
      .on("postgres_changes", { event: "*", schema: "public", table: "session_questions", filter: `session_id=eq.${session.id}` },
        () => loadQueueForSession(session.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "session_scores", filter: `session_id=eq.${session.id}` },
        () => loadScoresForSession(session.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `id=eq.${session.id}` },
        (payload) => setSession(payload.new as Session))
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [session?.id]);

  const remaining = useMemo(() => {
    if (!round || !round.closes_at || round.status !== "live") return 0;
    return Math.max(0, Math.ceil((new Date(round.closes_at).getTime() - now) / 1000));
  }, [round, now]);

  const totalQuestions = sessionQueue.length;
  const hasNextQuestion = sessionQueue.some((item) => !item.played);

  useEffect(() => {
    onActiveQuestionChange?.(round?.status !== "resolved" ? currentQuestion?.id ?? null : null);
  }, [round?.status, currentQuestion?.id, onActiveQuestionChange]);

  // Auto-resolve when timer hits 0
  useEffect(() => {
    if (round?.status === "live" && remaining === 0 && round.closes_at) {
      // only fire once
      handleResolve(round.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, round?.status]);

  // Hide reveal-answer when round changes
  useEffect(() => { setRevealAnswer(false); }, [round?.id]);

  const createSession = async () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one question first");
      return;
    }
    setBusy(true);
    const { data: s, error } = await supabase.from("sessions").insert({
      name: `Session ${new Date().toLocaleString()}`,
      question_duration_seconds: duration,
      auto_advance: autoAdvance,
    } as any).select().single();
    if (error || !s) { setBusy(false); toast.error(error?.message || "Failed"); return; }
    const rows = Array.from(selectedIds).map((qid, i) => ({
      session_id: s.id, question_id: qid, position: i,
    }));
    const { error: e2 } = await supabase.from("session_questions").insert(rows);
    if (e2) { toast.error(e2.message); setBusy(false); return; }
    setSession(s);
    onClearSelection();
    toast.success("Session created — start the first round");
    setBusy(false);
  };

  const startNextRound = async () => {
    if (!session) return;
    setBusy(true);
    // Re-read played state from DB to avoid stale local state
    const { data: sq } = await supabase.from("session_questions")
      .select("question_id, position, played")
      .eq("session_id", session.id).order("position");
    const next = (sq || []).find((s: any) => !s.played);
    if (!next) {
      setBusy(false);
      toast.message("All questions played. Ending session...");
      await endSession();
      return;
    }
    const { error } = await supabase.functions.invoke("round-control", {
      body: { action: "start", session_id: session.id, question_id: next.question_id },
    });
    await Promise.all([
      loadRoundForSession(session.id),
      loadQueueForSession(session.id),
    ]);
    setBusy(false);
    if (error) toast.error(error.message);
  };

  const handleResolve = async (roundId: string) => {
    setBusy(true);
    const { error } = await supabase.functions.invoke("round-control", {
      body: { action: "resolve", session_id: session!.id, round_id: roundId },
    });
    await Promise.all([
      loadRoundForSession(session!.id),
      loadQueueForSession(session!.id),
      loadScoresForSession(session!.id),
    ]);
    setBusy(false);
    if (error) toast.error(error.message);
  };

  const endSession = async () => {
    if (!session) return;
    setBusy(true);
    const { error } = await supabase.from("sessions").update({
      status: "finished", finished_at: new Date().toISOString(),
    }).eq("id", session.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    // Broadcast to overlay
    const ch = supabase.channel(`overlay:${session.overlay_token}`);
    await new Promise<void>((resolve) => {
      ch.subscribe((status) => { if (status === "SUBSCRIBED") resolve(); });
      setTimeout(resolve, 1000);
    });
    await ch.send({ type: "broadcast", event: "session_changed", payload: { action: "end" } });
    await supabase.removeChannel(ch);
    toast.success("Session ended");
    setSession(null);
  };

  const updateDuration = async (v: number) => {
    setDuration(v);
    if (!session) return;
    await supabase.from("sessions").update({ question_duration_seconds: v }).eq("id", session.id);
  };

  const updateAutoAdvance = async (v: boolean) => {
    setAutoAdvance(v);
    if (!session) return;
    await supabase.from("sessions").update({ auto_advance: v } as any).eq("id", session.id);
  };

  // Auto-advance to next question after a round resolves, or auto-end if exhausted
  useEffect(() => {
    if (autoAdvanceTimer.current) {
      window.clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    if (!session || !round || round.status !== "resolved") return;
    if (lastAdvancedRound.current === round.id) return;
    lastAdvancedRound.current = round.id;

    if (!hasNextQuestion) {
      // All questions played — auto-end the session after a short delay
      autoAdvanceTimer.current = window.setTimeout(() => {
        endSession();
        toast.success("All questions played — session ended");
      }, 4000);
    } else if (autoAdvance) {
      autoAdvanceTimer.current = window.setTimeout(() => {
        startNextRound();
      }, 3000);
    }
    return () => {
      if (autoAdvanceTimer.current) {
        window.clearTimeout(autoAdvanceTimer.current);
        autoAdvanceTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.id, round?.status, autoAdvance, session?.id, hasNextQuestion]);

  const copyOverlayLink = () => {
    if (!session) return;
    const url = `${window.location.origin}/overlay/${session.overlay_token}`;
    navigator.clipboard.writeText(url);
    toast.success("Overlay link copied");
  };

  const status = round?.status === "live" ? "live"
    : session?.status === "active" ? "active" : "idle";

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Status bar */}
      <div className="px-6 py-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${
            status === "live" ? "bg-tiktok-pink animate-pulse-live" :
            status === "active" ? "bg-tiktok-cyan animate-pulse-live" :
            "bg-muted-foreground animate-breathe"
          }`} />
          <span className="text-xs font-display font-semibold uppercase tracking-widest text-muted-foreground">{status}</span>
          {session && (
            <span className="text-xs text-muted-foreground">
              · {playedIds.size}/{totalQuestions} played
            </span>
          )}
        </div>
        {session && (
          <Button variant="glass" size="sm" className="gap-1.5 h-7" onClick={copyOverlayLink}>
            <Copy className="w-3 h-3" /> <span className="text-xs">Overlay link</span>
          </Button>
        )}
      </div>

      {/* Main stage */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-start gap-6">
        {!session ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-10 max-w-lg w-full text-center space-y-6 mt-12">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <Play className="w-7 h-7 text-primary" />
            </div>
            <div className="space-y-2">
              <p className="text-foreground font-display text-lg">Start a new session</p>
              <p className="text-muted-foreground text-sm">
                Select questions from the bank, set the timer, then create the session.
              </p>
            </div>
            <div className="space-y-3 text-left">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Timer per question</Label>
                <span className="text-sm font-mono">{duration}s</span>
              </div>
              <Slider value={[duration]} min={10} max={60} step={5}
                onValueChange={(v) => setDuration(v[0])} />
              <div className="flex items-center justify-between pt-2">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Auto-advance</Label>
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                    Automatically start the next question after each round resolves.
                  </p>
                </div>
                <Switch checked={autoAdvance} onCheckedChange={setAutoAdvance} />
              </div>
            </div>
            <Button variant="cyan" size="lg" className="rounded-full px-8 w-full" onClick={createSession} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : `Create session (${selectedIds.size} questions)`}
            </Button>
          </motion.div>
        ) : (
          <>
            {round && currentQuestion ? (
              <motion.div key={round.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="glass rounded-2xl p-8 w-full max-w-2xl space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                    Round · {round.status}
                  </span>
                  {round.status === "live" && (
                    <div className="text-3xl font-display font-bold text-tiktok-cyan tabular-nums">
                      {remaining}s
                    </div>
                  )}
                </div>

                {round.status === "live" && (
                  <div className="h-1 bg-muted/40 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-tiktok-cyan to-tiktok-pink transition-all duration-500"
                      style={{ width: `${Math.max(0, (remaining / round.duration_seconds) * 100)}%` }} />
                  </div>
                )}

                <p className="text-2xl font-display font-semibold leading-snug">{currentQuestion.text}</p>

                <div className="grid grid-cols-2 gap-3">
                  {(currentQuestion.choices as any[]).map((c) => {
                    const isResolvedCorrect = round.status === "resolved" && c.key === currentQuestion.correct_choice;
                    const isLiveCorrect = round.status === "live" && revealAnswer && c.key === currentQuestion.correct_choice;
                    return (
                      <div key={c.key}
                        className={`p-4 rounded-xl border transition-all ${
                          isResolvedCorrect ? "border-tiktok-cyan bg-tiktok-cyan/10 glow-cyan"
                            : isLiveCorrect ? "border-tiktok-cyan/60 bg-tiktok-cyan/5 border-dashed"
                            : "border-border/40 bg-muted/20"
                        }`}>
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-md bg-background/60 flex items-center justify-center font-display font-bold text-sm">
                            {c.key}
                          </span>
                          <span className="text-sm">{c.text}</span>
                          {isLiveCorrect && (
                            <span className="ml-auto text-[9px] uppercase tracking-wider text-tiktok-cyan font-display">Correct</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {round.status === "live" && (
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setRevealAnswer((v) => !v)}
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-tiktok-cyan transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      {revealAnswer ? "Hide answer" : "Reveal answer (operator only)"}
                    </button>
                    {revealAnswer && (
                      <span className="text-[11px] text-tiktok-cyan font-mono">
                        Answer: <span className="font-bold">{currentQuestion.correct_choice}</span>
                      </span>
                    )}
                  </div>
                )}

                {round.status === "resolved" && (
                  <p className="text-center text-sm text-tiktok-cyan">
                    Correct answer: <span className="font-bold">{currentQuestion.correct_choice}</span>
                  </p>
                )}
              </motion.div>
            ) : (
              <div className="glass rounded-2xl p-8 w-full max-w-2xl text-center space-y-3">
                <p className="text-muted-foreground text-sm">No round active. Start the next question.</p>
              </div>
            )}

            {/* Live answer distribution */}
            {round && currentQuestion && (
              <AnswerDistribution
                roundId={round.id}
                choices={currentQuestion.choices as any}
                correctChoice={currentQuestion.correct_choice}
                showCorrect={round.status === "resolved" || revealAnswer}
              />
            )}

            {/* Leaderboard */}
            <div className="glass rounded-2xl p-6 w-full max-w-2xl space-y-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-tiktok-pink" />
                <h3 className="font-display font-bold text-sm uppercase tracking-wider">Leaderboard</h3>
              </div>
              {scores.length === 0 ? (
                <p className="text-xs text-muted-foreground">No scores yet</p>
              ) : (
                <div className="space-y-1.5">
                  {scores.slice(0, 10).map((s, i) => (
                    <div key={s.id} className="flex items-center justify-between p-2 rounded-md bg-muted/20">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-mono w-5 text-center ${i === 0 ? "text-tiktok-pink" : "text-muted-foreground"}`}>#{i + 1}</span>
                        <span className="text-sm">{s.viewer_display_name || s.viewer_handle}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground font-mono">{s.correct_count}/{s.answer_count}</span>
                        <span className="font-display font-bold text-tiktok-cyan">{s.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer controls */}
      <div className="px-6 py-3 border-t border-border/30 flex items-center justify-between gap-2">
        {session ? (
          <>
            <div className="flex items-center gap-2">
              <Button variant="cyan" size="sm" className="rounded-full gap-2"
                onClick={startNextRound}
                disabled={busy || round?.status === "live" || (!hasNextQuestion && round?.status === "resolved")}>
                <SkipForward className="w-3.5 h-3.5" />
                {round && round.status !== "resolved" ? "Next question" : "Start next"}
              </Button>
              {round?.status === "live" && (
                <Button variant="glass" size="sm" className="rounded-full gap-2"
                  onClick={() => handleResolve(round.id)} disabled={busy}>
                  <Square className="w-3.5 h-3.5" /> Close & score
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Auto</span>
                <Switch checked={autoAdvance} onCheckedChange={updateAutoAdvance} />
              </div>
              <div className="flex items-center gap-2 min-w-[180px]">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Timer</span>
                <Slider value={[duration]} min={10} max={60} step={5}
                  onValueChange={(v) => updateDuration(v[0])} className="w-24" />
                <span className="text-xs font-mono w-8">{duration}s</span>
              </div>
              <Button variant="pink" size="sm" className="rounded-full gap-2" onClick={endSession} disabled={busy}>
                <RotateCcw className="w-3.5 h-3.5" /> End session
              </Button>
            </div>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Select questions, then create a session.</span>
        )}
      </div>
    </div>
  );
};

export default GameStage;
