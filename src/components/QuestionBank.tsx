import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Trash2, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export interface Question {
  id: number;
  text: string;
  difficulty: "easy" | "medium" | "hard";
  category: string;
  selected: boolean;
}

interface QuestionBankProps {
  questions: Question[];
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}

const QuestionBank = ({ questions, onToggle, onDelete }: QuestionBankProps) => {
  return (
    <div className="w-72 border-r border-border/50 bg-card/40 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-border/30">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-primary text-sm">✦</span>
          <h2 className="font-display font-bold text-sm uppercase tracking-wider">Question Bank</h2>
        </div>
        <p className="text-xs text-muted-foreground">{questions.length} questions available</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence>
          {questions.map((q, i) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: i * 0.05 }}
              className={`group p-3 rounded-lg border transition-all cursor-pointer ${
                q.selected
                  ? "border-primary/50 bg-primary/5 glow-cyan"
                  : "border-border/30 bg-muted/20 hover:border-border hover:bg-muted/40"
              }`}
              onClick={() => onToggle(q.id)}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono">Q{i + 1}</span>
                  <Badge variant={q.difficulty}>{q.difficulty}</Badge>
                  <Badge variant="outline" className="text-[10px]">{q.category}</Badge>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={(e) => { e.stopPropagation(); onDelete(q.id); }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <p className="text-sm leading-snug">{q.text}</p>
              {q.selected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2"
                >
                  <Check className="w-3 h-3 text-primary" />
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default QuestionBank;
