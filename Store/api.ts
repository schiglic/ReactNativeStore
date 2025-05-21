import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
    baseURL: 'http://192.168.1.2:5259/api',
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 15000,
});

api.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('jwt_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            console.log('Request with token:', config.url, 'Token:', token.substring(0, 20) + '...');
        } else {
            console.log('No token for request:', config.url);
        }
        console.log('Request:', config.method, config.url, 'Data:', config.data, 'Headers:', config.headers);
        return config;
    },
    (error) => {
        console.error('Request error:', (error as Error).message);
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => {
        console.log('Response:', response.status, 'Data:', response.data);
        return response;
    },
    (error) => {
        const axiosError = error as AxiosError;
        console.error('Response error:', axiosError.message, 'Code:', axiosError.code, 'Status:', axiosError.response?.status, 'URL:', axiosError.config?.url);
        if (axiosError.code === 'ECONNABORTED') {
            console.error('Timeout: Сервер не відповів протягом 15 секунд');
        } else if (axiosError.code === 'ERR_NETWORK') {
            console.error('Network error details:', axiosError.config?.url);
        }
        return Promise.reject(error);
    }
);

export default api;