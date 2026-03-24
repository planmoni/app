-- Onboarding questionnaire: one row per user, filled after signup
CREATE TABLE IF NOT EXISTS public.onboarding_questionnaire (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occupation text,
  income_range text,
  goals text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE public.onboarding_questionnaire ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own onboarding_questionnaire"
  ON public.onboarding_questionnaire FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding_questionnaire"
  ON public.onboarding_questionnaire FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding_questionnaire"
  ON public.onboarding_questionnaire FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Optional: updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS onboarding_questionnaire_updated_at ON public.onboarding_questionnaire;
CREATE TRIGGER onboarding_questionnaire_updated_at
  BEFORE UPDATE ON public.onboarding_questionnaire
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
