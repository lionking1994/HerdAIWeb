/**
 * Safe MSAL hook wrapper that handles cases when MSAL is not available
 * (e.g., when running over HTTP instead of HTTPS)
 */
import { useMsal as useOriginalMsal } from '@azure/msal-react';

// Check if we're in a context where MSAL can work
const isMsalAvailable = () => {
  return window.isSecureContext || 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'https:';
};

/**
 * Safe wrapper around useMsal that returns null values when MSAL is not available
 */
export const useSafeMsal = () => {
  // If MSAL is not available, return mock values
  if (!isMsalAvailable() || !window.crypto?.subtle) {
    return {
      instance: null,
      accounts: [],
      inProgress: 'none',
    };
  }

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useOriginalMsal();
  } catch (error) {
    console.warn('MSAL hook failed:', error.message);
    return {
      instance: null,
      accounts: [],
      inProgress: 'none',
    };
  }
};

export default useSafeMsal;

