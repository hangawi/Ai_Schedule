/**
 * Legacy fetch wrapper for gradual migration
 * This will intercept localStorage token and replace with Firebase ID token
 */
import { auth } from '../config/firebaseConfig';

const originalFetch = window.fetch;

window.fetch = async function(...args) {
  let [url, options = {}] = args;

  // Get current Firebase user
  const currentUser = auth.currentUser;

  if (currentUser) {
    try {
      // Get Firebase ID token
      const idToken = await currentUser.getIdToken();

      // Update headers
      options.headers = options.headers || {};

      // Remove old JWT token header if exists
      if (options.headers['x-auth-token']) {
        delete options.headers['x-auth-token'];
      }

      // Add Firebase Bearer token
      options.headers['Authorization'] = `Bearer ${idToken}`;
    } catch (error) {
      console.error('[legacyFetch] Error getting Firebase token:', error);
    }
  }

  // Call original fetch
  return originalFetch(url, options);
};

export default window.fetch;
