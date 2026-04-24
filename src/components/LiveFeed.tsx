import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type Round = Database["public"]["Tables"]["rounds"]["Row"];
type Answer = Database["public"]["Tables"]["answers"]["Row"];

interface Props {
  sessionId: string | null;
}

const FAKE_NAMES = ["lily_07", "tikfan", "scarlet", "ramen.king", "blu3moon", "Jay", "noodle_x", "kitty.42", "z3ro", "mango"];

const LiveFeed = ({ sessionId }: Props) => {
  const [round, setRound] = useState<Round | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [handle, setHandle] = useState("tester");
  const [text, setText] = useState("");
  const [autoBusy, setAutoBusy] = useState(false);

  useEffect(() => {
    if (!sessionId) { setRound(null); setAnswers([]); return; }
    const loadRound = async () => {
      const { data } = await supabase.from("rounds").select("*")
        .eq("session_id", sessionId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      setRound(data || null);
      if (data) {
        const { data: ans } = await supabase.from("answers").select("*")
          .eq("round_id", data.id).order("created_at", { ascending: false });
        setAnswers(ans || []);
      } else {
        setAnswers([]);
      }
    };
    loadRound();

    const ch = supabase.channel(`feed:${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rounds", filter: `session_id=eq.${sessionId}` },
        () => loadRound())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "answers", filter: `session_id=eq.${sessionId}` },
        (p) => setAnswers((cur) => {
          const a = p.new as Answer;
          if (cur.find((x) => x.id === a.id)) return cur;
          return [a, ...cur];
        }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  const submit = async (h: string, t: string) => {
    if (!round || round.status !== "live") {
      toast.error("No live round");
      return;
    }
    const { data, error } = await supabase.functions.invoke("submit-answer", {
      body: { round_id: round.id, viewer_handle: h, viewer_display_name: h, raw_text: t },
    });
    if (error) toast.error(error.message);
    else if ((data as any)?.ok === false && (data as any)?.reason !== "already_answered") {
      // silent for invalid; toast for debug
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim() || !text.trim()) return;
    await submit(handle.trim(), text.trim());
    setText("");
  };

  const simulateBatch = async () => {
    if (!round || round.status !== "live") { toast.error("Start a round first"); return; }
    setAutoBusy(true);
    for (const name of FAKE_NAMES) {
      const choice = ["A", "B", "C", "D"][Math.floor(Math.random() * 4)];
      await submit(name, choice);
      await new Promise((r) => setTimeout(r, 80));
    }
    setAutoBusy(false);
  };

  return (
    <div className="w-80 border-l border-border/50 bg-card/40 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-border/30">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${round?.status === "live" ? "bg-tiktok-pink animate-pulse-live" : "bg-muted-foreground"}`} />
          <h2 className="font-display font-bold text-sm uppercase tracking-wider">Live Feed</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {round?.status === "live" ? "Round is open — A/B/C/D" : "Waiting for round"}
        </p>
      </div>

      {/* Simulator */}
      <div className="p-4 border-b border-border/30 space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Chat simulator</div>
        <form onSubmit={handleSend} className="space-y-2">
          <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@viewer" className="h-8 text-xs" />
          <div className="flex gap-1.5">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type A, B, C or D" className="h-8 text-xs" />
            <Button type="submit" size="sm" variant="cyan" className="h-8 px-2"><Send className="w-3 h-3" /></Button>
          </div>
        </form>
        <Button type="button" variant="glass" size="sm" className="w-full h-8 gap-1.5" onClick={simulateBatch} disabled={autoBusy}>
          <Bot className="w-3 h-3" /> <span className="text-xs">Simulate 10 viewers</span>
        </Button>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        <AnimatePresence initial={false}>
          {answers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center p-4">No answers yet</p>
          ) : answers.map((a) => (
            <motion.div key={a.id}
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-2 rounded-md bg-muted/20 text-xs">
              <span className="truncate">{a.viewer_display_name || a.viewer_handle}</span>
              <span className={`font-display font-bold ${
                a.is_correct === true ? "text-tiktok-cyan" :
                a.is_correct === false ? "text-tiktok-pink" :
                "text-foreground"
              }`}>{a.choice}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="px-4 py-3 border-t border-border/30 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground font-mono">{answers.length} answers</span>
      </div>
    </div>
  );
};

export default LiveFeed;
