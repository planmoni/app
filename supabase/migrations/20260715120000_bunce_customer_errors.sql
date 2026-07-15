-- Internal log of failed Bunce customer creates. Not exposed to end users.
CREATE TABLE IF NOT EXISTS public.bunce_customer_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  email text,
  first_name text,
  last_name text,
  phone_no text,
  error_message text NOT NULL,
  bunce_status integer,
  request_payload jsonb,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bunce_customer_errors_created_at
  ON public.bunce_customer_errors (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bunce_customer_errors_user_id
  ON public.bunce_customer_errors (user_id);

CREATE INDEX IF NOT EXISTS idx_bunce_customer_errors_email
  ON public.bunce_customer_errors (email);

ALTER TABLE public.bunce_customer_errors ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated/anon — only service role (bypasses RLS) can read/write.
COMMENT ON TABLE public.bunce_customer_errors IS
  'Ops log: Bunce create-customer failures. Silent to app users.';
