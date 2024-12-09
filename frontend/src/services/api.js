import axios from 'axios';

// Create an Axios instance with the base URL from the environment
const API = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL, // Dynamically set the backend base URL
});

// Dashboard and Settings APIs
export const getDashboardData = () => {
  console.log('Calling getDashboardData()');
  return API.get('/api/dashboard', {
    headers: {
      'Ngrok-Skip-Browser-Warning': 'true',
    },
  });
};

export const getSettings = () => {
  console.log('Calling getSettings()');
  return API.get('/api/settings', {
    headers: {
      'Ngrok-Skip-Browser-Warning': 'true',
    },
  });
};

export const updateSettings = (settings) => {
  console.log('Calling updateSettings() with payload:', settings);
  return API.post('/api/settings', settings, {
    headers: {
      'Ngrok-Skip-Browser-Warning': 'true',
    },
  });
};

// Snapshots APIs
export const getPaginatedSnapshots = ({
  page = 1,
  limit = 25,
  blacklisted = false,
  sort = 'desc',
  start_date,
  end_date,
}) => {
  const params = new URLSearchParams({
    page,
    limit,
    blacklisted: blacklisted.toString(),
    sort,
  });

  if (start_date) params.append('start_date', start_date);
  if (end_date) params.append('end_date', end_date);

  const url = `/api/snapshot/paginated?${params.toString()}`;
  console.log('Calling getPaginatedSnapshots() with URL:', url);
  return API.get(url, {
    headers: {
      'Ngrok-Skip-Browser-Warning': 'true',
    },
  });
};

export const addToBlacklist = ({ snapshotId, name }) => {
  const url = `/api/snapshot/${snapshotId}/add_to_blacklist`;
  console.log('Calling addToBlacklist() with URL:', url);
  console.log('Payload:', { name });
  return API.post(url, { name }, {
    headers: {
      'Ngrok-Skip-Browser-Warning': 'true',
    },
  });
};

export const sendEmailWithItem = (itemType, itemId, email) => {
  const url = `/api/${itemType}/${itemId}/email`; // Dynamically construct the URL
  console.log(`Calling sendEmailWithItem() with URL: ${url}`);
  console.log('Payload:', { email });
  return API.post(url, { email }, {
    headers: {
      'Ngrok-Skip-Browser-Warning': 'true',
    },
  });
};

export const downloadSnapshot = (itemType, itemId) => {
  const url = `/api/${itemType}/${itemId}/download`; // Align with backend route
  console.log('Calling downloadSnapshot() with URL:', url);
  return API.get(url, {
    responseType: 'blob',
    headers: {
      'Ngrok-Skip-Browser-Warning': 'true',
    },
  });
};

// Blacklist APIs
export const getPaginatedBlacklist = ({
  page = 1,
  limit = 10,
  sort = 'desc',
  start_date,
  end_date,
}) => {
  const params = new URLSearchParams({
    page,
    limit,
    sort,
  });

  if (start_date) params.append('start_date', start_date);
  if (end_date) params.append('end_date', end_date);

  const url = `/api/blacklist/paginated?${params.toString()}`;
  console.log('Calling getPaginatedBlacklist() with URL:', url);
  return API.get(url, {
    headers: {
      'Ngrok-Skip-Browser-Warning': 'true',
    },
  });
};

export const removeFromBlacklist = (blacklistId) => {
  const url = `/api/blacklist/${blacklistId}/remove`;
  console.log('Calling removeFromBlacklist() with URL:', url);
  return API.post(url, {}, {
    headers: {
      'Ngrok-Skip-Browser-Warning': 'true',
    },
  });
};

export default API;
