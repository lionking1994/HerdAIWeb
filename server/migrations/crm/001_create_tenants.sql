-- Tenants table migration
-- This file will contain the SQL to create the tenants table

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON tenants(is_active);

-- Add comments for documentation
COMMENT ON TABLE tenants IS 'Multi-tenant support table for CRM system';
COMMENT ON COLUMN tenants.subdomain IS 'Unique subdomain identifier for the tenant';
COMMENT ON COLUMN tenants.is_active IS 'Whether the tenant account is active';

-- Insert the default tenant that matches your hardcoded ID
INSERT INTO tenants (id, name, subdomain, is_active) 
VALUES ('56718904-e3a0-4de7-983b-ef7dda1eec86', 'Default Tenant', 'default', true)
ON CONFLICT (id) DO NOTHING;
