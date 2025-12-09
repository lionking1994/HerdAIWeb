# Workflow Database Schema Summary

## Tables Created

### Core Tables
1. **workflows** - Main workflow definitions
2. **workflow_steps** - Individual steps within workflows
3. **workflow_connections** - Connections between steps
4. **workflow_instances** - Running workflow instances
5. **workflow_step_instances** - Progress tracking for steps

### Supporting Tables
6. **workflow_templates** - Reusable workflow templates
7. **workflow_history** - Audit trail
8. **workflow_form_submissions** - Form data storage
9. **workflow_approvals** - Approval decisions
10. **workflow_notifications** - User notifications

## Key Features

- **JSONB Storage**: Flexible data storage for forms, configurations
- **Foreign Key Constraints**: Data integrity
- **Indexes**: Optimized query performance
- **Triggers**: Automatic timestamp updates
- **Views**: Convenient data aggregation
- **Functions**: Helper functions for dependencies

## Migration Files

1. `workflow_tables.sql` - Main tables
2. `workflow_tables_part2.sql` - Additional tables & indexes
3. `workflow_tables_part3.sql` - Triggers & sample data

## Sample Data

Includes default templates:
- Employee Onboarding
- Project Approval
- Expense Approval
- Content Review

## Usage

Run migrations in order:
```bash
psql -d database -f workflow_tables.sql
psql -d database -f workflow_tables_part2.sql
psql -d database -f workflow_tables_part3.sql
``` 