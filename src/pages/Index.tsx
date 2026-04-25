import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";
import QuestionBank from "@/components/QuestionBank";
import GameStage from "@/components/GameStage";
import LiveFeed from "@/components/LiveFeed";
import QuestionGeneratorModal from "@/components/QuestionGeneratorModal";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/contexts/AccountContext";

const Index = () => {
  const { currentAccount } = useAccount();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [aiOpen, setAiOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Trivia Live · Operator";
  }, []);

  // Reset selection when switching accounts
  useEffect(() => {
    setSelectedIds(new Set());
    setActiveQuestionId(null);
  }, [currentAccount?.id]);

  // Track active session id (for current account) for LiveFeed
  useEffect(() => {
    if (!currentAccount) { setActiveSessionId(null); return; }
    const load = async () => {
      const { data } = await (supabase.from("sessions").select("id") as any)
        .eq("account_id", currentAccount.id)
        .neq("status", "finished")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      setActiveSessionId(data?.id || null);
    };
    load();
    const ch = supabase.channel(`sessions-mine:${currentAccount.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentAccount?.id]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <NavBar onOpenAI={() => setAiOpen(true)} />
      <div className="flex-1 flex overflow-hidden">
        <QuestionBank
          selectedIds={selectedIds}
          onToggle={toggle}
          onOpenAI={() => setAiOpen(true)}
          refreshKey={refreshKey}
          activeQuestionId={activeQuestionId}
        />
        <GameStage
          selectedIds={selectedIds}
          onClearSelection={() => setSelectedIds(new Set())}
          onActiveQuestionChange={setActiveQuestionId}
        />
        <LiveFeed sessionId={activeSessionId} />
      </div>
      <QuestionGeneratorModal
        open={aiOpen}
        onOpenChange={setAiOpen}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
};

export default Index;
