# Workflow Database Schema Documentation

## Overview
This document describes the database schema for the workflow functionality in the admin panel. The schema supports creating, managing, and executing complex workflows with multiple steps, approvals, forms, and automated actions.

## Tables Structure

### 1. workflows
Main table for storing workflow definitions.

**Columns:**
- `id` - Primary key
- `name` - Workflow name
- `description` - Workflow description
- `company_id` - Foreign key to companies table
- `version` - Version number for workflow updates
- `is_active` - Whether the workflow is active
- `is_template` - Whether this is a template workflow
- `category` - Workflow category (HR, Finance, etc.)
- `tags` - Array of tags for categorization
- `created_at`, `updated_at` - Timestamps
- `created_by`, `updated_by` - User references

### 2. workflow_steps
Stores individual steps within a workflow.

**Columns:**
- `id` - Primary key
- `workflow_id` - Foreign key to workflows table
- `name` - Step name
- `type` - Step type: 'form', 'approval', 'agent', 'email'
- `description` - Step description
- `assignee_type` - 'role' or 'person'
- `assignee_role` - Role name if assignee_type is 'role'
- `assignee_person` - Person name if assignee_type is 'person'
- `due_date` - Due date for the step
- `priority` - 'low', 'medium', 'high'
- `dependencies` - Array of step IDs this step depends on
- `position_x`, `position_y` - Visual position in workflow builder
- `form_fields` - JSONB for form configuration
- `agent_config` - JSONB for agent configuration
- `email_config` - JSONB for email configuration
- `step_order` - Order of steps in workflow

### 3. workflow_connections
Stores connections between workflow steps.

**Columns:**
- `id` - Primary key
- `workflow_id` - Foreign key to workflows table
- `source_step_id` - Source step ID
- `target_step_id` - Target step ID
- `condition_type` - Type of condition: 'always', 'conditional', 'approval'
- `condition_config` - JSONB for condition configuration

### 4. workflow_instances
Stores running instances of workflows.

**Columns:**
- `id` - Primary key
- `workflow_id` - Foreign key to workflows table
- `name` - Instance name
- `status` - 'active', 'completed', 'paused', 'cancelled'
- `current_step_id` - Currently active step
- `data` - JSONB for workflow instance data
- `started_at`, `completed_at` - Timestamps
- `assigned_to` - User assigned to the workflow
- `created_by` - User who created the instance

### 5. workflow_step_instances
Tracks progress of individual steps within workflow instances.

**Columns:**
- `id` - Primary key
- `workflow_instance_id` - Foreign key to workflow_instances
- `workflow_step_id` - Foreign key to workflow_steps
- `status` - 'pending', 'in_progress', 'completed', 'failed', 'skipped'
- `assigned_to` - User assigned to the step
- `started_at`, `completed_at` - Timestamps
- `data` - JSONB for step-specific data
- `comments` - Comments on the step

### 6. workflow_templates
Stores reusable workflow templates.

**Columns:**
- `id` - Primary key
- `name` - Template name
- `description` - Template description
- `category` - Template category
- `tags` - Array of tags
- `is_public` - Whether template is publicly available
- `created_by` - User who created the template

### 7. workflow_history
Audit trail for workflow changes.

**Columns:**
- `id` - Primary key
- `workflow_id` - Foreign key to workflows (optional)
- `workflow_instance_id` - Foreign key to workflow_instances (optional)
- `action` - Action performed: 'created', 'updated', 'activated', etc.
- `user_id` - User who performed the action
- `changes` - JSONB storing what was changed
- `timestamp` - When the action occurred

### 8. workflow_form_submissions
Stores form submissions within workflow steps.

**Columns:**
- `id` - Primary key
- `workflow_instance_id` - Foreign key to workflow_instances
- `workflow_step_id` - Foreign key to workflow_steps
- `submitted_by` - User who submitted the form
- `form_data` - JSONB containing form submission data
- `submitted_at` - Submission timestamp
- `status` - 'submitted', 'approved', 'rejected', 'pending_review'

### 9. workflow_approvals
Stores approval decisions for workflow steps.

**Columns:**
- `id` - Primary key
- `workflow_instance_id` - Foreign key to workflow_instances
- `workflow_step_id` - Foreign key to workflow_steps
- `approver_id` - User who made the approval decision
- `status` - 'pending', 'approved', 'rejected'
- `comments` - Approval comments
- `approved_at` - When approval was made
- `created_at`, `updated_at` - Timestamps

### 10. workflow_notifications
Stores notifications sent to users about workflows.

**Columns:**
- `id` - Primary key
- `workflow_instance_id` - Foreign key to workflow_instances (optional)
- `workflow_step_id` - Foreign key to workflow_steps (optional)
- `user_id` - User to notify
- `type` - Notification type: 'assignment', 'approval_required', etc.
- `title` - Notification title
- `message` - Notification message
- `is_read` - Whether notification has been read
- `sent_at`, `read_at` - Timestamps

## Views

### workflow_stats
Provides statistics about workflows including instance counts and completion times.

### user_workflow_assignments
Shows workflow assignments and pending tasks for each user.

## Functions

### get_workflow_step_dependencies(workflow_id)
Returns all steps and their dependencies for a given workflow.

### can_start_workflow_step(step_id, instance_id)
Checks if a workflow step can be started based on its dependencies.

## Usage Examples

### Creating a new workflow
```sql
INSERT INTO workflows (name, description, company_id, created_by) 
VALUES ('Employee Onboarding', 'Standard onboarding process', 1, 1);
```

### Adding steps to a workflow
```sql
INSERT INTO workflow_steps (workflow_id, name, type, assignee_type, assignee_role, position_x, position_y)
VALUES 
  (1, 'Submit Application', 'form', 'role', 'applicant', 100, 100),
  (1, 'HR Review', 'approval', 'role', 'hr_manager', 300, 100),
  (1, 'Send Welcome Email', 'email', 'role', 'system', 500, 100);
```

### Creating connections between steps
```sql
INSERT INTO workflow_connections (workflow_id, source_step_id, target_step_id, condition_type)
VALUES 
  (1, 1, 2, 'always'),
  (1, 2, 3, 'approval');
```

### Starting a workflow instance
```sql
INSERT INTO workflow_instances (workflow_id, name, assigned_to, created_by)
VALUES (1, 'Onboarding - John Doe', 2, 1);
```

## Migration Files

1. `workflow_tables.sql` - Main tables and basic structure
2. `workflow_tables_part2.sql` - Additional tables and indexes
3. `workflow_tables_part3.sql` - Triggers, sample data, and functions

## Running the Migrations

Execute the migration files in order:

```bash
psql -d your_database -f server/migrations/workflow_tables.sql
psql -d your_database -f server/migrations/workflow_tables_part2.sql
psql -d your_database -f server/migrations/workflow_tables_part3.sql
```

## Notes

- All tables use PostgreSQL's JSONB type for flexible data storage
- Foreign key constraints ensure data integrity
- Indexes are created for optimal query performance
- Triggers automatically update `updated_at` timestamps
- Sample data includes common workflow templates
- Views provide convenient access to aggregated data 