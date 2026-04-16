import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

const NavBar = () => {
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
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="text-primary font-semibold text-xs uppercase tracking-wider">
            Operator
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs uppercase tracking-wider">
            Open Overlay
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-tiktok-cyan to-tiktok-pink" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Default Account</span>
        </div>
        <Button variant="glass" size="sm" className="gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide">AI Generator</span>
        </Button>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
          History & Leaderboard
        </Button>
      </div>
    </nav>
  );
};

export default NavBar;
