-- Fix crm_research table data type mismatches
-- This migration fixes the data type inconsistencies between the table schema and actual data

-- Step 1: Drop existing indexes that might cause issues
DROP INDEX IF EXISTS idx_crm_research_unique;
DROP INDEX IF EXISTS idx_crm_research_opportunity_id;
DROP INDEX IF EXISTS idx_crm_research_tenant_id;

-- Step 2: Fix data type mismatches
-- Change contact_id from INTEGER to UUID to match contacts table
ALTER TABLE crm_research ALTER COLUMN contact_id TYPE UUID USING contact_id::UUID;

-- Change tenant_id from INTEGER to match your actual tenant ID type
-- Based on your error, tenantId is "32726" which suggests it might be TEXT or VARCHAR
ALTER TABLE crm_research ALTER COLUMN tenant_id TYPE VARCHAR(50);

-- Step 3: Recreate all indexes with correct data types
CREATE INDEX IF NOT EXISTS idx_crm_research_opportunity_id ON crm_research(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_crm_research_tenant_id ON crm_research(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_research_status ON crm_research(status);
CREATE INDEX IF NOT EXISTS idx_crm_research_type ON crm_research(research_type);

-- Recreate unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_research_unique ON crm_research(opportunity_id, research_type);

-- Step 4: Add comments to document the changes
COMMENT ON COLUMN crm_research.contact_id IS 'Reference to the contact being researched (UUID type)';
COMMENT ON COLUMN crm_research.tenant_id IS 'Reference to the tenant/company (VARCHAR type)';

-- Step 5: Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'crm_research' 
ORDER BY ordinal_position;
