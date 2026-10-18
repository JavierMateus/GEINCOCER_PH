// routes/visitantesRoutes.js
// Registro de visitantes de la portería. Guarda en Visitantes.csv (carpeta BaseResidencial).
//
// Montaje en app.js:
//   const visitantesRoutes = require("./routes/visitantesRoutes");
//   app.use("/api/visitantes", visitantesRoutes(baseResidencialDir));
//
// Rutas:
//   GET  /api/visitantes?estado=dentro   -> solo quienes están dentro ahora
//   GET  /api/visitantes                 -> las últimas 300 visitas
//   POST /api/visitantes                 -> registrar una entrada
//   PUT  /api/visitantes/:id/salida      -> registrar la salida

const express = require("express");
const fs = require("fs");
const path = require("path");

const ARCHIVO = "Visitantes.csv";
const ENCABEZADOS = [
  "ID_Visita", "FechaEntrada", "HoraEntrada", "FechaSalida", "HoraSalida",
  "NombreVisitante", "DocumentoVisitante", "TorreManzana", "AptoCasa",
  "ResidenteVisitado", "Motivo", "Placa", "Estado",
  "RegistradoPor", "SalidaRegistradaPor", "Observaciones",
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

module.exports = (baseDir) => {
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
        error: "No se pudo guardar: Visitantes.csv está abierto en otro programa (por ejemplo Excel). Ciérralo e inténtalo de nuevo.",
      });
    }
    console.error("❌ Error en visitantes:", err);
    return res.status(500).json({ error: "No se pudo completar la operación con los visitantes." });
  };

  router.get("/", (req, res) => {
    try {
      let filas = leer();
      if (String(req.query.estado || "").toLowerCase() === "dentro") {
        filas = filas.filter((f) => f.Estado === "dentro");
      }
      // Las más recientes primero.
      return res.json({ visitas: filas.reverse().slice(0, 300) });
    } catch (err) {
      return errorDeArchivo(res, err);
    }
  });

  router.post("/", (req, res) => {
    try {
      const b = req.body || {};
      const nombre = limpiar(b.nombre);
      const documento = limpiar(b.documento).replace(/\s+/g, "");
      const torre = limpiar(b.torreManzana);
      const apto = limpiar(b.aptoCasa);
      const placa = limpiar(b.placa).toUpperCase().replace(/[\s-]/g, "");

      if (nombre.length < 3) return res.status(400).json({ error: "Escribe el nombre completo del visitante." });
      if (documento.length < 5) return res.status(400).json({ error: "Escribe el documento del visitante (mínimo 5 caracteres)." });
      if (!torre || !apto) return res.status(400).json({ error: "Indica la torre/manzana y el apartamento/casa de destino." });
      if (!/^[A-Z0-9]{0,7}$/.test(placa)) return res.status(400).json({ error: "La placa solo puede tener letras y números (máximo 7)." });

      const yaDentro = leer().find((f) => f.Estado === "dentro" && f.DocumentoVisitante === documento);
      if (yaDentro) {
        return res.status(409).json({
          error: `Este documento ya figura dentro del conjunto desde las ${yaDentro.HoraEntrada}. Registra primero su salida.`,
        });
      }

      const { fecha, hora } = ahoraBogota();
      const visita = {
        ID_Visita: `VIS-${Date.now()}`,
        FechaEntrada: fecha,
        HoraEntrada: hora,
        FechaSalida: "",
        HoraSalida: "",
        NombreVisitante: nombre,
        DocumentoVisitante: documento,
        TorreManzana: torre,
        AptoCasa: apto,
        ResidenteVisitado: limpiar(b.residente),
        Motivo: limpiar(b.motivo) || "Visita",
        Placa: placa,
        Estado: "dentro",
        RegistradoPor: limpiar(b.registradoPor) || "Portería",
        SalidaRegistradaPor: "",
        Observaciones: limpiar(b.observaciones),
      };
      agregar(visita);
      return res.status(201).json({ ok: true, mensaje: "Entrada registrada.", visita });
    } catch (err) {
      return errorDeArchivo(res, err);
    }
  });

  router.put("/:id/salida", (req, res) => {
    try {
      const id = limpiar(req.params.id);
      const filas = leer();
      const fila = filas.find((f) => f.ID_Visita === id);
      if (!fila) return res.status(404).json({ error: "No se encontró esa visita." });
      if (fila.Estado !== "dentro") return res.status(400).json({ error: "Esta visita ya tiene la salida registrada." });

      const { fecha, hora } = ahoraBogota();
      fila.FechaSalida = fecha;
      fila.HoraSalida = hora;
      fila.Estado = "salió";
      fila.SalidaRegistradaPor = limpiar(req.body?.registradoPor) || "Portería";
      guardarTodo(filas);
      return res.json({ ok: true, mensaje: "Salida registrada.", visita: fila });
    } catch (err) {
      return errorDeArchivo(res, err);
    }
  });

  return router;
};