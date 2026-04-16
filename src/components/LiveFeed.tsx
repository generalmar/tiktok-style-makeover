import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LiveFeed = () => {
  const [username, setUsername] = useState("");
  const [connected, setConnected] = useState(false);

  return (
    <div className="w-80 border-l border-border/50 bg-card/40 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-tiktok-pink animate-pulse-live" />
          <h2 className="font-display font-bold text-sm uppercase tracking-wider">Live Feed</h2>
        </div>
      </div>

      {/* TikTok Connection */}
      <div className="p-4 border-b border-border/30">
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">TikTok Live</span>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-tiktok-cyan" : "bg-tiktok-pink"}`} />
              <span className={`text-[10px] font-medium ${connected ? "text-tiktok-cyan" : "text-tiktok-pink"}`}>
                {connected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
              className="h-8 text-xs bg-muted/40 border-border/50"
            />
            <Button
              variant={connected ? "glass" : "cyan"}
              size="sm"
              className="rounded-lg text-xs h-8 px-4"
              onClick={() => setConnected(!connected)}
            >
              {connected ? "Disconnect" : "Connect"}
            </Button>
          </div>
        </div>
      </div>

      {/* Feed area */}
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          Connect TikTok Live or start a round to detect answers.
        </p>
      </div>

      {/* Footer stats */}
      <div className="px-4 py-3 border-t border-border/30 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground font-mono">0 answers</span>
        <span className="text-[10px] text-muted-foreground font-mono">2 viewers</span>
      </div>
    </div>
  );
};

export default LiveFeed;
