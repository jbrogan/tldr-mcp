-- Add timezone to profiles for user-local date handling
-- Default to America/New_York — IANA timezone handles EST/EDT automatically
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York';
