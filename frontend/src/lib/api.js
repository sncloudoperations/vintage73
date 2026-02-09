import axios from 'axios';

const getBaseURL = () => {
  return `${process.env.NEXT_PUBLIC_API_URL}/api`;
};

const api = axios.create({
  baseURL: getBaseURL(),
});

export const getServerUrl = () => {
  return process.env.NEXT_PUBLIC_API_URL;
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
