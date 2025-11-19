import { authenticatedFetch } from '../utils/apiClient';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const request = async (url, options) => {
  const response = await authenticatedFetch(url, options);

  if (!response.ok) {
    const errorData = await response.json();
    const errorMsg = errorData.details || errorData.msg || 'API request failed';
    throw new Error(errorMsg);
  }

  return response.json();
};

export const userService = {
  getUserSchedule: () => {
    return request(`${API_BASE_URL}/api/users/profile/schedule`, { method: 'GET' });
  },

  updateUserSchedule: (scheduleData) => {
    return request(`${API_BASE_URL}/api/users/profile/schedule`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(scheduleData),
    });
  },

  getUserScheduleById: (userId) => {
    return request(`${API_BASE_URL}/api/users/${userId}/schedule`, { method: 'GET' });
  },

  getUserProfile: () => {
    return request(`${API_BASE_URL}/api/users/profile`, { method: 'GET' });
  },

  updateUserProfile: (profileData) => {
    return request(`${API_BASE_URL}/api/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(profileData),
    });
  },
};