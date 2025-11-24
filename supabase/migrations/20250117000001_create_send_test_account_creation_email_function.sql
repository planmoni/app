/*
  # Create function to send test account creation email
  
  This function allows sending a test account creation email to a user.
  It calls the edge function to send the email.
*/

-- Function to send test account creation email via edge function
CREATE OR REPLACE FUNCTION send_test_account_creation_email(
  p_user_email text,
  p_account_number text DEFAULT '1234567890',
  p_account_name text DEFAULT 'Test Account Name',
  p_bank_name text DEFAULT 'SafeHaven Microfinance Bank'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_user_first_name text;
  v_supabase_url text;
  v_service_role_key text;
  v_http_response jsonb;
BEGIN
  -- Get user ID and first name from email
  SELECT id, first_name INTO v_user_id, v_user_first_name
  FROM profiles
  WHERE email = p_user_email
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found with email: ' || p_user_email
    );
  END IF;
  
  -- Get Supabase URL and service role key from settings
  -- Note: These should be set in your Supabase project settings
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- If not set, use default (you may need to adjust this)
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://rqmpnoaavyizlwzfngpr.supabase.co';
  END IF;
  
  -- Call the edge function to send the email
  -- Using net.http_post if pg_net extension is available
  BEGIN
    SELECT content::jsonb INTO v_http_response
    FROM net.http_post(
      url := v_supabase_url || '/functions/v1/send-account-creation-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(v_service_role_key, '')
      ),
      body := jsonb_build_object(
        'user_id', v_user_id,
        'account_number', p_account_number,
        'account_name', p_account_name,
        'bank_name', p_bank_name
      )::text
    );
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Email sent successfully via edge function',
      'user_id', v_user_id,
      'user_email', p_user_email,
      'response', v_http_response
    );
  EXCEPTION WHEN OTHERS THEN
    -- Fallback: Just create the record and return instructions
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to call edge function: ' || SQLERRM,
      'user_id', v_user_id,
      'user_email', p_user_email,
      'note', 'Please deploy the send-account-creation-email edge function and ensure pg_net extension is enabled, or call sendAccountCreationEmail() from application code'
    );
  END;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION send_test_account_creation_email(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION send_test_account_creation_email(text, text, text, text) TO service_role;

