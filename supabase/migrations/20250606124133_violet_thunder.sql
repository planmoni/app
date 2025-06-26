/*
  # Fix events table RLS policy for INSERT operations

  1. Security
    - Add INSERT policy for events table to allow authenticated users to insert their own events
    - Ensure users can only insert events where user_id matches their auth.uid()
*/

-- Create policy for authenticated users to insert their own events
CREATE POLICY "Users can insert own events"
  ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);