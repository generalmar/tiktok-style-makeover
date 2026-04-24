import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Check, Plus, Loader2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import QuestionEditorModal from "./QuestionEditorModal";

type DBQuestion = Database["public"]["Tables"]["questions"]["Row"];

interface Props {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onOpenAI: () => void;
  refreshKey: number;
}

const QuestionBank = ({ selectedIds, onToggle, onOpenAI, refreshKey }: Props) => {
  const [questions, setQuestions] = useState<DBQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DBQuestion | null>(null);
  const [localKey, setLocalKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase.from("questions").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) toast.error(error.message);
        else setQuestions(data || []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshKey, localKey]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  return (
    <div className="w-72 border-r border-border/50 bg-card/40 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-border/30">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-primary text-sm">✦</span>
            <h2 className="font-display font-bold text-sm uppercase tracking-wider">Question Bank</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onOpenAI}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{questions.length} available · {selectedIds.size} selected</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center p-6 space-y-2">
            <p className="text-xs text-muted-foreground">No questions yet</p>
            <Button variant="cyan" size="sm" onClick={onOpenAI} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add your first
            </Button>
          </div>
        ) : (
          <AnimatePresence>
            {questions.map((q, i) => {
              const selected = selectedIds.has(q.id);
              return (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={`group relative p-3 rounded-lg border transition-all cursor-pointer ${
                    selected
                      ? "border-primary/50 bg-primary/5 glow-cyan"
                      : "border-border/30 bg-muted/20 hover:border-border hover:bg-muted/40"
                  }`}
                  onClick={() => onToggle(q.id)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-muted-foreground font-mono">Q{i + 1}</span>
                      <Badge variant={q.difficulty as "easy" | "medium" | "hard"}>{q.difficulty}</Badge>
                      <Badge variant="outline" className="text-[10px]">{q.category}</Badge>
                      {q.source === "ai" && (
                        <Badge variant="outline" className="text-[10px] border-tiktok-cyan/40 text-tiktok-cyan">AI</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                      <button
                        className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                        onClick={(e) => { e.stopPropagation(); setEditing(q); }}
                        aria-label="Edit question"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                        onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }}
                        aria-label="Delete question"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm leading-snug">{q.text}</p>
                  {selected && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 right-2">
                      <Check className="w-3 h-3 text-primary" />
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
      <QuestionEditorModal
        question={editing}
        open={!!editing}
        onOpenChange={(v) => { if (!v) setEditing(null); }}
        onSaved={() => setLocalKey((k) => k + 1)}
      />
    </div>
  );
};

export default QuestionBank;
