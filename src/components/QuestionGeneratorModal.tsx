import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { z } from "zod";
import { Sparkles, Plus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}

const manualSchema = z.object({
  text: z.string().trim().min(5).max(280),
  choices: z.array(z.string().trim().min(1).max(80)).length(4),
  correct: z.enum(["A", "B", "C", "D"]),
  category: z.string().trim().min(1).max(40),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

const aiSchema = z.object({
  topic: z.string().trim().min(2).max(120),
  count: z.number().int().min(1).max(10),
  difficulty: z.enum(["easy", "medium", "hard"]),
  category: z.string().trim().max(40).optional(),
});

const QuestionGeneratorModal = ({ open, onOpenChange, onCreated }: Props) => {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [busy, setBusy] = useState(false);

  // Reset on open
  useEffect(() => { if (open) setMode("ai"); }, [open]);

  const handleAI = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = aiSchema.safeParse({
      topic: fd.get("topic"),
      count: Number(fd.get("count")),
      difficulty: fd.get("difficulty"),
      category: fd.get("category") || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("generate-questions", {
      body: parsed.data,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Failed to generate");
      return;
    }
    if ((data as any)?.error) {
      toast.error((data as any).error);
      return;
    }
    toast.success(`Added ${(data as any).questions?.length ?? 0} questions`);
    onCreated();
    onOpenChange(false);
  };

  const handleManual = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = manualSchema.safeParse({
      text: fd.get("text"),
      choices: ["a", "b", "c", "d"].map((k) => String(fd.get(`choice_${k}`) || "")),
      correct: fd.get("correct"),
      category: fd.get("category"),
      difficulty: fd.get("difficulty"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("questions").insert({
      text: parsed.data.text,
      choices: parsed.data.choices.map((t, i) => ({ key: ["A", "B", "C", "D"][i], text: t })),
      correct_choice: parsed.data.correct,
      category: parsed.data.category,
      difficulty: parsed.data.difficulty,
      source: "manual",
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Question added");
    onCreated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Questions</DialogTitle>
          <DialogDescription>Generate with AI or build manually</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button variant={mode === "ai" ? "cyan" : "glass"} size="sm" className="flex-1 gap-2"
            onClick={() => setMode("ai")} type="button">
            <Sparkles className="w-4 h-4" /> AI Generator
          </Button>
          <Button variant={mode === "manual" ? "cyan" : "glass"} size="sm" className="flex-1 gap-2"
            onClick={() => setMode("manual")} type="button">
            <Plus className="w-4 h-4" /> Manual
          </Button>
        </div>

        {mode === "ai" ? (
          <form onSubmit={handleAI} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="topic">Topic</Label>
              <Input id="topic" name="topic" placeholder="e.g. 2000s pop music" required maxLength={120} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="count">Count</Label>
                <Input id="count" name="count" type="number" min={1} max={10} defaultValue={5} required />
              </div>
              <div className="space-y-1.5">
                <Label>Difficulty</Label>
                <Select name="difficulty" defaultValue="medium">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">Category</Label>
                <Input id="category" name="category" placeholder="optional" maxLength={40} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" variant="cyan" disabled={busy} className="gap-2">
                <Sparkles className="w-4 h-4" />
                {busy ? "Generating…" : "Generate"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleManual} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="text">Question</Label>
              <Textarea id="text" name="text" required minLength={5} maxLength={280} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(["a", "b", "c", "d"] as const).map((k) => (
                <div key={k} className="space-y-1.5">
                  <Label htmlFor={`choice_${k}`}>Choice {k.toUpperCase()}</Label>
                  <Input id={`choice_${k}`} name={`choice_${k}`} required maxLength={80} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Correct</Label>
                <Select name="correct" defaultValue="A">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["A", "B", "C", "D"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Difficulty</Label>
                <Select name="difficulty" defaultValue="medium">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">Category</Label>
                <Input id="category" name="category" defaultValue="General" required maxLength={40} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" variant="cyan" disabled={busy}>
                {busy ? "Saving…" : "Add question"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default QuestionGeneratorModal;
