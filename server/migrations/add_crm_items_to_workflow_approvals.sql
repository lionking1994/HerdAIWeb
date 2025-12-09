-- Migration to add CRM items support to workflow approvals
-- This migration adds a crm_items column to store selected CRM items for CRM approval nodes

-- Add crm_items column to workflow_approvals table
ALTER TABLE workflow_approvals 
ADD COLUMN IF NOT EXISTS crm_items JSONB DEFAULT '{}';

-- Add node_type column to distinguish between regular and CRM approval nodes
ALTER TABLE workflow_approvals 
ADD COLUMN IF NOT EXISTS node_type VARCHAR(50) DEFAULT 'approvalNode';

-- Add approver_name column for better tracking
ALTER TABLE workflow_approvals 
ADD COLUMN IF NOT EXISTS approver_name VARCHAR(255);

-- Create index on crm_items for better query performance
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_crm_items 
ON workflow_approvals USING GIN (crm_items);

-- Create index on node_type for filtering
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_node_type 
ON workflow_approvals (node_type);

-- Add comment to document the new column
COMMENT ON COLUMN workflow_approvals.crm_items IS 'JSONB field storing selected CRM items (accounts, contacts, opportunities) for CRM approval nodes';
COMMENT ON COLUMN workflow_approvals.node_type IS 'Type of approval node: approvalNode or crmApprovalNode';
COMMENT ON COLUMN workflow_approvals.approver_name IS 'Name of the approver for better tracking'; 