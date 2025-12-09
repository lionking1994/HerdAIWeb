# Weight Percentage Implementation for Opportunity Stages

## Overview
This document describes the implementation of the `weight_percentage` field for opportunity stages in the CRM system. The weight percentage allows users to assign importance weights to different stages in the sales pipeline for better forecasting and analysis.

## Changes Made

### 1. Database Schema
- **Migration File**: `server/migrations/crm/015_add_weight_percentage_to_stages.sql`
- **Column**: `weight_percentage NUMERIC(5,2) DEFAULT 0.00`
- **Constraint**: Check constraint ensuring values between 0 and 100
- **Index**: Performance index on weight_percentage column

### 2. Type Definitions
- **File**: `admin/src/types/crm.ts`
- **Updated**: `OpportunityStage` interface to include `weight_percentage: number`

### 3. Frontend Components

#### StageForm Component
- **File**: `admin/src/components/CRM/StageForm.tsx`
- **Added**: Weight percentage input field with validation (0-100%)
- **Features**: 
  - Numeric input with step 0.1
  - Validation for range 0-100
  - Error display for invalid values
  - Default value handling

#### Stages Page
- **File**: `admin/src/pages/CRM/Stages.tsx`
- **Added**: 
  - Weight percentage column in data table
  - Visual weight percentage display with purple badge
  - Total weight calculation and display
  - Weight percentage info card
  - Form submission handling for weight_percentage

### 4. Backend API

#### Stage Controller
- **File**: `server/controllers/crm/stageController.js`
- **Updated**: 
  - `createStage`: Added weight_percentage validation and insertion
  - `updateStage`: Added weight_percentage validation
  - Validation: Ensures weight_percentage is between 0-100

#### Stage Model
- **File**: `server/models/crm/OpportunityStage.js`
- **Updated**: 
  - `create` method: Includes weight_percentage field
  - `update` method: Handles weight_percentage updates

### 5. Migration Script
- **File**: `server/scripts/run_weight_percentage_migration.js`
- **Purpose**: Executes the database migration
- **Features**: 
  - SQL statement execution
  - Error handling for existing constraints
  - Migration verification
  - Default weight distribution for existing stages

## Database Migration

### Running the Migration
```bash
cd server
node scripts/run_weight_percentage_migration.js
```

### Migration Details
1. **Add Column**: Creates `weight_percentage` column with default value 0.00
2. **Add Constraint**: Ensures values are between 0 and 100
3. **Set Defaults**: Assigns reasonable default weights to existing stages based on order_index
4. **Create Index**: Improves query performance

### Default Weight Distribution
- Order 1: 20%
- Order 2: 25%
- Order 3: 20%
- Order 4: 15%
- Order 5: 10%
- Order 6: 5%
- Order 7: 3%
- Order 8: 2%
- Others: 1%

## Usage

### Creating/Editing Stages
1. Navigate to CRM > Stages
2. Click "Add New" or edit existing stage
3. Fill in the weight percentage field (0-100%)
4. Save the stage

### Weight Management
- **Total Weight**: Displayed at bottom of stages table
- **Visual Indicators**: 
  - Green: Total equals 100%
  - Orange: Total under or over 100%
- **Best Practice**: Aim for total weight of 100% across all stages

### Validation Rules
- **Range**: 0.00 to 100.00
- **Precision**: Up to 2 decimal places
- **Required**: Field is required but defaults to 0 if not specified

## Benefits

1. **Sales Forecasting**: Better pipeline value calculations
2. **Stage Analysis**: Identify high-value stages
3. **Performance Metrics**: Track conversion rates by weight
4. **Pipeline Optimization**: Balance stage distribution

## Future Enhancements

1. **Weight Validation**: Warn users when total ≠ 100%
2. **Auto-balancing**: Suggest weight adjustments
3. **Historical Tracking**: Track weight changes over time
4. **Reporting**: Include weight-based analytics

## Testing

### Frontend Testing
- Form validation (0-100 range)
- Error message display
- Data persistence
- Table display formatting

### Backend Testing
- API validation
- Database constraints
- Migration rollback
- Performance impact

## Rollback Plan

If rollback is needed:
```sql
-- Remove the column
ALTER TABLE opportunity_stages DROP COLUMN IF EXISTS weight_percentage;

-- Remove the constraint
ALTER TABLE opportunity_stages DROP CONSTRAINT IF EXISTS chk_weight_percentage_range;

-- Remove the index
DROP INDEX IF EXISTS idx_opportunity_stages_weight_percentage;
```

## Dependencies

- React frontend components
- Express.js backend API
- PostgreSQL database
- Node.js migration scripts

## Notes

- The implementation maintains backward compatibility
- Existing stages will have default weights assigned
- The weight_percentage field is optional but recommended
- Performance impact is minimal due to proper indexing
