/*
  # Create function to retry/resend failed account creation emails
  
  This function allows retrying failed account creation emails by:
  1. Finding records where email_sent = false
  2. Calling the edge function to send the email
  3. Updating the record with success or error
*/

-- Function to retry sending account creation email for a specific record
CREATE OR REPLACE FUNCTION retry_account_creation_email(
  p_email_record_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record record;
  v_supabase_url text;
  v_service_role_key text;
  v_http_response jsonb;
BEGIN
  -- Get the email record
  SELECT * INTO v_record
  FROM account_creation_emails
  WHERE id = p_email_record_id;
  
  IF v_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Email record not found'
    );
  END IF;
  
  -- Get Supabase URL and service role key
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Default Supabase URL (adjust if needed)
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://rqmpnoaavyizlwzfngpr.supabase.co';
  END IF;
  
  -- Call the edge function to send the email
  BEGIN
    SELECT content::jsonb INTO v_http_response
    FROM net.http_post(
      url := v_supabase_url || '/functions/v1/send-account-creation-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(v_service_role_key, '')
      ),
      body := jsonb_build_object(
        'user_id', v_record.user_id,
        'account_number', v_record.account_number,
        'account_name', v_record.account_name,
        'bank_name', v_record.bank_name
      )::text
    );
    
    -- Parse the response
    IF v_http_response->>'success' = 'true' OR (v_http_response->>'error') IS NULL THEN
      -- Update record as successful (if edge function updated it, this is safe)
      UPDATE account_creation_emails
      SET 
        email_sent = true,
        sent_at = COALESCE(sent_at, now()),
        updated_at = now()
      WHERE id = p_email_record_id
        AND email_sent = false;
      
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Email sent successfully',
        'email_record_id', p_email_record_id,
        'response', v_http_response
      );
    ELSE
      -- Update record with error
      UPDATE account_creation_emails
      SET 
        error_message = COALESCE(v_http_response->>'error', 'Failed to send email'),
        email_provider_response = v_http_response,
        updated_at = now()
      WHERE id = p_email_record_id;
      
      RETURN jsonb_build_object(
        'success', false,
        'error', v_http_response->>'error',
        'email_record_id', p_email_record_id,
        'response', v_http_response
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Update record with error
    UPDATE account_creation_emails
    SET 
      error_message = 'Failed to call edge function: ' || SQLERRM,
      updated_at = now()
    WHERE id = p_email_record_id;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to call edge function: ' || SQLERRM,
      'email_record_id', p_email_record_id,
      'note', 'Please ensure pg_net extension is enabled and edge function is deployed'
    );
  END;
END;
$$;

-- Function to retry all failed emails for a specific user
CREATE OR REPLACE FUNCTION retry_user_account_creation_emails(
  p_user_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_record record;
  v_results jsonb[] := '{}';
  v_result jsonb;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id
  FROM profiles
  WHERE email = p_user_email
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found with email: ' || p_user_email
    );
  END IF;
  
  -- Loop through all failed emails for this user
  FOR v_record IN
    SELECT id
    FROM account_creation_emails
    WHERE user_id = v_user_id
      AND email_sent = false
    ORDER BY created_at DESC
  LOOP
    v_result := retry_account_creation_email(v_record.id);
    v_results := array_append(v_results, v_result);
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_email', p_user_email,
    'user_id', v_user_id,
    'attempted', array_length(v_results, 1),
    'results', v_results
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION retry_account_creation_email(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION retry_account_creation_email(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION retry_user_account_creation_emails(text) TO authenticated;
GRANT EXECUTE ON FUNCTION retry_user_account_creation_emails(text) TO service_role;

