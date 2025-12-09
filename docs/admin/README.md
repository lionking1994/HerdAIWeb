# Admin Dashboard - User Analytics

## Overview
The User Analytics page provides comprehensive insights into user behavior and application usage through 6 interactive charts and detailed statistics.

## Charts

### 1. Top Pages with Most Time (Top 5)
- **Type**: Bar Chart
- **Data**: Shows the top 5 pages where users spend the most time
- **Metrics**: Total time spent per page in seconds
- **Color**: Orange theme

### 2. Monthly Avg Time in App
- **Type**: Bar Chart
- **Data**: Average time spent in the application per user per month
- **Metrics**: Average time in seconds across all users for each month
- **Color**: Blue theme

### 3. Top 5 Users (by Time in App)
- **Type**: Bar Chart
- **Data**: Shows the top 5 users who spend the most time in the application
- **Metrics**: Total time spent per user in seconds
- **Color**: Green theme

### 4. Month Over Month Avg Time in App Per Person
- **Type**: Line Chart
- **Data**: Tracks average time spent per user over multiple months
- **Metrics**: Time trends for top 5 users across different months
- **Color**: Multi-color lines for different users

### 5. Page Visits and Page Clicks
- **Type**: Bar Chart
- **Data**: Compares page visits vs page clicks for top 10 pages
- **Metrics**: Dual dataset showing both visit counts and click counts
- **Color**: Blue (visits) and Green (clicks)

### 6. Clicks by Page
- **Type**: Bar Chart
- **Data**: Shows click activity for top 10 pages
- **Metrics**: Total clicks per page
- **Color**: Red theme

## Features

### Date Range Filtering
- Today (default)
- Last 24 Hours
- Last 7 Days
- Last 30 Days
- All Time

### User-Specific Analytics
- View analytics for all users (admin)
- View analytics for specific users
- Back navigation to user management

### Real-time Statistics Cards
- Total Actions
- Page Views
- Click Events
- Most Visited Page
- Average Time in App
- Average Sessions Per User Per Day
- Average Time on Page

### Recent Activity Table
- Shows recent click activity with timestamps
- Page information and element details
- Click coordinates

## Data Sources

The analytics are powered by the user tracking system that captures:
- Page views and navigation
- Click events
- Mouse movements
- Scroll events
- Time spent on pages
- Session duration
- User interactions

## Technical Implementation

### Frontend
- React with TypeScript
- Chart.js for visualizations
- Tailwind CSS for styling
- Responsive grid layout (3x2 for charts)

### Backend
- Node.js with Express
- PostgreSQL database
- Real-time data aggregation
- User session tracking

### Data Processing
- Session-based time calculations
- Page-level analytics
- User behavior patterns
- Monthly trend analysis

## Usage

1. Navigate to the User Analytics page in the admin dashboard
2. Select a date range from the dropdown
3. Optionally filter by specific user
4. View the 6 charts displaying different aspects of user behavior
5. Use the refresh button to update data
6. Click on chart elements for detailed tooltips

## API Endpoints

- `GET /user-analytics/tracking-data` - Main analytics data
- `GET /users/:id` - User details for specific user analytics
- `GET /user-analytics/unique-paths` - Available paths for filtering
