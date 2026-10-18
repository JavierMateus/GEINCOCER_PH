// backend/routes/pqrsRoutes.js
// PQRS con radicado, historial, plazo de 15 dias habiles y conversacion.
//
//   GET    /api/pqrs                       -> lista (con radicado, fecha limite y semaforo)
//   POST   /api/pqrs                       -> el residente radica una PQRS (con adjunto opcional)
//   POST   /api/pqrs/upload                -> sube un archivo suelto
//   DELETE /api/pqrs/:id                   -> elimina una PQRS (y su historial)
//   GET    /api/pqrs/:id/historial         -> eventos de la PQRS
//   PUT    /api/pqrs/:id/estado            -> administrador: "En proceso" o "Cerrada"
//   PUT    /api/pqrs/:id/respuesta         -> administrador: respuesta escrita
//   PUT    /api/pqrs/:id/respuesta-archivo -> administrador: archivo de respuesta
//   POST   /api/pqrs/:id/mensaje           -> residente: mensaje y, si quiere, reabrir
//
// Archivos en BaseResidencial:
//   PQRS.csv            -> una fila por PQRS
//   PQRS_Historial.csv  -> una fila por evento (radicada, cambio de estado, respuesta, mensaje...)

const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const router = express.Router();

const basePath = "C:/Users/Javier Mateus/Desktop/Geincocer/BaseResidencial";
const pqrsFile = path.join(basePath, "PQRS.csv");
const historialFile = path.join(basePath, "PQRS_Historial.csv");
const residentesFile = path.join(basePath, "Habitantes.csv");

const adjuntosDir = path.join(basePath, "PQRSAdjuntos");
const solicitudesDir = path.join(adjuntosDir, "Solicitudes");
const respuestasDir = path.join(adjuntosDir, "Respuestas");

[basePath, adjuntosDir, solicitudesDir, respuestasDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const HEADERS = [
  "ID", "Fecha", "Tipo", "Asunto", "Descripcion", "Espacio", "FechaReserva", "HoraReserva",
  "DocumentoResidente", "NombreResidente", "TorreManzana", "AptoCasa", "Estado", "Adjunto",
  "URL_Adjunto", "RespuestaAdmin", "URL_RespuestaAdmin", "FechaRespuesta",
  "Radicado", "FechaLimite",
];

const HEADERS_HISTORIAL = ["ID_PQRS", "FechaHora", "Evento", "Estado", "Autor", "Rol", "Mensaje", "URL_Archivo"];

const PLAZO_DIAS_HABILES = 15;
const DIAS_ALERTA = 3;
const ESTADOS_ABIERTOS = ["radicada", "en proceso", "reabierta"];

if (!fs.existsSync(pqrsFile)) fs.writeFileSync(pqrsFile, `${HEADERS.join(";")}\n`, "utf8");

// ------------------------------------------------------------------
// CSV (acepta comillas y saltos de linea dentro de un campo)
// ------------------------------------------------------------------
function escaparCSV(valor) {
  const texto = String(valor ?? "");
  if (/[;"\r\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

function parsearCSV(texto) {
  const filas = [];
  let fila = [];
  let campo = "";
  let enComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        enComillas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      enComillas = true;
    } else if (c === ";") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo);
      if (fila.some((x) => x !== "")) filas.push(fila);
      fila = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  fila.push(campo);
  if (fila.some((x) => x !== "")) filas.push(fila);
  return filas;
}

function leerTabla(ruta) {
  if (!fs.existsSync(ruta)) return [];
  const contenido = fs.readFileSync(ruta, "utf8").replace(/^\uFEFF/, "");
  const filas = parsearCSV(contenido);
  if (filas.length <= 1) return [];
  const encabezados = filas[0].map((h) => h.trim());
  return filas.slice(1).map((valores) => {
    const obj = {};
    encabezados.forEach((enc, i) => {
      obj[enc] = (valores[i] || "").trim();
    });
    return obj;
  });
}

function escribirTabla(ruta, encabezados, registros) {
  const lineas = registros.map((r) => encabezados.map((h) => escaparCSV(r[h] ?? "")).join(";"));
  const temporal = `${ruta}.tmp`;
  fs.writeFileSync(temporal, [encabezados.join(";"), ...lineas].join("\n") + "\n", "utf8");
  fs.renameSync(temporal, ruta);
}

function leerCSV() {
  return leerTabla(pqrsFile).map((o) => {
    const r = {};
    HEADERS.forEach((h) => {
      r[h] = o[h] || "";
    });
    r.TorreManzana = o.TorreManzana || o["Torre/Manzana"] || "";
    r.AptoCasa = o.AptoCasa || o["Apto/Casa"] || "";
    return r;
  });
}

function guardarCSV(registros) {
  escribirTabla(pqrsFile, HEADERS, registros);
}

const leerHistorial = () => leerTabla(historialFile);

function agregarEvento(evento) {
  const nuevo = !fs.existsSync(historialFile);
  const fila = HEADERS_HISTORIAL.map((h) => escaparCSV(evento[h] ?? "")).join(";");
  fs.appendFileSync(historialFile, (nuevo ? HEADERS_HISTORIAL.join(";") + "\n" : "") + fila + "\n", "utf8");
}

// ------------------------------------------------------------------
// Fechas (hora de Colombia) y dias habiles
// ------------------------------------------------------------------
const partesColombia = () =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  );

const hoyISO = () => {
  const p = partesColombia();
  return `${p.year}-${p.month}-${p.day}`;
};

const ahoraISO = () => {
  const p = partesColombia();
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}:${p.second}`;
};

// Acepta 2026-05-29 y 29/05/2026. Devuelve Date en UTC (solo fecha).
function aFecha(valor) {
  const t = String(valor || "").trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return null;
}

const iso = (d) => d.toISOString().slice(0, 10);
const sumarDias = (d, n) => new Date(d.getTime() + n * 86400000);

// Festivos de Colombia (Ley 51 de 1983 y Semana Santa).
const cacheFestivos = {};
function festivosColombia(anio) {
  if (cacheFestivos[anio]) return cacheFestivos[anio];

  // Domingo de Pascua (algoritmo de Meeus)
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  const pascua = new Date(Date.UTC(anio, mes - 1, dia));

  const lunesSiguiente = (fecha) => {
    const dow = fecha.getUTCDay();
    return dow === 1 ? fecha : sumarDias(fecha, (8 - dow) % 7);
  };
  const f0 = (mm, dd) => new Date(Date.UTC(anio, mm - 1, dd));

  const lista = [
    f0(1, 1), f0(5, 1), f0(7, 20), f0(8, 7), f0(12, 8), f0(12, 25),
    lunesSiguiente(f0(1, 6)), lunesSiguiente(f0(3, 19)), lunesSiguiente(f0(6, 29)),
    lunesSiguiente(f0(8, 15)), lunesSiguiente(f0(10, 12)), lunesSiguiente(f0(11, 1)),
    lunesSiguiente(f0(11, 11)),
    sumarDias(pascua, -3), sumarDias(pascua, -2),
    sumarDias(pascua, 43), sumarDias(pascua, 64), sumarDias(pascua, 71),
  ];
  cacheFestivos[anio] = new Set(lista.map(iso));
  return cacheFestivos[anio];
}

const esHabil = (d) => {
  const dow = d.getUTCDay();
  return dow !== 0 && dow !== 6 && !festivosColombia(d.getUTCFullYear()).has(iso(d));
};

// Fecha limite: el dia habil numero 15 contado desde el dia siguiente.
function fechaLimiteDesde(fechaRadicacion) {
  let d = aFecha(fechaRadicacion);
  if (!d) return "";
  let contados = 0;
  while (contados < PLAZO_DIAS_HABILES) {
    d = sumarDias(d, 1);
    if (esHabil(d)) contados++;
  }
  return iso(d);
}

// Dias habiles entre dos fechas (sin contar la primera, contando la ultima).
function diasHabilesEntre(desde, hasta) {
  let d = aFecha(desde);
  const fin = aFecha(hasta);
  if (!d || !fin) return 0;
  let n = 0;
  while (d < fin) {
    d = sumarDias(d, 1);
    if (esHabil(d)) n++;
  }
  return n;
}

// Semaforo para la tabla
function calcularPlazo(r) {
  const estado = String(r.Estado || "").toLowerCase();
  const limite = r.FechaLimite;
  if (!limite) return { Semaforo: "sin_plazo", DiasHabilesRestantes: null };

  if (!ESTADOS_ABIERTOS.includes(estado)) {
    const fr = aFecha(r.FechaRespuesta);
    const aTiempo = fr ? fr <= aFecha(limite) : true;
    return { Semaforo: aTiempo ? "respondida_a_tiempo" : "respondida_tarde", DiasHabilesRestantes: null };
  }

  const hoy = hoyISO();
  if (hoy > limite) return { Semaforo: "vencida", DiasHabilesRestantes: -diasHabilesEntre(limite, hoy) };
  const restantes = diasHabilesEntre(hoy, limite);
  return { Semaforo: restantes <= DIAS_ALERTA ? "vence_pronto" : "a_tiempo", DiasHabilesRestantes: restantes };
}

// ------------------------------------------------------------------
// Radicado y migracion de PQRS antiguas
// ------------------------------------------------------------------
function siguienteRadicado(registros, anio) {
  const prefijo = `PQRS-${anio}-`;
  const max = registros
    .map((r) => String(r.Radicado || ""))
    .filter((x) => x.startsWith(prefijo))
    .map((x) => Number(x.slice(prefijo.length)) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefijo}${String(max + 1).padStart(4, "0")}`;
}

// Las PQRS que existian antes no tienen radicado ni historial: se completan una sola vez.
function completarPqrsAntiguas() {
  const registros = leerCSV();
  const faltantes = registros.filter((r) => !r.Radicado);
  if (!faltantes.length) return;

  const respaldos = path.join(basePath, "respaldos");
  if (!fs.existsSync(respaldos)) fs.mkdirSync(respaldos, { recursive: true });
  const sello = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  fs.copyFileSync(pqrsFile, path.join(respaldos, `PQRS_antes_seguimiento_${sello}.csv`));

  const historial = leerHistorial();
  const conHistorial = new Set(historial.map((h) => h.ID_PQRS));

  [...faltantes]
    .sort((a, b) => String(a.Fecha).localeCompare(String(b.Fecha)) || String(a.ID).localeCompare(String(b.ID)))
    .forEach((r) => {
      const fecha = aFecha(r.Fecha) ? iso(aFecha(r.Fecha)) : hoyISO();
      r.Radicado = siguienteRadicado(registros, fecha.slice(0, 4));
      r.FechaLimite = fechaLimiteDesde(fecha);

      if (!conHistorial.has(r.ID)) {
        agregarEvento({
          ID_PQRS: r.ID, FechaHora: `${fecha}T00:00:00`, Evento: "Radicada", Estado: "Radicada",
          Autor: r.NombreResidente, Rol: "Residente", Mensaje: r.Descripcion, URL_Archivo: r.URL_Adjunto !== "-" ? r.URL_Adjunto : "",
        });
        const tieneRespuesta = (r.RespuestaAdmin && r.RespuestaAdmin !== "-") || (r.URL_RespuestaAdmin && r.URL_RespuestaAdmin !== "-");
        if (tieneRespuesta) {
          const fr = aFecha(r.FechaRespuesta) ? iso(aFecha(r.FechaRespuesta)) : fecha;
          agregarEvento({
            ID_PQRS: r.ID, FechaHora: `${fr}T00:00:00`, Evento: "Respuesta", Estado: r.Estado || "Respondida",
            Autor: "Administración", Rol: "Administrador", Mensaje: r.RespuestaAdmin !== "-" ? r.RespuestaAdmin : "",
            URL_Archivo: r.URL_RespuestaAdmin !== "-" ? r.URL_RespuestaAdmin : "",
          });
        }
      }
    });

  guardarCSV(registros);
  console.log(`📋 PQRS: se asignó radicado a ${faltantes.length} PQRS antiguas.`);
}

try {
  completarPqrsAntiguas();
} catch (error) {
  console.error("❌ No se pudieron completar las PQRS antiguas:", error);
}

// ------------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------------
function buscarDatosResidentePorDocumento(documento) {
  return leerTabla(residentesFile).find(
    (item) => String(item.Documento || item.DocumentoResidente || item.documento || "").trim() === String(documento).trim()
  );
}

const MAX_MB = 5;
const TIPOS_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png"];

const almacenamiento = (carpeta, prefijo) =>
  multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, carpeta),
      filename: (req, file, cb) => cb(null, `${prefijo}${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`),
    }),
    limits: { fileSize: MAX_MB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (TIPOS_PERMITIDOS.includes(file.mimetype)) return cb(null, true);
      cb(new Error("Solo se permiten archivos PDF, JPG o PNG."));
    },
  });

const uploadSolicitud = almacenamiento(solicitudesDir, "");
const uploadRespuesta = almacenamiento(respuestasDir, "RESP-");

const buscarIndice = (pqrs, id) => pqrs.findIndex((item) => String(item.ID).trim() === String(id).trim());

const conPlazo = (r) => ({ ...r, ...calcularPlazo(r) });

// ------------------------------------------------------------------
// Rutas
// ------------------------------------------------------------------
router.get("/", (req, res) => {
  try {
    res.json(leerCSV().map(conPlazo));
  } catch (error) {
    console.error("Error al leer PQRS:", error);
    res.status(500).json({ error: "Error al leer las PQRS" });
  }
});

router.post("/", uploadSolicitud.single("archivo"), (req, res) => {
  try {
    const body = req.body || {};
    const Tipo = String(body.Tipo || "").trim();
    const Asunto = String(body.Asunto || "").trim();
    const Descripcion = String(body.Descripcion || "").trim();
    const DocumentoResidente = String(body.DocumentoResidente || "").trim();
    const NombreResidente = String(body.NombreResidente || "").trim();
    const Espacio = String(body.Espacio || "").trim();
    const FechaReserva = String(body.FechaReserva || "").trim();
    const HoraReserva = String(body.HoraReserva || "").trim();

    if (!Tipo || !Asunto || !Descripcion || !DocumentoResidente || !NombreResidente) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const residente = buscarDatosResidentePorDocumento(DocumentoResidente);
    const TorreManzana = String(body.TorreManzana || residente?.TorreManzana || residente?.["Torre/Manzana"] || "").trim();
    const AptoCasa = String(body.AptoCasa || residente?.AptoCasa || residente?.["Apto/Casa"] || "").trim();

    const pqrs = leerCSV();
    const hoy = hoyISO();
    const urlAdjunto = req.file ? `/PQRSAdjuntos/Solicitudes/${req.file.filename}` : "-";

    const nuevaPQRS = {
      ID: `PQRS-${Date.now()}`,
      Fecha: hoy,
      Tipo,
      Asunto,
      Descripcion,
      Espacio: Espacio || "-",
      FechaReserva: FechaReserva || "-",
      HoraReserva: HoraReserva || "-",
      DocumentoResidente,
      NombreResidente,
      TorreManzana: TorreManzana || "-",
      AptoCasa: AptoCasa || "-",
      Estado: "Radicada",
      Adjunto: req.file ? req.file.filename : "-",
      URL_Adjunto: urlAdjunto,
      RespuestaAdmin: "-",
      URL_RespuestaAdmin: "-",
      FechaRespuesta: "-",
      Radicado: siguienteRadicado(pqrs, hoy.slice(0, 4)),
      FechaLimite: fechaLimiteDesde(hoy),
    };

    pqrs.push(nuevaPQRS);
    guardarCSV(pqrs);
    agregarEvento({
      ID_PQRS: nuevaPQRS.ID, FechaHora: ahoraISO(), Evento: "Radicada", Estado: "Radicada",
      Autor: NombreResidente, Rol: "Residente", Mensaje: Descripcion, URL_Archivo: urlAdjunto !== "-" ? urlAdjunto : "",
    });

    console.log(`📋 PQRS radicada: ${nuevaPQRS.Radicado} (${NombreResidente})`);
    return res.status(201).json({ mensaje: "PQRS creada correctamente", pqrs: conPlazo(nuevaPQRS) });
  } catch (error) {
    console.error("Error al crear PQRS:", error);
    return res.status(500).json({ error: "Error al crear la PQRS" });
  }
});

router.post("/upload", uploadSolicitud.single("archivo"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió ningún archivo" });
    res.status(201).json({
      mensaje: "Archivo subido correctamente",
      nombreArchivo: req.file.filename,
      ruta: `/PQRSAdjuntos/Solicitudes/${req.file.filename}`,
    });
  } catch (error) {
    console.error("Error al subir archivo:", error);
    res.status(500).json({ error: "Error al subir archivo" });
  }
});

router.delete("/:id", (req, res) => {
  try {
    const pqrs = leerCSV();
    const index = buscarIndice(pqrs, req.params.id);
    if (index === -1) return res.status(404).json({ message: "PQRS no encontrada" });

    if (String(pqrs[index].Estado || "").trim().toLowerCase() !== "radicada") {
  return res.status(403).json({
    message: "Solo se puede eliminar una PQRS mientras esté en estado Radicada. Las demás quedan como constancia.",
  });
}
    const eliminada = pqrs[index];
    const rutaAdjunto = eliminada.Adjunto && eliminada.Adjunto !== "-" ? path.join(solicitudesDir, eliminada.Adjunto) : "";
    if (rutaAdjunto && fs.existsSync(rutaAdjunto)) fs.unlinkSync(rutaAdjunto);

    pqrs.splice(index, 1);
    guardarCSV(pqrs);

    const historial = leerHistorial();
    const restantes = historial.filter((h) => h.ID_PQRS !== eliminada.ID);
    if (restantes.length !== historial.length) escribirTabla(historialFile, HEADERS_HISTORIAL, restantes);

    return res.status(200).json({ message: "PQRS eliminada correctamente", pqrs: eliminada });
  } catch (error) {
    console.error("Error al eliminar PQRS:", error);
    return res.status(500).json({ message: "Error al eliminar la PQRS" });
  }
});

router.get("/:id/historial", (req, res) => {
  try {
    const pqrs = leerCSV().find((p) => p.ID === req.params.id);
    if (!pqrs) return res.status(404).json({ message: "PQRS no encontrada" });
    const eventos = leerHistorial()
      .filter((h) => h.ID_PQRS === req.params.id)
      .sort((a, b) => String(a.FechaHora).localeCompare(String(b.FechaHora)));
    return res.json({ pqrs: conPlazo(pqrs), eventos });
  } catch (error) {
    console.error("Error al leer historial de PQRS:", error);
    return res.status(500).json({ message: "Error al leer el historial" });
  }
});

router.put("/:id/estado", (req, res) => {
  try {
    const { Estado, Autor, Nota } = req.body || {};
    const permitido = ["En proceso", "Cerrada"].find((e) => e.toLowerCase() === String(Estado || "").toLowerCase());
    if (!permitido) return res.status(400).json({ message: "Estado no válido. Usa 'En proceso' o 'Cerrada'." });

    const pqrs = leerCSV();
    const index = buscarIndice(pqrs, req.params.id);
    if (index === -1) return res.status(404).json({ message: "PQRS no encontrada" });
    if (pqrs[index].Estado === permitido) return res.status(400).json({ message: `La PQRS ya está en "${permitido}".` });

    pqrs[index].Estado = permitido;
    guardarCSV(pqrs);
    agregarEvento({
      ID_PQRS: pqrs[index].ID, FechaHora: ahoraISO(), Evento: permitido === "Cerrada" ? "Cerrada" : "En proceso",
      Estado: permitido, Autor: Autor || "Administración", Rol: "Administrador", Mensaje: String(Nota || "").trim(),
    });

    return res.json({ message: `Estado cambiado a ${permitido}.`, pqrs: conPlazo(pqrs[index]) });
  } catch (error) {
    console.error("Error al cambiar estado de PQRS:", error);
    return res.status(500).json({ message: "Error al cambiar el estado" });
  }
});

router.put("/:id/respuesta", (req, res) => {
  try {
    const { RespuestaAdmin, Estado, Autor } = req.body || {};
    const texto = String(RespuestaAdmin || "").trim();
    if (!texto) return res.status(400).json({ message: "Escribe la respuesta." });

    const pqrs = leerCSV();
    const index = buscarIndice(pqrs, req.params.id);
    if (index === -1) return res.status(404).json({ message: "PQRS no encontrada" });

    pqrs[index].RespuestaAdmin = texto;
    pqrs[index].FechaRespuesta = hoyISO();
    pqrs[index].Estado = String(Estado || "Respondida").trim();
    guardarCSV(pqrs);
    agregarEvento({
      ID_PQRS: pqrs[index].ID, FechaHora: ahoraISO(), Evento: "Respuesta", Estado: pqrs[index].Estado,
      Autor: Autor || "Administración", Rol: "Administrador", Mensaje: texto,
    });

    return res.status(200).json({ message: "Respuesta guardada correctamente", pqrs: conPlazo(pqrs[index]) });
  } catch (error) {
    console.error("Error al guardar respuesta de PQRS:", error);
    return res.status(500).json({ message: "Error al guardar la respuesta de la PQRS" });
  }
});

router.put("/:id/respuesta-archivo", uploadRespuesta.single("archivoRespuesta"), (req, res) => {
  try {
    const pqrs = leerCSV();
    const index = buscarIndice(pqrs, req.params.id);
    if (index === -1) return res.status(404).json({ message: "PQRS no encontrada" });
    if (!req.file) return res.status(400).json({ message: "Debes adjuntar un archivo de respuesta" });

    const url = `/PQRSAdjuntos/Respuestas/${req.file.filename}`;
    // Si ya hay respuesta escrita se conserva; si no, queda el nombre del archivo.
    if (!pqrs[index].RespuestaAdmin || pqrs[index].RespuestaAdmin === "-") pqrs[index].RespuestaAdmin = req.file.filename;
    pqrs[index].URL_RespuestaAdmin = url;
    pqrs[index].FechaRespuesta = hoyISO();
    pqrs[index].Estado = "Respondida";
    guardarCSV(pqrs);
    agregarEvento({
      ID_PQRS: pqrs[index].ID, FechaHora: ahoraISO(), Evento: "Archivo de respuesta", Estado: "Respondida",
      Autor: (req.body && req.body.Autor) || "Administración", Rol: "Administrador",
      Mensaje: req.file.originalname, URL_Archivo: url,
    });

    return res.status(200).json({ message: "Archivo de respuesta guardado correctamente", pqrs: conPlazo(pqrs[index]) });
  } catch (error) {
    console.error("Error al guardar archivo de respuesta:", error);
    return res.status(500).json({ message: "Error al guardar el archivo de respuesta" });
  }
});

// Residente: mensaje en la conversacion. Con Reabrir=true pide reabrir la PQRS
// (solo si ya fue respondida o cerrada); el plazo de 15 dias habiles empieza de nuevo.
router.post("/:id/mensaje", (req, res) => {
  try {
    const { Documento, Autor, Mensaje, Reabrir } = req.body || {};
    const texto = String(Mensaje || "").trim();
    if (!texto) return res.status(400).json({ message: "Escribe tu mensaje." });

    const pqrs = leerCSV();
    const index = buscarIndice(pqrs, req.params.id);
    if (index === -1) return res.status(404).json({ message: "PQRS no encontrada" });

    const r = pqrs[index];
    if (String(r.DocumentoResidente).trim() !== String(Documento || "").trim()) {
      return res.status(403).json({ message: "Esta PQRS no pertenece a tu usuario." });
    }

    const estado = String(r.Estado).toLowerCase();
    let evento = "Mensaje del residente";

    if (Reabrir) {
      if (ESTADOS_ABIERTOS.includes(estado)) {
        return res.status(400).json({ message: "La PQRS sigue abierta; tu mensaje se puede enviar sin reabrir." });
      }
      r.Estado = "Reabierta";
      r.FechaLimite = fechaLimiteDesde(hoyISO());
      evento = "Reabierta";
    } else if (estado === "cerrada") {
      return res.status(400).json({ message: "La PQRS está cerrada. Para escribir, pide reabrirla." });
    }

    guardarCSV(pqrs);
    agregarEvento({
      ID_PQRS: r.ID, FechaHora: ahoraISO(), Evento: evento, Estado: r.Estado,
      Autor: Autor || r.NombreResidente, Rol: "Residente", Mensaje: texto,
    });

    return res.json({ message: Reabrir ? "PQRS reabierta. La administración tiene un nuevo plazo para responder." : "Mensaje enviado.", pqrs: conPlazo(r) });
  } catch (error) {
    console.error("Error al registrar mensaje de PQRS:", error);
    return res.status(500).json({ message: "Error al enviar el mensaje" });
  }
});

// Convierte los rechazos de archivos en mensajes claros para la pantalla
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    const texto = `El archivo supera el máximo de ${MAX_MB} MB.`;
    return res.status(400).json({ error: texto, message: texto });
  }
  if (err) {
    return res.status(400).json({ error: err.message, message: err.message });
  }
  next();
});

module.exports = router;