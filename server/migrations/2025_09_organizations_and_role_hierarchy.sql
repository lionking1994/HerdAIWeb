-- Organizations within a company and per-organization role hierarchy

-- 1) Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_company_id ON organizations(company_id);

-- 2) Organization role nodes: tree structure referencing company roles
CREATE TABLE IF NOT EXISTS organization_role_nodes (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES company_roles(id) ON DELETE CASCADE,
  parent_node_id INTEGER REFERENCES organization_role_nodes(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  depth_level INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, role_id, parent_node_id)
);

CREATE INDEX IF NOT EXISTS idx_org_role_nodes_org ON organization_role_nodes(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_role_nodes_parent ON organization_role_nodes(parent_node_id);
CREATE INDEX IF NOT EXISTS idx_org_role_nodes_sort ON organization_role_nodes(organization_id, parent_node_id, sort_order);

-- 3) Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orgs_updated ON organizations;
CREATE TRIGGER trg_orgs_updated
BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_org_role_nodes_updated ON organization_role_nodes;
CREATE TRIGGER trg_org_role_nodes_updated
BEFORE UPDATE ON organization_role_nodes
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


