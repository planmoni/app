-- Create a trigger function to update email_verified in profiles
CREATE OR REPLACE FUNCTION update_email_verified()
RETURNS TRIGGER AS $$
BEGIN
  -- When a user confirms their email in auth.users, update the profiles table
  IF NEW.email_confirmed_at IS NOT NULL AND 
     (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at <> NEW.email_confirmed_at) THEN
    
    UPDATE public.profiles
    SET email_verified = TRUE
    WHERE id = NEW.id;
    
    RAISE LOG 'Updated email_verified status for user %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION update_email_verified();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_email_verified() TO supabase_auth_admin;

-- Add a comment to explain the purpose of this migration
COMMENT ON FUNCTION update_email_verified() IS 'Automatically updates the email_verified field in profiles when a user confirms their email';