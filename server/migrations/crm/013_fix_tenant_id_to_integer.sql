-- Migration to convert tenant_id from UUID to INTEGER to match company.id
-- This migration properly converts existing tenant_id fields without adding new columns

-- Step 1: Drop existing foreign key constraints and indexes
ALTER TABLE IF EXISTS accounts DROP CONSTRAINT IF EXISTS fk_accounts_tenant_id;
ALTER TABLE IF EXISTS contacts DROP CONSTRAINT IF EXISTS fk_accounts_tenant_id;
ALTER TABLE IF EXISTS opportunities DROP CONSTRAINT IF EXISTS fk_opportunities_tenant_id;
ALTER TABLE IF EXISTS opportunity_stages DROP CONSTRAINT IF EXISTS fk_opportunity_stages_tenant_id;
ALTER TABLE IF EXISTS custom_field_definitions DROP CONSTRAINT IF EXISTS fk_custom_field_definitions_tenant_id;

DROP INDEX IF EXISTS idx_accounts_tenant_id;
DROP INDEX IF EXISTS idx_contacts_tenant_id;
DROP INDEX IF EXISTS idx_opportunities_tenant_id;
DROP INDEX IF EXISTS idx_opportunity_stages_tenant_id;
DROP INDEX IF EXISTS idx_custom_field_definitions_tenant_id;

-- Step 2: Convert tenant_id columns from UUID to INTEGER
-- First, add new INTEGER columns
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tenant_id_new INTEGER;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tenant_id_new INTEGER;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS tenant_id_new INTEGER;
ALTER TABLE opportunity_stages ADD COLUMN IF NOT EXISTS tenant_id_new INTEGER;
ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS tenant_id_new INTEGER;

-- Step 3: Update the new columns with default company ID (7544)
-- This should be adjusted based on your actual company data
UPDATE accounts SET tenant_id_new = 7544 WHERE tenant_id_new IS NULL;
UPDATE contacts SET tenant_id_new = 7544 WHERE tenant_id_new IS NULL;
UPDATE opportunities SET tenant_id_new = 7544 WHERE tenant_id_new IS NULL;
UPDATE opportunity_stages SET tenant_id_new = 7544 WHERE tenant_id_new IS NULL;
UPDATE custom_field_definitions SET tenant_id_new = 7544 WHERE tenant_id_new IS NULL;

-- Step 4: Drop old UUID columns and rename new ones
ALTER TABLE accounts DROP COLUMN tenant_id;
ALTER TABLE contacts DROP COLUMN tenant_id;
ALTER TABLE opportunities DROP COLUMN tenant_id;
ALTER TABLE opportunity_stages DROP COLUMN tenant_id;
ALTER TABLE custom_field_definitions DROP COLUMN tenant_id;

ALTER TABLE accounts RENAME COLUMN tenant_id_new TO tenant_id;
ALTER TABLE contacts RENAME COLUMN tenant_id_new TO tenant_id;
ALTER TABLE opportunities RENAME COLUMN tenant_id_new TO tenant_id;
ALTER TABLE opportunity_stages RENAME COLUMN tenant_id_new TO tenant_id;
ALTER TABLE custom_field_definitions RENAME COLUMN tenant_id_new TO tenant_id;

-- Step 5: Make tenant_id NOT NULL
ALTER TABLE accounts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE contacts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE opportunities ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE opportunity_stages ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE custom_field_definitions ALTER COLUMN tenant_id SET NOT NULL;

-- Step 6: Convert created_by and updated_by from UUID to INTEGER
-- Add new INTEGER columns
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS created_by_new INTEGER;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS updated_by_new INTEGER;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS created_by_new INTEGER;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_by_new INTEGER;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS created_by_new INTEGER;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS updated_by_new INTEGER;
ALTER TABLE opportunity_stages ADD COLUMN IF NOT EXISTS created_by_new INTEGER;
ALTER TABLE opportunity_stages ADD COLUMN IF NOT EXISTS updated_by_new INTEGER;
ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS created_by_new INTEGER;
ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS updated_by_new INTEGER;

-- Update with default values (adjust based on your user data)
UPDATE accounts SET created_by_new = 1, updated_by_new = 1 WHERE created_by_new IS NULL;
UPDATE contacts SET created_by_new = 1, updated_by_new = 1 WHERE created_by_new IS NULL;
UPDATE opportunities SET created_by_new = 1, updated_by_new = 1 WHERE created_by_new IS NULL;
UPDATE opportunity_stages SET created_by_new = 1, updated_by_new = 1 WHERE created_by_new IS NULL;
UPDATE custom_field_definitions SET created_by_new = 1, updated_by_new = 1 WHERE created_by_new IS NULL;

-- Drop old UUID columns and rename new ones
ALTER TABLE accounts DROP COLUMN created_by;
ALTER TABLE accounts DROP COLUMN updated_by;
ALTER TABLE contacts DROP COLUMN created_by;
ALTER TABLE contacts DROP COLUMN updated_by;
ALTER TABLE opportunities DROP COLUMN created_by;
ALTER TABLE opportunities DROP COLUMN updated_by;
ALTER TABLE opportunity_stages DROP COLUMN created_by;
ALTER TABLE opportunity_stages DROP COLUMN updated_by;
ALTER TABLE custom_field_definitions DROP COLUMN created_by;
ALTER TABLE custom_field_definitions DROP COLUMN updated_by;

ALTER TABLE accounts RENAME COLUMN created_by_new TO created_by;
ALTER TABLE accounts RENAME COLUMN updated_by_new TO updated_by;
ALTER TABLE contacts RENAME COLUMN created_by_new TO created_by;
ALTER TABLE contacts RENAME COLUMN updated_by_new TO updated_by;
ALTER TABLE opportunities RENAME COLUMN created_by_new TO created_by;
ALTER TABLE opportunities RENAME COLUMN updated_by_new TO updated_by;
ALTER TABLE opportunity_stages RENAME COLUMN created_by_new TO created_by;
ALTER TABLE opportunity_stages RENAME COLUMN updated_by_new TO updated_by;
ALTER TABLE custom_field_definitions RENAME COLUMN created_by_new TO created_by;
ALTER TABLE custom_field_definitions RENAME COLUMN updated_by_new TO updated_by;

-- Step 7: Convert owner_id from UUID to INTEGER (if exists)
-- Add new INTEGER columns for owner_id
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS owner_id_new INTEGER;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS owner_id_new INTEGER;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS owner_id_new INTEGER;

-- Update with default values
UPDATE accounts SET owner_id_new = 1 WHERE owner_id_new IS NULL;
UPDATE contacts SET owner_id_new = 1 WHERE owner_id_new IS NULL;
UPDATE opportunities SET owner_id_new = 1 WHERE owner_id_new IS NULL;

-- Drop old UUID columns and rename new ones
ALTER TABLE accounts DROP COLUMN IF EXISTS owner_id;
ALTER TABLE contacts DROP COLUMN IF EXISTS owner_id;
ALTER TABLE opportunities DROP COLUMN IF EXISTS owner_id;

ALTER TABLE accounts RENAME COLUMN owner_id_new TO owner_id;
ALTER TABLE contacts RENAME COLUMN owner_id_new TO owner_id;
ALTER TABLE opportunities RENAME COLUMN owner_id_new TO owner_id;

-- Step 8: Update tenants table to use INTEGER ID
-- First, add new INTEGER column
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS id_new INTEGER;

-- Update with default company ID
UPDATE tenants SET id_new = 7544 WHERE id_new IS NULL;

-- Drop old UUID column and rename new one
ALTER TABLE tenants DROP COLUMN id;
ALTER TABLE tenants RENAME COLUMN id_new TO id;

-- Make it PRIMARY KEY
ALTER TABLE tenants ADD PRIMARY KEY (id);

-- Step 9: Add foreign key constraints to company table
ALTER TABLE accounts ADD CONSTRAINT fk_accounts_tenant_id FOREIGN KEY (tenant_id) REFERENCES company(id) ON DELETE CASCADE;
ALTER TABLE contacts ADD CONSTRAINT fk_contacts_tenant_id FOREIGN KEY (tenant_id) REFERENCES company(id) ON DELETE CASCADE;
ALTER TABLE opportunities ADD CONSTRAINT fk_opportunities_tenant_id FOREIGN KEY (tenant_id) REFERENCES company(id) ON DELETE CASCADE;
ALTER TABLE opportunity_stages ADD CONSTRAINT fk_opportunity_stages_tenant_id FOREIGN KEY (tenant_id) REFERENCES company(id) ON DELETE CASCADE;
ALTER TABLE custom_field_definitions ADD CONSTRAINT fk_custom_field_definitions_tenant_id FOREIGN KEY (tenant_id) REFERENCES company(id) ON DELETE CASCADE;

-- Step 10: Create indexes on tenant_id for better performance
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_id ON accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_id ON opportunities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_stages_tenant_id ON opportunity_stages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_tenant_id ON custom_field_definitions(tenant_id);

-- Step 11: Enable Row Level Security (RLS)
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;

-- Step 12: Create RLS policies using tenant_id
DROP POLICY IF EXISTS accounts_tenant_isolation ON accounts;
DROP POLICY IF EXISTS contacts_tenant_isolation ON contacts;
DROP POLICY IF EXISTS opportunities_tenant_isolation ON opportunities;
DROP POLICY IF EXISTS opportunity_stages_tenant_isolation ON opportunity_stages;
DROP POLICY IF EXISTS custom_field_definitions_tenant_isolation ON custom_field_definitions;

CREATE POLICY accounts_tenant_isolation ON accounts
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::integer);

CREATE POLICY contacts_tenant_isolation ON contacts
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::integer);

CREATE POLICY opportunities_tenant_isolation ON opportunities
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::integer);

CREATE POLICY opportunity_stages_tenant_isolation ON opportunity_stages
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::integer);

CREATE POLICY custom_field_definitions_tenant_isolation ON custom_field_definitions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::integer);

-- Step 13: Add comments for documentation
COMMENT ON COLUMN accounts.tenant_id IS 'Company ID for multi-tenancy support (matches company.id)';
COMMENT ON COLUMN contacts.tenant_id IS 'Company ID for multi-tenancy support (matches company.id)';
COMMENT ON COLUMN opportunities.tenant_id IS 'Company ID for multi-tenancy support (matches company.id)';
COMMENT ON COLUMN opportunity_stages.tenant_id IS 'Company ID for multi-tenancy support (matches company.id)';
COMMENT ON COLUMN custom_field_definitions.tenant_id IS 'Company ID for multi-tenancy support (matches company.id)';

COMMENT ON COLUMN accounts.created_by IS 'User ID who created the record';
COMMENT ON COLUMN accounts.updated_by IS 'User ID who last updated the record';
COMMENT ON COLUMN contacts.created_by IS 'User ID who created the record';
COMMENT ON COLUMN contacts.updated_by IS 'User ID who last updated the record';
COMMENT ON COLUMN opportunities.created_by IS 'User ID who created the record';
COMMENT ON COLUMN opportunities.updated_by IS 'User ID who last updated the record';
COMMENT ON COLUMN opportunity_stages.created_by IS 'User ID who created the record';
COMMENT ON COLUMN opportunity_stages.updated_by IS 'User ID who last updated the record';
COMMENT ON COLUMN custom_field_definitions.created_by IS 'User ID who created the record';
COMMENT ON COLUMN custom_field_definitions.updated_by IS 'User ID who last updated the record';

COMMENT ON COLUMN tenants.id IS 'Company ID that matches company.id for multi-tenancy support';
