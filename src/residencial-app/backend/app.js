// backend/app.js
const express = require('express');
const cors = require("cors");
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { requiereSesion } = require("./middlewares/sesion");
const pqrsRoutes = require("./routes/pqrsRoutes");

const mercadopagoRoutes = require('./routes/mercadopago');
const pagosRoutes = require('./routes/pagosRoutes');
const importExportRoutes = require('./routes/importExportRoutes');
const crearObligacionesController = require('./controllers/obligacionesController');
const crearObligacionesRoutes = require('./routes/obligacionesRoutes');
const habitantesRoutes = require("./routes/habitantesRoutes");
const liquidacionInteresesRoutes = require("./routes/liquidacionInteresesRoutes");
const pagosRecibidosRoutes = require("./routes/pagosRecibidosRoutes");
const authRoutes = require("./routes/authRoutes");
const visitantesRoutes = require("./routes/visitantesRoutes");
const consultaSeguridadRoutes = require("./routes/consultaSeguridadRoutes");
const cuotasRoutes = require("./routes/cuotasRoutes");
const bitacoraRoutes = require("./routes/bitacoraRoutes");
const inventarioRoutes = require("./routes/inventarioRoutes");
const mantenimientoRoutes = require("./routes/mantenimientoRoutes");

const app = express();

/* =========================
   1. Configuración Global de CORS (DEBE IR PRIMERO)
========================= */
/* =========================
   1. Configuración Global de CORS
========================= */
const corsOptions = {
  origin: ["https://geincocer-app.onrender.com", "http://localhost:3000", "http://localhost:4000"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true
};

app.use(cors(corsOptions));

app.use(cors(corsOptions));

/* =========================
   Middlewares base
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   Rutas oficiales BaseResidencial
========================= */
const baseResidencialDir = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, 'public', 'BaseResidencial') 
  : 'C:\\Users\\Javier Mateus\\Desktop\\Geincocer\\BaseResidencial';

  const mascotasPath = path.join(baseResidencialDir, 'Mascotas.csv');
  
const obligacionesController =
  crearObligacionesController(baseResidencialDir);
const obligacionesRoutes =
  crearObligacionesRoutes(obligacionesController);
const notificacionesDir = path.join(baseResidencialDir, 'Notificaciones');
const archivoNotificacionesCSV = path.join(baseResidencialDir, 'Notificaciones.csv');
const publicDir = path.join(__dirname, 'public');

const CABECERAS_NOTIFICACIONES = [
  'ID_Archivo',
  'Título',
  'Tipo',
  'Fecha_Publicación',
  'Autor',
  'Descripción',
  'Adjunto',
  'URL_Archivo',
  'Destinatarios',
  'Vigente_Desde',
  'Vigente_Hasta',
  'Prioridad',
  'Estado',
  'Firma_Digital',
  'Visualizado_Por',
  'Fecha_Actualización',
  'Versión',
  'Confirmación_Recibido',
  'Link_Referencia',
  'fecha'
];

/* =========================
   Carpetas y archivos necesarios
========================= */
if (!fs.existsSync(baseResidencialDir)) {
  fs.mkdirSync(baseResidencialDir, { recursive: true });
}

if (!fs.existsSync(notificacionesDir)) {
  fs.mkdirSync(notificacionesDir, { recursive: true });
}

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

if (!fs.existsSync(archivoNotificacionesCSV)) {
  const csvInicial = stringify([], {
    header: true,
    columns: CABECERAS_NOTIFICACIONES
  });
  fs.writeFileSync(archivoNotificacionesCSV, csvInicial, 'utf8');
}

/* =========================
   Archivos Estáticos y Logs
========================= */
app.use(express.static(publicDir));
app.use('/Notificaciones', express.static(notificacionesDir));
const uploadsDir = path.join(baseResidencialDir, "Notificaciones");
console.log("Uploads Dir:", uploadsDir);
app.use("/uploads", express.static(uploadsDir));

app.use("/api/pqrs", pqrsRoutes);

app.use(
  "/PQRSAdjuntos",
  express.static(path.join(baseResidencialDir, "PQRSAdjuntos"))
);

console.log("Ruta estática PQRSAdjuntos:", path.join(baseResidencialDir, "PQRSAdjuntos"));

/* =========================
   Configuración Multer
========================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, notificacionesDir);
  },
  filename: (req, file, cb) => {
    const nombreOriginal = file.originalname || 'archivo';
    const extension = path.extname(nombreOriginal);
    const base = path.basename(nombreOriginal, extension);
    const nombreLimpio = base.replace(/[^\w\u00C0-\u024F.-]/g, '_');
    const nombreFinal = `${Date.now()}-${nombreLimpio}${extension}`;
    cb(null, nombreFinal);
  },
});

const upload = multer({ storage });

/* =========================
   Rutas generales de la API
========================= */
app.use('/api/obligaciones', obligacionesRoutes);
app.use("/api/habitantes", habitantesRoutes(baseResidencialDir));
app.use("/api/liquidacion-intereses", liquidacionInteresesRoutes(baseResidencialDir));

const rutasAuth = authRoutes(baseResidencialDir);
app.use("/api/pagos-recibidos", pagosRecibidosRoutes(baseResidencialDir, rutasAuth.verificarAdmin));
app.use("/api/auth", rutasAuth); // <--- Autenticación pública para el login

app.use("/api/inventario", inventarioRoutes(baseResidencialDir, rutasAuth.verificarAdmin));
app.use("/api/bitacora", bitacoraRoutes(baseResidencialDir, rutasAuth.verificarAdmin));
app.use("/api/cuotas", cuotasRoutes(baseResidencialDir));
app.use("/api/visitantes", visitantesRoutes(baseResidencialDir));
app.use("/api/consulta-seguridad", consultaSeguridadRoutes(baseResidencialDir));
app.use("/api/mantenimiento", mantenimientoRoutes(baseResidencialDir, rutasAuth.verificarAdmin));
app.use('/api/pagos', pagosRoutes);
app.use('/api/mercadopago', mercadopagoRoutes);
app.use('/api/import-export', importExportRoutes);

// ==========================================
// RUTAS PARA EL MÓDULO DE MASCOTAS (ROBUSTO)
// ==========================================

// 1. GET: Consultar todas las mascotas registradas
app.get('/api/mascotas', (req, res) => {
  try {
    if (!fs.existsSync(mascotasPath)) {
      return res.json({ mascotas: [] });
    }
    const contenido = fs.readFileSync(mascotasPath, 'utf-8');
    const registros = parse(contenido, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true
    });
    res.json({ mascotas: registros });
  } catch (err) {
    console.error("Error leyendo mascotas:", err);
    res.status(500).json({ error: "No se pudo leer la información de mascotas." });
  }
});

// 2. POST: Guardar o actualizar la declaración de múltiples mascotas
app.post('/api/mascotas', (req, res) => {
  try {
    const { torre, apto, tieneMascota, mascotas } = req.body;

    if (!torre || !apto || tieneMascota === undefined) {
      return res.status(400).json({ error: "Datos incompletos para el registro." });
    }

    let lineas = [];
    if (fs.existsSync(mascotasPath)) {
      const contenido = fs.readFileSync(mascotasPath, 'utf-8');
      lineas = contenido.trim().split(/\r?\n/).filter(Boolean);
    } else {
      lineas = ['idMascota,torre,apto,tieneMascota,tipo,nombre,raza,vacunasAlDia,fechaRegistro'];
    }

    const fechaRegistro = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

    // Filtrar registros anteriores de esta misma torre y apto para evitar duplicados al actualizar
    const cabecera = lineas[0];
    const restoLineas = lineas.slice(1).filter(linea => {
      const partes = linea.split(',');
      if (partes.length >= 3) {
        const t = partes[1].trim();
        const a = partes[2].trim();
        return !(t.toLowerCase() === String(torre).trim().toLowerCase() && a.toLowerCase() === String(apto).trim().toLowerCase());
      }
      return true;
    });

    let nuevasLineas = [cabecera, ...restoLineas];

    if (tieneMascota === 'No' || !mascotas || mascotas.length === 0) {
      const idMascota = `MASC-${Date.now()}`;
      const nuevaLinea = `${idMascota},${torre},${apto},No,N/A,N/A,N/A,N/A,${fechaRegistro}`;
      nuevasLineas.push(nuevaLinea);
    } else {
      mascotas.forEach((m, idx) => {
        const idMascota = `MASC-${Date.now()}-${idx}`;
        const vacunas = m.vacunasAlDia || 'Sí';
        const nuevaLinea = `${idMascota},${torre},${apto},Sí,${m.tipo || 'N/A'},${m.nombre || 'N/A'},${m.raza || 'N/A'},${vacunas},${fechaRegistro}`;
        nuevasLineas.push(nuevaLinea);
      });
    }

    fs.writeFileSync(mascotasPath, nuevasLineas.join('\n'), 'utf-8');
    res.json({ mensaje: "Registros de mascotas guardados con éxito." });
  } catch (err) {
    console.error("Error guardando mascotas:", err);
    res.status(500).json({ error: "No se pudo guardar la información." });
  }
});

/* =========================
   Funciones CSV Notificaciones
========================= */
function leerNotificacionesCSV() {
  try {
    if (!fs.existsSync(archivoNotificacionesCSV)) {
      const csvInicial = stringify([], {
        header: true,
        columns: CABECERAS_NOTIFICACIONES
      });
      fs.writeFileSync(archivoNotificacionesCSV, csvInicial, 'utf8');
      return [];
    }

    const contenido = fs.readFileSync(archivoNotificacionesCSV, 'utf8').trim();

    if (!contenido) {
      return [];
    }

    const registros = parse(contenido, {
      columns: true,
      skip_empty_lines: true,
      bom: true
    });

    return Array.isArray(registros) ? registros : [];
  } catch (error) {
    console.error('Error leyendo Notificaciones.csv:', error);
    return [];
  }
}

function guardarNotificacionesCSV(notificaciones) {
  const filasNormalizadas = (Array.isArray(notificaciones) ? notificaciones : []).map((item) => {
    const fila = {};
    CABECERAS_NOTIFICACIONES.forEach((col) => {
      fila[col] = item?.[col] ?? '-';
    });
    return fila;
  });

  const contenidoCSV = stringify(filasNormalizadas, {
    header: true,
    columns: CABECERAS_NOTIFICACIONES
  });

  fs.writeFileSync(archivoNotificacionesCSV, contenidoCSV, 'utf8');
}

/* =========================
   Rutas Notificaciones
========================= */

// Subir archivo
app.post('/api/notificaciones/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió archivo' });
    }

    const url = `/Notificaciones/${req.file.filename}`;

    res.status(201).json({
      mensaje: 'Archivo subido correctamente',
      nombreArchivo: req.file.filename,
      url,
    });
  } catch (error) {
    console.error('Error subiendo archivo:', error);
    res.status(500).json({ error: 'Error subiendo archivo' });
  }
});

// Obtener todas las notificaciones
app.get('/api/notificaciones', (req, res) => {
  try {
    const notificaciones = leerNotificacionesCSV();
    res.json(Array.isArray(notificaciones) ? notificaciones : []);
  } catch (error) {
    console.error('Error obteniendo notificaciones:', error);
    res.status(500).json({ error: 'Error obteniendo notificaciones' });
  }
});

// Crear nueva notificación
app.post('/api/notificaciones', (req, res) => {
  try {
    const notificaciones = leerNotificacionesCSV();
    const id = String(Date.now());
    const fechaISO = new Date().toISOString().split('T')[0];
    const fechaLocal = new Date().toLocaleDateString();

    const nuevaNotif = {
      ID_Archivo: id,
      Título: req.body.Título || '-',
      Tipo: req.body.Tipo || '-',
      Fecha_Publicación: req.body.Fecha_Publicación || fechaLocal,
      Autor: req.body.Autor || '-',
      Descripción: req.body.Descripción || '-',
      Adjunto: req.body.Adjunto || '-',
      URL_Archivo: req.body.URL_Archivo || '-',
      Destinatarios: req.body.Destinatarios || '-',
      Vigente_Desde: req.body.Vigente_Desde || '-',
      Vigente_Hasta: req.body.Vigente_Hasta || '-',
      Prioridad: req.body.Prioridad || '-',
      Estado: req.body.Estado || 'Pendiente',
      Firma_Digital: req.body.Firma_Digital || '-',
      Visualizado_Por: req.body.Visualizado_Por || '-',
      Fecha_Actualización: req.body.Fecha_Actualización || fechaISO,
      Versión: req.body.Versión || '1',
      Confirmación_Recibido: req.body.Confirmación_Recibido || '-',
      Link_Referencia: req.body.Link_Referencia || '-',
      fecha: fechaISO,
    };

    notificaciones.push(nuevaNotif);
    guardarNotificacionesCSV(notificaciones);

    res.status(201).json({
      mensaje: 'Notificación creada',
      notificacion: nuevaNotif,
    });
  } catch (error) {
    console.error('Error creando notificación:', error);
    res.status(500).json({ error: 'Error creando notificación' });
  }
});

// Eliminar notificación
app.delete('/api/notificaciones/:id', (req, res) => {
  try {
    const id = String(req.params.id);
    const notificaciones = leerNotificacionesCSV();

    const index = notificaciones.findIndex(
      (n) => String(n.ID_Archivo) === id
    );

    if (index === -1) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    const eliminada = notificaciones[index];

    if (eliminada?.Adjunto && eliminada.Adjunto !== '-') {
      const rutaArchivo = path.join(notificacionesDir, eliminada.Adjunto);
      if (fs.existsSync(rutaArchivo)) {
        fs.unlinkSync(rutaArchivo);
      }
    }

    notificaciones.splice(index, 1);
    guardarNotificacionesCSV(notificaciones);

    res.json({
      mensaje: 'Notificación eliminada correctamente',
      notificacion: eliminada,
    });
  } catch (error) {
    console.error('Error eliminando notificación:', error);
    res.status(500).json({ error: 'Error eliminando notificación' });
  }
});

// GET: Obtener todas las mascotas (Exclusivo Admin)
app.get('/api/mascotas', (req, res) => {
  try {
    if (!fs.existsSync(mascotasPath)) {
      return res.json({ mascotas: [] });
    }
    const contenido = fs.readFileSync(mascotasPath, 'utf-8');
    const lineas = contenido.trim().split('\n').filter(Boolean);
    if (lineas.length <= 1) return res.json({ mascotas: [] });

    const headers = lineas[0].split(',').map(h => h.trim());
    const mascotas = lineas.slice(1).map(linea => {
      const valores = linea.split(',').map(v => v.trim());
      let obj = {};
      headers.forEach((h, idx) => obj[h] = valores[idx] || '');
      return obj;
    });

    res.json({ mascotas });
  } catch (err) {
    console.error("Error leyendo Mascotas.csv:", err);
    res.status(500).json({ error: "Error al consultar mascotas." });
  }
});

// POST: Registrar o actualizar la declaración de múltiples mascotas
app.post('/api/mascotas', (req, res) => {
  try {
    const { torre, apto, tieneMascota, mascotas } = req.body;

    if (!torre || !apto || tieneMascota === undefined) {
      return res.status(400).json({ error: "Datos incompletos para el registro." });
    }

    let lineas = [];
    if (fs.existsSync(mascotasPath)) {
      const contenido = fs.readFileSync(mascotasPath, 'utf-8');
      lineas = contenido.trim().split('\n').filter(Boolean);
    } else {
      lineas = ['idMascota,torre,apto,tieneMascota,tipo,nombre,raza,vacunasAlDia,fechaRegistro'];
    }

    const fechaRegistro = new Date().toISOString().split('T')[0];

    if (tieneMascota === 'No' || !mascotas || mascotas.length === 0) {
      // Registrar que no tiene mascotas
      const idMascota = `MASC-${Date.now()}`;
      const nuevaLinea = `${idMascota},${torre},${apto},No,N/A,N/A,N/A,N/A,${fechaRegistro}`;
      lineas.push(nuevaLinea);
    } else {
      // Registrar cada mascota de la lista
      mascotas.forEach((m, idx) => {
        const idMascota = `MASC-${Date.now()}-${idx}`;
        const nuevaLinea = `${idMascota},${torre},${apto},Sí,${m.tipo || 'N/A'},${m.nombre || 'N/A'},${m.raza || 'N/A'},${m.vacunasAlDia || 'N/A'},${fechaRegistro}`;
        lineas.push(nuevaLinea);
      });
    }

    fs.writeFileSync(mascotasPath, lineas.join('\n'), 'utf-8');
    res.json({ mensaje: "Registros de mascotas guardados con éxito." });
  } catch (err) {
    console.error("Error guardando mascotas:", err);
    res.status(500).json({ error: "No se pudo guardar la información." });
  }
});

/* =========================
   Frontend SPA Fallback (React)
========================= */
app.use(express.static(path.join(__dirname, 'public')));

app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* =========================
   Arrancar servidor
========================= */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend corriendo en el puerto ${PORT}`);
  console.log(`BaseResidencial: ${baseResidencialDir}`);
  console.log(`CSV Notificaciones: ${archivoNotificacionesCSV}`);
  console.log(`Adjuntos Notificaciones: ${notificacionesDir}`);
});