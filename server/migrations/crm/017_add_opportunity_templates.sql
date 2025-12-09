-- Migration: Add Opportunity-Template Relationship
-- This creates a 1-to-1 relationship between opportunities and PSA templates

-- Step 1: Enhance psa_project_templates table with cost and resource details
ALTER TABLE psa_project_templates 
ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS budget_hours INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS resource_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS resource_details JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS all_required_skills TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS duration_weeks INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN psa_project_templates.estimated_cost IS 'Total estimated cost for the project based on resources and hours';
COMMENT ON COLUMN psa_project_templates.budget_hours IS 'Total budget hours for all work items';
COMMENT ON COLUMN psa_project_templates.resource_count IS 'Number of resources required';
COMMENT ON COLUMN psa_project_templates.resource_details IS 'Array of resource requirements with roles and allocations';
COMMENT ON COLUMN psa_project_templates.all_required_skills IS 'Aggregated list of all required skills across all items';
COMMENT ON COLUMN psa_project_templates.duration_weeks IS 'Estimated project duration in weeks';

-- Step 2: Create opportunity_template relationship table (SIMPLE VERSION)
CREATE TABLE IF NOT EXISTS opportunity_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL UNIQUE,  -- Only ONE template per opportunity
  template_id UUID NOT NULL,  -- UUID to match psa_project_templates.id
  tenant_id INTEGER NOT NULL,
  notes TEXT,
  attached_at TIMESTAMP DEFAULT NOW(),
  attached_by INTEGER
);

-- Add comments for documentation
COMMENT ON TABLE opportunity_templates IS 'Links CRM opportunities to PSA project templates for cost estimation';
COMMENT ON COLUMN opportunity_templates.opportunity_id IS 'UUID of the CRM opportunity';
COMMENT ON COLUMN opportunity_templates.template_id IS 'UUID of the PSA project template (matches psa_project_templates.id)';
COMMENT ON COLUMN opportunity_templates.notes IS 'Optional notes about why this template was selected';
COMMENT ON COLUMN opportunity_templates.attached_by IS 'User ID who attached the template';

