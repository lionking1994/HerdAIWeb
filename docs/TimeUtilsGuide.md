# Timezone Utilities Guide

This guide explains how to use the timezone utility functions for converting between user timezones and UTC.

## Overview

The timezone utilities provide functions for:

1. Converting dates from a user's timezone to UTC
2. Converting dates from UTC to a user's timezone
3. Getting the user's current timezone (client-side only)
4. Validating timezone strings (server-side only)
5. Getting a list of common timezones (server-side only)
6. Formatting dates with localization support

## Client-Side Usage

### Importing

```javascript
import { 
  convertToUTC, 
  convertFromUTC, 
  getUserTimezone, 
  formatDate 
} from '../utils/timeUtils';
```

### Functions

#### `convertToUTC(dateTime, timezone = null)`

Converts a date/time from a user's local timezone to UTC.

- `dateTime`: The date/time to convert (Date object, ISO string, or timestamp)
- `timezone`: Optional timezone identifier (e.g., 'America/New_York'). If not provided, uses the user's local browser timezone.

```javascript
// Convert current local time to UTC
const now = new Date();
const utcTime = convertToUTC(now);

// Convert a specific timezone to UTC
const nyTime = new Date('2023-06-15T14:30:00');
const nyToUTC = convertToUTC(nyTime, 'America/New_York');
```

#### `convertFromUTC(utcDateTime, timezone = null)`

Converts a UTC date/time to a user's local timezone or specified timezone.

- `utcDateTime`: The UTC date/time to convert (Date object, ISO string, or timestamp)
- `timezone`: Optional timezone identifier. If not provided, uses the user's local browser timezone.

```javascript
// Convert UTC to local timezone
const localTime = convertFromUTC('2023-06-15T18:30:00Z');

// Convert UTC to a specific timezone
const tokyoTime = convertFromUTC('2023-06-15T18:30:00Z', 'Asia/Tokyo');
```

#### `getUserTimezone()`

Gets the user's current timezone.

```javascript
const userTimezone = getUserTimezone();
console.log(userTimezone); // e.g., 'America/New_York'
```

#### `formatDate(date, locale = 'en-US', options = {})`

Formats a date according to the specified locale and options.

- `date`: The date to format
- `locale`: The locale to use for formatting (default: 'en-US')
- `options`: Formatting options (see Intl.DateTimeFormat for details)

```javascript
// Format with default options
const formattedDate = formatDate(new Date());

// Format with custom options
const customFormatted = formatDate(new Date(), 'en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});
```

## Server-Side Usage

### Importing

```javascript
const { 
  convertToUTC, 
  convertFromUTC, 
  isValidTimezone, 
  getTimezones, 
  formatDate 
} = require('../utils/timeUtils');
```

### Functions

#### `convertToUTC(dateTime, timezone = 'UTC')`

Converts a date/time from a specified timezone to UTC.

- `dateTime`: The date/time to convert (Date object, ISO string, or timestamp)
- `timezone`: Timezone identifier (default: 'UTC')

```javascript
// Convert from Los Angeles time to UTC
const laTime = new Date('2023-06-15T10:30:00');
const utcTime = convertToUTC(laTime, 'America/Los_Angeles');
```

#### `convertFromUTC(utcDateTime, timezone)`

Converts a UTC date/time to a specified timezone.

- `utcDateTime`: The UTC date/time to convert (Date object, ISO string, or timestamp)
- `timezone`: Timezone identifier (required)

```javascript
// Convert UTC to London time
const londonTime = convertFromUTC('2023-06-15T18:30:00Z', 'Europe/London');
```

#### `isValidTimezone(timezone)`

Validates if a timezone string is valid.

```javascript
const isValid = isValidTimezone('Europe/Paris'); // true
const isInvalid = isValidTimezone('Invalid/Zone'); // false
```

#### `getTimezones()`

Gets a list of common timezone identifiers.

```javascript
const timezones = getTimezones();
// ['UTC', 'America/New_York', 'America/Chicago', ...]
```

#### `formatDate(date, locale = 'en-US', options = {})`

Formats a date according to the specified locale and options.

```javascript
// Format with default options
const formattedDate = formatDate(new Date());

// Format with custom options
const customFormatted = formatDate(new Date(), 'fr-FR', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});
```

## Common Timezone Identifiers

Here are some common timezone identifiers:

- `UTC` - Coordinated Universal Time
- `America/New_York` - Eastern Time
- `America/Chicago` - Central Time
- `America/Denver` - Mountain Time
- `America/Los_Angeles` - Pacific Time
- `Europe/London` - British Time
- `Europe/Paris` - Central European Time
- `Europe/Moscow` - Moscow Time
- `Asia/Tokyo` - Japan Time
- `Asia/Shanghai` - China Time
- `Australia/Sydney` - Australian Eastern Time
- `Pacific/Auckland` - New Zealand Time

For a complete list of timezone identifiers, refer to the IANA Time Zone Database.

## Best Practices

1. **Store dates in UTC**: Always store dates in UTC format in your database.
2. **Convert on display**: Convert to the user's timezone only when displaying dates to the user.
3. **Be explicit**: When accepting date inputs from users, be clear about which timezone the date should be in.
4. **Handle DST**: Be aware that Daylight Saving Time transitions can cause issues with timezone conversions.
5. **Validate inputs**: Always validate date inputs before processing them.

## Example Usage

See the `examples/timeUtilsExample.js` file for complete examples of how to use these utilities.

