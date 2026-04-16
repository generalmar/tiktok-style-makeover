import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";

interface GameStageProps {
  status: "idle" | "active" | "finished";
  selectedCount: number;
  onReset: () => void;
}

const GameStage = ({ status, selectedCount, onReset }: GameStageProps) => {
  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Status bar */}
      <div className="px-6 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            status === "idle" ? "bg-muted-foreground animate-breathe" :
            status === "active" ? "bg-tiktok-cyan animate-pulse-live" :
            "bg-muted-foreground"
          }`} />
          <span className="text-xs font-display font-semibold uppercase tracking-widest text-muted-foreground">
            {status}
          </span>
          {selectedCount > 0 && (
            <span className="text-xs text-primary ml-2">
              {selectedCount} selected
            </span>
          )}
        </div>
      </div>

      {/* Main stage */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-2xl p-12 max-w-lg w-full text-center"
        >
          {status === "idle" ? (
            <div className="space-y-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <Play className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Select questions from the question bank to start a new session
                </p>
              </div>
              {selectedCount > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Button variant="cyan" size="lg" className="rounded-full px-8">
                    Start Round
                  </Button>
                </motion.div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-foreground font-display text-xl">Session Active</p>
              <p className="text-muted-foreground text-sm">Waiting for answers...</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Footer controls */}
      <div className="px-6 py-3 border-t border-border/30">
        <Button variant="pink" size="sm" className="rounded-full gap-2" onClick={onReset}>
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Session Game
        </Button>
      </div>
    </div>
  );
};

export default GameStage;
