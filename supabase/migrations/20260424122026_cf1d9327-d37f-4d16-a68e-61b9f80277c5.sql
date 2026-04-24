-- Make owner_id nullable so anonymous clients can insert
ALTER TABLE public.sessions ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE public.questions ALTER COLUMN owner_id DROP NOT NULL;

-- QUESTIONS: drop owner-scoped policies, add public ones
DROP POLICY IF EXISTS "Owners view questions" ON public.questions;
DROP POLICY IF EXISTS "Owners insert questions" ON public.questions;
DROP POLICY IF EXISTS "Owners update questions" ON public.questions;
DROP POLICY IF EXISTS "Owners delete questions" ON public.questions;

CREATE POLICY "Public read questions" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Public insert questions" ON public.questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update questions" ON public.questions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete questions" ON public.questions FOR DELETE USING (true);

-- SESSIONS
DROP POLICY IF EXISTS "Owners view sessions" ON public.sessions;
DROP POLICY IF EXISTS "Owners insert sessions" ON public.sessions;
DROP POLICY IF EXISTS "Owners update sessions" ON public.sessions;
DROP POLICY IF EXISTS "Owners delete sessions" ON public.sessions;

CREATE POLICY "Public read sessions" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Public insert sessions" ON public.sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update sessions" ON public.sessions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete sessions" ON public.sessions FOR DELETE USING (true);

-- ROUNDS
DROP POLICY IF EXISTS "Owners view rounds" ON public.rounds;
DROP POLICY IF EXISTS "Owners insert rounds" ON public.rounds;
DROP POLICY IF EXISTS "Owners update rounds" ON public.rounds;

CREATE POLICY "Public read rounds" ON public.rounds FOR SELECT USING (true);
CREATE POLICY "Public insert rounds" ON public.rounds FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update rounds" ON public.rounds FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete rounds" ON public.rounds FOR DELETE USING (true);

-- ANSWERS
DROP POLICY IF EXISTS "Owners view answers" ON public.answers;

CREATE POLICY "Public read answers" ON public.answers FOR SELECT USING (true);
CREATE POLICY "Public insert answers" ON public.answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update answers" ON public.answers FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete answers" ON public.answers FOR DELETE USING (true);

-- SESSION_QUESTIONS
DROP POLICY IF EXISTS "Owners view sq" ON public.session_questions;
DROP POLICY IF EXISTS "Owners insert sq" ON public.session_questions;
DROP POLICY IF EXISTS "Owners update sq" ON public.session_questions;
DROP POLICY IF EXISTS "Owners delete sq" ON public.session_questions;

CREATE POLICY "Public read sq" ON public.session_questions FOR SELECT USING (true);
CREATE POLICY "Public insert sq" ON public.session_questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update sq" ON public.session_questions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete sq" ON public.session_questions FOR DELETE USING (true);

-- SESSION_SCORES
DROP POLICY IF EXISTS "Owners view scores" ON public.session_scores;

CREATE POLICY "Public read scores" ON public.session_scores FOR SELECT USING (true);
CREATE POLICY "Public insert scores" ON public.session_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update scores" ON public.session_scores FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete scores" ON public.session_scores FOR DELETE USING (true);