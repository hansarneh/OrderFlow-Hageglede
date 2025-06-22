/*
  # Create integrations table for storing API credentials

  1. New Tables
    - `integrations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `integration_type` (text) - type of integration (e.g., 'woocommerce')
      - `credentials` (jsonb) - encrypted API credentials
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `integrations` table
    - Add policies for users to manage their own integration credentials
    - Users can only access their own integration data

  3. Functions
    - Trigger to automatically update `updated_at` column
*/

-- Create integrations table
CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_type text NOT NULL,
  credentials jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Create policies for user access to their own integrations
CREATE POLICY "Users can view own integrations"
  ON integrations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations"
  ON integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations"
  ON integrations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations"
  ON integrations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create unique constraint to prevent duplicate integrations per user
CREATE UNIQUE INDEX integrations_user_type_unique 
  ON integrations(user_id, integration_type);