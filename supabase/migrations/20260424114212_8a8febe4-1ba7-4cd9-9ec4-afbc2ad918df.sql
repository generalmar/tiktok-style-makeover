-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'operator');
CREATE TYPE public.difficulty AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE public.session_status AS ENUM ('idle', 'active', 'finished');
CREATE TYPE public.round_status AS ENUM ('idle', 'live', 'closed', 'resolved');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- handle_new_user (after user_roles exists)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operator');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- questions
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  choices JSONB NOT NULL,
  correct_choice TEXT NOT NULL,
  difficulty public.difficulty NOT NULL DEFAULT 'medium',
  category TEXT NOT NULL DEFAULT 'General',
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view questions" ON public.questions FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert questions" ON public.questions FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update questions" ON public.questions FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete questions" ON public.questions FOR DELETE USING (auth.uid() = owner_id);
CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_questions_owner ON public.questions(owner_id);

-- sessions
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Live Session',
  status public.session_status NOT NULL DEFAULT 'idle',
  question_duration_seconds INT NOT NULL DEFAULT 25,
  overlay_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex') UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view sessions" ON public.sessions FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert sessions" ON public.sessions FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update sessions" ON public.sessions FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete sessions" ON public.sessions FOR DELETE USING (auth.uid() = owner_id);
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- session_questions
CREATE TABLE public.session_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  position INT NOT NULL,
  played BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, question_id)
);
ALTER TABLE public.session_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view sq" ON public.session_questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owners insert sq" ON public.session_questions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owners update sq" ON public.session_questions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owners delete sq" ON public.session_questions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.owner_id = auth.uid()));

-- rounds
CREATE TABLE public.rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  status public.round_status NOT NULL DEFAULT 'idle',
  duration_seconds INT NOT NULL DEFAULT 25,
  started_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view rounds" ON public.rounds FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owners insert rounds" ON public.rounds FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owners update rounds" ON public.rounds FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.owner_id = auth.uid()));
CREATE INDEX idx_rounds_session ON public.rounds(session_id);

-- answers
CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  viewer_handle TEXT NOT NULL,
  viewer_display_name TEXT,
  choice TEXT NOT NULL,
  is_correct BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, viewer_handle)
);
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view answers" ON public.answers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.owner_id = auth.uid()));
CREATE INDEX idx_answers_round ON public.answers(round_id);
CREATE INDEX idx_answers_session ON public.answers(session_id);

-- session_scores
CREATE TABLE public.session_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  viewer_handle TEXT NOT NULL,
  viewer_display_name TEXT,
  score INT NOT NULL DEFAULT 0,
  correct_count INT NOT NULL DEFAULT 0,
  answer_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, viewer_handle)
);
ALTER TABLE public.session_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view scores" ON public.session_scores FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.owner_id = auth.uid()));
CREATE INDEX idx_scores_session ON public.session_scores(session_id);

-- Realtime
ALTER TABLE public.rounds REPLICA IDENTITY FULL;
ALTER TABLE public.answers REPLICA IDENTITY FULL;
ALTER TABLE public.session_scores REPLICA IDENTITY FULL;
ALTER TABLE public.sessions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.answers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;