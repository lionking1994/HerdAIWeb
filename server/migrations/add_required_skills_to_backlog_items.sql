-- Add required_skills field to psa_backlog_items table
-- This field will store an array of skill names that are required for the backlog item

ALTER TABLE psa_backlog_items 
ADD COLUMN IF NOT EXISTS required_skills TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN psa_backlog_items.required_skills IS 'Array of skill names required for this backlog item';

-- Create index for better performance on skill queries
CREATE INDEX IF NOT EXISTS idx_psa_backlog_items_required_skills ON psa_backlog_items USING GIN (required_skills);
