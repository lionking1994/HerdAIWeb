# Financial Calculations Guide

This document explains all the calculations used in the PSA Financial Summary and Project Performance Report APIs.

## Table of Contents
1. [Financial Summary Report Calculations](#financial-summary-report-calculations)
2. [Project Performance Report Calculations](#project-performance-report-calculations)
3. [Resource Utilization Report Calculations](#resource-utilization-report-calculations)
4. [Common Formulas](#common-formulas)
5. [Data Sources](#data-sources)
6. [Rounding and Precision](#rounding-and-precision)

---

## Financial Summary Report Calculations

### 1. Project-Level Calculations

#### Revenue Calculation
```
Revenue = Total Project Costs × 1.3 (30% markup)
```

**Step-by-step:**
1. Calculate weekly cost for each resource: `Weekly Cost = (Allocation % ÷ 100) × Hours Per Week × Hourly Rate`
2. Calculate total project cost: `Total Cost = Weekly Cost × Weeks Elapsed`
3. Apply 30% markup: `Revenue = Total Cost × 1.3`

**Example:**
- Resource: Developer, 100% allocation, 40 hours/week, $75/hour
- Weekly Cost: (100 ÷ 100) × 40 × $75 = $3,000
- If project ran for 6 weeks: Total Cost = $3,000 × 6 = $18,000
- Revenue: $18,000 × 1.3 = $23,400

#### Cost Calculation
```
Cost = Weekly Cost × Weeks Elapsed
```

**Where:**
- `Weeks Elapsed = Max(0, (Current Date - Project Start Date) ÷ 7 days)`
- `Weekly Cost = Sum of all resource weekly costs`

#### Profit Calculation
```
Profit = Revenue - Cost
```

#### Profit Margin Calculation
```
Profit Margin (%) = (Profit ÷ Revenue) × 100
```

### 2. Summary-Level Calculations

#### Total Revenue
```
Total Revenue = Sum of all project revenues
```

#### Total Costs
```
Total Costs = Sum of all project costs
```

#### Gross Profit
```
Gross Profit = Total Revenue - Total Costs
```

#### Overall Profit Margin
```
Overall Profit Margin (%) = (Gross Profit ÷ Total Revenue) × 100
```

### 3. Key Performance Indicators (KPIs)

#### Billable Hours
```
Billable Hours = Sum of (Allocation % × Hours Per Week × Weeks Elapsed) for all resources
```

#### Average Hourly Rate
```
Average Hourly Rate = Total Revenue ÷ Total Billable Hours
```

#### Resource Utilization
```
Resource Utilization (%) = (Total Billable Hours ÷ (Total Resources × 40 hours/week × Weeks)) × 100
```

#### Revenue Per Resource
```
Revenue Per Resource = Total Revenue ÷ Total Number of Resources
```

### 4. Department Revenue
```
Department Revenue = Sum of all project revenues for resources in that department
```

### 5. Monthly Trends
```
Monthly Revenue = Monthly Cost × 1.3
Monthly Cost = Weekly Cost × 4 (approximate weeks per month)
Monthly Profit = Monthly Revenue - Monthly Cost
```

**Note:** Only includes months when projects are actually running.

---

## Project Performance Report Calculations

### 1. Budget Variance
```
Budget Variance = Budget Amount - Actual Spent
Budget Variance % = (Budget Variance ÷ Budget Amount) × 100
```

### 2. Schedule Variance
```
Schedule Variance = Planned Duration - Actual Duration
Schedule Variance % = (Schedule Variance ÷ Planned Duration) × 100
```

### 3. Cost Performance
```
Cost Performance = Budget Amount - Total Spent
Cost Performance % = (Cost Performance ÷ Budget Amount) × 100
```

### 4. Deliverable Progress
```
Deliverable Progress = (Completed Stories ÷ Total Stories) × 100
```

### 5. Overall Score Calculation
```
Overall Score = Weighted Average of:
- Budget Performance (40% weight)
- Schedule Performance (30% weight)  
- Deliverable Progress (30% weight)
```

**Formula:**
```
Overall Score = (Budget Performance × 0.4) + (Schedule Performance × 0.3) + (Deliverable Progress × 0.3)
```

### 6. Health Status
```
Health Status = 
- "Green": Overall Score ≥ 80%
- "Yellow": Overall Score 60-79%
- "Red": Overall Score < 60%
```

---

## Resource Utilization Report Calculations

### 1. Resource Allocation Calculation
```
Total Allocation = Sum of all project allocations for the resource
```

**Step-by-step:**
1. For each project where the resource is assigned, get the allocation percentage from `resource_allocations[array_position(resource_user_ids, user_id)]`
2. Sum all allocation percentages across all active projects
3. Cap at 100% maximum allocation

**Example:**
- Resource assigned to Project A with 60% allocation
- Resource assigned to Project B with 40% allocation
- Total Allocation = 60% + 40% = 100%

### 2. Utilization Percentage
```
Utilization = Min(Total Allocation, 100%)
```

**Note:** Utilization is the same as total allocation, capped at 100%.

### 3. Billable Hours Calculation
```
Billable Hours = (Utilization ÷ 100) × Hours Per Week
```

**Example:**
- Utilization: 80%
- Hours Per Week: 40
- Billable Hours = (80 ÷ 100) × 40 = 32 hours

### 4. Weekly Revenue Calculation
```
Weekly Revenue = Billable Hours × Hourly Rate
```

**Example:**
- Billable Hours: 32
- Hourly Rate: $75/hour
- Weekly Revenue = 32 × $75 = $2,400

### 5. Bench Time Calculation
```
Bench Time = 100% - Utilization
```

**Example:**
- Utilization: 80%
- Bench Time = 100% - 80% = 20%

### 6. Availability Calculation
```
Availability = Utilization (same as allocation percentage)
```

### 7. Resource Status Classification
```
Status = 
- "over-utilized": Utilization ≥ 90%
- "optimal": Utilization 80-89%
- "under-utilized": Utilization 60-79%
- "available": Utilization < 60%
```

### 8. Summary Statistics

#### Average Utilization
```
Average Utilization = Sum of all resource utilizations ÷ Total Resources
```

#### Total Weekly Revenue
```
Total Weekly Revenue = Sum of all resource weekly revenues
```

#### Resource Distribution
```
Over-utilized: Count of resources with utilization ≥ 90%
Optimal: Count of resources with utilization 80-89%
Under-utilized: Count of resources with utilization 60-79%
Available: Count of resources with utilization < 60%
```

### 9. Project Assignment Details
For each resource, collect:
- Project ID and Name
- Actual allocation percentage (from database)
- Role in the project

**Example Response:**
```json
{
  "assignedProjects": [
    {
      "id": "project-uuid-1",
      "name": "GetHERD Roadmap",
      "allocation": 60,
      "role": "Developer"
    },
    {
      "id": "project-uuid-2", 
      "name": "Test Project",
      "allocation": 40,
      "role": "Member"
    }
  ]
}
```

---

## Common Formulas

### Time Calculations

#### Weeks Elapsed
```
Weeks Elapsed = Max(0, (Current Date - Project Start Date) ÷ 7 days)
```

#### Project Duration
```
Total Duration = Project End Date - Project Start Date
Total Weeks = Total Duration ÷ 7 days
```

### Resource Calculations

#### Weekly Resource Cost
```
Weekly Cost = (Allocation Percentage ÷ 100) × Hours Per Week × Hourly Rate
```

#### Total Resource Cost
```
Total Cost = Weekly Cost × Weeks Elapsed
```

#### Billable Hours Per Resource
```
Billable Hours = (Allocation Percentage ÷ 100) × Hours Per Week × Weeks Elapsed
```

### Financial Calculations

#### Markup Application
```
Revenue = Cost × (1 + Markup Percentage)
Example: Revenue = Cost × 1.3 (30% markup)
```

#### Percentage Calculations
```
Percentage = (Part ÷ Whole) × 100
```

#### Variance Calculations
```
Variance = Actual - Planned
Variance % = (Variance ÷ Planned) × 100
```

---

## Data Sources

### Database Tables Used

#### Primary Tables
- `psa_projects`: Project information, budgets, timelines
- `psa_resources`: Resource hourly rates, hours per week
- `users`: User information, department assignments
- `company_roles`: Department information
- `psa_backlog_items`: Story progress and completion

#### Key Columns
- `psa_projects.budget_hours`: Project budget in hours
- `psa_projects.resource_user_ids`: Array of assigned user IDs
- `psa_projects.resource_allocations`: Array of allocation percentages
- `psa_projects.start_date`, `psa_projects.end_date`: Project timeline
- `psa_resources.hourly_rate`: Resource cost per hour
- `psa_resources.hours_per_week`: Resource availability

---

## Rounding and Precision

### Rounding Strategy
All financial calculations use consistent rounding to ensure accuracy:

1. **Individual Calculations**: Round to nearest integer
2. **Final Results**: Round to 2 decimal places for percentages
3. **Consistency**: Calculate profit from rounded revenue and costs

### Example Rounding Process
```
Raw Revenue: $22,813.47
Raw Costs: $17,549.23
Raw Profit: $5,264.24

Rounded Revenue: $22,813
Rounded Costs: $17,549
Rounded Profit: $22,813 - $17,549 = $5,264
```

### Why This Matters
- Prevents off-by-one errors in calculations
- Ensures Revenue - Costs = Profit exactly
- Maintains consistency between individual projects and summary totals

---

## Implementation Notes

### Error Handling
- Handle division by zero for percentage calculations
- Validate date ranges to prevent negative durations
- Check for null/undefined values in resource data

### Performance Considerations
- Use efficient SQL queries with proper indexing
- Calculate monthly trends only for active projects
- Cache frequently accessed data when possible

### Data Validation
- Ensure allocation percentages are between 0-100
- Validate hourly rates are positive numbers
- Check that project dates are logical (start < end)

---

## Example Calculations

### Complete Project Example

**Project: "GetHERD Roadmap"**
- Duration: 12 weeks (start: 2024-01-01, end: 2024-03-25)
- Current Date: 2024-02-15 (6 weeks elapsed)

**Resources:**
1. Developer: 100% allocation, 40h/week, $75/hour
2. Designer: 60% allocation, 40h/week, $50/hour

**Calculations:**

**Resource 1 (Developer):**
- Weekly Cost: (100 ÷ 100) × 40 × $75 = $3,000
- Total Cost: $3,000 × 6 weeks = $18,000
- Revenue: $18,000 × 1.3 = $23,400
- Billable Hours: (100 ÷ 100) × 40 × 6 = 240 hours

**Resource 2 (Designer):**
- Weekly Cost: (60 ÷ 100) × 40 × $50 = $1,200
- Total Cost: $1,200 × 6 weeks = $7,200
- Revenue: $7,200 × 1.3 = $9,360
- Billable Hours: (60 ÷ 100) × 40 × 6 = 144 hours

**Project Totals:**
- Total Cost: $18,000 + $7,200 = $25,200
- Total Revenue: $23,400 + $9,360 = $32,760
- Total Profit: $32,760 - $25,200 = $7,560
- Profit Margin: ($7,560 ÷ $32,760) × 100 = 23.08%
- Total Billable Hours: 240 + 144 = 384 hours

This example demonstrates how all calculations work together to provide accurate financial reporting.
