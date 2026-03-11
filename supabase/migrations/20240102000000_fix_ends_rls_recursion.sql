-- Fix infinite recursion in ends/end_shares RLS policies.
--
-- The "Users can view shares for own ends" policy on end_shares references
-- the ends table, which in turn references end_shares via the
-- "Users can view shared ends" policy, causing infinite recursion.
--
-- This policy is redundant anyway — end owners already have access via
-- "Users can manage own shares" (shared_by_user_id = auth.uid()).

DROP POLICY IF EXISTS "Users can view shares for own ends" ON end_shares;
