// routes/pagosRecibidosRoutes.js
// Registro de pagos recibidos por la administracion (transferencia,
// consignacion, efectivo o Mercado Pago confirmado a mano).
//
// Un solo pago puede cubrir varias obligaciones. El valor recibido se reparte:
//   1) primero intereses de mora (art. 1653 Codigo Civil),
//   2) luego capital, empezando por lo mas antiguo.
// Cada obligacion queda en su propia fila de Pagos.csv, con la misma referencia.
//
// Montaje en app.js:
//   const pagosRecibidosRoutes = require("./routes/pagosRecibidosRoutes");
//   app.use("/api/pagos-recibidos", pagosRecibidosRoutes(baseResidencialDir));
//
// Rutas:
//   GET  /api/pagos-recibidos/cartera    -> obligaciones con saldo real
//   POST /api/pagos-recibidos/registrar  -> reparte y guarda el pago
//   GET  /api/pagos-recibidos/comprobante/:idPago -> datos para el comprobante PDF
//   GET  /api/pagos-recibidos/morosos              -> residentes con saldo vencido
//   POST /api/pagos-recibidos/recordatorios        -> deja constancia de un recordatorio enviado
//   GET  /api/pagos-recibidos/paz-y-salvo/estado   -> revisa si un inmueble puede recibirlo
//   POST /api/pagos-recibidos/paz-y-salvo/expedir  -> expide y numera el paz y salvo

const express = require("express");
const fs = require("fs");
const path = require("path");

const ARCHIVO_OBLIGACIONES = "obligaciones_residente.csv";
const ARCHIVO_PAGOS = "Pagos.csv";
const CARPETA_RESPALDOS = "respaldos";

const METODOS_CON_REFERENCIA = ["mercado pago", "transferencia", "consignacion"];

const ENCABEZADO_PAGOS = [
  "ID_Pago", "ID_Obligacion", "DocumentoResidente", "NombreResidente",
  "TorreManzana", "AptoCasa", "Periodo", "ConceptoPago", "SubconceptoPago",
  "ValorPagado", "InteresesPagados", "OtrosCobrosPagados", "TotalAplicado",
  "FechaPago", "MetodoPago", "ReferenciaTransaccion", "EstadoPago",
  "ValidoParaConciliacion", "OrigenPago", "RegistradoPor", "FechaRegistro",
  "Observaciones", "NotasInternas", "Telefono", "Correo", "DescripcionPago",
  "Intereses", "OtrosCobros", "Estado", "EstadoObligacionAntesPago",
  "SaldoPendienteObligacion",
];

// ------------------------------------------------------------------
// CSV
// ------------------------------------------------------------------

const leerCSV = (ruta) => {
  if (!fs.existsSync(ruta)) return { encabezados: [], filas: [], finLinea: "\n" };

  const buffer = fs.readFileSync(ruta);
  const utf8 = buffer.toString("utf8");
  const texto = (utf8.includes("\uFFFD") ? buffer.toString("latin1") : utf8).replace(/^\uFEFF/, "");
  const finLinea = texto.includes("\r\n") ? "\r\n" : "\n";
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");

  if (!lineas.length) return { encabezados: [], filas: [], finLinea };

  const encabezados = lineas[0].split(";").map((e) => e.trim());
  const filas = lineas.slice(1).map((linea) => {
    const valores = linea.split(";");
    const fila = {};
    encabezados.forEach((enc, i) => {
      fila[enc] = (valores[i] ?? "").trim();
    });
    return fila;
  });

  return { encabezados, filas, finLinea };
};

const limpiarCelda = (valor) => String(valor ?? "").replace(/[;\r\n]+/g, ", ").trim();

const aNumero = (valor) => {
  const texto = String(valor ?? "").trim();
  if (!texto) return 0;
  const normal = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
  const n = Number(normal.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const normalizar = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const soloDigitos = (valor) => String(valor ?? "").replace(/\D/g, "");

// Acepta 10/07/2026 y 2026-07-10. Devuelve numero AAAAMMDD para comparar.
const claveFecha = (valor) => {
  const texto = String(valor || "").trim();
  let p = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (p) return Number(p[1]) * 10000 + Number(p[2]) * 100 + Number(p[3]);
  p = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) return Number(p[3]) * 10000 + Number(p[2]) * 100 + Number(p[1]);
  return 0;
};

const hoyColombia = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date()); // 2026-10-02

const fechaHoraColombia = () => {
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

// ------------------------------------------------------------------
// Cartera
// ------------------------------------------------------------------

const esInteres = (o) => normalizar(o.Concepto) === "interes_mora";

const montoAplicadoPago = (p) => {
  const total = aNumero(p.TotalAplicado);
  if (total > 0) return total;
  return aNumero(p.ValorPagado) + aNumero(p.InteresesPagados) + aNumero(p.OtrosCobrosPagados);
};

const pagoValido = (p) =>
  normalizar(p.EstadoPago || p.Estado || "pagado").includes("pag") &&
  normalizar(p.ValidoParaConciliacion || "si") !== "no";

const cargarCartera = (dir) => {
  const { filas: obligaciones } = leerCSV(path.join(dir, ARCHIVO_OBLIGACIONES));
  const { filas: pagos } = leerCSV(path.join(dir, ARCHIVO_PAGOS));

  const pagado = {};
  pagos.filter(pagoValido).forEach((p) => {
    const id = String(p.ID_Obligacion || "").trim();
    if (id) pagado[id] = (pagado[id] || 0) + montoAplicadoPago(p);
  });

  const hoy = claveFecha(hoyColombia());

  return obligaciones
    .filter((o) => normalizar(o.Activo || "si") !== "no")
    .map((o) => {
      const id = String(o.ID_Obligacion || "").trim();
      const declarado = aNumero(o.TotalObligacion);
      const total =
        declarado > 0 ? declarado : aNumero(o.ValorBase) + aNumero(o.Intereses) + aNumero(o.OtrosCobros);
      const totalPagado = pagado[id] || 0;
      const saldo = Math.max(total - totalPagado, 0);
      const vence = claveFecha(o.FechaVencimiento);

      let estado = "pendiente";
      if (saldo <= 0) estado = "pagado";
      else if (vence && hoy > vence) estado = "mora";

      return {
        ...o,
        ID_Obligacion: id,
        TotalObligacion: total,
        TotalPagado: totalPagado,
        SaldoPendiente: saldo,
        EstadoCalculado: estado,
      };
    });
};

// Orden de imputacion: intereses primero y luego capital; dentro de cada
// grupo, lo que vencio primero.
const ordenImputacion = (a, b) => {
  const ia = esInteres(a) ? 0 : 1;
  const ib = esInteres(b) ? 0 : 1;
  if (ia !== ib) return ia - ib;
  const fa = claveFecha(a.FechaVencimiento);
  const fb = claveFecha(b.FechaVencimiento);
  if (fa !== fb) return fa - fb;
  return String(a.ID_Obligacion).localeCompare(String(b.ID_Obligacion));
};

// ------------------------------------------------------------------
// Rutas
// ------------------------------------------------------------------

module.exports = (baseDir, verificarAdmin) => {
  const router = express.Router();
  console.log("🔎 pagosRecibidos recibió:", typeof verificarAdmin);
  const rutaPagos = path.join(baseDir, ARCHIVO_PAGOS);

  // Obligaciones con saldo real calculado en el servidor.
  router.get("/cartera", (req, res) => {
    try {
      return res.json({ obligaciones: cargarCartera(baseDir) });
    } catch (error) {
      console.error("❌ Error leyendo cartera:", error);
      return res.status(500).json({ error: "No se pudo leer la cartera" });
    }
  });

    // GET /resumen-mora -> cifras para la tarjeta de morosidad del panel del administrador.
  // Se calcula con la misma cartera del informe, así los números coinciden.
  router.get("/resumen-mora", (req, res) => {
    try {
      const cartera = cargarCartera(baseDir);
      const clave = (o) => normalizar(`${o.TorreManzana || ""} ${o.AptoCasa || ""}`).replace(/[^a-z0-9]/g, "");
      const conCartera = new Set();
      const enMora = new Set();
      const residentes = new Set();
      let totalMora = 0;

      cartera.forEach((o) => {
        const k = clave(o);
        if (k) conCartera.add(k);
        if (o.SaldoPendiente > 0 && o.EstadoCalculado === "mora") {
          if (k) enMora.add(k);
          const doc = soloDigitos(o.DocumentoResidente);
          if (doc) residentes.add(doc);
          totalMora += o.SaldoPendiente;
        }
      });

      const porcentaje = conCartera.size > 0 ? Math.round((enMora.size / conCartera.size) * 1000) / 10 : 0;
      return res.json({
        ok: true,
        inmueblesConCartera: conCartera.size,
        inmueblesEnMora: enMora.size,
        residentesEnMora: residentes.size,
        totalMora,
        porcentaje,
      });
    } catch (error) {
      console.error("❌ Error calculando el resumen de mora:", error);
      return res.status(500).json({ ok: false, error: "No se pudo calcular la morosidad" });
    }
  });

  // ---------------- Recordatorios de cobro ----------------
  // GET /morosos?incluirPendientes=1 -> un registro por residente con saldo vencido
  // (o por vencer si se pide), con telefono y correo de Habitantes.csv y la fecha
  // del ultimo recordatorio enviado.
  const rutaRecordatorios = path.join(baseDir, "Recordatorios.csv");
  const ENCABEZADO_RECORDATORIOS = ["FechaHora", "DocumentoResidente", "NombreResidente", "Canal", "TotalCobrado", "Obligaciones", "EnviadoPor"];

  router.get("/morosos", (req, res) => {
    try {
      const incluirPendientes = String(req.query.incluirPendientes || "") === "1";
      const cartera = cargarCartera(baseDir).filter(
        (o) => o.SaldoPendiente > 0 && (o.EstadoCalculado === "mora" || (incluirPendientes && o.EstadoCalculado === "pendiente"))
      );

      const habitantes = leerCSV(path.join(baseDir, "Habitantes.csv")).filas;
      const contacto = new Map();
      habitantes.forEach((h) => {
        const doc = soloDigitos(h.DocumentoResidente);
        if (doc && !contacto.has(doc)) contacto.set(doc, { telefono: soloDigitos(h.Telefono), email: h.Email || "" });
      });

      const ultimo = new Map();
      leerCSV(rutaRecordatorios).filas.forEach((r) => {
        const doc = soloDigitos(r.DocumentoResidente);
        if (!ultimo.has(doc) || r.FechaHora > ultimo.get(doc).FechaHora) ultimo.set(doc, r);
      });

      const grupos = new Map();
      cartera.forEach((o) => {
        const doc = soloDigitos(o.DocumentoResidente);
        if (!grupos.has(doc)) {
          grupos.set(doc, {
            documento: doc,
            nombre: o.NombreResidente,
            inmueble: [o.TorreManzana, o.AptoCasa].filter(Boolean).join(" - "),
            telefono: contacto.get(doc)?.telefono || "",
            email: contacto.get(doc)?.email || "",
            totalMora: 0,
            totalPendiente: 0,
            obligaciones: [],
            ultimoRecordatorio: ultimo.get(doc) ? { fecha: ultimo.get(doc).FechaHora, canal: ultimo.get(doc).Canal } : null,
          });
        }
        const g = grupos.get(doc);
        if (o.EstadoCalculado === "mora") g.totalMora += o.SaldoPendiente;
        else g.totalPendiente += o.SaldoPendiente;
        g.obligaciones.push({
          id: o.ID_Obligacion,
          periodo: o.Periodo,
          concepto: o.Concepto,
          subconcepto: o.Subconcepto,
          saldo: o.SaldoPendiente,
          vence: o.FechaVencimiento,
          estado: o.EstadoCalculado,
        });
      });

      const lista = [...grupos.values()]
        .map((g) => ({ ...g, total: g.totalMora + g.totalPendiente }))
        .sort((a, b) => b.totalMora - a.totalMora || b.total - a.total);

      return res.json({ ok: true, residentes: lista });
    } catch (error) {
      console.error("❌ Error armando lista de morosos:", error);
      return res.status(500).json({ error: "No se pudo armar la lista de morosos." });
    }
  });

  // POST /recordatorios { documento, nombre, canal, total, obligaciones:[ids], enviadoPor }
  router.post("/recordatorios", (req, res) => {
    try {
      const b = req.body || {};
      const doc = soloDigitos(b.documento);
      if (!doc) return res.status(400).json({ error: "Falta el documento." });

      const csv = leerCSV(rutaRecordatorios);
      const encabezados = csv.encabezados.length ? csv.encabezados : ENCABEZADO_RECORDATORIOS;
      const fila = {
        FechaHora: fechaHoraColombia(),
        DocumentoResidente: doc,
        NombreResidente: b.nombre || "",
        Canal: b.canal || "",
        TotalCobrado: String(aNumero(b.total)),
        Obligaciones: (Array.isArray(b.obligaciones) ? b.obligaciones : []).join(" "),
        EnviadoPor: b.enviadoPor || "Administrador",
      };
      const lineas = [encabezados.join(";"), ...[...csv.filas, fila].map((f) => encabezados.map((c) => limpiarCelda(f[c])).join(";"))];
      fs.writeFileSync(rutaRecordatorios, "\uFEFF" + lineas.join("\r\n") + "\r\n", "utf8");

      return res.json({ ok: true, fecha: fila.FechaHora });
    } catch (error) {
      console.error("❌ Error guardando recordatorio:", error);
      return res.status(500).json({ error: "No se pudo registrar el recordatorio." });
    }
  });

  // ---------------- Paz y salvo (por inmueble) ----------------
  // Se expide si el inmueble no tiene nada en mora. Lo pendiente que aun no
  // vence no lo impide, pero se menciona. Vale hasta el ultimo dia del mes.
  const rutaPazYSalvos = path.join(baseDir, "PazYSalvos.csv");
  const ENCABEZADO_PYS = ["Numero", "FechaExpedicion", "ValidoHasta", "TorreManzana", "AptoCasa", "DocumentoPropietario", "NombrePropietario", "PendienteNoVencido", "SolicitadoPor"];

  const claveUbic = (t, a) =>
    `${normalizar(t).replace(/\s+/g, "").replace(/^torre/, "t").replace(/^(manzana|mza|mz)/, "m").replace(/-/g, "")}|${normalizar(a).replace(/\s+/g, "").replace(/^0+(?=\d)/, "")}`;

  const estadoInmueble = (torre, apto) => {
    const clave = claveUbic(torre, apto);
    const hoy = claveFecha(hoyColombia());

    const habitantes = leerCSV(path.join(baseDir, "Habitantes.csv")).filas.filter(
      (h) => normalizar(h.Rol) === "residente" && claveUbic(h.TorreManzana, h.AptoCasa) === clave
    );
    const activo = (h) => {
      const salida = claveFecha(h.FechaSalida);
      return !salida || salida >= hoy;
    };
    const activos = habitantes.filter(activo);
    const titular =
      activos.find((h) => normalizar(h.Tipo) === "propietario") ||
      habitantes.find((h) => normalizar(h.Tipo) === "propietario") ||
      activos.find((h) => normalizar(h.Tipo) === "arrendatario") ||
      activos[0] ||
      null;

    const deudas = cargarCartera(baseDir).filter((o) => o.SaldoPendiente > 0 && claveUbic(o.TorreManzana, o.AptoCasa) === clave);
    const resumen = (o) => ({ id: o.ID_Obligacion, periodo: o.Periodo, concepto: o.Concepto, subconcepto: o.Subconcepto, saldo: o.SaldoPendiente, vence: o.FechaVencimiento });

    return {
      existe: habitantes.length > 0,
      torreManzana: titular?.TorreManzana || torre,
      aptoCasa: titular?.AptoCasa || apto,
      titular: titular ? { nombre: titular.NombreResidente, documento: soloDigitos(titular.DocumentoResidente), tipo: titular.Tipo } : null,
      enMora: deudas.filter((o) => o.EstadoCalculado === "mora").map(resumen),
      porVencer: deudas.filter((o) => o.EstadoCalculado !== "mora").map(resumen),
    };
  };

  // GET /paz-y-salvo/estado?torre=T-2&apto=302
  router.get("/paz-y-salvo/estado", (req, res) => {
    try {
      const e = estadoInmueble(req.query.torre, req.query.apto);
      if (!e.existe) return res.status(404).json({ error: "No hay residentes registrados en ese inmueble." });
      return res.json({ ok: true, ...e, puede: e.enMora.length === 0 });
    } catch (error) {
      console.error("❌ Error revisando paz y salvo:", error);
      return res.status(500).json({ error: "No se pudo revisar el estado del inmueble." });
    }
  });

  // POST /paz-y-salvo/expedir { torre, apto, solicitadoPor }
  router.post("/paz-y-salvo/expedir", (req, res) => {
    try {
      const { torre, apto, solicitadoPor } = req.body || {};
      const e = estadoInmueble(torre, apto);
      if (!e.existe) return res.status(404).json({ error: "No hay residentes registrados en ese inmueble." });
      if (e.enMora.length) {
        const total = e.enMora.reduce((s, o) => s + o.saldo, 0);
        return res.status(400).json({
          error: `No se puede expedir: el inmueble tiene ${e.enMora.length} obligación(es) en mora por $${total.toLocaleString("es-CO")}.`,
          enMora: e.enMora,
        });
      }

      const hoyIso = hoyColombia();
      const [a, m] = hoyIso.split("-").map(Number);
      const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
      const visual = (iso) => {
        const [y, mm, d] = iso.split("-");
        return `${Number(d)}/${mm}/${y}`;
      };
      const validoHasta = `${ultimo}/${String(m).padStart(2, "0")}/${a}`;

      const csv = leerCSV(rutaPazYSalvos);
      const encabezados = csv.encabezados.length ? csv.encabezados : ENCABEZADO_PYS;
      const delAnio = csv.filas.filter((f) => String(f.Numero).startsWith(`PYS-${a}-`)).length;
      const numero = `PYS-${a}-${String(delAnio + 1).padStart(4, "0")}`;
      const pendiente = e.porVencer.reduce((s, o) => s + o.saldo, 0);

      const fila = {
        Numero: numero,
        FechaExpedicion: fechaHoraColombia(),
        ValidoHasta: validoHasta,
        TorreManzana: e.torreManzana,
        AptoCasa: e.aptoCasa,
        DocumentoPropietario: e.titular?.documento || "",
        NombrePropietario: e.titular?.nombre || "",
        PendienteNoVencido: String(pendiente),
        SolicitadoPor: solicitadoPor || "",
      };
      const lineas = [encabezados.join(";"), ...[...csv.filas, fila].map((f) => encabezados.map((c) => limpiarCelda(f[c])).join(";"))];
      fs.writeFileSync(rutaPazYSalvos, "\uFEFF" + lineas.join("\r\n") + "\r\n", "utf8");

      return res.json({
        ok: true,
        numero,
        fechaExpedicion: visual(hoyIso),
        validoHasta,
        torreManzana: e.torreManzana,
        aptoCasa: e.aptoCasa,
        titular: e.titular,
        porVencer: e.porVencer,
        solicitadoPor: solicitadoPor || "",
      });
    } catch (error) {
      console.error("❌ Error expidiendo paz y salvo:", error);
      return res.status(500).json({ error: "No se pudo expedir el paz y salvo." });
    }
  });

  // Datos para el comprobante de un pago. Agrupa todas las filas del mismo pago
  // (un pago repartido en varias obligaciones comparte el mismo numero base).
  //   TR-1788469517744-OBL-0010, TR-1788469517744-INT  -> comprobante TR-1788469517744
  router.get("/comprobante/:id", (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      const baseDe = (v) => String(v || "").trim().replace(/-(OBL-\d+|INT)$/i, "");
      const numero = baseDe(id);
      
      const pagos = leerCSV(rutaPagos).filas;
      const filas = pagos.filter((p) => baseDe(p.ID_Pago) === numero);
      if (!filas.length) return res.status(404).json({ error: `No se encontró el pago ${id}.` });
            if (filas.every((p) => normalizar(p.EstadoPago || p.Estado).includes("anul"))) {
        return res.status(400).json({ error: "Este pago fue anulado y no tiene comprobante." });
      }

      const obligaciones = leerCSV(path.join(baseDir, ARCHIVO_OBLIGACIONES)).filas;
      const porId = new Map(obligaciones.map((o) => [String(o.ID_Obligacion).trim(), o]));
      const num = (v) => Number(String(v ?? "").replace(/[^\d.-]/g, "")) || 0;

      const detalle = filas.map((p) => {
        const o = porId.get(String(p.ID_Obligacion).trim()) || {};
        return {
          idPago: p.ID_Pago,
          idObligacion: p.ID_Obligacion,
          periodo: p.Periodo || o.Periodo || "",
          concepto: p.ConceptoPago || o.Concepto || "",
          subconcepto: p.SubconceptoPago || o.Subconcepto || "",
          capital: num(p.ValorPagado),
          intereses: num(p.InteresesPagados),
          otros: num(p.OtrosCobrosPagados),
          aplicado: num(p.TotalAplicado) || num(p.ValorPagado) + num(p.InteresesPagados) + num(p.OtrosCobrosPagados),
          saldoDespues: p.SaldoPendienteObligacion === "" || p.SaldoPendienteObligacion === undefined ? null : num(p.SaldoPendienteObligacion),
        };
      });

      const p0 = filas[0];
      return res.json({
        numero,
        fechaPago: p0.FechaPago,
        fechaRegistro: p0.FechaRegistro,
        metodoPago: p0.MetodoPago,
        referencia: p0.ReferenciaTransaccion,
        estado: p0.EstadoPago || p0.Estado,
        registradoPor: p0.RegistradoPor,
        observaciones: p0.Observaciones,
        residente: {
          nombre: p0.NombreResidente,
          documento: p0.DocumentoResidente,
          torreManzana: p0.TorreManzana,
          aptoCasa: p0.AptoCasa,
        },
        detalle,
        total: detalle.reduce((s, d) => s + d.aplicado, 0),
      });
    } catch (error) {
      console.error("❌ Error armando comprobante:", error);
      return res.status(500).json({ error: "No se pudo generar el comprobante." });
    }
  });

  router.post("/registrar", (req, res) => {
    try {
      const {
        documento,
        obligaciones: idsRecibidos = [],
        valorRecibido,
        fechaPago,
        metodoPago,
        referencia = "",
        observaciones = "",
        registradoPor = "Administrador",
      } = req.body || {};

      const doc = soloDigitos(documento);
      const valor = Math.round(aNumero(valorRecibido));
      const metodo = String(metodoPago || "").trim();
      const ref = String(referencia || "").trim();
      const fecha = String(fechaPago || "").trim();

      // --- Validaciones basicas
      if (!doc) return res.status(400).json({ error: "Falta el documento del residente" });
      if (!Array.isArray(idsRecibidos) || !idsRecibidos.length) {
        return res.status(400).json({ error: "Marca al menos una obligación" });
      }
      if (!(valor > 0)) return res.status(400).json({ error: "El valor recibido debe ser mayor que cero" });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return res.status(400).json({ error: "La fecha de pago no es válida" });
      }
      if (claveFecha(fecha) > claveFecha(hoyColombia())) {
        return res.status(400).json({ error: "La fecha de pago no puede ser futura" });
      }
      if (!metodo) return res.status(400).json({ error: "Falta el método de pago" });
      if (METODOS_CON_REFERENCIA.includes(normalizar(metodo)) && !ref) {
        return res.status(400).json({ error: "La referencia es obligatoria para este método de pago" });
      }

      // --- Referencia repetida
      const actual = leerCSV(rutaPagos);
      if (ref) {
        const repetido = actual.filas.find(
          (p) =>
            String(p.ReferenciaTransaccion || "").replace(/'/g, "").trim() === ref &&
            normalizar(p.MetodoPago).startsWith(normalizar(metodo).slice(0, 5))
        );
        if (repetido) {
          return res.status(400).json({
            error: `La referencia ${ref} ya está registrada (${repetido.ID_Pago}). Revisa si el pago ya se guardó`,
          });
        }
      }

      // --- Obligaciones marcadas
      const cartera = cargarCartera(baseDir);
      const porId = Object.fromEntries(cartera.map((o) => [o.ID_Obligacion, o]));
      const ids = [...new Set(idsRecibidos.map((id) => String(id || "").trim()))];

      for (const id of ids) {
        const obl = porId[id];
        if (!obl) return res.status(400).json({ error: `La obligación ${id} no existe` });
        if (soloDigitos(obl.DocumentoResidente) !== doc) {
          return res.status(400).json({ error: `La obligación ${id} no pertenece a este residente` });
        }
        if (obl.SaldoPendiente <= 0) {
          return res.status(400).json({ error: `La obligación ${id} ya está pagada` });
        }
      }

      // Si se paga una cuota, sus intereses pendientes deben ir incluidos.
      for (const id of ids) {
        if (esInteres(porId[id])) continue;
        const faltan = cartera.filter(
          (o) =>
            esInteres(o) &&
            String(o.ID_ObligacionPadre || "").trim() === id &&
            o.SaldoPendiente > 0 &&
            !ids.includes(o.ID_Obligacion)
        );
        if (faltan.length) {
          return res.status(400).json({
            error: `Para pagar ${id} debes incluir sus intereses: ${faltan.map((f) => f.ID_Obligacion).join(", ")}`,
          });
        }
      }

      const seleccion = ids.map((id) => porId[id]).sort(ordenImputacion);
      const totalMarcado = seleccion.reduce((s, o) => s + o.SaldoPendiente, 0);

      if (valor > totalMarcado) {
        return res.status(400).json({
          error: `El valor recibido ($${valor.toLocaleString("es-CO")}) supera lo marcado ($${totalMarcado.toLocaleString("es-CO")}). Corrige el valor o marca más obligaciones`,
        });
      }

      // --- Reparto
      const prefijo =
        { "mercado pago": "MP", transferencia: "TR", consignacion: "CS", efectivo: "EF" }[normalizar(metodo)] || "PG";
      const base = prefijo === "MP" && ref ? `MP-${ref}` : `${prefijo}-${Date.now()}`;
      const fechaRegistro = fechaHoraColombia();

      let disponible = valor;
      const filas = [];

      seleccion.forEach((o) => {
        if (disponible <= 0) return;

        const aplicado = Math.min(o.SaldoPendiente, disponible);
        disponible -= aplicado;

        const interes = esInteres(o);
        const queda = o.SaldoPendiente - aplicado;

        filas.push({
          ID_Pago: `${base}-${o.ID_Obligacion}`,
          ID_Obligacion: o.ID_Obligacion,
          DocumentoResidente: o.DocumentoResidente,
          NombreResidente: o.NombreResidente,
          TorreManzana: o.TorreManzana,
          AptoCasa: o.AptoCasa,
          Periodo: o.Periodo,
          ConceptoPago: o.Concepto,
          SubconceptoPago: o.Subconcepto,
          ValorPagado: interes ? 0 : aplicado,
          InteresesPagados: interes ? aplicado : 0,
          OtrosCobrosPagados: 0,
          TotalAplicado: aplicado,
          FechaPago: fecha,
          MetodoPago: metodo,
          ReferenciaTransaccion: ref,
          EstadoPago: "pagado",
          ValidoParaConciliacion: "SI",
          OrigenPago: "pago_recibido_admin",
          RegistradoPor: registradoPor,
          FechaRegistro: fechaRegistro,
          Observaciones:
            (ref ? `Pago recibido (ref. ${ref}). ` : "Pago recibido. ") +
            (interes
              ? "Imputado primero a intereses (art. 1653 C.C.)"
              : queda > 0
              ? `Abono parcial a ${o.ID_Obligacion}`
              : `Aplicado al capital de ${o.ID_Obligacion}`) +
            (observaciones ? `. ${observaciones}` : ""),
          NotasInternas: `Cruce válido con ${o.ID_Obligacion}`,
          Telefono: o.Telefono || "",
          Correo: o.Correo || "",
          DescripcionPago: o.Observaciones || "",
          Intereses: interes ? aplicado : 0,
          OtrosCobros: 0,
          Estado: queda > 0 ? "Parcial" : "Pagado",
          EstadoObligacionAntesPago: o.EstadoCalculado,
          SaldoPendienteObligacion: queda,
        });
      });

      // --- Respaldo y escritura
      if (fs.existsSync(rutaPagos)) {
        const carpeta = path.join(baseDir, CARPETA_RESPALDOS);
        if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });
        const sello = fechaRegistro.replace(/\D/g, "");
        fs.copyFileSync(rutaPagos, path.join(carpeta, `Pagos_antes_pago_recibido_${sello}.csv`));
      }

      const encabezados = actual.encabezados.length ? actual.encabezados : ENCABEZADO_PAGOS;
      const finLinea = actual.finLinea || "\n";
      const lineas = filas.map((f) => encabezados.map((enc) => limpiarCelda(f[enc])).join(";"));

      let contenido = "";
      if (!actual.encabezados.length) {
        contenido = encabezados.join(";") + finLinea;
      } else {
        const texto = fs.readFileSync(rutaPagos, "utf8");
        if (texto.length && !texto.endsWith("\n")) contenido = finLinea;
      }
      contenido += lineas.join(finLinea) + finLinea;
      fs.appendFileSync(rutaPagos, contenido, "utf8");

      console.log(`💾 Pago recibido ${base}: ${filas.length} fila(s) en Pagos.csv`);

      return res.json({
        exito: true,
        mensaje: `Pago guardado: ${filas.length} obligación(es)`,
        valorRecibido: valor,
        filas: filas.map((f) => ({
          ID_Pago: f.ID_Pago,
          ID_Obligacion: f.ID_Obligacion,
          Aplicado: f.TotalAplicado,
          SaldoPendiente: f.SaldoPendienteObligacion,
        })),
      });
    } catch (error) {
      console.error("❌ Error registrando pago recibido:", error);
      return res.status(500).json({ error: "No se pudo guardar el pago" });
    }
  });
  // POST /api/pagos-recibidos/anular
  // Anula un pago completo (todas sus filas). No borra nada: deja el registro
  // marcado como anulado y lo saca de los cálculos de cartera y paz y salvo.
  router.post("/anular", (req, res) => {
    try {
            const id = String(req.body?.idPago || "").trim();
      const motivo = limpiarCelda(req.body?.motivo);
      
      if (!id) return res.status(400).json({ error: "Falta el ID del pago" });
      if (motivo.length < 10) {
        return res.status(400).json({ error: "Escribe el motivo de la anulación (mínimo 10 caracteres)" });
      }
            if (typeof verificarAdmin !== "function") {
        return res.status(500).json({ error: "La verificación de administrador no está configurada." });
      }
      const admin = verificarAdmin(req.body?.adminDocumento, req.body?.adminPin);
      if (!admin.ok) return res.status(admin.status || 401).json({ error: admin.error });
      const quien = admin.nombre;

      const baseDe = (v) => String(v || "").trim().replace(/-(OBL-\d+|INT)$/i, "");
      const numero = baseDe(id);

      const actual = leerCSV(rutaPagos);
      const afectadas = actual.filas.filter((p) => baseDe(p.ID_Pago) === numero);
      if (!afectadas.length) return res.status(404).json({ error: `No se encontró el pago ${id}` });

      const esAnulado = (p) => normalizar(p.EstadoPago || p.Estado).includes("anul");
      if (afectadas.every(esAnulado)) {
        return res.status(400).json({ error: "Este pago ya está anulado" });
      }

      const esMercadoPago = afectadas.some(
        (p) =>
          /^MP-/i.test(String(p.ID_Pago || "")) ||
          normalizar(p.OrigenPago).includes("mercadopago") ||
          normalizar(p.MetodoPago).includes("mercado")
      );
      if (esMercadoPago) {
        return res.status(400).json({
          error: "Los pagos de Mercado Pago no se anulan aquí. Si procede una devolución, se gestiona en Mercado Pago.",
        });
      }

      // Respaldo antes de tocar el archivo
      const sello = fechaHoraColombia().replace(/\D/g, "");
      const carpeta = path.join(baseDir, CARPETA_RESPALDOS);
      if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });
      fs.copyFileSync(rutaPagos, path.join(carpeta, `Pagos_antes_anular_${sello}.csv`));

      const nota = `ANULADO ${fechaHoraColombia()} por ${quien}: ${motivo}`;
      actual.filas.forEach((p) => {
        if (baseDe(p.ID_Pago) !== numero || esAnulado(p)) return;
        p.EstadoPago = "anulado";
        p.ValidoParaConciliacion = "NO";
        if ("Estado" in p) p.Estado = "Anulado";
        p.NotasInternas = [p.NotasInternas, nota].filter(Boolean).join(" | ");
      });

      const encabezados = actual.encabezados;
      const finLinea = actual.finLinea || "\r\n";
      const lineas = actual.filas.map((f) => encabezados.map((enc) => limpiarCelda(f[enc])).join(";"));
      const temporal = `${rutaPagos}.tmp`;
      fs.writeFileSync(temporal, encabezados.join(";") + finLinea + lineas.join(finLinea) + finLinea, "utf8");
      fs.renameSync(temporal, rutaPagos);

      console.log(`🚫 Pago ${numero} anulado por ${quien}`);
      return res.json({ exito: true, mensaje: "Pago anulado. La deuda volvió a la cartera del residente." });
    } catch (error) {
      console.error("❌ Error anulando pago:", error);
      return res.status(500).json({ error: "No se pudo anular el pago" });
    }
  });

  return router;
};