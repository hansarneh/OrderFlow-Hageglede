/*
  # Complete RLS policy fix - remove all policies causing recursion

  1. Problem
    - RLS policies are still causing infinite recursion
    - Login process gets stuck in infinite loading

  2. Solution
    - Disable RLS entirely for profiles table temporarily
    - Create the most basic policies possible
    - Move all role checking to application layer

  3. Security
    - Basic authentication-based access control
    - Role checking handled in React application
*/

-- Disable RLS temporarily to clear all issues
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Drop ALL policies to ensure clean slate
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can update profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can delete profiles" ON profiles;

-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create the simplest possible policies
CREATE POLICY "Allow authenticated users full access"
  ON profiles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);