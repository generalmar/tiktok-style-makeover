import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Account {
  id: string;
  name: string;
  created_at: string;
}

interface AccountContextValue {
  accounts: Account[];
  currentAccount: Account | null;
  loading: boolean;
  switchAccount: (id: string) => void;
  createAccount: (name: string) => Promise<Account | null>;
  deleteAccount: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

const STORAGE_KEY = "trivia.currentAccountId";

export const AccountProvider = ({ children }: { children: ReactNode }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAccounts = useCallback(async () => {
    const { data, error } = await supabase
      .from("accounts" as any)
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const list = (data || []) as unknown as Account[];
    setAccounts(list);

    const stored = localStorage.getItem(STORAGE_KEY);
    const found = list.find((a) => a.id === stored);
    if (found) {
      setCurrentAccount(found);
    } else if (list.length > 0) {
      setCurrentAccount(list[0]);
      localStorage.setItem(STORAGE_KEY, list[0].id);
    } else {
      setCurrentAccount(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const switchAccount = (id: string) => {
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;
    localStorage.setItem(STORAGE_KEY, id);
    setCurrentAccount(acc);
    toast.success(`Switched to ${acc.name}`);
  };

  const createAccount = async (name: string) => {
    const { data, error } = await supabase
      .from("accounts" as any)
      .insert({ name } as any)
      .select()
      .single();
    if (error) { toast.error(error.message); return null; }
    const acc = data as unknown as Account;
    setAccounts((p) => [...p, acc]);
    localStorage.setItem(STORAGE_KEY, acc.id);
    setCurrentAccount(acc);
    toast.success(`Created ${acc.name}`);
    return acc;
  };

  const deleteAccount = async (id: string) => {
    // Cascade: delete answers, scores, rounds, session_questions, sessions, questions for this account
    const sb = supabase as any;
    const { data: sessions } = await sb.from("sessions").select("id").eq("account_id", id);
    const sessionIds = (sessions || []).map((s: any) => s.id);
    if (sessionIds.length > 0) {
      await sb.from("answers").delete().in("session_id", sessionIds);
      await sb.from("session_scores").delete().in("session_id", sessionIds);
      await sb.from("rounds").delete().in("session_id", sessionIds);
      await sb.from("session_questions").delete().in("session_id", sessionIds);
      await sb.from("sessions").delete().in("id", sessionIds);
    }
    await sb.from("questions").delete().eq("account_id", id);

    const { error } = await supabase.from("accounts" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }

    const remaining = accounts.filter((a) => a.id !== id);
    setAccounts(remaining);
    if (currentAccount?.id === id) {
      const next = remaining[0] || null;
      setCurrentAccount(next);
      if (next) localStorage.setItem(STORAGE_KEY, next.id);
      else localStorage.removeItem(STORAGE_KEY);
    }
    toast.success("Account deleted");
  };

  return (
    <AccountContext.Provider
      value={{ accounts, currentAccount, loading, switchAccount, createAccount, deleteAccount, refresh: loadAccounts }}
    >
      {children}
    </AccountContext.Provider>
  );
};

export const useAccount = () => {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used inside AccountProvider");
  return ctx;
};
