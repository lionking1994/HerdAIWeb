# Account Consolidation Feature

## Overview

The Account Consolidation feature allows platform administrators to merge multiple user accounts into a single primary account. This is particularly useful for companies that have duplicate accounts or need to consolidate user data.

## Features

- **Multi-Account Selection**: Admins can select multiple accounts to consolidate
- **Primary Account Selection**: One account must be designated as the primary account
- **Task Reassignment**: All open tasks from inactive accounts are automatically reassigned to the primary account
- **Account Deactivation**: Non-primary accounts are set to inactive status
- **Transaction Safety**: All operations are wrapped in database transactions for data integrity

## How It Works

### Frontend (Admin Panel)

1. **Access**: Navigate to User Management in the admin panel
2. **Consolidate Button**: Click the "Consolidate Accounts" button in the header
3. **Account Selection**: 
   - Select multiple accounts using checkboxes
   - Choose one account as the primary account
4. **Confirmation**: Review the consolidation summary and click "Consolidate Accounts"

### Backend Process

1. **Validation**: 
   - Ensures at least 2 accounts are selected
   - Validates that primary account is among selected accounts
   - Checks that all accounts belong to the same company

2. **Task Reassignment**:
   - Finds all open tasks (status: 'open', 'in_progress', 'pending') from accounts to be deactivated
   - Reassigns these tasks to the primary account
   - Updates task owner information

3. **Account Deactivation**:
   - Sets status of non-primary accounts to 'disabled'
   - Primary account remains active

4. **Transaction Safety**:
   - All operations are wrapped in database transactions
   - If any step fails, all changes are rolled back

## API Endpoints

### GET /users/consolidation-accounts
Returns all enabled accounts with their open task counts.

**Response:**
```json
{
  "success": true,
  "accounts": [
    {
      "id": "123",
      "name": "John Doe",
      "email": "john@company.com",
      "status": "enabled",
      "open_tasks_count": 5
    }
  ]
}
```

### POST /users/consolidate-accounts
Performs the account consolidation.

**Request Body:**
```json
{
  "selectedAccountIds": ["123", "456", "789"],
  "primaryAccountId": "123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully consolidated 2 accounts into John Doe",
  "consolidatedAccounts": 2,
  "primaryAccount": "John Doe",
  "reassignedTasks": 8
}
```

## Security

- Only platform administrators can access this feature
- All operations require authentication
- Database transactions prevent partial updates

## Error Handling

The system handles various error scenarios:

- **Invalid Input**: Missing required fields or invalid account selections
- **Account Not Found**: Selected accounts don't exist
- **Database Errors**: Transaction rollback on any database operation failure

## Database Changes

The feature uses existing database tables:
- `users`: For account information and status updates
- `tasks`: For task reassignment
- `company`: For company domain validation

No new database tables or migrations are required.

## Usage Guidelines

1. **Before Consolidation**:
   - Review all accounts to be consolidated
   - Ensure the primary account is the correct choice
   - Verify that open tasks will be properly reassigned

2. **After Consolidation**:
   - Verify that all open tasks are now assigned to the primary account
   - Check that inactive accounts are properly disabled
   - Monitor for any issues with task assignments

3. **Best Practices**:
   - Always communicate with users before consolidation
   - Keep records of consolidation operations
   - Test the feature in a development environment first

## Troubleshooting

### Common Issues

1. **"At least 2 accounts must be selected"**
   - Ensure you've selected multiple accounts before proceeding

2. **"Primary account must be selected"**
   - Make sure to designate one account as primary using the "Set as Primary" button

3. **"Some accounts not found"**
   - Verify that all selected accounts exist and belong to the company

4. **Transaction failures**
   - Check database connectivity and permissions
   - Review server logs for detailed error information

### Recovery

If consolidation fails:
- All changes are automatically rolled back
- No data is lost
- You can retry the operation after resolving the issue

## Future Enhancements

Potential improvements for future versions:
- Audit logging of consolidation operations
- Email notifications to affected users
- Bulk consolidation operations
- Preview mode to show what will happen before execution
- Undo functionality for recent consolidations 