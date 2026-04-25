import { useState } from "react";
import { Check, ChevronsUpDown, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccount } from "@/contexts/AccountContext";

const AccountSwitcher = () => {
  const { accounts, currentAccount, switchAccount, createAccount, deleteAccount } = useAccount();
  const [open, setOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const acc = await createAccount(name.trim());
    setBusy(false);
    if (acc) {
      setName("");
      setNewOpen(false);
      setOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    await deleteAccount(confirmDelete);
    setBusy(false);
    setConfirmDelete(null);
  };

  const deletingAccount = accounts.find((a) => a.id === confirmDelete);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="glass" size="sm" className="gap-2 min-w-[160px] justify-between">
            <div className="flex items-center gap-1.5 truncate">
              <Users className="w-3.5 h-3.5 text-tiktok-cyan" />
              <span className="text-xs font-semibold truncate">
                {currentAccount?.name ?? "No account"}
              </span>
            </div>
            <ChevronsUpDown className="w-3 h-3 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="end">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
            Accounts
          </div>
          <div className="space-y-0.5 max-h-60 overflow-y-auto">
            {accounts.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-3 text-center">
                No accounts yet
              </p>
            )}
            {accounts.map((a) => {
              const active = a.id === currentAccount?.id;
              return (
                <div
                  key={a.id}
                  className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors ${
                    active ? "bg-primary/10 text-primary" : "hover:bg-muted/40"
                  }`}
                  onClick={() => { switchAccount(a.id); setOpen(false); }}
                >
                  <div className="flex items-center gap-2 truncate">
                    {active ? <Check className="w-3.5 h-3.5" /> : <span className="w-3.5" />}
                    <span className="truncate">{a.name}</span>
                  </div>
                  <button
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition"
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(a.id); setOpen(false); }}
                    aria-label="Delete account"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="border-t border-border/40 mt-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-xs"
              onClick={() => { setOpen(false); setNewOpen(true); }}
            >
              <Plus className="w-3.5 h-3.5" /> New account
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Create dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New account</DialogTitle>
            <DialogDescription>
              Each account has its own question bank, sessions, and stats.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="acc-name">Name</Label>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Friday Night Trivia"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button variant="cyan" onClick={handleCreate} disabled={busy || !name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete account?</DialogTitle>
            <DialogDescription>
              This will permanently delete <span className="font-semibold">{deletingAccount?.name}</span>{" "}
              and all of its questions, sessions, scores, and answers. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="pink" onClick={handleDelete} disabled={busy}>
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AccountSwitcher;
