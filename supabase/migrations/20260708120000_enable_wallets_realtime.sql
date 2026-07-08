/*
  Enable realtime on wallets so balance updates instantly after SafeHaven deposits.
  events is already published; wallets was missing from supabase_realtime.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'wallets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE wallets;
  END IF;
END $$;
