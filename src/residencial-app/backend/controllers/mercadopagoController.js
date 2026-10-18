// backend/controllers/mercadopagoController.js
//
// Pagos en linea con Mercado Pago.
//
// Flujo:
//   1) crearPreferencia: el residente marca obligaciones en PagoOnline.jsx.
//      El backend revisa cada una contra obligaciones_residente.csv y
//      Pagos.csv (que sea suya, que tenga saldo y que el valor sea el real),
//      y guarda el detalle en la metadata de la preferencia.
//   2) manejarWebhook / confirmarPagoMp: cuando Mercado Pago aprueba, se
//      escribe en Pagos.csv UNA FILA POR OBLIGACION, con su ID_Obligacion.
//      Los intereses se aplican primero (art. 1653 Codigo Civil).
//
// Pagos.csv se escribe por NOMBRE de columna, leyendo el encabezado real del
// archivo. Asi no se descuadran las columnas.

const axios = require("axios");
const fs = require("fs");
const path = require("path");

// ------------------------------------------------------------------
// Configuracion privada: se lee del archivo backend/.env
// (el token NO se escribe en el codigo)
// ------------------------------------------------------------------
const cargarEnv = () => {
  const rutaEnv = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(rutaEnv)) {
    console.warn("⚠️  No se encontró backend/.env. Mercado Pago no funcionará sin MP_ACCESS_TOKEN.");
    return;
  }
  fs.readFileSync(rutaEnv, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .forEach((linea) => {
      const texto = linea.trim();
      if (!texto || texto.startsWith("#") || !texto.includes("=")) return;
      const i = texto.indexOf("=");
      const clave = texto.slice(0, i).trim();
      const valor = texto.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      if (clave && process.env[clave] === undefined) process.env[clave] = valor;
    });
};
cargarEnv();

// Carpeta OFICIAL de datos
const BASE_DIR = "C:/Users/Javier Mateus/Desktop/Geincocer/BaseResidencial";
const rutaPagos = path.join(BASE_DIR, "Pagos.csv");
const rutaObligaciones = path.join(BASE_DIR, "obligaciones_residente.csv");

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/+$/, "");

if (!ACCESS_TOKEN) {
  console.warn("⚠️  Falta MP_ACCESS_TOKEN en backend/.env. Los pagos con Mercado Pago no funcionarán.");
} else {
  console.log(`✅ Mercado Pago configurado (token ...${ACCESS_TOKEN.slice(-4)})`);
}

// Encabezado oficial, por si Pagos.csv no existe todavia.
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
// Utilidades de CSV
// ------------------------------------------------------------------

const leerCSV = (ruta) => {
  if (!fs.existsSync(ruta)) {
    return { encabezados: [], filas: [], finLinea: "\n", texto: "" };
  }

  const buffer = fs.readFileSync(ruta);
  const utf8 = buffer.toString("utf8");
  const texto = (utf8.includes("\uFFFD") ? buffer.toString("latin1") : utf8).replace(/^\uFEFF/, "");
  const finLinea = texto.includes("\r\n") ? "\r\n" : "\n";

  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lineas.length) return { encabezados: [], filas: [], finLinea, texto };

  const encabezados = lineas[0].split(";").map((e) => e.trim());
  const filas = lineas.slice(1).map((linea) => {
    const valores = linea.split(";");
    const fila = {};
    encabezados.forEach((enc, i) => {
      fila[enc] = (valores[i] ?? "").trim();
    });
    return fila;
  });

  return { encabezados, filas, finLinea, texto };
};

// Un punto y coma o un salto de linea dentro de un texto rompen las columnas.
const limpiarCelda = (valor) =>
  String(valor ?? "").replace(/[;\r\n]+/g, ", ").trim();

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

// Fecha y hora de Colombia
const fechaColombia = (fecha = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(fecha); // 2026-10-01

const fechaHoraColombia = (fecha = new Date()) => {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(fecha);
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}:${p.second}`;
};

// Acepta 10/07/2026 y 2026-07-10
const leerFecha = (valor) => {
  const texto = String(valor || "").trim();
  let p = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (p) return new Date(Number(p[1]), Number(p[2]) - 1, Number(p[3]));
  p = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) return new Date(Number(p[3]), Number(p[2]) - 1, Number(p[1]));
  return null;
};

// ------------------------------------------------------------------
// Cartera: saldo real de cada obligacion
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

// Devuelve las obligaciones con TotalObligacion, Pagado, Saldo y Estado.
const cargarCartera = () => {
  const { filas: obligaciones } = leerCSV(rutaObligaciones);
  const { filas: pagos } = leerCSV(rutaPagos);

  const pagado = {};
  pagos.filter(pagoValido).forEach((p) => {
    const id = String(p.ID_Obligacion || "").trim();
    if (!id) return;
    pagado[id] = (pagado[id] || 0) + montoAplicadoPago(p);
  });

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  return obligaciones
    .filter((o) => normalizar(o.Activo || "si") !== "no")
    .map((o) => {
      const id = String(o.ID_Obligacion || "").trim();
      const declarado = aNumero(o.TotalObligacion);
      const total =
        declarado > 0
          ? declarado
          : aNumero(o.ValorBase) + aNumero(o.Intereses) + aNumero(o.OtrosCobros);
      const pagadoObl = pagado[id] || 0;
      const saldo = Math.max(total - pagadoObl, 0);
      const vence = leerFecha(o.FechaVencimiento);

      let estado = "pendiente";
      if (saldo <= 0) estado = "pagado";
      else if (vence && hoy > vence) estado = "mora";

      return { ...o, ID_Obligacion: id, _total: total, _pagado: pagadoObl, _saldo: saldo, _estado: estado };
    });
};

// ------------------------------------------------------------------
// Detalle de obligaciones en la metadata de Mercado Pago
// Formato: "OBL-0010:2886,OBL-0007:50000" (intereses primero)
// ------------------------------------------------------------------

const detalleATexto = (detalle) => detalle.map((d) => `${d.id}:${Math.round(d.valor)}`).join(",");

const textoADetalle = (texto) =>
  String(texto || "")
    .split(",")
    .map((parte) => {
      const [id, valor] = parte.split(":");
      return { id: String(id || "").trim(), valor: aNumero(valor) };
    })
    .filter((d) => d.id && d.valor > 0);

// ------------------------------------------------------------------
// Escritura en Pagos.csv (por nombre de columna, sin duplicados)
// ------------------------------------------------------------------

const agregarFilasPagos = (nuevasFilas, contextoLog = "") => {
  const actual = leerCSV(rutaPagos);
  const encabezados = actual.encabezados.length ? actual.encabezados : ENCABEZADO_PAGOS;
  const finLinea = actual.finLinea || "\n";
  const idsExistentes = new Set(actual.filas.map((f) => String(f.ID_Pago || "").trim()));

  const aEscribir = nuevasFilas.filter((f) => !idsExistentes.has(String(f.ID_Pago).trim()));

  if (!aEscribir.length) {
    console.log(`⚠️ Pago ya registrado (${contextoLog}), no se vuelve a escribir en Pagos.csv`);
    return { yaExistia: true, escritas: 0 };
  }

  const lineas = aEscribir.map((fila) => encabezados.map((enc) => limpiarCelda(fila[enc])).join(";"));

  let contenido = "";
  if (!actual.encabezados.length) {
    contenido = encabezados.join(";") + finLinea;
  } else {
    const texto = fs.readFileSync(rutaPagos, "utf8");
    if (texto.length && !texto.endsWith("\n")) contenido = finLinea;
  }

  contenido += lineas.join(finLinea) + finLinea;
  fs.appendFileSync(rutaPagos, contenido, "utf8");

  console.log(`💾 ${aEscribir.length} fila(s) agregada(s) a Pagos.csv (${contextoLog})`);
  return { yaExistia: false, escritas: aEscribir.length };
};

// ------------------------------------------------------------------
// Registro de un pago aprobado de Mercado Pago
// ------------------------------------------------------------------

const registrarPagoAprobado = (pago, origen) => {
  const meta = pago.metadata || {};
  const referencia = String(pago.id);
  const fechaPago = fechaColombia(pago.date_approved ? new Date(pago.date_approved) : new Date());
  const fechaRegistro = fechaHoraColombia();
  const metodo = `Mercado Pago${pago.payment_method_id ? ` (${pago.payment_method_id})` : ""}`;
  const montoRecibido = aNumero(pago.transaction_amount);

  const base = {
    DocumentoResidente: meta.documento || "",
    NombreResidente: meta.nombre || "",
    TorreManzana: meta.torre_manzana || "",
    AptoCasa: meta.apto_casa || "",
    FechaPago: fechaPago,
    MetodoPago: metodo,
    ReferenciaTransaccion: referencia,
    EstadoPago: "pagado",
    ValidoParaConciliacion: "SI",
    OrigenPago: origen,
    RegistradoPor: "Sistema",
    FechaRegistro: fechaRegistro,
    Telefono: meta.telefono || "",
    Correo: meta.email || pago.payer?.email || "",
    Estado: "Pagado",
  };

  const detalle = textoADetalle(meta.obligaciones_detalle);

  // Pagos antiguos sin detalle: una sola fila, sin ID_Obligacion.
  if (!detalle.length) {
    return agregarFilasPagos(
      [
        {
          ...base,
          ID_Pago: `MP-${referencia}`,
          Periodo: fechaPago.slice(0, 7),
          ConceptoPago: meta.concepto || "",
          ValorPagado: montoRecibido,
          InteresesPagados: 0,
          OtrosCobrosPagados: 0,
          TotalAplicado: montoRecibido,
          Intereses: 0,
          OtrosCobros: 0,
          Observaciones: "Pago en línea sin detalle de obligaciones. Revisar y asignar",
          NotasInternas: "Sin ID_Obligacion",
          DescripcionPago: meta.descripcion || "",
        },
      ],
      origen
    );
  }

  // Se reparte lo recibido en el orden guardado: intereses primero.
  const cartera = cargarCartera();
  const porId = Object.fromEntries(cartera.map((o) => [o.ID_Obligacion, o]));

  let disponible = montoRecibido;
  const filas = [];

  detalle.forEach((d) => {
    if (disponible <= 0) return;

    const obl = porId[d.id] || {};
    const aplicado = Math.min(d.valor, disponible);
    disponible -= aplicado;

    const interes = esInteres(obl);
    const saldoAntes = obl._saldo ?? d.valor;
    const saldoDespues = Math.max(saldoAntes - aplicado, 0);

    filas.push({
      ...base,
      ID_Pago: `MP-${referencia}-${d.id}`,
      ID_Obligacion: d.id,
      DocumentoResidente: obl.DocumentoResidente || base.DocumentoResidente,
      NombreResidente: obl.NombreResidente || base.NombreResidente,
      TorreManzana: obl.TorreManzana || base.TorreManzana,
      AptoCasa: obl.AptoCasa || base.AptoCasa,
      Periodo: obl.Periodo || "",
      ConceptoPago: obl.Concepto || "",
      SubconceptoPago: obl.Subconcepto || "",
      ValorPagado: interes ? 0 : aplicado,
      InteresesPagados: interes ? aplicado : 0,
      OtrosCobrosPagados: 0,
      TotalAplicado: aplicado,
      Intereses: interes ? aplicado : 0,
      OtrosCobros: 0,
      Estado: saldoDespues > 0 ? "Parcial" : "Pagado",
      EstadoObligacionAntesPago: obl._estado || "",
      SaldoPendienteObligacion: saldoDespues,
      Observaciones:
        `Pago en línea Mercado Pago (ref. ${referencia}).` +
        (interes ? " Imputado primero a intereses (art. 1653 C.C.)" : ` Aplicado al capital de ${d.id}`),
      NotasInternas: porId[d.id] ? `Cruce válido con ${d.id}` : `ATENCIÓN: ${d.id} no existe en obligaciones`,
      DescripcionPago: obl.Observaciones || "",
    });
  });

  if (disponible > 0) {
    console.warn(`⚠️ Pago ${referencia}: sobraron ${disponible} sin obligación asignada`);
  }

  return agregarFilasPagos(filas, origen);
};

// ------------------------------------------------------------------
// 1) Crear preferencia
// ------------------------------------------------------------------

exports.crearPreferencia = async (req, res) => {
  if (!ACCESS_TOKEN) {
    return res.status(500).json({
      error: "Mercado Pago no está configurado: falta MP_ACCESS_TOKEN en backend/.env. Avisa al administrador.",
    });
  }

  const {
    descripcion,
    nombre,
    email,
    documento,
    telefono,
    concepto,
    torre_manzana,
    apto_casa,
    obligaciones = [],
  } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ error: "El email es requerido" });
    }

    if (!Array.isArray(obligaciones) || !obligaciones.length) {
      return res.status(400).json({ error: "Debes marcar al menos una obligación" });
    }

    // Revisar cada obligacion contra la base real.
    const cartera = cargarCartera();
    const porId = Object.fromEntries(cartera.map((o) => [o.ID_Obligacion, o]));
    const doc = soloDigitos(documento);
    const ids = [...new Set(obligaciones.map((o) => String(o.ID_Obligacion || "").trim()))];

    for (const id of ids) {
      const obl = porId[id];

      if (!obl) {
        return res.status(400).json({ error: `La obligación ${id} no existe` });
      }
      if (soloDigitos(obl.DocumentoResidente) !== doc) {
        return res.status(400).json({ error: `La obligación ${id} no pertenece a este residente` });
      }
      if (obl._saldo <= 0) {
        return res.status(400).json({ error: `La obligación ${id} ya está pagada. Recarga la página` });
      }

      const valorPantalla = aNumero(obligaciones.find((o) => String(o.ID_Obligacion).trim() === id)?.Valor);
      if (Math.round(valorPantalla) !== Math.round(obl._saldo)) {
        return res.status(400).json({
          error: `El saldo de ${id} cambió. Recarga la página e inténtalo de nuevo`,
        });
      }
    }

    // Si se paga una cuota, sus intereses pendientes deben ir incluidos.
    for (const id of ids) {
      if (esInteres(porId[id])) continue;
      const faltantes = cartera.filter(
        (o) =>
          esInteres(o) &&
          String(o.ID_ObligacionPadre || "").trim() === id &&
          o._saldo > 0 &&
          !ids.includes(o.ID_Obligacion)
      );
      if (faltantes.length) {
        return res.status(400).json({
          error: `Para pagar ${id} debes incluir sus intereses: ${faltantes.map((f) => f.ID_Obligacion).join(", ")}`,
        });
      }
    }

    // Intereses primero, luego el resto. Valores tomados de la base.
    const detalle = ids
      .map((id) => ({ id, valor: porId[id]._saldo, interes: esInteres(porId[id]) }))
      .sort((a, b) => Number(b.interes) - Number(a.interes));

    const montoTotal = detalle.reduce((s, d) => s + d.valor, 0);

    const titulo =
      (descripcion || `Pago GEINCOCER ${ids.join(", ")}`).slice(0, 250);

    const response = await axios.post(
      "https://api.mercadopago.com/checkout/preferences/",
      {
        items: [
          {
            id: "PAGO_ONLINE",
            title: titulo,
            quantity: 1,
            unit_price: Math.round(montoTotal),
            currency_id: "COP",
          },
        ],
        payer: { name: nombre, email },
        back_urls: {
          success: `${FRONTEND_URL}/pagos/resultado?from=mp`,
          failure: `${FRONTEND_URL}/pagos/resultado?from=mp`,
          pending: `${FRONTEND_URL}/pagos/resultado?from=mp`,
        },
        notification_url: `${BACKEND_URL}/api/mercadopago/webhook`,
        metadata: {
          documento: documento || "",
          telefono: telefono || "",
          email: email || "",
          concepto: concepto || "",
          nombre: nombre || "",
          torre_manzana: torre_manzana || "",
          apto_casa: apto_casa || "",
          descripcion: titulo,
          obligaciones_detalle: detalleATexto(detalle),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    return res.json({
      url: response.data.init_point,
      preferenceId: response.data.id,
      monto: montoTotal,
    });
  } catch (error) {
    console.error("❌ Error en crearPreferencia:", error.response?.data || error.message);
    return res.status(500).json({
      error: "No se pudo crear el pago en Mercado Pago",
      detalle: error.response?.data || error.message,
    });
  }
};

// ------------------------------------------------------------------
// 2) Procesar resultado del pago (solo informa)
// ------------------------------------------------------------------

exports.procesarResultadoPago = async (req, res) => {
  try {
    const { preferenceId, paymentId } = req.body;

    if (!preferenceId) {
      return res.status(400).json({ exito: false, mensaje: "Falta preferenceId" });
    }

    return res.json({
      exito: true,
      mensaje: "Resultado de pago procesado correctamente",
      preferenceId,
      paymentId: paymentId || null,
    });
  } catch (error) {
    console.error("❌ Error en procesarResultadoPago:", error.response?.data || error.message);
    return res.status(500).json({
      exito: false,
      mensaje: "Error procesando resultado del pago",
      detalle: error.response?.data || error.message,
    });
  }
};

// ------------------------------------------------------------------
// 3) Confirmar pago (desde la pantalla de resultado)
// ------------------------------------------------------------------

exports.confirmarPagoMp = async (req, res) => {
  try {
    const { paymentId } = req.body;

    if (!paymentId) {
      return res.status(400).json({ exito: false, mensaje: "Falta paymentId" });
    }

    const { data: pago } = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });

    if (pago.status !== "approved") {
      return res.status(400).json({
        exito: false,
        mensaje: `El pago no está aprobado. Estado actual: ${pago.status}`,
      });
    }

    const resultado = registrarPagoAprobado(pago, "mercadopago_confirmacion");

    return res.status(200).json({
      exito: true,
      mensaje: resultado.yaExistia ? "El pago ya existía en el CSV" : "Pago confirmado y guardado en CSV",
      filas: resultado.escritas,
      yaExistia: resultado.yaExistia,
    });
  } catch (error) {
    console.error("❌ Error en confirmarPagoMp:", error.response?.data || error.message);
    return res.status(500).json({
      exito: false,
      mensaje: "No se pudo confirmar el pago en Mercado Pago",
      detalle: error.response?.data || error.message,
    });
  }
};

// ------------------------------------------------------------------
// 4) Webhook (aviso automatico de Mercado Pago)
// ------------------------------------------------------------------

exports.manejarWebhook = async (req, res) => {
  try {
    const { data, type } = req.body;

    if (type !== "payment" || !data || !data.id) {
      console.log("⚠️ Webhook ignorado: no es un pago");
      return res.sendStatus(200);
    }

    const { data: pago } = await axios.get(`https://api.mercadopago.com/v1/payments/${data.id}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });

    if (pago.status !== "approved") {
      console.log("⚠️ Pago no aprobado, estado:", pago.status);
      return res.sendStatus(200);
    }

    const resultado = registrarPagoAprobado(pago, "mercadopago_webhook");

    return res.status(200).json({
      exito: true,
      mensaje: resultado.yaExistia ? "El pago ya existía en el CSV" : "Pago recibido por webhook y guardado en CSV",
      filas: resultado.escritas,
      yaExistia: resultado.yaExistia,
    });
  } catch (error) {
    console.error("❌ Error en manejarWebhook:", error.response?.data || error.message);
    return res.status(500).json({
      exito: false,
      mensaje: "Error procesando webhook de Mercado Pago",
      detalle: error.response?.data || error.message,
    });
  }
};

// ------------------------------------------------------------------
// 5) Registrar pago manual (POST /api/mercadopago)
// Se conserva por compatibilidad. Ahora escribe con las columnas nuevas.
// ------------------------------------------------------------------

exports.registrarPagoManual = async (req, res) => {
  try {
    const body = req.body;
    const hoy = fechaColombia();

    const concepto = body["Concepto Pago"] || body.Concepto || body.conceptoPago || body.concepto || "";
    const nombre = body.Nombre || body.nombre || "";
    const valor = aNumero(body.Valor || body.valor || body.montoPagar);
    const intereses = aNumero(body.Intereses);
    const otros = aNumero(body["Cobro Especial"]);

    if (!String(concepto).trim()) {
      return res.status(400).json({ exito: false, mensaje: "Falta el concepto de pago" });
    }
    if (!nombre || !valor) {
      return res.status(400).json({ exito: false, mensaje: "Faltan campos obligatorios: Nombre o Valor" });
    }

    const fila = {
      ID_Pago: body.ID_Pago || `MANUAL-${Date.now()}`,
      ID_Obligacion: body.ID_Obligacion || "",
      DocumentoResidente: body.Documento || body.documento || "",
      NombreResidente: nombre,
      TorreManzana: body["Torre/Manzana"] || body.torreManzana || "",
      AptoCasa: body["Apto/Casa"] || body.aptoCasa || "",
      Periodo: body.Periodo || body.periodo || "",
      ConceptoPago: concepto,
      ValorPagado: valor,
      InteresesPagados: intereses,
      OtrosCobrosPagados: otros,
      TotalAplicado: valor + intereses + otros,
      FechaPago: body["Fecha de pago"] || body.fechaPago || hoy,
      MetodoPago: body["Método Pago"] || body.metodoPago || "Transferencia",
      ReferenciaTransaccion: body["Referencia/Transacción"] || body.referenciaTransaccion || "",
      EstadoPago: "pagado",
      ValidoParaConciliacion: "SI",
      OrigenPago: "manual",
      RegistradoPor: "Administrador",
      FechaRegistro: fechaHoraColombia(),
      Observaciones: body.Observaciones || body.observaciones || "Pago manual registrado por administrador",
      Telefono: body.Telefono || body.telefono || "",
      Intereses: intereses,
      OtrosCobros: otros,
      Estado: "Pagado",
    };

    const resultado = agregarFilasPagos([fila], "manual");

    return res.status(200).json({
      exito: true,
      mensaje: resultado.yaExistia ? "El pago ya existía en el CSV" : "Pago manual guardado correctamente",
      pago: fila,
      yaExistia: resultado.yaExistia,
    });
  } catch (error) {
    console.error("❌ Error en registrarPagoManual:", error.response?.data || error.message);
    return res.status(500).json({
      exito: false,
      mensaje: "No se pudo guardar el pago manual",
      detalle: error.response?.data || error.message,
    });
  }
};

// Exportado para pruebas
exports._registrarPagoAprobado = registrarPagoAprobado;