// src/config.js
const API_BASE = window.location.hostname === "localhost" 
  ? "http://localhost:4000" 
  : ""; // Si está en Render (en la nube), usa una cadena vacía para rutas relativas

export { API_BASE };