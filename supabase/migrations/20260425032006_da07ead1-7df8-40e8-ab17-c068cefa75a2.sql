-- Accounts table (no auth)
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read accounts" ON public.accounts FOR SELECT USING (true);
CREATE POLICY "Public insert accounts" ON public.accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update accounts" ON public.accounts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete accounts" ON public.accounts FOR DELETE USING (true);

CREATE TRIGGER update_accounts_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed a default account and migrate existing data
DO $$
DECLARE
  default_account_id UUID;
BEGIN
  INSERT INTO public.accounts (name) VALUES ('Default') RETURNING id INTO default_account_id;

  ALTER TABLE public.questions ADD COLUMN account_id UUID;
  ALTER TABLE public.sessions ADD COLUMN account_id UUID;

  UPDATE public.questions SET account_id = default_account_id WHERE account_id IS NULL;
  UPDATE public.sessions SET account_id = default_account_id WHERE account_id IS NULL;
END $$;

CREATE INDEX idx_questions_account_id ON public.questions(account_id);
CREATE INDEX idx_sessions_account_id ON public.sessions(account_id);