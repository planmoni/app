-- Migrate kyc_data.document_type from text (with CHECK) to jsonb
-- 1) Add new jsonb column
ALTER TABLE kyc_data
  ADD COLUMN IF NOT EXISTS document_type_jsonb jsonb;

-- 2) Migrate existing scalar values into jsonb
UPDATE kyc_data
SET document_type_jsonb =
  CASE
    WHEN document_type IS NULL THEN NULL
    ELSE to_jsonb(document_type)
  END;

-- 3) Drop old column (and its CHECK constraint implicitly)
ALTER TABLE kyc_data
  DROP COLUMN IF EXISTS document_type;

-- 4) Rename new column to original name
ALTER TABLE kyc_data
  RENAME COLUMN document_type_jsonb TO document_type;

-- 5) Optional: add a comment for clarity
COMMENT ON COLUMN kyc_data.document_type IS 'JSONB payload describing the detected/selected document type from verification.';


