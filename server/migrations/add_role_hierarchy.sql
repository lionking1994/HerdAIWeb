-- Add hierarchy support to company_roles table
ALTER TABLE company_roles ADD COLUMN IF NOT EXISTS parent_role_id INTEGER REFERENCES company_roles(id);
ALTER TABLE company_roles ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER DEFAULT 0;
ALTER TABLE company_roles ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Create index for better performance on hierarchy queries
CREATE INDEX IF NOT EXISTS idx_company_roles_parent_id ON company_roles(parent_role_id);
CREATE INDEX IF NOT EXISTS idx_company_roles_hierarchy_level ON company_roles(hierarchy_level);
CREATE INDEX IF NOT EXISTS idx_company_roles_sort_order ON company_roles(sort_order);
