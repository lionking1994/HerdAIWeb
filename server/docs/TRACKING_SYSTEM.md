# User Tracking System Documentation

## Overview

The user tracking system captures comprehensive user interactions from the client-side and stores them in a PostgreSQL database for analytics and insights.

## Database Schema

### Table: `user_tracking_actions`

This table stores all user interactions with the following structure:

```sql
CREATE TABLE user_tracking_actions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) REFERENCES users(id),
    session_id VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    timestamp BIGINT NOT NULL,
    url VARCHAR(2000),
    title VARCHAR(500),
    referrer VARCHAR(2000),
    user_agent TEXT,
    element_tag VARCHAR(50),
    element_id VARCHAR(255),
    element_class VARCHAR(1000),
    element_text TEXT,
    element_href VARCHAR(2000),
    element_type VARCHAR(50),
    position_x INTEGER,
    position_y INTEGER,
    position_page_x INTEGER,
    position_page_y INTEGER,
    scroll_x INTEGER,
    scroll_y INTEGER,
    scroll_top INTEGER,
    scroll_left INTEGER,
    key_pressed VARCHAR(10),
    key_code VARCHAR(50),
    ctrl_key BOOLEAN DEFAULT FALSE,
    shift_key BOOLEAN DEFAULT FALSE,
    alt_key BOOLEAN DEFAULT FALSE,
    meta_key BOOLEAN DEFAULT FALSE,
    screen_width INTEGER,
    screen_height INTEGER,
    viewport_width INTEGER,
    viewport_height INTEGER,
    hidden BOOLEAN,
    additional_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Action Types

The system tracks the following action types:

- `page_view` - Initial page load
- `click` - Mouse clicks
- `mousemove` - Mouse movements (throttled)
- `scroll` - Scroll events
- `keypress` - Keyboard input
- `visibility_change` - Tab/window focus changes
- `page_unload` - Page leave events

## Setup Instructions

### 1. Run Database Migration

```bash
cd server
npm run migrate:tracking
```

This will:
- Create the `user_tracking_actions` table
- Create necessary indexes for performance
- Create database functions for analytics
- Verify the setup

### 2. Verify Installation

The migration script will output:
- ✅ Table creation status
- 📋 Table structure
- 🔍 Indexes created
- ⚙️ Functions created

## API Endpoints

### Track Actions
```http
POST /api/user-analytics/track-actions
Authorization: Bearer <token>
Content-Type: application/json

[
  {
    "type": "page_view",
    "timestamp": 1751469536430,
    "sessionId": "session_1751469536430_5ojn2mqlu",
    "url": "http://localhost:3000/task-details?id=10063895",
    "title": "Getherd",
    "referrer": "http://localhost:3000/task-details?id=10063895",
    "userAgent": "Mozilla/5.0...",
    "screenResolution": { "width": 1920, "height": 994 },
    "viewport": { "width": 936, "height": 880 }
  }
]
```

### Get User Statistics
```http
GET /api/user-analytics/my-tracking-stats
Authorization: Bearer <token>
```

### Get Recent Actions
```http
GET /api/user-analytics/my-recent-actions?limit=50&action_type=click
Authorization: Bearer <token>
```

### Get Session Timeline
```http
GET /api/user-analytics/session/{session_id}/timeline
Authorization: Bearer <token>
```

### Get Click Heatmap
```http
GET /api/user-analytics/click-heatmap?url=/task-details
Authorization: Bearer <token>
```

## Client-Side Integration

### Include Tracking Script

Add the tracking script to your HTML:

```html
<script src="/tracking.js"></script>
```

### Initialize Tracking

The script automatically initializes when the DOM loads:

```javascript
// Access the tracker globally
window.userTracker.startAutoSend(30000); // Send every 30 seconds
```

### Manual Control

```javascript
// Send data immediately
const result = await window.userTracker.sendAndClear();

// Get tracking data
const actions = window.userTracker.getActions();

// Get session summary
const summary = window.userTracker.getSessionSummary();
```

## Database Functions

### get_user_tracking_stats(user_id, start_timestamp, end_timestamp)

Returns comprehensive statistics for a user:

```sql
SELECT * FROM get_user_tracking_stats('user_id', 1751469536430, 1751469636430);
```

### get_session_timeline(session_id)

Returns timeline of actions for a specific session:

```sql
SELECT * FROM get_session_timeline('session_1751469536430_5ojn2mqlu');
```

### get_click_heatmap(user_id, url, start_timestamp, end_timestamp)

Returns click heatmap data:

```sql
SELECT * FROM get_click_heatmap('user_id', '/task-details', 1751469536430, 1751469636430);
```

## Analytics Examples

### Get User Activity Summary

```javascript
const response = await fetch('/api/user-analytics/my-tracking-stats', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const stats = await response.json();

console.log(`Total actions: ${stats.data.total_actions}`);
console.log(`Page views: ${stats.data.page_views}`);
console.log(`Clicks: ${stats.data.clicks}`);
console.log(`Mouse movements: ${stats.data.mouse_movements}`);
```

### Get Click Heatmap

```javascript
const heatmap = await fetch('/api/user-analytics/click-heatmap?url=/task-details', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const heatmapData = await heatmap.json();

// Use heatmap data for visualization
heatmapData.data.forEach(point => {
  console.log(`Click at (${point.position_x}, ${point.position_y}): ${point.click_count} times`);
});
```

## Performance Considerations

### Indexes

The following indexes are created for optimal performance:

- `idx_tracking_actions_user_id` - User-based queries
- `idx_tracking_actions_session_id` - Session-based queries
- `idx_tracking_actions_action_type` - Action type filtering
- `idx_tracking_actions_timestamp` - Time-based queries
- `idx_tracking_actions_user_session` - Composite user+session queries
- `idx_tracking_actions_user_type` - Composite user+type queries

### Data Retention

Consider implementing data retention policies:

```sql
-- Delete old tracking data (older than 90 days)
DELETE FROM user_tracking_actions 
WHERE created_at < NOW() - INTERVAL '90 days';
```

### Batch Processing

For large datasets, use batch processing:

```javascript
// Process in batches of 1000
const batchSize = 1000;
for (let i = 0; i < actions.length; i += batchSize) {
  const batch = actions.slice(i, i + batchSize);
  await saveTrackingActions(batch);
}
```

## Troubleshooting

### Common Issues

1. **Migration fails**: Check database permissions and connection
2. **Data not saving**: Verify user authentication and token validity
3. **Performance issues**: Check indexes and consider data partitioning
4. **Memory issues**: Implement data retention and batch processing

### Debug Mode

Enable debug logging in the tracking script:

```javascript
window.userTracker.updateConfig({
  debug: true,
  maxActions: 500
});
```

## Security Considerations

- All endpoints require authentication
- User data is isolated by user_id
- Sensitive data (passwords, tokens) is not tracked
- Data is encrypted in transit (HTTPS)
- Consider GDPR compliance for data retention

## Monitoring

Monitor the tracking system with:

```sql
-- Check tracking data volume
SELECT 
  DATE(created_at) as date,
  COUNT(*) as actions,
  COUNT(DISTINCT user_id) as users,
  COUNT(DISTINCT session_id) as sessions
FROM user_tracking_actions
GROUP BY DATE(created_at)
ORDER BY date DESC;
``` 