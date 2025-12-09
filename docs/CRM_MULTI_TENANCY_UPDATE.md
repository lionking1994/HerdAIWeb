# CRM Multi-Tenancy Update: From Tenant UUIDs to Company IDs

## Overview

This document describes the migration from the old tenant-based multi-tenancy system to a new company-based system in the CRM. The key change is replacing hardcoded tenant UUIDs with dynamic company IDs from the URL query parameters.

## What Changed

### Before (Old System)
- CRM used hardcoded `tenant_id` values (UUIDs)
- All CRM data was isolated by tenant UUID
- Authentication relied on user email domain to determine tenant
- Fallback to hardcoded UUID: `'56718904-e3a0-4de7-983b-ef7dda1eec86'`

### After (New System)
- CRM uses dynamic `company_id` from URL query parameters (e.g., `/crm?company=7544`)
- All CRM data is isolated by company ID (INTEGER)
- Company ID comes from the `company` table in the database
- No more hardcoded values

## Database Schema Changes

### New Columns Added
- `company_id` (INTEGER) - replaces `tenant_id` for multi-tenancy
- `created_by_user_id` (INTEGER) - replaces `created_by` UUID
- `updated_by_user_id` (INTEGER) - replaces `updated_by` UUID

### Foreign Key Relationships
- `company_id` → `company.id` (CASCADE on delete)
- `created_by_user_id` → `users.id` (SET NULL on delete)
- `updated_by_user_id` → `users.id` (SET NULL on delete)

### RLS Policies Updated
- Old: `tenant_id = current_setting('app.current_tenant_id')`
- New: `company_id = current_setting('app.current_company_id')::integer`

## Frontend Changes

### New Hook: `useCompanyId()`
```typescript
import { useCompanyId } from '../../hooks/useCompanyId';

export default function Dashboard() {
  const companyId = useCompanyId(); // Gets company ID from URL
  // ... rest of component
}
```

### Updated Services
- `CRMService` now requires company ID in constructor
- `CustomFieldService` now requires company ID in constructor
- All API calls automatically include company parameter

```typescript
// Old way
const crmService = new CRMService();

// New way
const crmService = createCRMService(companyId);
const customFieldService = createCustomFieldService(companyId);
```

### URL Structure
- **Old**: `/crm` (hardcoded tenant)
- **New**: `/crm?company=7544` (dynamic company)

## Backend Changes

### New Utility Functions
```javascript
// Get company ID from request
const getCompanyId = (req) => {
  if (req.query.company) {
    return parseInt(req.query.company);
  }
  if (req.user && req.user.company_id) {
    return req.user.company_id;
  }
  throw new Error('Company ID is required');
};
```

### Updated Controllers
- All CRM controllers now use `getCompanyId(req)` instead of hardcoded values
- Database queries use `company_id` instead of `tenant_id`
- Proper error handling for missing company ID

### Company Context Management
```javascript
// Set company context for RLS
await CompanyContext.setCompanyContext(companyId);

// Get current company context
const company = await CompanyContext.getCurrentCompanyContext();
```

## Migration Steps

### 1. Database Migration
Run the migration script: `server/migrations/crm/012_update_tenant_id_to_company.sql`

This script:
- Adds new `company_id` columns
- Sets default company ID (7544) for existing data
- Creates foreign key constraints
- Updates RLS policies
- Creates performance indexes

### 2. Update Frontend Components
- Import and use `useCompanyId()` hook
- Update service instantiation to use factory functions
- Ensure all navigation links include company parameter

### 3. Update Backend Controllers
- Replace hardcoded tenant logic with `getCompanyId(req)`
- Update database queries to use `company_id`
- Test data isolation between companies

### 4. Test Data Isolation
- Create test data for different companies
- Verify that company A cannot see company B's data
- Test all CRUD operations with company context

## Benefits of the New System

1. **Dynamic Multi-Tenancy**: No more hardcoded values
2. **Better Performance**: INTEGER IDs vs UUIDs
3. **Cleaner URLs**: Explicit company identification
4. **Easier Management**: Company-based data isolation
5. **Scalability**: Better support for multiple companies
6. **Maintainability**: Clear separation of concerns

## Backward Compatibility

- Legacy functions are maintained with deprecation warnings
- Old tenant-based code will continue to work during transition
- Gradual migration path available

## Testing

### Test Cases
1. **Company Isolation**: Verify data from company A is not visible to company B
2. **URL Parameters**: Test with different company IDs in URL
3. **Authentication**: Ensure proper company access control
4. **CRUD Operations**: Test all operations with company context
5. **Error Handling**: Test missing or invalid company IDs

### Test Data
```sql
-- Test with different companies
INSERT INTO company (id, name, domain) VALUES 
(7544, 'Test Company A', 'companya.com'),
(7545, 'Test Company B', 'companyb.com');

-- Test data isolation
INSERT INTO contacts (company_id, first_name, last_name) VALUES 
(7544, 'John', 'Doe'),
(7545, 'Jane', 'Smith');
```

## Troubleshooting

### Common Issues

1. **Company ID Missing**
   - Error: "Company ID is required"
   - Solution: Ensure URL includes `?company=123`

2. **Data Not Loading**
   - Check company ID in URL
   - Verify company exists in database
   - Check RLS policies

3. **Permission Errors**
   - Verify user belongs to company
   - Check company is enabled
   - Verify RLS context is set

### Debug Commands
```sql
-- Check current company context
SELECT current_setting('app.current_company_id');

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'contacts';

-- Verify company data
SELECT * FROM company WHERE id = 7544;
```

## Future Enhancements

1. **Company Settings**: Per-company configuration
2. **User Roles**: Company-specific user permissions
3. **Data Export**: Company-specific data export
4. **Audit Logs**: Company-based audit trails
5. **API Rate Limiting**: Per-company rate limits

## Support

For questions or issues with this migration:
1. Check the migration logs
2. Verify database schema changes
3. Test with different company IDs
4. Review RLS policy configuration
