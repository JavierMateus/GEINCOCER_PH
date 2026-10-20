import axios from 'axios';

// Configuración global para que Axios siempre envíe credenciales y cookies
axios.defaults.withCredentials = true;

export const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://geincocer-app.onrender.com' 
  : 'http://localhost:4000';