-- Migration: Add CRM opportunity_id to tasks table
-- This allows linking tasks to CRM opportunities

-- Add the crm_opportunity_id column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS crm_opportunity_id INTEGER;

-- Add foreign key constraint (optional - depends on your crm_opportunities table)
-- ALTER TABLE tasks 
-- ADD CONSTRAINT fk_tasks_crm_opportunity 
-- FOREIGN KEY (crm_opportunity_id) REFERENCES crm_opportunities(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tasks_crm_opportunity_id ON tasks(crm_opportunity_id);

-- Comment for documentation
COMMENT ON COLUMN tasks.crm_opportunity_id IS 'Links task to a CRM opportunity for opportunity-based task management';

