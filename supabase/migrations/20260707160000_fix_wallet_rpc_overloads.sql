-- Fix PostgREST PGRST203: ambiguous lock_funds / unlock_funds / transfer_funds / add_funds.
-- 20260416000001 added 5-param versions (with defaults); 20260707150000 recreated 2-param
-- versions via CREATE OR REPLACE, which does not drop the other signature.

DROP FUNCTION IF EXISTS public.lock_funds(uuid, numeric, text, text, jsonb);
DROP FUNCTION IF EXISTS public.unlock_funds(uuid, numeric, text, text, jsonb);
DROP FUNCTION IF EXISTS public.transfer_funds(uuid, numeric, text, text, jsonb);
DROP FUNCTION IF EXISTS public.add_funds(uuid, numeric, text, text, jsonb);
