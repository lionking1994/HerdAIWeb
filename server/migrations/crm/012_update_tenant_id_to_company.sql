-- Migration to update CRM tables to use company IDs instead of tenant UUIDs
-- This migration converts the tenant_id field from UUID to INTEGER and updates references

-- Step 1: Add new company_id column to all CRM tables
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS company_id INTEGER;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_id INTEGER;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS company_id INTEGER;
ALTER TABLE opportunity_stages ADD COLUMN IF NOT EXISTS company_id INTEGER;
ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS company_id INTEGER;

-- Step 2: Update the company_id values based on existing tenant_id
-- For now, we'll set a default company ID (you may need to adjust this based on your data)
UPDATE accounts SET company_id = 7544 WHERE company_id IS NULL;
UPDATE contacts SET company_id = 7544 WHERE company_id IS NULL;
UPDATE opportunities SET company_id = 7544 WHERE company_id IS NULL;
UPDATE opportunity_stages SET company_id = 7544 WHERE company_id IS NULL;
UPDATE custom_field_definitions SET company_id = 7544 WHERE company_id IS NULL;

-- Step 3: Make company_id NOT NULL
ALTER TABLE accounts ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE contacts ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE opportunities ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE opportunity_stages ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE custom_field_definitions ALTER COLUMN company_id SET NOT NULL;

-- Step 4: Add foreign key constraints to company table
ALTER TABLE accounts ADD CONSTRAINT fk_accounts_company_id FOREIGN KEY (company_id) REFERENCES company(id) ON DELETE CASCADE;
ALTER TABLE contacts ADD CONSTRAINT fk_contacts_company_id FOREIGN KEY (company_id) REFERENCES company(id) ON DELETE CASCADE;
ALTER TABLE opportunities ADD CONSTRAINT fk_opportunities_company_id FOREIGN KEY (company_id) REFERENCES company(id) ON DELETE CASCADE;
ALTER TABLE opportunity_stages ADD CONSTRAINT fk_opportunity_stages_company_id FOREIGN KEY (company_id) REFERENCES company(id) ON DELETE CASCADE;
ALTER TABLE custom_field_definitions ADD CONSTRAINT fk_custom_field_definitions_company_id FOREIGN KEY (company_id) REFERENCES company(id) ON DELETE CASCADE;

-- Step 5: Create indexes on company_id for better performance
CREATE INDEX IF NOT EXISTS idx_accounts_company_id ON accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_company_id ON opportunities(company_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_stages_company_id ON opportunity_stages(company_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_company_id ON custom_field_definitions(company_id);

-- Step 6: Update created_by and updated_by to use INTEGER (user IDs)
-- First, add new columns
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER;
ALTER TABLE opportunity_stages ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE opportunity_stages ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER;
ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER;

-- Step 7: Copy data from UUID fields to INTEGER fields (if needed)
-- This step depends on your existing data structure
-- You may need to map UUID user IDs to INTEGER user IDs

-- Step 8: Add foreign key constraints to users table
ALTER TABLE accounts ADD CONSTRAINT fk_accounts_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE accounts ADD CONSTRAINT fk_accounts_updated_by_user_id FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE contacts ADD CONSTRAINT fk_contacts_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE contacts ADD CONSTRAINT fk_contacts_updated_by_user_id FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE opportunities ADD CONSTRAINT fk_opportunities_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE opportunities ADD CONSTRAINT fk_opportunities_updated_by_user_id FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE opportunity_stages ADD CONSTRAINT fk_opportunity_stages_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE opportunity_stages ADD CONSTRAINT fk_opportunity_stages_updated_by_user_id FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE custom_field_definitions ADD CONSTRAINT fk_custom_field_definitions_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE custom_field_definitions ADD CONSTRAINT fk_custom_field_definitions_updated_by_user_id FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Step 9: Create indexes on user ID fields
CREATE INDEX IF NOT EXISTS idx_accounts_created_by_user_id ON accounts(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_updated_by_user_id ON accounts(updated_by_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_created_by_user_id ON contacts(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_updated_by_user_id ON contacts(updated_by_user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_created_by_user_id ON opportunities(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_updated_by_user_id ON opportunities(updated_by_user_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_stages_created_by_user_id ON opportunity_stages(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_stages_updated_by_user_id ON opportunity_stages(updated_by_user_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_created_by_user_id ON custom_field_definitions(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_updated_by_user_id ON custom_field_definitions(updated_by_user_id);

-- Step 10: Update RLS policies to use company_id instead of tenant_id
-- Drop existing policies
DROP POLICY IF EXISTS accounts_tenant_isolation ON accounts;
DROP POLICY IF EXISTS contacts_tenant_isolation ON contacts;
DROP POLICY IF EXISTS opportunities_tenant_isolation ON opportunities;
DROP POLICY IF EXISTS opportunity_stages_tenant_isolation ON opportunity_stages;
DROP POLICY IF EXISTS custom_field_definitions_tenant_isolation ON custom_field_definitions;

-- Create new policies using company_id
CREATE POLICY accounts_company_isolation ON accounts
    FOR ALL USING (company_id = current_setting('app.current_company_id')::integer);

CREATE POLICY contacts_company_isolation ON contacts
    FOR ALL USING (company_id = current_setting('app.current_company_id')::integer);

CREATE POLICY opportunities_company_isolation ON opportunities
    FOR ALL USING (company_id = current_setting('app.current_company_id')::integer);

CREATE POLICY opportunity_stages_company_isolation ON opportunity_stages
    FOR ALL USING (company_id = current_setting('app.current_company_id')::integer);

CREATE POLICY custom_field_definitions_company_isolation ON custom_field_definitions
    FOR ALL USING (company_id = current_setting('app.current_company_id')::integer);

-- Step 11: Update the function to set company context instead of tenant context
CREATE OR REPLACE FUNCTION set_company_context(company_id integer)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_company_id', company_id::text, false);
END;
$$ LANGUAGE plpgsql;

-- Step 12: Add comments for documentation
COMMENT ON COLUMN accounts.company_id IS 'Company ID for multi-tenancy support (replaces tenant_id)';
COMMENT ON COLUMN contacts.company_id IS 'Company ID for multi-tenancy support (replaces tenant_id)';
COMMENT ON COLUMN opportunities.company_id IS 'Company ID for multi-tenancy support (replaces tenant_id)';
COMMENT ON COLUMN opportunity_stages.company_id IS 'Company ID for multi-tenancy support (replaces tenant_id)';
COMMENT ON COLUMN custom_field_definitions.company_id IS 'Company ID for multi-tenancy support (replaces tenant_id)';

COMMENT ON COLUMN accounts.created_by_user_id IS 'User ID who created the record (replaces created_by UUID)';
COMMENT ON COLUMN accounts.updated_by_user_id IS 'User ID who last updated the record (replaces updated_by UUID)';
COMMENT ON COLUMN contacts.created_by_user_id IS 'User ID who created the record (replaces created_by UUID)';
COMMENT ON COLUMN contacts.updated_by_user_id IS 'User ID who last updated the record (replaces updated_by UUID)';
COMMENT ON COLUMN opportunities.created_by_user_id IS 'User ID who created the record (replaces created_by UUID)';
COMMENT ON COLUMN opportunities.updated_by_user_id IS 'User ID who last updated the record (replaces updated_by UUID)';
COMMENT ON COLUMN opportunity_stages.created_by_user_id IS 'User ID who created the record (replaces created_by UUID)';
COMMENT ON COLUMN opportunity_stages.updated_by_user_id IS 'User ID who last updated the record (replaces updated_by UUID)';
COMMENT ON COLUMN custom_field_definitions.created_by_user_id IS 'User ID who created the record (replaces created_by UUID)';
COMMENT ON COLUMN custom_field_definitions.updated_by_user_id IS 'User ID who last updated the record (replaces updated_by UUID)';

-- Note: After this migration, you can optionally drop the old UUID columns:
-- ALTER TABLE accounts DROP COLUMN IF EXISTS tenant_id;
-- ALTER TABLE accounts DROP COLUMN IF EXISTS created_by;
-- ALTER TABLE accounts DROP COLUMN IF EXISTS updated_by;
-- (Repeat for other tables)
