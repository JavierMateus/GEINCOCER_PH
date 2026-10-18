const fs = require("fs");
const path = require("path");

const rutaCSV =
  "C:/Users/Javier Mateus/Desktop/Geincocer/BaseResidencial/Pagos.csv";

const encabezadosBase = [
  "ID_Pago",
  "ID_Obligacion",
  "DocumentoResidente",
  "NombreResidente",
  "Telefono",
  "Correo",
  "TorreManzana",
  "AptoCasa",
  "Periodo",
  "ConceptoPago",
  "DescripcionPago",
  "ValorPagado",
  "Intereses",
  "OtrosCobros",
  "TotalAplicado",
  "FechaPago",
  "MetodoPago",
  "ReferenciaTransaccion",
  "Observaciones",
  "Estado",
  "EstadoPago",
  "ValidoParaConciliacion",
  "OrigenPago",
  "RegistradoPor",
  "FechaRegistro",
  "EstadoObligacionAntesPago",
  "SaldoPendienteObligacion",
];

function asegurarDirectorioYArchivo() {
  const directorio = path.dirname(rutaCSV);
  if (!fs.existsSync(directorio)) {
    fs.mkdirSync(directorio, { recursive: true });
  }
  if (!fs.existsSync(rutaCSV)) {
    fs.writeFileSync(rutaCSV, `\uFEFF${encabezadosBase.join(";")}\n`, "utf8");
  }
}

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function limpiarNumero(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const texto = String(valor)
    .replace(/\$/g, "")
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^\d.-]/g, "");
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function parseFechaFlexible(valor) {
  const texto = limpiarTexto(valor);
  if (!texto || texto === "-" || texto.toLowerCase() === "no pagado") return 0;

  const isoConHora = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:[tT ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?/);
  if (isoConHora) {
    const [, y, m, d, hh = "00", mm = "00", ss = "00", ms = "0"] = isoConHora;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss), Number(ms)).getTime();
  }

  const fechaLatina = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (fechaLatina) {
    let [, d, m, y, hh = "00", mm = "00", ss = "00"] = fechaLatina;
    const anio = y.length === 2 ? Number(`20${y}`) : Number(y);
    return new Date(anio, Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)).getTime();
  }

  const timestamp = new Date(texto).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatearFechaISO(valor, incluirHora = false) {
  const timestamp = parseFechaFlexible(valor);
  if (!timestamp) return "";
  const fecha = new Date(timestamp);
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");
  if (!incluirHora) return `${yyyy}-${mm}-${dd}`;
  const hh = String(fecha.getHours()).padStart(2, "0");
  const mi = String(fecha.getMinutes()).padStart(2, "0");
  const ss = String(fecha.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
}

function escaparCSV(valor) {
  const texto = String(valor ?? "").replace(/\r?\n|\r/g, " ").trim();
  if (texto.includes(";") || texto.includes('"')) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

function dividirLineaCSV(linea) {
  const resultado = [];
  let actual = "";
  let enComillas = false;

  for (let i = 0; i < linea.length; i += 1) {
    const char = linea[i];
    const siguiente = linea[i + 1];

    if (char === '"') {
      if (enComillas && siguiente === '"') {
        actual += '"';
        i += 1;
      } else {
        enComillas = !enComillas;
      }
    } else if (char === ";" && !enComillas) {
      resultado.push(actual);
      actual = "";
    } else {
      actual += char;
    }
  }

  resultado.push(actual);
  return resultado;
}

function normalizarFilaPago(raw = {}, indice = 0) {
  const metodoPago = limpiarTexto(raw.MetodoPago ?? raw["Método Pago"] ?? raw.metodoPago);
  const fechaPago = formatearFechaISO(raw.FechaPago ?? raw["Fecha de pago"] ?? raw.fechaPago, false);
  const fechaRegistro = formatearFechaISO(raw.FechaRegistro ?? raw.fechaRegistro ?? raw["Fecha Registro"], true);
  const valorPagado = limpiarNumero(raw.ValorPagado ?? raw.Valor ?? raw.valorPagado ?? raw.TotalAplicado);
  const intereses = limpiarNumero(raw.Intereses ?? raw.intereses);
  const otrosCobros = limpiarNumero(raw.OtrosCobros ?? raw["Cobro Especial"] ?? raw.cobroEspecial);
  const totalAplicado = limpiarNumero(raw.TotalAplicado ?? raw.totalAplicado ?? valorPagado);
  const idPagoBase = limpiarTexto(raw.ID_Pago ?? raw.IDPago);
  const idPago = idPagoBase || `PAGO-${Date.now()}-${indice + 1}`;

  return {
    ID_Pago: idPago,
    ID_Obligacion: limpiarTexto(raw.ID_Obligacion ?? raw.IDObligacion ?? raw.IdObligacion ?? raw.idObligacion ?? raw.obligacionSeleccionada),
    DocumentoResidente: limpiarTexto(raw.DocumentoResidente ?? raw.Documento ?? raw.documentoIdentidad),
    NombreResidente: limpiarTexto(raw.NombreResidente ?? raw.Nombre ?? raw.nombreCompleto),
    Telefono: limpiarTexto(raw.Telefono ?? raw.telefono),
    Correo: limpiarTexto(raw.Correo ?? raw.correoElectronico),
    TorreManzana: limpiarTexto(raw.TorreManzana ?? raw["Torre/Manzana"] ?? raw.torreManzana),
    AptoCasa: limpiarTexto(raw.AptoCasa ?? raw["Apto/Casa"] ?? raw.aptoCasa),
    Periodo: limpiarTexto(raw.Periodo ?? raw.periodo),
    ConceptoPago: limpiarTexto(raw.ConceptoPago ?? raw["Concepto Pago"] ?? raw.Concepto ?? raw.conceptoPago),
    DescripcionPago: limpiarTexto(raw.DescripcionPago ?? raw["Descripción Pago"] ?? raw.descripcionPago),
    ValorPagado: String(valorPagado),
    Intereses: String(intereses),
    OtrosCobros: String(otrosCobros),
    TotalAplicado: String(totalAplicado > 0 ? totalAplicado : valorPagado),
    FechaPago: fechaPago,
    MetodoPago: metodoPago,
    ReferenciaTransaccion: limpiarTexto(raw.ReferenciaTransaccion ?? raw["Referencia/Transacción"] ?? raw.referenciaTransaccion),
    Observaciones: limpiarTexto(raw.Observaciones ?? raw.observaciones),
    Estado: limpiarTexto(raw.Estado) || "Pagado",
    EstadoPago: limpiarTexto(raw.EstadoPago ?? raw.Estado ?? raw.estado) || "Pagado",
    ValidoParaConciliacion: limpiarTexto(raw.ValidoParaConciliacion ?? raw.validoParaConciliacion) || "SI",
    OrigenPago: limpiarTexto(raw.OrigenPago ?? raw.origenPago) || "manual",
    RegistradoPor: limpiarTexto(raw.RegistradoPor ?? raw.registradoPor) || "Administrador",
    FechaRegistro: fechaRegistro || formatearFechaISO(new Date().toISOString(), true),
    EstadoObligacionAntesPago: limpiarTexto(raw.EstadoObligacionAntesPago ?? raw.estadoObligacionAntesPago),
    SaldoPendienteObligacion: String(limpiarNumero(raw.SaldoPendienteObligacion ?? raw.saldoPendienteObligacion)),
  };
}

function leerCSVCompleto() {
  asegurarDirectorioYArchivo();
  const contenido = fs.readFileSync(rutaCSV, "utf8").replace(/^\uFEFF/, "");
  const lineas = contenido.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (lineas.length === 0) {
    return { encabezados: [...encabezadosBase], pagos: [] };
  }

  const encabezados = dividirLineaCSV(lineas[0]).map((item) => item.trim());
  const pagos = lineas.slice(1).map((linea, indice) => {
    const columnas = dividirLineaCSV(linea);
    const obj = {};
    encabezados.forEach((header, idx) => {
      obj[header] = columnas[idx] ?? "";
    });
    return normalizarFilaPago(obj, indice);
  });

  return { encabezados: [...encabezadosBase], pagos };
}

function guardarCSV(pagos) {
  const lineas = [
    encabezadosBase.join(";"),
    ...pagos.map((pago) => encabezadosBase.map((h) => escaparCSV(pago[h] ?? "")).join(";")),
  ];
  fs.writeFileSync(rutaCSV, `\uFEFF${lineas.join("\n")}`, "utf8");
}

function validarPago(pago) {
  if (!pago.NombreResidente) return "Falta el nombre del residente.";
  if (!pago.DocumentoResidente) return "Falta el documento del residente.";
  if (!pago.TorreManzana) return "Falta la torre o manzana.";
  if (!pago.AptoCasa) return "Falta el apartamento o casa.";
  if (!pago.Periodo) return "Falta el período.";
  if (!pago.ConceptoPago) return "Falta el concepto de pago.";
  if (limpiarNumero(pago.ValorPagado) <= 0) return "El valor pagado debe ser mayor que cero.";
  if (!pago.FechaPago) return "Falta la fecha de pago.";
  if (!pago.MetodoPago) return "Falta el método de pago.";
  const requiereReferencia = ["MERCADO PAGO", "TRANSFERENCIA", "CONSIGNACIÓN", "CONSIGNACION"].includes(pago.MetodoPago.toUpperCase());
  if (requiereReferencia && !pago.ReferenciaTransaccion) {
    return "La referencia es obligatoria para este método de pago.";
  }
  return null;
}

exports.listarPagos = (req, res) => {
  try {
    const { pagos } = leerCSVCompleto();
    return res.json({ pagos });
  } catch (error) {
    console.error("Error al leer Pagos.csv:", error);
    return res.status(500).json({ mensaje: "Error al leer Pagos.csv" });
  }
};

exports.crearPago = (req, res) => {
  try {
    const { pagos } = leerCSVCompleto();
    const pagoNuevo = normalizarFilaPago(req.body || {}, pagos.length);
    const errorValidacion = validarPago(pagoNuevo);
    if (errorValidacion) return res.status(400).json({ error: errorValidacion });

    const existe = pagos.find((p) => String(p.ID_Pago || "").trim() === String(pagoNuevo.ID_Pago || "").trim());
    if (existe) return res.status(409).json({ error: "Ya existe un pago con ese ID." });

    pagos.push(pagoNuevo);
    guardarCSV(pagos);

    return res.status(201).json({ mensaje: "Pago guardado correctamente", pago: pagoNuevo });
  } catch (error) {
    console.error("Error al crear pago:", error);
    return res.status(500).json({ mensaje: "Error interno al crear el pago" });
  }
};

exports.eliminarPago = (req, res) => {
  try {
    const { id } = req.params;
    const { pagos } = leerCSVCompleto();
    if (pagos.length === 0) return res.status(404).json({ mensaje: "No hay pagos para eliminar" });

    const indice = pagos.findIndex((p) => String(p.ID_Pago || "").trim() === String(id).trim());
    if (indice === -1) return res.status(404).json({ mensaje: "Pago no encontrado" });

    pagos.splice(indice, 1);
    guardarCSV(pagos);

    return res.json({ ok: true, mensaje: "Pago eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar pago:", error);
    return res.status(500).json({ mensaje: "Error al eliminar el pago" });
  }
};

exports.actualizarPago = (req, res) => {
  try {
    const { id } = req.params;
    const datosActualizados = req.body || {};
    const { pagos } = leerCSVCompleto();
    if (pagos.length === 0) return res.status(404).json({ mensaje: "No hay pagos para editar" });

    const indicePago = pagos.findIndex((p) => String(p.ID_Pago || "").trim() === String(id).trim());
    if (indicePago === -1) return res.status(404).json({ mensaje: "Pago no encontrado" });

    const fusion = {
      ...pagos[indicePago],
      ...datosActualizados,
      ID_Pago: pagos[indicePago].ID_Pago,
    };

    pagos[indicePago] = normalizarFilaPago(fusion, indicePago);
    pagos[indicePago].ID_Pago = pagos[indicePago].ID_Pago || String(id).trim();
    guardarCSV(pagos);

    return res.status(200).json({ mensaje: "Pago actualizado correctamente", pago: pagos[indicePago] });
  } catch (error) {
    console.error("Error al actualizar pago:", error);
    return res.status(500).json({ mensaje: "Error interno al actualizar el pago" });
  }
};

exports.actualizarObservacionPago = (req, res) => {
  try {
    const { id } = req.params;
    const { observacionNueva, usuario } = req.body;

    if (!observacionNueva || !String(observacionNueva).trim()) {
      return res.status(400).json({ mensaje: "La observación está vacía" });
    }
    if (!usuario || String(usuario).trim().toLowerCase() !== "administrador") {
      return res.status(403).json({ mensaje: "Solo el Administrador puede modificar Observaciones" });
    }

    const { pagos } = leerCSVCompleto();
    if (pagos.length === 0) return res.status(404).json({ mensaje: "No hay pagos para editar" });

    const indicePago = pagos.findIndex((p) => String(p.ID_Pago || "").trim() === String(id).trim());
    if (indicePago === -1) return res.status(404).json({ mensaje: "Pago no encontrado" });

    const fechaHora = new Intl.DateTimeFormat("es-CO", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date());

    const autor = String(usuario).trim();
    const detalle = String(observacionNueva).trim();
    const notaAuditoria = `[${fechaHora}] ${autor}: ${detalle}`;
    const observacionAnterior = String(pagos[indicePago].Observaciones || "").trim();
    const textoBase = "Pago en línea confirmado manualmente";

    if (!observacionAnterior || observacionAnterior === textoBase) {
      pagos[indicePago].Observaciones = `${textoBase} || ${notaAuditoria}`;
    } else {
      pagos[indicePago].Observaciones = `${observacionAnterior} || ${notaAuditoria}`;
    }

    pagos[indicePago] = normalizarFilaPago(pagos[indicePago], indicePago);
    guardarCSV(pagos);

    return res.status(200).json({ mensaje: "Observación actualizada correctamente", observaciones: pagos[indicePago].Observaciones });
  } catch (error) {
    console.error("Error al actualizar observación:", error);
    return res.status(500).json({ mensaje: "Error interno al actualizar observación" });
  }
};

exports.normalizarPagosCSV = (req, res) => {
  try {
    const { pagos } = leerCSVCompleto();
    guardarCSV(pagos);
    return res.status(200).json({
      ok: true,
      mensaje: "Pagos.csv normalizado correctamente",
      totalRegistros: pagos.length,
      encabezados: encabezadosBase,
    });
  } catch (error) {
    console.error("Error al normalizar Pagos.csv:", error);
    return res.status(500).json({ mensaje: "Error al normalizar Pagos.csv" });
  }
};



