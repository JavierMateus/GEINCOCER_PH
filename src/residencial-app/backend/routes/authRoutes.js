// routes/authRoutes.js
// Ingreso real a GEINCOCER con los datos de Habitantes.csv.
//
// Reglas:
//   1) Primer ingreso: documento + nombre completo (como esta en Habitantes.csv).
//      Al entrar, la app obliga a crear un PIN de 4 digitos.
//   2) Despues: documento + PIN. El nombre ya no sirve para entrar.
//   3) El PIN se guarda cifrado (scrypt con sal) en Credenciales.csv,
//      separado de Habitantes.csv.
//   4) 5 intentos fallidos seguidos: bloqueo de 15 minutos.
//   5) PIN olvidado: un administrador lo restablece y la persona vuelve a
//      entrar con su nombre para crear uno nuevo.
//
// Montaje en app.js:
//   const authRoutes = require("./routes/authRoutes");
//   app.use("/api/auth", authRoutes(baseResidencialDir));
//
// Rutas:
//   POST /api/auth/ingresar         { documento, clave, rol }
//   POST /api/auth/crear-pin        { documento, clave, pinNuevo, pinConfirmacion }
//   POST /api/auth/restablecer-pin  { adminDocumento, adminPin, documento }
//   GET  /api/auth/estado-pines     -> quien tiene PIN y quien esta bloqueado

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { crearToken } = require("../middlewares/sesion");
const ARCHIVO_HABITANTES = "Habitantes.csv";
const ARCHIVO_CREDENCIALES = "Credenciales.csv";

const ENCABEZADO_CREDENCIALES = [
  "DocumentoResidente",
  "PinCifrado",
  "Sal",
  "FechaCreacion",
  "FechaUltimoCambio",
  "IntentosFallidos",
  "BloqueadoHasta",
  "UltimoIngreso",
];

const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;

// Roles que existen en la app. El administrador puede entrar con cualquiera.
const ROLES = ["Administrador", "Residente", "Seguridad", "Mantenimiento"];

// ------------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------------

const normalizar = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const soloDigitos = (valor) => String(valor ?? "").replace(/\D/g, "");

const ahoraTexto = () => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}:${p.second}`;
};

// Fecha ISO (2026-03-04) o d/mm/aaaa (4/03/2026) -> AAAAMMDD
const claveFecha = (valor) => {
  const t = String(valor || "").trim();
  let p = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (p) return Number(p[1]) * 10000 + Number(p[2]) * 100 + Number(p[3]);
  p = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) return Number(p[3]) * 10000 + Number(p[2]) * 100 + Number(p[1]);
  return 0;
};

const hoyClave = () =>
  claveFecha(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date()));

// ------------------------------------------------------------------
// CSV
// ------------------------------------------------------------------

const leerTexto = (ruta) => {
  const buffer = fs.readFileSync(ruta);
  const utf8 = buffer.toString("utf8");
  return (utf8.includes("\uFFFD") ? buffer.toString("latin1") : utf8).replace(/^\uFEFF/, "");
};

const leerCSV = (ruta) => {
  if (!fs.existsSync(ruta)) return [];
  const lineas = leerTexto(ruta)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lineas.length < 2) return [];

  const delim =
    (lineas[0].match(/;/g) || []).length >= (lineas[0].match(/,/g) || []).length ? ";" : ",";
  const encabezados = lineas[0].split(delim).map((e) => e.replace(/^"|"$/g, "").trim());

  return lineas.slice(1).map((linea) => {
    const valores = linea.split(delim).map((v) => v.replace(/^"|"$/g, "").trim());
    const fila = {};
    encabezados.forEach((enc, i) => {
      fila[enc] = valores[i] ?? "";
    });
    return fila;
  });
};

const guardarCredenciales = (ruta, filas) => {
  const lineas = [
    ENCABEZADO_CREDENCIALES.join(";"),
    ...filas.map((f) =>
      ENCABEZADO_CREDENCIALES.map((c) => String(f[c] ?? "").replace(/[;\r\n]/g, "")).join(";")
    ),
  ];
  // Se escribe en un archivo temporal y luego se reemplaza: evita dejarlo a medias.
  const temporal = `${ruta}.tmp`;
  fs.writeFileSync(temporal, lineas.join("\r\n") + "\r\n", "utf8");
  fs.renameSync(temporal, ruta);
};

// ------------------------------------------------------------------
// PIN cifrado
// ------------------------------------------------------------------

const cifrarPin = (pin, sal = crypto.randomBytes(16).toString("hex")) => ({
  sal,
  cifrado: crypto.scryptSync(String(pin), sal, 64).toString("hex"),
});

const pinCorrecto = (pin, sal, cifrado) => {
  if (!sal || !cifrado) return false;
  const calculado = Buffer.from(cifrarPin(pin, sal).cifrado, "hex");
  const guardado = Buffer.from(cifrado, "hex");
  return calculado.length === guardado.length && crypto.timingSafeEqual(calculado, guardado);
};

// PIN de 4 digitos que no sea obvio.
const validarPinNuevo = (pin, documento) => {
  if (!/^\d{4}$/.test(pin)) return "El PIN debe tener exactamente 4 números.";
  if (/^(\d)\1{3}$/.test(pin)) return "El PIN no puede tener los 4 números iguales (ej: 1111).";
  const ascendente = "0123456789";
  const descendente = "9876543210";
  if (ascendente.includes(pin) || descendente.includes(pin)) {
    return "El PIN no puede ser una secuencia (ej: 1234 o 4321).";
  }
  if (soloDigitos(documento).endsWith(pin)) {
    return "El PIN no puede ser igual a los últimos 4 números de tu documento.";
  }
  return "";
};

// ------------------------------------------------------------------
// Datos del habitante
// ------------------------------------------------------------------

const buscarHabitante = (baseDir, documento) => {
  const doc = soloDigitos(documento);
  if (!doc) return null;

  const habitantes = leerCSV(path.join(baseDir, ARCHIVO_HABITANTES));
  const hoy = hoyClave();

  return (
    habitantes.find((h) => {
      if (soloDigitos(h.DocumentoResidente || h.Documento) !== doc) return false;
      // Si ya salio del conjunto, no puede entrar.
      const salida = claveFecha(h.FechaSalida);
      return !salida || salida > hoy;
    }) || null
  );
};

const rolesPermitidos = (habitante) => {
  const rol = ROLES.find((r) => normalizar(r) === normalizar(habitante.Rol)) || "Residente";
  return rol === "Administrador" ? [...ROLES] : [rol];
};

// Datos que recibe la app. Nunca se envia el PIN.
const usuarioPublico = (h, rolActivo, debeCambiarPin) => {
  const permitidos = rolesPermitidos(h);
  return {
    nombre: h.NombreResidente || h.Nombre || "",
    documento: soloDigitos(h.DocumentoResidente || h.Documento),
    rol: permitidos[0],
    rolActivo,
    rolesPermitidos: permitidos,
    idHabitante: h.ID_Habitante || "",
    idInmueble: h.ID_Inmueble || "",
    torreManzana: h.TorreManzana || "",
    aptoCasa: h.AptoCasa || "",
    telefono: h.Telefono || "",
    email: h.Email || "",
    debeCambiarPin,
  };
};

// ------------------------------------------------------------------
// Rutas
// ------------------------------------------------------------------

module.exports = (baseDir) => {
  const router = express.Router();
  const rutaCredenciales = path.join(baseDir, ARCHIVO_CREDENCIALES);

  const leerCreds = () => leerCSV(rutaCredenciales);

  // Revisa documento + clave (nombre o PIN). Lleva la cuenta de intentos.
  // Devuelve { ok, habitante, tienePin, error, status }.
  const verificar = (documento, clave) => {
    const doc = soloDigitos(documento);
    const habitante = buscarHabitante(baseDir, doc);

    // Mismo mensaje si el documento no existe: no se revela quien esta registrado.
    const errorGeneral = { ok: false, status: 401, error: "Documento, nombre o PIN incorrectos." };
    if (!habitante) return errorGeneral;

    const creds = leerCreds();
    let cred = creds.find((c) => soloDigitos(c.DocumentoResidente) === doc);

    // Bloqueo vigente
    if (cred?.BloqueadoHasta && Date.now() < Number(cred.BloqueadoHasta)) {
      const minutos = Math.ceil((Number(cred.BloqueadoHasta) - Date.now()) / 60000);
      return {
        ok: false,
        status: 423,
        error: `Demasiados intentos fallidos. Intenta de nuevo en ${minutos} minuto(s).`,
      };
    }

    const tienePin = Boolean(cred?.PinCifrado);
    const correcto = tienePin
      ? pinCorrecto(String(clave || "").trim(), cred.Sal, cred.PinCifrado)
      : normalizar(clave) !== "" && normalizar(clave) === normalizar(habitante.NombreResidente || habitante.Nombre);

    if (!cred) {
      cred = { DocumentoResidente: doc, IntentosFallidos: "0" };
      creds.push(cred);
    }

    if (!correcto) {
      const intentos = Number(cred.IntentosFallidos || 0) + 1;
      cred.IntentosFallidos = String(intentos);
      if (intentos >= MAX_INTENTOS) {
        cred.BloqueadoHasta = String(Date.now() + MINUTOS_BLOQUEO * 60000);
        cred.IntentosFallidos = "0";
      }
      guardarCredenciales(rutaCredenciales, creds);

      if (cred.BloqueadoHasta && Date.now() < Number(cred.BloqueadoHasta)) {
        return {
          ok: false,
          status: 423,
          error: `Demasiados intentos fallidos. Acceso bloqueado por ${MINUTOS_BLOQUEO} minutos.`,
        };
      }

      const quedan = MAX_INTENTOS - intentos;
      return {
        ...errorGeneral,
        error: tienePin
          ? `Documento o PIN incorrectos. Te quedan ${quedan} intento(s).`
          : `Documento o nombre incorrectos. Te quedan ${quedan} intento(s).`,
      };
    }

    // Correcto: se reinician los intentos.
    cred.IntentosFallidos = "0";
    cred.BloqueadoHasta = "";
    cred.UltimoIngreso = ahoraTexto();
    guardarCredenciales(rutaCredenciales, creds);

    return { ok: true, habitante, tienePin };
  };

  // Ingreso
  router.post("/ingresar", (req, res) => {
    try {
      const { documento, clave, rol } = req.body || {};

      if (!soloDigitos(documento) || !String(clave || "").trim()) {
        return res.status(400).json({ error: "Escribe tu documento y tu PIN (o tu nombre si es tu primer ingreso)." });
      }

      const r = verificar(documento, clave);
      if (!r.ok) return res.status(r.status).json({ error: r.error });

      const rolActivo = ROLES.find((x) => normalizar(x) === normalizar(rol)) || "";
      const permitidos = rolesPermitidos(r.habitante);

      if (!rolActivo || !permitidos.includes(rolActivo)) {
        return res.status(403).json({ error: `Este usuario no está autorizado para el rol ${rol || ""}.` });
      }

      const usuario = usuarioPublico(r.habitante, rolActivo, !r.tienePin);
      const token = crearToken({ doc: usuario.documento, nom: usuario.nombre, rol: usuario.rol, act: rolActivo });
      return res.json({ ok: true, usuario, token });

    } catch (error) {
      console.error("❌ Error en ingreso:", error);
      return res.status(500).json({ error: "No se pudo validar el ingreso." });
    }
  });

  // Crear o cambiar PIN (pide de nuevo la clave actual: nombre o PIN)
  router.post("/crear-pin", (req, res) => {
    try {
      const { documento, clave, pinNuevo, pinConfirmacion } = req.body || {};
      const pin = String(pinNuevo || "").trim();

      if (pin !== String(pinConfirmacion || "").trim()) {
        return res.status(400).json({ error: "Los dos PIN no coinciden." });
      }

      const errorPin = validarPinNuevo(pin, documento);
      if (errorPin) return res.status(400).json({ error: errorPin });

      const r = verificar(documento, clave);
      if (!r.ok) return res.status(r.status).json({ error: r.error });

      const creds = leerCreds();
      const doc = soloDigitos(documento);
      let cred = creds.find((c) => soloDigitos(c.DocumentoResidente) === doc);
      if (!cred) {
        cred = { DocumentoResidente: doc };
        creds.push(cred);
      }

      if (cred.PinCifrado && pinCorrecto(pin, cred.Sal, cred.PinCifrado)) {
        return res.status(400).json({ error: "El PIN nuevo debe ser diferente al actual." });
      }

      const { sal, cifrado } = cifrarPin(pin);
      const ahora = ahoraTexto();
      cred.PinCifrado = cifrado;
      cred.Sal = sal;
      cred.FechaCreacion = cred.FechaCreacion || ahora;
      cred.FechaUltimoCambio = ahora;
      cred.IntentosFallidos = "0";
      cred.BloqueadoHasta = "";

      guardarCredenciales(rutaCredenciales, creds);

      return res.json({ ok: true, mensaje: "PIN guardado. Desde ahora entras con tu documento y tu PIN." });
    } catch (error) {
      console.error("❌ Error creando PIN:", error);
      return res.status(500).json({ error: "No se pudo guardar el PIN." });
    }
  });

  // Estado de los PIN (sin datos secretos): para la pantalla del administrador.
  router.get("/estado-pines", (req, res) => {
    try {
      const estados = leerCreds().map((c) => ({
        documento: soloDigitos(c.DocumentoResidente),
        tienePin: Boolean(c.PinCifrado),
        bloqueado: Boolean(c.BloqueadoHasta && Date.now() < Number(c.BloqueadoHasta)),
        ultimoIngreso: c.UltimoIngreso || "",
        ultimoCambio: c.FechaUltimoCambio || "",
      }));
      return res.json({ estados });
    } catch (error) {
      console.error("❌ Error leyendo estado de PIN:", error);
      return res.status(500).json({ error: "No se pudo leer el estado de los PIN." });
    }
  });

  // Restablecer PIN olvidado (solo administrador)
  router.post("/restablecer-pin", (req, res) => {
    try {
      const { adminDocumento, adminPin, documento } = req.body || {};

      const admin = buscarHabitante(baseDir, adminDocumento);
      if (!admin || rolesPermitidos(admin)[0] !== "Administrador") {
        return res.status(403).json({ error: "Solo un administrador puede restablecer un PIN." });
      }

      const r = verificar(adminDocumento, adminPin);
      if (!r.ok || !r.tienePin) {
        return res.status(401).json({ error: r.error || "El administrador debe confirmar con su PIN." });
      }

      const doc = soloDigitos(documento);
      if (doc === soloDigitos(adminDocumento)) {
        return res.status(400).json({ error: "No puedes restablecer tu propio PIN. Usa \"Cambiar mi PIN\"." });
      }
      if (!buscarHabitante(baseDir, doc)) {
        return res.status(404).json({ error: "No existe un habitante activo con ese documento." });
      }

      const creds = leerCreds().filter((c) => soloDigitos(c.DocumentoResidente) !== doc);
      guardarCredenciales(rutaCredenciales, creds);

      return res.json({
        ok: true,
        mensaje: "PIN restablecido. La persona debe entrar con su documento y su nombre completo para crear uno nuevo.",
      });
    } catch (error) {
      console.error("❌ Error restableciendo PIN:", error);
      return res.status(500).json({ error: "No se pudo restablecer el PIN." });
    }
  });

    // Para otras rutas del servidor: confirma que quien actúa es un administrador
  // con su PIN. Devuelve { ok: true, nombre } o { ok: false, status, error }.
  router.verificarAdmin = (documento, pin) => {
    const admin = buscarHabitante(baseDir, documento);
    if (!admin || rolesPermitidos(admin)[0] !== "Administrador") {
      return { ok: false, status: 403, error: "Solo un administrador puede hacer esta acción." };
    }
    const r = verificar(documento, pin);
    if (!r.ok || !r.tienePin) {
      return { ok: false, status: r.status || 401, error: r.error || "Confirma con tu PIN de administrador." };
    }
    return { ok: true, nombre: admin.NombreResidente || admin.Nombre || "Administrador" };
  };

    console.log("🔎 authRoutes archivo:", __filename);
  console.log("🔎 authRoutes: verificarAdmin definido =", typeof router.verificarAdmin);

  return router;
};