/*
  # Fix infinite recursion in RLS policies

  1. Problem
    - RLS policies were causing infinite recursion when trying to check user roles
    - This was preventing login and profile fetching

  2. Solution
    - Drop all existing policies that cause recursion
    - Create simple policies that don't query the profiles table from within the policy
    - Move complex role-based logic to application layer

  3. Security
    - Users can view and update their own profiles
    - All authenticated users can view all profiles (role checking moved to app)
    - All authenticated users can manage profiles (role checking moved to app)
*/

-- First, drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin users can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admin users can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin users can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can update profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can delete profiles" ON profiles;

-- Create simple, non-recursive policies
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Authenticated users can view all profiles (role checking in app)
CREATE POLICY "Authenticated users can view profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert profiles (role checking in app)
CREATE POLICY "Authenticated users can insert profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update profiles (role checking in app)
CREATE POLICY "Authenticated users can update profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (true);

-- Authenticated users can delete profiles (role checking in app)
CREATE POLICY "Authenticated users can delete profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (true);