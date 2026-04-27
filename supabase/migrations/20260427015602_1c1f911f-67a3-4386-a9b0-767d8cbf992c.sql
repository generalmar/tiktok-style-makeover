-- TikTok LIVE chat connection state, one row per session.
CREATE TABLE IF NOT EXISTS public.tiktok_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE,
  tiktok_username text NOT NULL,
  status text NOT NULL DEFAULT 'connecting',
  last_error text,
  viewer_count integer,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tiktok_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read tiktok_connections"
  ON public.tiktok_connections FOR SELECT USING (true);
CREATE POLICY "Public insert tiktok_connections"
  ON public.tiktok_connections FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update tiktok_connections"
  ON public.tiktok_connections FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete tiktok_connections"
  ON public.tiktok_connections FOR DELETE USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tiktok_connections;