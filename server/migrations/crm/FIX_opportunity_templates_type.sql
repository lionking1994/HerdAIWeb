-- FIX: Change template_id from INTEGER to UUID
-- This fixes the type mismatch error when joining with psa_project_templates

-- Step 1: Drop the existing table (if you haven't added any data yet)
-- If you have data, you'll need to migrate it first
DROP TABLE IF EXISTS opportunity_templates CASCADE;

-- Step 2: Recreate with correct types
CREATE TABLE opportunity_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL UNIQUE,  -- Only ONE template per opportunity
  template_id UUID NOT NULL,  -- UUID to match psa_project_templates.id
  tenant_id INTEGER NOT NULL,
  notes TEXT,
  attached_at TIMESTAMP DEFAULT NOW(),
  attached_by INTEGER
);

-- Step 3: Add comments for documentation
COMMENT ON TABLE opportunity_templates IS 'Links CRM opportunities to PSA project templates for cost estimation';
COMMENT ON COLUMN opportunity_templates.opportunity_id IS 'UUID of the CRM opportunity';
COMMENT ON COLUMN opportunity_templates.template_id IS 'UUID of the PSA project template (matches psa_project_templates.id)';
COMMENT ON COLUMN opportunity_templates.notes IS 'Optional notes about why this template was selected';
COMMENT ON COLUMN opportunity_templates.attached_by IS 'User ID who attached the template';

-- If you already have data in the table, use this instead:
-- ALTER TABLE opportunity_templates ALTER COLUMN template_id TYPE UUID USING template_id::text::uuid;

