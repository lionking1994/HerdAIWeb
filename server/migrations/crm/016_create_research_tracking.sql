-- Create research tracking table for CRM research functionality
-- This table tracks the progress and results of company and contact research

CREATE TABLE IF NOT EXISTS crm_research (
    id SERIAL PRIMARY KEY,
    opportunity_id UUID NOT NULL,
    account_id UUID,
    contact_id UUID,  -- Changed from INTEGER to UUID to match contacts table
    tenant_id INTEGER NOT NULL,  -- Keep as INTEGER to match your migration history
    research_type VARCHAR(20) NOT NULL CHECK (research_type IN ('company', 'contact', 'both')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'failed')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    research_data JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_crm_research_opportunity_id ON crm_research(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_crm_research_tenant_id ON crm_research(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_research_status ON crm_research(status);
CREATE INDEX IF NOT EXISTS idx_crm_research_type ON crm_research(research_type);

-- Create unique constraint to prevent duplicate research for same opportunity/type
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_research_unique ON crm_research(opportunity_id, research_type);

-- Add comments for documentation
COMMENT ON TABLE crm_research IS 'Tracks CRM research progress and results for opportunities';
COMMENT ON COLUMN crm_research.research_type IS 'Type of research: company, contact, or both';
COMMENT ON COLUMN crm_research.status IS 'Current status of the research';
COMMENT ON COLUMN crm_research.progress IS 'Progress percentage from 0-100';
COMMENT ON COLUMN crm_research.research_data IS 'JSON object containing research results and insights';
COMMENT ON COLUMN crm_research.contact_id IS 'Reference to the contact being researched (UUID type)';
COMMENT ON COLUMN crm_research.tenant_id IS 'Reference to the tenant/company (INTEGER type)';
