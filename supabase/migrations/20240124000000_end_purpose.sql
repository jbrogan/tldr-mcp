-- Add purpose field to ends.
-- Captures why the end exists — distinct from thesis (inquiry question)
-- and rationale (support link context).
ALTER TABLE ends ADD COLUMN purpose TEXT;
