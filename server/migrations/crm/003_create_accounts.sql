-- Accounts table migration
-- This file will contain the SQL to create the accounts table

CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_account_id UUID REFERENCES accounts(id),
    account_type VARCHAR(50) DEFAULT 'customer',
    industry VARCHAR(100),
    website VARCHAR(500),
    phone VARCHAR(50),
    email VARCHAR(255),
    billing_address JSONB DEFAULT '{}',
    shipping_address JSONB DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_id ON accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounts_name ON accounts(name);
CREATE INDEX IF NOT EXISTS idx_accounts_account_type ON accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_accounts_industry ON accounts(industry);
CREATE INDEX IF NOT EXISTS idx_accounts_parent_account_id ON accounts(parent_account_id);

-- Add comments for documentation
COMMENT ON TABLE accounts IS 'CRM accounts table for storing company/organization information';
COMMENT ON COLUMN accounts.tenant_id IS 'Tenant ID for multi-tenancy support';
COMMENT ON COLUMN accounts.account_type IS 'Type of account: customer, prospect, partner, vendor, competitor';
COMMENT ON COLUMN accounts.custom_fields IS 'JSON object for storing custom field values';
COMMENT ON COLUMN accounts.billing_address IS 'JSON object for billing address information';
COMMENT ON COLUMN accounts.shipping_address IS 'JSON object for shipping address information';
