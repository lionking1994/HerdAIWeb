# Quick Reference: Financial API Calculations

## Financial Summary Report - Key Formulas

### Revenue Calculation
```javascript
// For each resource
weeklyCost = (allocationPercentage / 100) * hoursPerWeek * hourlyRate
totalCost = weeklyCost * weeksElapsed
revenue = totalCost * 1.3  // 30% markup

// Project total
projectRevenue = sum(all resource revenues)
```

### Cost Calculation
```javascript
// For each resource
weeklyCost = (allocationPercentage / 100) * hoursPerWeek * hourlyRate
totalCost = weeklyCost * weeksElapsed

// Project total
projectCost = sum(all resource costs)
```

### Profit Calculation
```javascript
// Individual project
profit = Math.round(revenue) - Math.round(cost)

// Summary totals
grossProfit = Math.round(totalRevenue) - Math.round(totalCosts)
```

### KPIs
```javascript
billableHours = sum((allocationPercentage / 100) * hoursPerWeek * weeksElapsed)
averageHourlyRate = totalRevenue / totalBillableHours
resourceUtilization = (totalBillableHours / (totalResources * 40 * weeks)) * 100
revenuePerResource = totalRevenue / totalResources
```

---

## Resource Utilization Report - Key Formulas

### Resource Allocation
```javascript
// For each resource
totalAllocation = sum(projectAllocations) // From resource_allocations array
utilization = Math.min(totalAllocation, 100)
```

### Billable Hours & Revenue
```javascript
billableHours = (utilization / 100) * hoursPerWeek
weeklyRevenue = billableHours * hourlyRate
benchTime = 100 - utilization
```

### Status Classification
```javascript
status = utilization >= 90 ? 'over-utilized' :
         utilization >= 80 ? 'optimal' :
         utilization >= 60 ? 'under-utilized' : 'available'
```

---

## Project Performance Report - Key Formulas

### Budget Variance
```javascript
budgetVariance = budgetAmount - actualSpent
budgetVariancePercentage = (budgetVariance / budgetAmount) * 100
```

### Schedule Variance
```javascript
plannedDuration = endDate - startDate
actualDuration = currentDate - startDate
scheduleVariance = plannedDuration - actualDuration
scheduleVariancePercentage = (scheduleVariance / plannedDuration) * 100
```

### Overall Score
```javascript
overallScore = (budgetPerformance * 0.4) + (schedulePerformance * 0.3) + (deliverableProgress * 0.3)
```

### Health Status
```javascript
healthStatus = overallScore >= 80 ? 'green' : overallScore >= 60 ? 'yellow' : 'red'
```

---

## Important Notes

### Rounding Strategy
- Always round revenue and costs first, then calculate profit
- This ensures: `Math.round(revenue) - Math.round(cost) = Math.round(profit)`

### Time Calculations
```javascript
weeksElapsed = Math.max(0, (currentDate - startDate) / (7 * 24 * 60 * 60 * 1000))
```

### Data Validation
- Check for null/undefined values
- Ensure allocation percentages are 0-100
- Validate dates are logical (start < end)

### Error Handling
- Handle division by zero for percentages
- Use fallback values for missing data
- Log calculation steps for debugging
