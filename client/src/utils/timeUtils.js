/**
 * Utility functions for handling time and timezone conversions
 */

/**
 * Converts a date/time from a user's local timezone to UTC
 * 
 * @param {Date|string|number} dateTime - The date/time to convert (Date object, ISO string, or timestamp)
 * @param {string} [timezone] - Optional timezone identifier (e.g., 'America/New_York', 'Europe/London')
 *                             If not provided, uses the user's local browser timezone
 * @returns {Date} - The converted date in UTC
 */
export const convertToUTC = (dateTime, timezone = null) => {
  // If dateTime is a string or number, convert it to a Date object
  const date = dateTime instanceof Date ? dateTime : new Date(dateTime);
  
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date provided');
  }

  // If no specific timezone is provided, we'll use the browser's timezone
  // and the conversion to UTC is straightforward
  if (!timezone) {
    return new Date(date.getTime());
  }
  
  // For a specific timezone, we need to use the Intl API
  try {
    // Get the UTC timestamp
    const utcTimestamp = date.getTime();
    
    // Create a formatter in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });
    
    // Format the date in the target timezone
    const parts = formatter.formatToParts(date);
    
    // Extract the parts
    const tzParts = {};
    parts.forEach(part => {
      if (part.type !== 'literal') {
        tzParts[part.type] = parseInt(part.value, 10);
      }
    });
    
    // Create a new date in the target timezone
    const tzDate = new Date(
      tzParts.year,
      tzParts.month - 1, // Month is 0-indexed in JS Date
      tzParts.day,
      tzParts.hour,
      tzParts.minute,
      tzParts.second
    );
    
    // Calculate the offset between the target timezone and UTC
    const offset = tzDate.getTime() - utcTimestamp;
    
    // Apply the offset to get the UTC time
    return new Date(date.getTime() - offset);
  } catch (error) {
    console.error('Error converting timezone:', error);
    // Fall back to browser timezone if there's an error
    return new Date(date.getTime());
  }
};

/**
 * Converts a UTC date/time to a user's local timezone or specified timezone
 * 
 * @param {Date|string|number} utcDateTime - The UTC date/time to convert (Date object, ISO string, or timestamp)
 * @param {string} [timezone] - Optional timezone identifier (e.g., 'America/New_York', 'Europe/London')
 *                             If not provided, uses the user's local browser timezone
 * @returns {Date} - The converted date in the specified timezone
 */
export const convertFromUTC = (utcDateTime, timezone = null) => {
  // If utcDateTime is a string or number, convert it to a Date object
  const utcDate = utcDateTime instanceof Date ? utcDateTime : new Date(utcDateTime);
  
  if (isNaN(utcDate.getTime())) {
    throw new Error('Invalid date provided');
  }

  // If no specific timezone is provided, we'll convert to the browser's timezone
  // which happens automatically when we create a new Date
  if (!timezone) {
    return new Date(utcDate.getTime());
  }
  
  // For a specific timezone, we need to use the Intl API
  try {
    // Format the UTC date in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });
    
    // Get the formatted date string in the target timezone
    const formattedDate = formatter.format(utcDate);
    
    // Parse the formatted date string back to a Date object
    // This will be in the local timezone, but with the correct time for the target timezone
    const [datePart, timePart] = formattedDate.split(', ');
    const [month, day, year] = datePart.split('/');
    const [hour, minute, second] = timePart.split(':');
    
    return new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1, // Month is 0-indexed in JS Date
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
      parseInt(second, 10)
    );
  } catch (error) {
    console.error('Error converting timezone:', error);
    // Fall back to browser timezone if there's an error
    return new Date(utcDate.getTime());
  }
};

/**
 * Gets the user's current timezone
 * 
 * @returns {string} - The user's timezone (e.g., 'America/New_York')
 */
export const getUserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Formats a date according to the specified locale and options
 * 
 * @param {Date|string|number} date - The date to format
 * @param {string} [locale='en-US'] - The locale to use for formatting
 * @param {Object} [options] - Formatting options (see Intl.DateTimeFormat for details)
 * @returns {string} - The formatted date string
 */
export const formatDate = (date, locale = 'en-US', options = {}) => {
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    timeZoneName: 'short'
  };
  
  const dateObj = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(locale, { ...defaultOptions, ...options }).format(dateObj);
};

