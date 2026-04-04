-- Rename collections to portfolios throughout the schema

-- Rename the table
ALTER TABLE collections RENAME TO portfolios;

-- Rename the column on ends
ALTER TABLE ends RENAME COLUMN collection_id TO portfolio_id;

-- Rename collection_type column
ALTER TABLE portfolios RENAME COLUMN collection_type TO portfolio_type;

-- Update RLS policies (drop and recreate with new names)
DROP POLICY IF EXISTS "Users can CRUD own collections" ON portfolios;
CREATE POLICY "Users can CRUD own portfolios"
  ON portfolios FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
