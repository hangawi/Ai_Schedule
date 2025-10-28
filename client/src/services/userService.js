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
    console.error('❌ API 에러:', errorData);
    const errorMsg = errorData.details || errorData.msg || 'API request failed';
    if (errorData.errors) {
      console.error('❌ Validation 에러들:', errorData.errors);
    }
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
      body: JSON.stringify(profileData),
    });
  },
};