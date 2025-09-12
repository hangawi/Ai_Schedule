const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const request = async (url, options) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['x-auth-token'] = token;
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.msg || 'API request failed');
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
      body: JSON.stringify(scheduleData),
    });
  },
};