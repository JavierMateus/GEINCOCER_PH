// routes/mantenimientoRoutes.js
// Tareas de mantenimiento con estados y notas de avance.
// Guarda en TareasMantenimiento.csv y TareasMantenimiento_Notas.csv (carpeta BaseResidencial).
//
// Las notas NO se editan ni se borran: son el historial de cada tarea.
// Una tarea no se elimina: si se creó por error, el administrador (con su PIN) la cancela.
//
// Montaje en app.js (debajo de const rutasAuth = authRoutes(...)):
//   const mantenimientoRoutes = require("./routes/mantenimientoRoutes");
//   app.use("/api/mantenimiento", mantenimientoRoutes(baseResidencialDir, rutasAuth.verificarAdmin));
//
// Rutas:
//   GET  /api/mantenimiento            -> las últimas 300 tareas, cada una con sus notas
//   GET  /api/mantenimiento/resumen    -> cifras para la tarjeta del panel
//   POST /api/mantenimiento            -> crear una tarea
//   POST /api/mantenimiento/:id/notas  -> agregar una nota de avance (tarea abierta)
//   PUT  /api/mantenimiento/:id/estado -> pasar a "en_proceso" o "completada"
//   PUT  /api/mantenimiento/:id/cancelar -> cancelar (solo administrador, con PIN)

const express = require("express");
const fs = require("fs");
const path = require("path");

const ARCHIVO_TAREAS = "TareasMantenimiento.csv";
const ARCHIVO_NOTAS = "TareasMantenimiento_Notas.csv";
const PRIORIDADES = ["Baja", "Media", "Alta", "Urgente"];
const ENC_TAREAS = [
  "ID_Tarea", "Fecha", "Hora", "Titulo", "Descripcion", "Ubicacion", "Prioridad", "Estado",
  "CreadaPor", "FechaInicio", "HoraInicio", "IniciadaPor", "FechaCierre", "HoraCierre", "CerradaPor",
];
const ENC_NOTAS = ["ID_Nota", "ID_Tarea", "Fecha", "Hora", "Autor", "Tipo", "Nota"];

const limpiar = (v) => String(v ?? "").replace(/[;\r\n]+/g, " ").trim();

// Fecha y hora de Colombia, sin depender de la zona horaria del computador.
const ahoraBogota = () => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date()).map((x) => [x.type, x.value])
  );
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` };
};

const leerCsv = (ruta) => {
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

const aLinea = (enc, fila) => enc.map((e) => limpiar(fila[e])).join(";");

const agregarFila = (ruta, enc, fila) => {
  if (!fs.existsSync(ruta)) {
    // El BOM al inicio hace que Excel muestre bien las tildes.
    fs.writeFileSync(ruta, "\uFEFF" + enc.join(";") + "\r\n", "utf8");
  }
  fs.appendFileSync(ruta, aLinea(enc, fila) + "\r\n", "utf8");
};

const guardarTodo = (ruta, enc, filas) => {
  const temporal = `${ruta}.tmp`;
  const contenido = "\uFEFF" + enc.join(";") + "\r\n" + filas.map((f) => aLinea(enc, f) + "\r\n").join("");
  try {
    fs.writeFileSync(temporal, contenido, "utf8");
    fs.renameSync(temporal, ruta);
  } catch (err) {
    try { fs.unlinkSync(temporal); } catch (_) { /* ya no existe */ }
    throw err;
  }
};

module.exports = (baseDir, verificarAdmin) => {
  const router = express.Router();
  const rutaTareas = path.join(baseDir, ARCHIVO_TAREAS);
  const rutaNotas = path.join(baseDir, ARCHIVO_NOTAS);

  const abierta = (t) => t.Estado === "pendiente" || t.Estado === "en_proceso";

  const errorDeArchivo = (res, err) => {
    if (err.code === "EPERM" || err.code === "EBUSY") {
      return res.status(423).json({
        error: "No se pudo guardar: un archivo de mantenimiento está abierto en otro programa (por ejemplo Excel). Ciérralo e inténtalo de nuevo.",
      });
    }
    console.error("❌ Error en mantenimiento:", err);
    return res.status(500).json({ error: "No se pudo completar la operación de mantenimiento." });
  };

  const nuevaNota = (idTarea, autor, tipo, nota) => {
    const { fecha, hora } = ahoraBogota();
    agregarFila(rutaNotas, ENC_NOTAS, {
      ID_Nota: `NOT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ID_Tarea: idTarea, Fecha: fecha, Hora: hora, Autor: limpiar(autor) || "Mantenimiento", Tipo: tipo, Nota: nota,
    });
  };

  router.get("/", (req, res) => {
    try {
      const notas = leerCsv(rutaNotas);
      const porTarea = new Map();
      notas.forEach((n) => {
        if (!porTarea.has(n.ID_Tarea)) porTarea.set(n.ID_Tarea, []);
        porTarea.get(n.ID_Tarea).push(n);
      });
      const tareas = leerCsv(rutaTareas)
        .reverse()
        .slice(0, 300)
        .map((t) => ({ ...t, notas: porTarea.get(t.ID_Tarea) || [] }));
      return res.json({ tareas });
    } catch (err) {
      return errorDeArchivo(res, err);
    }
  });

  router.get("/resumen", (req, res) => {
    try {
      const tareas = leerCsv(rutaTareas);
      const mes = ahoraBogota().fecha.slice(0, 7);
      const abiertas = tareas.filter(abierta);
      return res.json({
        ok: true,
        abiertas: abiertas.length,
        pendientes: abiertas.filter((t) => t.Estado === "pendiente").length,
        enProceso: abiertas.filter((t) => t.Estado === "en_proceso").length,
        urgentes: abiertas.filter((t) => t.Prioridad === "Urgente").length,
        completadasMes: tareas.filter((t) => t.Estado === "completada" && String(t.FechaCierre).startsWith(mes)).length,
      });
    } catch (err) {
      return errorDeArchivo(res, err);
    }
  });

  router.post("/", (req, res) => {
    try {
      const b = req.body || {};
      const titulo = limpiar(b.titulo);
      const ubicacion = limpiar(b.ubicacion);
      const prioridad = limpiar(b.prioridad);
      const descripcion = limpiar(b.descripcion);
      if (titulo.length < 5) return res.status(400).json({ error: "Escribe qué hay que hacer (mínimo 5 caracteres)." });
      if (ubicacion.length < 3) return res.status(400).json({ error: "Indica dónde (por ejemplo: Ascensor de la Torre 2)." });
      if (!PRIORIDADES.includes(prioridad)) return res.status(400).json({ error: "Elige la prioridad: baja, media, alta o urgente." });

      const { fecha, hora } = ahoraBogota();
      const tarea = {
        ID_Tarea: `TAR-${Date.now()}`, Fecha: fecha, Hora: hora, Titulo: titulo, Descripcion: descripcion,
        Ubicacion: ubicacion, Prioridad: prioridad, Estado: "pendiente", CreadaPor: limpiar(b.creadaPor) || "Administración",
        FechaInicio: "", HoraInicio: "", IniciadaPor: "", FechaCierre: "", HoraCierre: "", CerradaPor: "",
      };
      agregarFila(rutaTareas, ENC_TAREAS, tarea);
      return res.status(201).json({ ok: true, mensaje: "Tarea creada.", tarea });
    } catch (err) {
      return errorDeArchivo(res, err);
    }
  });

  router.post("/:id/notas", (req, res) => {
    try {
      const id = limpiar(req.params.id);
      const nota = limpiar(req.body?.nota);
      if (nota.length < 5) return res.status(400).json({ error: "Escribe la nota (mínimo 5 caracteres)." });
      const tarea = leerCsv(rutaTareas).find((t) => t.ID_Tarea === id);
      if (!tarea) return res.status(404).json({ error: "No se encontró esa tarea." });
      if (!abierta(tarea)) return res.status(400).json({ error: "Esta tarea ya está cerrada; no admite más notas." });
      nuevaNota(id, req.body?.autor, "avance", nota);
      return res.status(201).json({ ok: true, mensaje: "Nota agregada." });
    } catch (err) {
      return errorDeArchivo(res, err);
    }
  });

  router.put("/:id/estado", (req, res) => {
    try {
      const id = limpiar(req.params.id);
      const nuevo = limpiar(req.body?.estado);
      const nota = limpiar(req.body?.nota);
      const autor = limpiar(req.body?.autor) || "Mantenimiento";
      if (nuevo !== "en_proceso" && nuevo !== "completada") {
        return res.status(400).json({ error: "El estado debe ser en_proceso o completada." });
      }
      const tareas = leerCsv(rutaTareas);
      const tarea = tareas.find((t) => t.ID_Tarea === id);
      if (!tarea) return res.status(404).json({ error: "No se encontró esa tarea." });
      if (!abierta(tarea)) return res.status(400).json({ error: "Esta tarea ya está cerrada." });
      if (nuevo === "en_proceso" && tarea.Estado !== "pendiente") {
        return res.status(400).json({ error: "Esta tarea ya está en proceso." });
      }
      if (nuevo === "completada" && nota.length < 10) {
        return res.status(400).json({ error: "Cuenta qué se hizo para completarla (mínimo 10 caracteres)." });
      }

      const { fecha, hora } = ahoraBogota();
      tarea.Estado = nuevo;
      if (nuevo === "en_proceso") {
        tarea.FechaInicio = fecha; tarea.HoraInicio = hora; tarea.IniciadaPor = autor;
      } else {
        tarea.FechaCierre = fecha; tarea.HoraCierre = hora; tarea.CerradaPor = autor;
      }
      guardarTodo(rutaTareas, ENC_TAREAS, tareas);
      if (nota) nuevaNota(id, autor, nuevo === "en_proceso" ? "inicio" : "cierre", nota);
      return res.json({ ok: true, mensaje: nuevo === "en_proceso" ? "Tarea en proceso." : "Tarea completada.", tarea });
    } catch (err) {
      return errorDeArchivo(res, err);
    }
  });

  router.put("/:id/cancelar", (req, res) => {
    try {
      const id = limpiar(req.params.id);
      const motivo = limpiar(req.body?.motivo);
      if (motivo.length < 10) return res.status(400).json({ error: "Escribe el motivo de la cancelación (mínimo 10 caracteres)." });
      if (typeof verificarAdmin !== "function") {
        return res.status(500).json({ error: "La verificación de administrador no está configurada." });
      }
      const admin = verificarAdmin(req.body?.adminDocumento, req.body?.adminPin);
      if (!admin.ok) return res.status(admin.status || 401).json({ error: admin.error });

      const tareas = leerCsv(rutaTareas);
      const tarea = tareas.find((t) => t.ID_Tarea === id);
      if (!tarea) return res.status(404).json({ error: "No se encontró esa tarea." });
      if (!abierta(tarea)) return res.status(400).json({ error: "Solo se pueden cancelar las tareas abiertas." });

      const { fecha, hora } = ahoraBogota();
      tarea.Estado = "cancelada";
      tarea.FechaCierre = fecha; tarea.HoraCierre = hora; tarea.CerradaPor = admin.nombre;
      guardarTodo(rutaTareas, ENC_TAREAS, tareas);
      nuevaNota(id, admin.nombre, "cancelacion", motivo);
      return res.json({ ok: true, mensaje: "Tarea cancelada.", tarea });
    } catch (err) {
      return errorDeArchivo(res, err);
    }
  });

  return router;
};