-- Add end_type, state, due_date, thesis, resolution_notes to ends.
-- Existing ends default to journey/active.

ALTER TABLE ends
  ADD COLUMN end_type text NOT NULL DEFAULT 'journey'
    CHECK (end_type IN ('journey', 'destination', 'inquiry')),
  ADD COLUMN state text NOT NULL DEFAULT 'active',
  ADD COLUMN due_date date,
  ADD COLUMN thesis text,
  ADD COLUMN resolution_notes text;

-- State validation is enforced at the API layer (per-type valid states
-- are too complex for a single CHECK constraint).

CREATE INDEX IF NOT EXISTS idx_ends_user_type ON ends (user_id, end_type);
CREATE INDEX IF NOT EXISTS idx_ends_user_state ON ends (user_id, state);
