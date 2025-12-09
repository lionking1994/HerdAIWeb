// CRM Type Definitions
export type TableName = 'accounts' | 'contacts' | 'opportunities';


export type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'email' | 'phone' | 'url' | 'single_select' | 'multi_select' | 'user_lookup';


export type AccountRelationshipType = 'parent' | 'subsidiary' | 'partner' | 'related' | 'competitor';

export type ContactRelationshipType = 'employee' | 'contact' | 'decision_maker' | 'influencer' | 'stakeholder';

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface CustomFieldDefinition {
  id: string;
  tenant_id: string;
  table_name: TableName;
  field_name: string;
  field_type: FieldType;
  field_label: string;
  field_description?: string;
  is_required: boolean;
  default_value?: any;
  validation_rules?: any;
  select_options?: string[];
  created_at: string;
  updated_at: string;
  version: number;
}

export interface Account {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  parent_account_id?: string;
  account_type: string;
  industry?: string;
  website?: string;
  phone?: string;
  email?: string;
  billing_address?: any;
  shipping_address?: any;
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface Contact {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  mobile_phone?: string;
  title?: string;
  department?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country: string;
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface OpportunityStage {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  order_index: number;
  weight_percentage: number;
  is_active: boolean;
  is_closed_won: boolean;
  is_closed_lost: boolean;
  created_at: string;
  updated_at: string;
}

export interface Opportunity {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  amount?: number;
  probability: number;
  stage: string;
  stage_id?: string;
  expected_close_date?: string;
  actual_close_date?: string;
  account_id?: string;
  owner_id?: string;
  lead_source?: string;
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface AccountContact {
  id: string;
  tenant_id: string;
  account_id: string;
  contact_id: string;
  role?: string;
  is_primary: boolean;
  relationship_type: string;
  description?: string;
  created_at: string;
}

export interface OpportunityContact {
  id: string;
  tenant_id: string;
  opportunity_id: string;
  contact_id: string;
  role: string;
  created_at: string;
}

export interface AccountRelationship {
  id: string;
  tenant_id: string;
  parent_account_id: string;
  child_account_id: string;
  relationship_type: string;
  description?: string;
  created_at: string;
  created_by?: string;
}