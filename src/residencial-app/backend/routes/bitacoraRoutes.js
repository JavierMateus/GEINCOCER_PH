// routes/bitacoraRoutes.js
// Bitácora de novedades e incidentes de la portería. Guarda en Bitacora.csv.
//
// Las novedades NO se editan ni se borran: sirven como constancia.
// Solo un administrador (con su PIN) puede marcarlas como "atendida".
//
// Montaje en app.js (debajo de const rutasAuth = authRoutes(...)):
//   const bitacoraRoutes = require("./routes/bitacoraRoutes");
//   app.use("/api/bitacora", bitacoraRoutes(baseResidencialDir, rutasAuth.verificarAdmin));
//
// Rutas:
//   GET  /api/bitacora?estado=abierta|atendida   (sin estado: todas, las últimas 300)
//   POST /api/bitacora                           -> registrar una novedad
//   PUT  /api/bitacora/:id/atender               -> el administrador la marca atendida

const express = require("express");
const fs = require("fs");
const path = require("path");

const ARCHIVO = "Bitacora.csv";
const TIPOS = ["Novedad general", "Incidente", "Daño o mantenimiento", "Objeto perdido", "Emergencia"];
const GRAVEDADES = ["Baja", "Media", "Alta"];
const ENCABEZADOS = [
  "ID_Novedad", "Fecha", "Hora", "Tipo", "Gravedad", "Ubicacion", "Descripcion",
  "RegistradoPor", "Estado", "FechaAtencion", "HoraAtencion", "AtendidaPor", "NotaAtencion",
];

const limpiar = (valor) => String(valor ?? "").replace(/[;\r\n]+/g, " ").trim();

// Fecha y hora de Colombia, sin depender de la zona horaria del computador.
const ahoraBogota = () => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  );
  return {
    fecha: `${p.year}-${p.month}-${p.day}`,
    hora: `${p.hour === "24" ? "00" : p.hour}:${p.minute}`,
  };
};

module.exports = (baseDir, verificarAdmin) => {
  const router = express.Router();
  const ruta = path.join(baseDir, ARCHIVO);

  const leer = () => {
    if (!fs.existsSync(ruta)) return [];
    const texto = fs.readFileSync(ruta, "utf8").replace(/^\uFEFF/, "");
    const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lineas.length < 2) return [];
    const enc = lineas[0].split(";").map((e) => e.trim());
    return lineas.slice(1).map((linea) => {
      const valores = linea.split(";");
      const fila = {};
      enc.forEach((e, i) => { fila[e] = (valores[i] ?? "").trim(); });
      return fila;
    });
  };

  const aLinea = (fila) => ENCABEZADOS.map((e) => limpiar(fila[e])).join(";");

  const agregar = (fila) => {
    if (!fs.existsSync(ruta)) {
      // El BOM al inicio hace que Excel muestre bien las tildes.
      fs.writeFileSync(ruta, "\uFEFF" + ENCABEZADOS.join(";") + "\r\n", "utf8");
    }
    fs.appendFileSync(ruta, aLinea(fila) + "\r\n", "utf8");
  };

  const guardarTodo = (filas) => {
    const temporal = `${ruta}.tmp`;
    const contenido = "\uFEFF" + ENCABEZADOS.join(";") + "\r\n" + filas.map(aLinea).join("\r\n") + "\r\n";
    try {
      fs.writeFileSync(temporal, contenido, "utf8");
      fs.renameSync(temporal, ruta);
    } catch (err) {
      try { fs.unlinkSync(temporal); } catch (_) { /* ya no existe */ }
      throw err;
    }
  };

  const errorDeArchivo = (res, err) => {
    if (err.code === "EPERM" || err.code === "EBUSY") {
      return res.status(423).json({
        error: "No se pudo guardar: Bitacora.csv está abierto en otro programa (por ejemplo Excel). Ciérralo e inténtalo de nuevo.",
      });
    }
    console.error("❌ Error en bitácora:", err);
    return res.status(500).json({ error: "No se pudo completar la operación con la bitácora." });
  };

  router.get("/", (req, res) => {
    try {
      let filas = leer();
      const estado = String(req.query.estado || "").toLowerCase();
      if (estado === "abierta" || estado === "atendida") {
        filas = filas.filter((f) => f.Estado === estado);
      }
      // Las más recientes primero.
      return res.json({ novedades: filas.reverse().slice(0, 300) });
    } catch (err) {
      return errorDeArchivo(res, err);
    }
  });

  router.post("/", (req, res) => {
    try {
      const b = req.body || {};
      const tipo = limpiar(b.tipo);
      const gravedad = limpiar(b.gravedad);
      const ubicacion = limpiar(b.ubicacion);
      const descripcion = limpiar(b.descripcion);

      if (!TIPOS.includes(tipo)) return res.status(400).json({ error: "Elige el tipo de novedad." });
      if (!GRAVEDADES.includes(gravedad)) return res.status(400).json({ error: "Elige la gravedad: baja, media o alta." });
      if (ubicacion.length < 3) return res.status(400).json({ error: "Indica dónde ocurrió (por ejemplo: Torre 2, piso 3)." });
      if (descripcion.length < 10) return res.status(400).json({ error: "Describe lo ocurrido (mínimo 10 caracteres)." });

      const { fecha, hora } = ahoraBogota();
      const novedad = {
        ID_Novedad: `NOV-${Date.now()}`,
        Fecha: fecha,
        Hora: hora,
        Tipo: tipo,
        Gravedad: gravedad,
        Ubicacion: ubicacion,
        Descripcion: descripcion,
        RegistradoPor: limpiar(b.registradoPor) || "Portería",
        Estado: "abierta",
        FechaAtencion: "",
        HoraAtencion: "",
        AtendidaPor: "",
        NotaAtencion: "",
      };
      agregar(novedad);
      return res.status(201).json({ ok: true, mensaje: "Novedad registrada en la bitácora.", novedad });
    } catch (err) {
      return errorDeArchivo(res, err);
    }
  });

  router.put("/:id/atender", (req, res) => {
    try {
      const id = limpiar(req.params.id);
      const nota = limpiar(req.body?.nota);
      if (nota.length < 10) {
        return res.status(400).json({ error: "Escribe qué se hizo para atenderla (mínimo 10 caracteres)." });
      }
      if (typeof verificarAdmin !== "function") {
        return res.status(500).json({ error: "La verificación de administrador no está configurada." });
      }
      const admin = verificarAdmin(req.body?.adminDocumento, req.body?.adminPin);
      if (!admin.ok) return res.status(admin.status || 401).json({ error: admin.error });

      const filas = leer();
      const fila = filas.find((f) => f.ID_Novedad === id);
      if (!fila) return res.status(404).json({ error: "No se encontró esa novedad." });
      if (fila.Estado === "atendida") return res.status(400).json({ error: "Esta novedad ya fue atendida." });

      const { fecha, hora } = ahoraBogota();
      fila.Estado = "atendida";
      fila.FechaAtencion = fecha;
      fila.HoraAtencion = hora;
      fila.AtendidaPor = admin.nombre;
      fila.NotaAtencion = nota;
      guardarTodo(filas);
      return res.json({ ok: true, mensaje: "Novedad marcada como atendida.", novedad: fila });
    } catch (err) {
      return errorDeArchivo(res, err);
    }
  });

  return router;
};