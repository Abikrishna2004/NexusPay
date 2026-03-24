import axios from 'axios';

const api = axios.create({
    baseURL: window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://nexus-pay-alpha.vercel.app/api',
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('nexus_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
