import axios from 'axios';

axios.defaults.withCredentials = true;

// Si estamos en producción, usamos ruta relativa (""). En local usamos el puerto 4000.
export const API_BASE = process.env.NODE_ENV === 'production' 
  ? "" 
  : 'http://localhost:4000';