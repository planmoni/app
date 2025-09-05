-- Enable real-time for payout_plans table
-- Run this SQL in your Supabase SQL Editor or via CLI

-- Add payout_plans table to the supabase_realtime publication
alter publication supabase_realtime add table payout_plans;

-- Verify the table is added to the publication
select schemaname, tablename 
from pg_publication_tables 
where pubname = 'supabase_realtime' 
and tablename = 'payout_plans';
