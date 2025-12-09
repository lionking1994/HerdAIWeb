-- Migration: Create relationship type definition tables
-- This allows admins to define custom relationship types for different entity combinations

-- Table for relationship type definitions
CREATE TABLE IF NOT EXISTS relationship_type_definitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    entity_type_from text NOT NULL, -- 'account', 'contact', 'opportunity'
    entity_type_to text NOT NULL,   -- 'account', 'contact', 'opportunity'
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Ensure unique names per tenant and entity combination
    UNIQUE (tenant_id, name, entity_type_from, entity_type_to)
);

-- RLS for relationship type definitions
ALTER TABLE relationship_type_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_relationship_types ON relationship_type_definitions
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::integer);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_relationship_types_tenant_id 
    ON relationship_type_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_relationship_types_entity_combination 
    ON relationship_type_definitions(tenant_id, entity_type_from, entity_type_to);
CREATE INDEX IF NOT EXISTS idx_relationship_types_active 
    ON relationship_type_definitions(tenant_id, is_active);

-- Insert some default relationship types for common scenarios
INSERT INTO relationship_type_definitions (tenant_id, name, description, entity_type_from, entity_type_to, sort_order) VALUES
(1, 'Partner', 'Business partnership or collaboration', 'account', 'account', 1),
(1, 'Competitor', 'Competing business in the same market', 'account', 'account', 2),
(1, 'Subsidiary', 'Wholly or partially owned subsidiary', 'account', 'account', 3),
(1, 'Parent Company', 'Parent organization that owns this account', 'account', 'account', 4),
(1, 'Vendor', 'Supplier or service provider', 'account', 'account', 5),
(1, 'Customer', 'Client or customer of this account', 'account', 'account', 6),
(1, 'Decision Maker', 'Key decision maker in the account', 'contact', 'account', 1),
(1, 'Employee', 'Employee of the account', 'contact', 'account', 2),
(1, 'Advisor', 'External advisor or consultant', 'contact', 'account', 3),
(1, 'Influencer', 'Person who influences decisions', 'contact', 'account', 4),
(1, 'Owner', 'Primary owner of the opportunity', 'contact', 'opportunity', 1),
(1, 'Team Member', 'Team member working on the opportunity', 'contact', 'opportunity', 2),
(1, 'Stakeholder', 'Key stakeholder in the opportunity', 'contact', 'opportunity', 3),
(1, 'Champion', 'Internal champion for the opportunity', 'contact', 'opportunity', 4);

-- Update existing tables to reference relationship type definitions
-- For now, we'll keep the existing text fields but add new fields for the structured approach

-- Add relationship_type_id to account_relationships (optional, for future use)
ALTER TABLE account_relationships 
ADD COLUMN IF NOT EXISTS relationship_type_id uuid REFERENCES relationship_type_definitions(id);

-- Add relationship_type_id to account_contacts (optional, for future use)
ALTER TABLE account_contacts 
ADD COLUMN IF NOT EXISTS relationship_type_id uuid REFERENCES relationship_type_definitions(id);

-- Add relationship_type_id to opportunity_contacts (optional, for future use)
ALTER TABLE opportunity_contacts 
ADD COLUMN IF NOT EXISTS relationship_type_id uuid REFERENCES relationship_type_definitions(id);
