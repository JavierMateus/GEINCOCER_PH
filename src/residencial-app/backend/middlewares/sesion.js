// middlewares/sesion.js
// Sesiones del servidor. Al ingresar, el servidor entrega una credencial firmada (token) que
// la pantalla envía en cada petición. Sin una credencial válida, el servidor rechaza la petición.
//
// Uso en app.js (después de los parsers y ANTES de las rutas):
//   const { requiereSesion } = require("./middlewares/sesion");
//   app.use("/api", requiereSesion);
//
// Rutas públicas (no exigen sesión): el ingreso, la creación del PIN y el aviso automático
// (webhook) de Mercado Pago, que llega desde sus servidores.

const crypto = require("crypto");

const DURACION_MS = 8 * 60 * 60 * 1000; // 8 horas

let secretoAleatorio = null;
// El secreto sale de SESSION_SECRET (archivo .env). Si no existe, se usa uno aleatorio que cambia
// cada vez que se reinicia el servidor: en ese caso las sesiones se cierran al reiniciar.
const secreto = () => {
  const definido = process.env.SESSION_SECRET;
  if (definido && definido.length >= 16) return definido;
  if (!secretoAleatorio) {
    secretoAleatorio = crypto.randomBytes(32).toString("hex");
    console.warn("⚠️  SESSION_SECRET no está definido (o es muy corto) en el .env: las sesiones se cerrarán cada vez que se reinicie el servidor.");
  }
  return secretoAleatorio;
};

const firmar = (texto) => crypto.createHmac("sha256", secreto()).update(texto).digest("base64url");

// datos: { doc, nom, rol, act }. Devuelve el token firmado.
const crearToken = (datos, duracionMs = DURACION_MS) => {
  const cuerpo = Buffer.from(JSON.stringify({ ...datos, exp: Date.now() + duracionMs })).toString("base64url");
  return `${cuerpo}.${firmar(cuerpo)}`;
};

// Devuelve los datos de la sesión, o null si el token es falso, fue alterado o ya venció.
const verificarToken = (token) => {
  const [cuerpo, firma] = String(token || "").split(".");
  if (!cuerpo || !firma) return null;
  const esperada = Buffer.from(firmar(cuerpo));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) return null;
  try {
    const datos = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8"));
    if (!datos.exp || datos.exp < Date.now()) return null;
    return datos;
  } catch (_) {
    return null;
  }
};

const RUTAS_PUBLICAS = [
  { metodo: "POST", ruta: "/auth/ingresar" },
  { metodo: "POST", ruta: "/auth/crear-pin" },
  { metodo: "POST", ruta: "/mercadopago/webhook" },
];

const esPublica = (req) => {
  if (req.method === "OPTIONS") return true; // verificación previa del navegador (CORS)
  const ruta = String(req.path || "").replace(/\/+$/, "") || "/";
  return RUTAS_PUBLICAS.some((r) => r.metodo === req.method && r.ruta === ruta);
};

const requiereSesion = (req, res, next) => {
  if (esPublica(req)) return next();
  const cabecera = String(req.headers.authorization || "");
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7).trim() : "";
  const sesion = verificarToken(token);
  if (!sesion) {
    return res.status(401).json({ error: "Tu sesión no es válida o expiró. Ingresa de nuevo.", codigo: "SESION_INVALIDA" });
  }
  req.sesion = sesion; // { doc, nom, rol, act, exp }
  return next();
};

// Para la etapa 2: limita una ruta a ciertos roles reales. Ejemplo: router.get("/", soloRoles("Administrador"), ...)
const soloRoles = (...roles) => (req, res, next) => {
  if (req.sesion && roles.includes(req.sesion.rol)) return next();
  return res.status(403).json({ error: "No tienes permiso para esta acción." });
};

module.exports = { crearToken, verificarToken, requiereSesion, soloRoles, DURACION_MS };