-- Fix crm_research table contact_id data type mismatch
-- This migration changes contact_id from INTEGER to UUID to match the contacts table

-- Step 1: Drop the existing index that might cause issues
DROP INDEX IF EXISTS idx_crm_research_unique;

-- Step 2: Change contact_id column type from INTEGER to UUID
ALTER TABLE crm_research ALTER COLUMN contact_id TYPE UUID USING contact_id::UUID;

-- Step 3: Recreate the unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_research_unique ON crm_research(opportunity_id, research_type);

-- Step 4: Add comment to document the change
COMMENT ON COLUMN crm_research.contact_id IS 'Reference to the contact being researched (UUID type)';

-- Step 5: Verify the change
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'crm_research' 
AND column_name = 'contact_id';
