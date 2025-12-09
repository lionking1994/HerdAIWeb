/**
 * Utility functions for handling time and timezone conversions on the server
 */

/**
 * Converts a date/time from a user's timezone to UTC
 * 
 * @param {Date|string|number} dateTime - The date/time to convert (Date object, ISO string, or timestamp)
 * @param {string} [timezone='UTC'] - Timezone identifier (e.g., 'America/New_York', 'Europe/London')
 * @returns {Date} - The converted date in UTC
 */
const convertToUTC = (dateTime, timezone = 'UTC') => {
  // If dateTime is a string or number, convert it to a Date object
  const date = dateTime instanceof Date ? dateTime : new Date(dateTime);
  
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date provided');
  }

  // If timezone is UTC, no conversion needed
  if (timezone === 'UTC') {
    return date;
  }
  
  try {
    // Format the date in the specified timezone
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
    
    // Get the parts of the formatted date
    const parts = formatter.formatToParts(date);
    const tzParts = {};
    
    // Extract the parts into an object
    parts.forEach(part => {
      if (part.type !== 'literal') {
        tzParts[part.type] = parseInt(part.value, 10);
      }
    });
    
    // Create a date object with the timezone's local time
    const tzDate = new Date(
      tzParts.year,
      tzParts.month - 1, // Month is 0-indexed in JS Date
      tzParts.day,
      tzParts.hour,
      tzParts.minute,
      tzParts.second
    );
    
    // Calculate the offset between the timezone and UTC
    const offset = tzDate.getTime() - date.getTime();
    
    // Apply the offset to get the UTC time
    return new Date(date.getTime() - offset);
  } catch (error) {
    console.error('Error converting timezone:', error);
    // Fall back to the original date if there's an error
    return date;
  }
};

/**
 * Converts a UTC date/time to a specified timezone
 * 
 * @param {Date|string|number} utcDateTime - The UTC date/time to convert (Date object, ISO string, or timestamp)
 * @param {string} timezone - Timezone identifier (e.g., 'America/New_York', 'Europe/London')
 * @returns {Date} - The converted date in the specified timezone
 */
const convertFromUTC = (utcDateTime, timezone) => {
  if (!timezone) {
    throw new Error('Timezone must be specified for server-side conversion');
  }
  
  // If utcDateTime is a string or number, convert it to a Date object
  const utcDate = utcDateTime instanceof Date ? utcDateTime : new Date(utcDateTime);
  
  if (isNaN(utcDate.getTime())) {
    throw new Error('Invalid date provided');
  }

  // If timezone is UTC, no conversion needed
  if (timezone === 'UTC') {
    return utcDate;
  }
  
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
    const [datePart, timePart] = formattedDate.split(', ');
    const [month, day, year] = datePart.split('/');
    const [hour, minute, second] = timePart.split(':');
    
    // Create a new Date object with the parsed components
    // Note: This will be in the server's timezone, but with the correct time for the target timezone
    const localDate = new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1, // Month is 0-indexed in JS Date
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
      parseInt(second, 10)
    );
    
    return localDate;
  } catch (error) {
    console.error('Error converting timezone:', error);
    // Fall back to the original UTC date if there's an error
    return utcDate;
  }
};

/**
 * Validates if a timezone string is valid
 * 
 * @param {string} timezone - The timezone to validate
 * @returns {boolean} - True if the timezone is valid, false otherwise
 */
const isValidTimezone = (timezone) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Gets a list of all valid timezone identifiers
 * 
 * @returns {string[]} - Array of timezone identifiers
 */
const getTimezones = () => {
  // This is a simplified approach. For a complete list, you might want to use a library like moment-timezone
  return [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
    'Pacific/Auckland'
  ];
};

/**
 * Formats a date according to the specified locale and options
 * 
 * @param {Date|string|number} date - The date to format
 * @param {string} [locale='en-US'] - The locale to use for formatting
 * @param {Object} [options] - Formatting options (see Intl.DateTimeFormat for details)
 * @returns {string} - The formatted date string
 */
const formatDate = (date, locale = 'en-US', options = {}) => {
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

module.exports = {
  convertToUTC,
  convertFromUTC,
  isValidTimezone,
  getTimezones,
  formatDate
};

