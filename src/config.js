// src/config.js
const API_BASE = window.location.hostname === "localhost" 
  ? "http://localhost:4000" 
  : ""; 

export { API_BASE };