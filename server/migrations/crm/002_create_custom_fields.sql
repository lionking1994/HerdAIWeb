-- Create custom_field_definitions table
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  table_name VARCHAR(50) NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  field_type VARCHAR(50) NOT NULL,
  field_label VARCHAR(100) NOT NULL,
  field_description TEXT,
  is_required BOOLEAN DEFAULT FALSE,
  default_value TEXT,
  validation_rules JSONB,
  select_options JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INTEGER DEFAULT 1
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_tenant_id ON custom_field_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_table_name ON custom_field_definitions(table_name);
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_field_name ON custom_field_definitions(field_name);
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_tenant_table ON custom_field_definitions(tenant_id, table_name);

-- Create unique constraint to prevent duplicate field names within the same table and tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_field_definitions_unique_field 
ON custom_field_definitions(tenant_id, table_name, field_name);

-- Add comments for documentation
COMMENT ON TABLE custom_field_definitions IS 'Stores custom field definitions for CRM entities';
COMMENT ON COLUMN custom_field_definitions.tenant_id IS 'Reference to the tenant/company';
COMMENT ON COLUMN custom_field_definitions.table_name IS 'The table this custom field belongs to (accounts, contacts, opportunities)';
COMMENT ON COLUMN custom_field_definitions.field_name IS 'Internal field name (lowercase with underscores)';
COMMENT ON COLUMN custom_field_definitions.field_type IS 'Type of field (text, number, date, boolean, email, phone, url, single_select, multi_select)';
COMMENT ON COLUMN custom_field_definitions.field_label IS 'Display label for the field';
COMMENT ON COLUMN custom_field_definitions.field_description IS 'Optional description of the field';
COMMENT ON COLUMN custom_field_definitions.is_required IS 'Whether this field is required';
COMMENT ON COLUMN custom_field_definitions.default_value IS 'Default value for the field';
COMMENT ON COLUMN custom_field_definitions.validation_rules IS 'JSON object containing validation rules';
COMMENT ON COLUMN custom_field_definitions.select_options IS 'JSON array of options for select/multi_select fields';
COMMENT ON COLUMN custom_field_definitions.version IS 'Version number for optimistic locking';
