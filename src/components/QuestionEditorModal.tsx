import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type DBQuestion = Database["public"]["Tables"]["questions"]["Row"];
type Difficulty = Database["public"]["Enums"]["difficulty"];

interface Props {
  question: DBQuestion | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}

interface Choice { key: string; text: string }

const QuestionEditorModal = ({ question, open, onOpenChange, onSaved }: Props) => {
  const [text, setText] = useState("");
  const [category, setCategory] = useState("General");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [correct, setCorrect] = useState("A");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!question) return;
    setText(question.text);
    setCategory(question.category);
    setDifficulty(question.difficulty);
    const arr = (question.choices as any[]) || [];
    const normalized: Choice[] = arr.map((c, i) => ({
      key: c.key || String.fromCharCode(65 + i),
      text: c.text || "",
    }));
    while (normalized.length < 2) {
      normalized.push({ key: String.fromCharCode(65 + normalized.length), text: "" });
    }
    setChoices(normalized);
    setCorrect(question.correct_choice);
  }, [question?.id]);

  const updateChoice = (idx: number, val: string) => {
    setChoices((prev) => prev.map((c, i) => i === idx ? { ...c, text: val } : c));
  };

  const save = async () => {
    if (!question) return;
    if (!text.trim()) { toast.error("Question text required"); return; }
    if (choices.some((c) => !c.text.trim())) { toast.error("All choices need text"); return; }
    if (!choices.find((c) => c.key === correct)) { toast.error("Correct choice must match a choice key"); return; }
    setBusy(true);
    const { error } = await supabase.from("questions").update({
      text: text.trim(),
      category: category.trim() || "General",
      difficulty,
      choices: choices as any,
      correct_choice: correct,
    }).eq("id", question.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Question updated");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit question</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Question</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Difficulty</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Choices</Label>
            {choices.map((c, i) => (
              <div key={c.key} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorrect(c.key)}
                  className={`w-8 h-8 rounded-md font-display font-bold text-sm transition-all ${
                    correct === c.key
                      ? "bg-tiktok-cyan/20 text-tiktok-cyan border border-tiktok-cyan"
                      : "bg-muted/40 text-muted-foreground border border-border/40 hover:border-border"
                  }`}
                  title="Mark as correct answer"
                >{c.key}</button>
                <Input value={c.text} onChange={(e) => updateChoice(i, e.target.value)} />
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground">Click a letter to mark it as the correct answer.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="cyan" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuestionEditorModal;
