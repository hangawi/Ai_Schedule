import { auth } from '../config/firebaseConfig';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

/**
 * Fetch wrapper that automatically adds Firebase ID Token to requests
 */
export const authenticatedFetch = async (url, options = {}) => {
  try {
    // Get current Firebase user
    const currentUser = auth.currentUser;

    if (currentUser) {
      // Get fresh ID token
      const idToken = await currentUser.getIdToken();

      // Add Authorization header
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${idToken}`
      };
    }

    // Make the request
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    const response = await fetch(fullUrl, options);

    return response;
  } catch (error) {
    console.error('[authenticatedFetch] Error:', error);
    throw error;
  }
};

/**
 * Helper for GET requests
 */
export const apiGet = async (url) => {
  return authenticatedFetch(url, { method: 'GET' });
};

/**
 * Helper for POST requests
 */
export const apiPost = async (url, data) => {
  return authenticatedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
};

/**
 * Helper for PUT requests
 */
export const apiPut = async (url, data) => {
  return authenticatedFetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
};

/**
 * Helper for DELETE requests
 */
export const apiDelete = async (url) => {
  return authenticatedFetch(url, { method: 'DELETE' });
};

/**
 * Helper for PATCH requests
 */
export const apiPatch = async (url, data) => {
  return authenticatedFetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
};
