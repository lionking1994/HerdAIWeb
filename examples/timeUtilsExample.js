/**
 * Example usage of the timeUtils functions
 */

// Client-side example
// Import the client-side utilities
// import { convertToUTC, convertFromUTC, getUserTimezone, formatDate } from '../client/src/utils/timeUtils';

// Server-side example
// Uncomment this for server-side usage
// const { convertToUTC, convertFromUTC, isValidTimezone, getTimezones, formatDate } = require('../server/utils/timeUtils');

/**
 * Client-side examples
 */
function clientSideExamples() {
  // Get the user's current timezone
  const userTimezone = getUserTimezone();
  console.log('User timezone:', userTimezone);
  
  // Current date in local timezone
  const now = new Date();
  console.log('Current local time:', now.toString());
  
  // Convert local time to UTC
  const utcTime = convertToUTC(now);
  console.log('Converted to UTC:', utcTime.toISOString());
  
  // Convert from a specific timezone to UTC
  const nyTime = new Date('2023-06-15T14:30:00');
  const nyToUTC = convertToUTC(nyTime, 'America/New_York');
  console.log('NY time converted to UTC:', nyToUTC.toISOString());
  
  // Convert UTC back to local timezone
  const backToLocal = convertFromUTC(utcTime);
  console.log('UTC back to local:', backToLocal.toString());
  
  // Convert UTC to a specific timezone
  const utcToTokyo = convertFromUTC(utcTime, 'Asia/Tokyo');
  console.log('UTC to Tokyo time:', utcToTokyo.toString());
  
  // Format a date with default options
  console.log('Formatted date (default):', formatDate(now));
  
  // Format a date with custom options
  console.log('Formatted date (custom):', formatDate(now, 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }));
}

/**
 * Server-side examples
 */
function serverSideExamples() {
  // Current date (server's timezone)
  const now = new Date();
  console.log('Current server time:', now.toString());
  
  // Convert from a specific timezone to UTC
  const laTime = new Date('2023-06-15T10:30:00');
  const laToUTC = convertToUTC(laTime, 'America/Los_Angeles');
  console.log('LA time converted to UTC:', laToUTC.toISOString());
  
  // Convert UTC to a specific timezone
  const utcToLondon = convertFromUTC(now, 'Europe/London');
  console.log('UTC to London time:', utcToLondon.toString());
  
  // Check if a timezone is valid
  console.log('Is Europe/Paris valid?', isValidTimezone('Europe/Paris'));
  console.log('Is Invalid/Zone valid?', isValidTimezone('Invalid/Zone'));
  
  // Get list of common timezones
  console.log('Available timezones:', getTimezones());
  
  // Format a date with default options
  console.log('Formatted date (default):', formatDate(now));
  
  // Format a date with custom options
  console.log('Formatted date (custom):', formatDate(now, 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }));
}

// Uncomment the appropriate example to run
// clientSideExamples();
// serverSideExamples();

