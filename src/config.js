import axios from 'axios';

axios.defaults.withCredentials = true;

export const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://geincocer-app.onrender.com' 
  : ''; // Si está vacío en local usa relativo, en producción usa la URL completa de Render