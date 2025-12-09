-- Migration: Add Research Data Columns to CRM Tables
-- This migration adds JSONB columns to store research data in existing CRM tables
-- as agreed in our conversation - no new tables, just extend existing ones

-- Add research data column to accounts table
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS company_research_data JSONB DEFAULT '{}';

-- Add research data column to contacts table  
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS contact_research_data JSONB DEFAULT '{}';

-- Add research data column to opportunities table
ALTER TABLE opportunities 
ADD COLUMN IF NOT EXISTS research_data JSONB DEFAULT '{}';

-- Add indexes for better performance on research data queries
CREATE INDEX IF NOT EXISTS idx_accounts_research_data ON accounts USING GIN (company_research_data);
CREATE INDEX IF NOT EXISTS idx_contacts_research_data ON contacts USING GIN (contact_research_data);
CREATE INDEX IF NOT EXISTS idx_opportunities_research_data ON opportunities USING GIN (research_data);

-- Add comments for documentation
COMMENT ON COLUMN accounts.company_research_data IS 'JSONB field to store company research data from ResearchBy.ai';
COMMENT ON COLUMN contacts.contact_research_data IS 'JSONB field to store contact research data from ResearchBy.ai';
COMMENT ON COLUMN opportunities.research_data IS 'JSONB field to store opportunity-specific research insights and recommendations';

-- Verify the migration
SELECT 
    table_name,
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name IN ('accounts', 'contacts', 'opportunities')
AND column_name IN ('company_research_data', 'contact_research_data', 'research_data')
ORDER BY table_name, column_name;
