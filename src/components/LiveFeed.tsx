import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, Radio, Plug, PlugZap, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type Round = Database["public"]["Tables"]["rounds"]["Row"];
type Answer = Database["public"]["Tables"]["answers"]["Row"];

interface TikTokConnection {
  id: string;
  session_id: string;
  tiktok_username: string;
  status: "connecting" | "connected" | "disconnected" | "error";
  last_error: string | null;
  last_event_at: string | null;
}

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
  const [tiktokUsername, setTiktokUsername] = useState("");
  const [connection, setConnection] = useState<TikTokConnection | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);

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

  // Live TikTok connection status (per session).
  useEffect(() => {
    if (!sessionId) { setConnection(null); return; }
    const load = async () => {
      const { data } = await (supabase.from("tiktok_connections" as any).select("*") as any)
        .eq("session_id", sessionId).maybeSingle();
      setConnection((data as TikTokConnection) ?? null);
      if (data?.tiktok_username && !tiktokUsername) setTiktokUsername(data.tiktok_username);
    };
    load();
    const ch = supabase.channel(`tiktok-conn:${sessionId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "tiktok_connections", filter: `session_id=eq.${sessionId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const connectTikTok = async () => {
    if (!sessionId) { toast.error("Start a session first"); return; }
    const u = tiktokUsername.trim().replace(/^@/, "");
    if (!u) { toast.error("Enter a TikTok username"); return; }
    setConnectBusy(true);
    const { data, error } = await supabase.functions.invoke("tiktok-chat", {
      body: { action: "connect", session_id: sessionId, tiktok_username: u },
    });
    setConnectBusy(false);
    if (error || (data as any)?.ok === false) {
      toast.error(error?.message || (data as any)?.error || "Failed to connect");
      return;
    }
    toast.success(`Connecting to @${u}…`);
  };

  const disconnectTikTok = async () => {
    if (!sessionId) return;
    setConnectBusy(true);
    const { error } = await supabase.functions.invoke("tiktok-chat", {
      body: { action: "disconnect", session_id: sessionId },
    });
    setConnectBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Disconnected from TikTok");
  };

  const status = connection?.status ?? "idle";
  const statusMeta = useMemo(() => {
    switch (status) {
      case "connected":
        return { dot: "bg-tiktok-cyan animate-pulse-live", label: "Connected", color: "text-tiktok-cyan" };
      case "connecting":
        return { dot: "bg-tiktok-pink animate-pulse-live", label: "Connecting…", color: "text-tiktok-pink" };
      case "error":
        return { dot: "bg-tiktok-pink", label: "Error", color: "text-tiktok-pink" };
      case "disconnected":
        return { dot: "bg-muted-foreground", label: "Disconnected", color: "text-muted-foreground" };
      default:
        return { dot: "bg-muted-foreground", label: "Not connected", color: "text-muted-foreground" };
    }
  }, [status]);

  // Only fully-connected locks the input. While "connecting" we still show the
  // Disconnect button (so the operator can cancel) but keep the field editable
  // so they can fix a typo and reconnect without being stuck.
  const isLiveConn = status === "connected" || status === "connecting";
  const lockInput = status === "connected";

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

      {/* TikTok connection */}
      <div className="p-4 border-b border-border/30 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Radio className="w-3 h-3" /> TikTok LIVE chat
          </div>
          <div className={`flex items-center gap-1.5 text-[10px] font-display font-bold uppercase tracking-widest ${statusMeta.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
            {statusMeta.label}
          </div>
        </div>

        <div className="flex gap-1.5">
          <Input
            value={tiktokUsername}
            onChange={(e) => setTiktokUsername(e.target.value)}
            placeholder="@username"
            className="h-8 text-xs"
            disabled={isLiveConn}
          />
          {isLiveConn ? (
            <Button
              type="button" size="sm" variant="glass"
              className="h-8 px-2 gap-1"
              onClick={disconnectTikTok}
              disabled={connectBusy || !sessionId}
            >
              {connectBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plug className="w-3 h-3" />}
              <span className="text-xs">Disconnect</span>
            </Button>
          ) : (
            <Button
              type="button" size="sm" variant="cyan"
              className="h-8 px-2 gap-1"
              onClick={connectTikTok}
              disabled={connectBusy || !sessionId || !tiktokUsername.trim()}
            >
              {connectBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlugZap className="w-3 h-3" />}
              <span className="text-xs">Connect</span>
            </Button>
          )}
        </div>

        {!sessionId && (
          <p className="text-[10px] text-muted-foreground/80">
            Create a session first, then connect TikTok chat to ingest answers.
          </p>
        )}
        {connection?.last_error && status === "error" && (
          <p className="text-[10px] text-tiktok-pink flex items-start gap-1">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="break-words">{connection.last_error}</span>
          </p>
        )}

        {/* Hidden dev fallback — chat simulator */}
        <button
          type="button"
          onClick={() => setShowSimulator((s) => !s)}
          className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground underline-offset-2 hover:underline"
        >
          {showSimulator ? "Hide" : "Show"} dev simulator
        </button>
        {showSimulator && (
          <div className="space-y-2 pt-1">
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
        )}
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
