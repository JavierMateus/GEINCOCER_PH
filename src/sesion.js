// src/sesion.js
// Guarda en MEMORIA la credencial de sesión (no queda escrita en el navegador) y la envía
// automáticamente en cada petición a la API, tanto con fetch como con axios.
// Si el servidor responde que la sesión no es válida o expiró, avisa con el evento "sesion-expirada".
//
// Se importa una sola vez, al inicio, en src/index.js:  import "./sesion";
import axios from "axios";
import { API_BASE } from "./config";

let token = null;
let numeroSesion = 0; // cambia en cada ingreso o cierre de sesión

export const guardarToken = (nuevo) => { token = nuevo || null; numeroSesion += 1; };
export const borrarToken = () => { token = null; numeroSesion += 1; };
export const haySesion = () => Boolean(token);

const esApi = (url) =>
  typeof url === "string" && (url.startsWith(`${API_BASE}/api`) || url.startsWith("/api"));

// Solo se considera "sesión expirada" si la petición salió CON una sesión activa y esa misma
// sesión sigue activa cuando llega la respuesta. Así no hay avisos falsos al cerrar sesión.
const sesionExpirada = (numeroAlSalir) => {
  if (!token || numeroAlSalir !== numeroSesion) return;
  token = null;
  numeroSesion += 1;
  window.dispatchEvent(new Event("sesion-expirada"));
};

// ---- fetch ----
const fetchOriginal = window.fetch.bind(window);
window.fetch = async (entrada, opciones = {}) => {
  const url = typeof entrada === "string" ? entrada : entrada && entrada.url;
  const numeroAlSalir = numeroSesion;
  const llevaSesion = Boolean(token) && esApi(url);
  if (llevaSesion) {
    const headers = new Headers(opciones.headers || (typeof entrada !== "string" && entrada ? entrada.headers : undefined));
    if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
    opciones = { ...opciones, headers };
  }
  const resp = await fetchOriginal(entrada, opciones);
  if (llevaSesion && resp.status === 401) {
    // Un 401 por un PIN equivocado no trae este código, así que no cierra la sesión.
    resp.clone().json().then((d) => { if (d && d.codigo === "SESION_INVALIDA") sesionExpirada(numeroAlSalir); }).catch(() => {});
  }
  return resp;
};

// ---- axios ----
axios.interceptors.request.use((config) => {
  if (token && esApi(config.url)) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
    config.numeroSesion = numeroSesion;
  }
  return config;
});
axios.interceptors.response.use(
  (resp) => resp,
  (error) => {
    const respuesta = error && error.response;
    if (respuesta && respuesta.status === 401 && respuesta.data && respuesta.data.codigo === "SESION_INVALIDA") {
      sesionExpirada(error.config && error.config.numeroSesion);
    }
    return Promise.reject(error);
  }
);