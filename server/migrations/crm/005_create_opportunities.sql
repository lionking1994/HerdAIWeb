-- Opportunities table migration
-- This file will contain the SQL to create the opportunities table

CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(15,2),
    probability DECIMAL(5,2),
    stage VARCHAR(100),
    stage_id UUID,
    expected_close_date DATE,
    actual_close_date DATE,
    account_id UUID,
    owner_id UUID,
    lead_source VARCHAR(100),
    meeting_id INTEGER REFERENCES meetings(id),
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_id ON opportunities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_account_id ON opportunities(account_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage_id ON opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_owner_id ON opportunities(owner_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_meeting_id ON opportunities(meeting_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_lead_source ON opportunities(lead_source);

-- Add comments for documentation
COMMENT ON TABLE opportunities IS 'CRM opportunities/deals table';
COMMENT ON COLUMN opportunities.tenant_id IS 'Reference to the tenant/company';
COMMENT ON COLUMN opportunities.meeting_id IS 'Reference to the meeting that generated this opportunity (when lead_source is Meeting)';
COMMENT ON COLUMN opportunities.lead_source IS 'Source of the lead (Website, Referral, Cold Call, Trade Show, Social Media, Email Campaign, Partner, Meeting, Other)';
COMMENT ON COLUMN opportunities.custom_fields IS 'JSONB field for storing custom field values';
