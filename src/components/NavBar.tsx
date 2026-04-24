import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onOpenAI: () => void;
}

const NavBar = ({ onOpenAI }: Props) => {
  return (
    <nav className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-tiktok-cyan to-tiktok-pink flex items-center justify-center font-display font-bold text-background text-sm">
            T
          </div>
          <span className="font-display font-bold text-lg">
            Trivia<span className="text-gradient italic">LIVE</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="glass" size="sm" className="gap-1.5" onClick={onOpenAI}>
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide">AI Generator</span>
        </Button>
      </div>
    </nav>
  );
};

export default NavBar;
