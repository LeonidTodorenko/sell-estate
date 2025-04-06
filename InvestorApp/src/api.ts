import axios from 'axios';

//const API_BASE_URL = 'http://10.0.2.2:7019/api'; //   Android emulator
const API_BASE_URL = 'https://sell-estate.onrender.com/api'; //   deploy test

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
