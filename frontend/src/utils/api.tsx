import axios from 'axios';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

const axiosInstance = axios.create({ baseURL: backendUrl });

// Attach our app session JWT (issued by the backend after Spotify login).
axiosInstance.interceptors.request.use(
  (config) => {
    const session = localStorage.getItem('session_token');
    if (session) {
      config.headers.Authorization = `Bearer ${session}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default axiosInstance;
