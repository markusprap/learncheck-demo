
import axios from 'axios';

// TODO: Replace with environment variable for production
const API_BASE_URL = '/api/v1'; // Vercel will redirect this to your backend

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
