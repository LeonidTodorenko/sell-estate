import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

//const API_BASE_URL = 'http://10.0.2.2:7019/api'; //   Android emulator
const API_BASE_URL = 'https://sell-estate.onrender.com/api'; //   deploy test

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  //const token = await AsyncStorage.getItem('token');
    const stored = await AsyncStorage.getItem('user');
    const user = stored ? JSON.parse(stored) : null;
  if (user?.token) {
    config.headers.Authorization = `Bearer ${user?.token}`;
  }
  return config;
});

export default api;
