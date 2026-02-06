import axios from 'axios';

const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    // If accessing via IP (e.g. 192.168.x.x), use that same IP for the backend
    const host = window.location.hostname;
    return `http://${host}:5000/api`;
  }
  return 'http://127.0.0.1:5000/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
});

export const getServerUrl = () => {
  return api.defaults.baseURL.replace('/api', '');
};

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;
