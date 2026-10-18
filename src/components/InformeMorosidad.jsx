// src/components/InformeMorosidad.jsx
import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import FormularioPago from "./FormularioPago";
import LiquidacionIntereses from "./LiquidacionIntereses";
import RecordatoriosMorosos from "./RecordatoriosMorosos";
import PazYSalvo from "./PazYSalvo";

function InformeMorosidad({ usuario }) {
  const [pagos, setPagos] = useState([]);
  const [obligaciones, setObligaciones] = useState([]);
  const [habitantes, setHabitantes] = useState([]);
  const [mostrarLiquidacion, setMostrarLiquidacion] = useState(false);
  const [mostrarRecordatorios, setMostrarRecordatorios] = useState(false);
  const [mostrarPazYSalvo, setMostrarPazYSalvo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");
  const [anioFiltro, setAnioFiltro] = useState("");
  const [torreFiltro, setTorreFiltro] = useState("");
  const [aptoFiltro, setAptoFiltro] = useState("");
  const [mostrarTabla, setMostrarTabla] = useState(true);
  const [tiempoRestante, setTiempoRestante] = useState(300);

  const DIA_VENCIMIENTO = 10;

  const limpiarNumero = (valor) =>
    Number(String(valor ?? 0).replace(/[^\d.-]/g, "")) || 0;

  const normalizarTexto = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

const normalizarTorre = (valor) =>
  normalizarTexto(valor)
    .replace(/\bTORRE\b/g, "T")
    .replace(/\bMANZANA\b/g, "MZ")
    .replace(/\bMZA\b/g, "MZ")
    .replace(/[^A-Z0-9]/g, "");

// Para los filtros: "Torre 2", "t2", "T-2" -> "T2" y "Mz 7", "manzana 7", "M-7" -> "M7"
const claveTorreFiltro = (valor) =>
  normalizarTexto(valor)
    .replace(/\bTORRE\b/g, "T")
    .replace(/\b(MANZANA|MZA|MZ)\b/g, "M")
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^MZA?(?=\d)/, "M");

const normalizarApto = (valor) =>
  normalizarTexto(valor)
    .replace(/\bAPARTAMENTO\b/g, "")
    .replace(/\bAPTO\b/g, "")
    .replace(/\bAPT\b/g, "")
    .replace(/\bCASA\b/g, "")
    .replace(/[^A-Z0-9]/g, "");

const normalizarPeriodo = (valor) => {
  const texto = String(valor || "")
    .trim()
    .replace(/\//g, "-")
    .replace(/\s+/g, "");

  const coincidencia = texto.match(/^(\d{4})-(\d{1,2})$/);

  if (!coincidencia) return texto;

  const [, anio, mes] = coincidencia;

  return `${anio}-${mes.padStart(2, "0")}`;
};

const normalizarConcepto = (valor) => {
  const texto = normalizarTexto(valor)
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!texto) return "";

  if (
    texto.includes("ADMINISTRACION") ||
    texto.includes("CUOTA ADMON") ||
    texto.includes("CUOTA ADMIN") ||
    texto.includes("CUOTA DE ADMINISTRACION")
  ) {
    return "ADMINISTRACION";
  }

  if (
    texto.includes("ZONA COMUN") ||
    texto.includes("ZONAS COMUNES") ||
    texto.includes("SERVICIO COMUN") ||
    texto.includes("SERVICIOS COMUNES") ||
    texto.includes("AREA COMUN") ||
    texto.includes("AREAS COMUNES") ||
    texto.includes("RESERVA SALON") ||
    texto.includes("SALON SOCIAL")
  ) {
    return "ZONA_COMUN";
  }

  if (
    texto.includes("INTERES MORA") ||
    texto.includes("INTERESES MORA") ||
    texto.includes("INTERES POR MORA") ||
    texto.includes("INTERESES POR MORA")
  ) {
    return "INTERES_MORA";
  }

  if (
    texto.includes("CUOTA EXTRA") ||
    texto.includes("EXTRAORDINARIA")
  ) {
    return "EXTRAORDINARIA";
  }

  if (texto.includes("MULTA")) {
    return "MULTA";
  }

  if (
    texto.includes("FONDO DE RESERVA") ||
    texto === "RESERVA"
  ) {
    return "RESERVA";
  }

  if (texto.includes("MANTENIMIENTO")) {
    return "MANTENIMIENTO";
  }

  return texto;
};


const parseFechaPago = (valor) => {
  if (!valor || valor === "-" || valor === "No pagado") return 0;

  const valorStr = String(valor).trim();

  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(valorStr)) {
    const [dia, mes, anioTexto] = valorStr.split("/");
    const anio =
      anioTexto.length === 2
        ? Number(`20${anioTexto}`)
        : Number(anioTexto);

    return new Date(anio, Number(mes) - 1, Number(dia)).getTime();
  }

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(valorStr)) {
    const [anio, mes, dia] = valorStr.split("-");

    return new Date(
      Number(anio),
      Number(mes) - 1,
      Number(dia)
    ).getTime();
  }

  const fechaNormal = new Date(valorStr);

  return Number.isNaN(fechaNormal.getTime())
    ? 0
    : fechaNormal.getTime();
};

const obtenerFechaVencimiento = (periodo) => {
  const periodoNormalizado = normalizarPeriodo(periodo);

  if (!/^\d{4}-\d{2}$/.test(periodoNormalizado)) {
    return null;
  }

  const [anio, mes] = periodoNormalizado.split("-");

  return new Date(
    Number(anio),
    Number(mes) - 1,
    DIA_VENCIMIENTO
  );
};

const normalizarEstado = (valor) => {
  const estado = normalizarTexto(valor).toLowerCase();

  if (!estado) return "";
  if (estado.includes("mora")) return "mora";
  if (estado.includes("pag")) return "pagado";
  if (estado.includes("pend")) return "pendiente";

  return estado;
};

// Acepta 4/03/2026 y 2026-03-04. Devuelve un Date o null.
const leerFecha = (valor) => {
  const texto = String(valor || "").trim();

  if (!/^(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{1,2}-\d{1,2})$/.test(texto)) {
    return null;
  }

  const fecha = new Date(parseFechaPago(texto));

  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

// Formato visual unico de la aplicacion: 4/03/2026
const formatearFechaVisual = (valor) => {
  const fecha = leerFecha(valor);

  if (!fecha) return "";

  const mes = String(fecha.getMonth() + 1).padStart(2, "0");

  return `${fecha.getDate()}/${mes}/${fecha.getFullYear()}`;
};

// Para Excel: numero de fecha real, asi la columna se puede ordenar.
const fechaPagoExportable = (valor) => {
  const fecha = leerFecha(valor);

  if (!fecha) return "";

  const utc = Date.UTC(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate()
  );

  return (utc - Date.UTC(1899, 11, 30)) / 86400000;
};

const soloDigitos = (valor) => String(valor || "").replace(/\D/g, "");

const construirClave = ({ torre, apto, periodo, concepto }) =>
  [
    normalizarTorre(torre),
    normalizarApto(apto),
    normalizarPeriodo(periodo),
    normalizarConcepto(concepto),
  ].join("|");

const construirClaveInmueblePeriodo = ({ torre, apto, periodo }) =>
  [
    normalizarTorre(torre),
    normalizarApto(apto),
    normalizarPeriodo(periodo),
  ].join("|");

const calcularEstadoPorFechas = ({
  periodo,
  fechaPago,
  saldoPendiente,
}) => {
  if (Number(saldoPendiente) <= 0) {
    return "pagado";
  }

  const fechaVencimiento = obtenerFechaVencimiento(periodo);

  if (!fechaVencimiento) {
    return "pendiente";
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const vencimiento = new Date(fechaVencimiento);
  vencimiento.setHours(0, 0, 0, 0);

  return hoy > vencimiento ? "mora" : "pendiente";
};

const cargarPagos = async () => {
  const resp = await fetch("/api/pagos", {
    cache: "no-store",
  });

  if (!resp.ok) {
    throw new Error(
      `No se pudieron cargar pagos. Error ${resp.status}`
    );
  }

  const data = await resp.json();

  return Array.isArray(data.pagos) ? data.pagos : [];
};

const cargarHabitantes = async () => {
  // Si el endpoint aun no existe, el informe no debe romperse: devuelve vacio.
  try {
    const resp = await fetch("/api/habitantes", { cache: "no-store" });

    if (!resp.ok) return [];

    const data = await resp.json();

    return Array.isArray(data.habitantes) ? data.habitantes : [];
  } catch (err) {
    console.warn("No se pudieron cargar habitantes:", err);
    return [];
  }
};

const cargarObligaciones = async () => {
  const resp = await fetch('/api/obligaciones', {
    cache: 'no-store',
  });

  if (!resp.ok) {
    throw new Error(
      `No se pudieron cargar obligaciones. Error ${resp.status}`
    );
  }

  const data = await resp.json();

  if (!data?.ok) {
    throw new Error(
      data?.error || 'No se pudieron cargar las obligaciones.'
    );
  }

  return Array.isArray(data.obligaciones)
    ? data.obligaciones
    : [];

  const csvTexto = await resp.text();

  const lineas = csvTexto
    .replace(/\r/g, "")
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean);

  if (lineas.length < 2) return [];

  const encabezados = lineas[0]
    .split(";")
    .map((encabezado) => encabezado.trim());

  return lineas.slice(1).map((linea) => {
    const valores = linea.split(";").map((valor) => valor.trim());
    const fila = {};

    encabezados.forEach((encabezado, indice) => {
      fila[encabezado] = valores[indice] ?? "";
    });

    return fila;
  });
};

const recargarDatos = async () => {
  try {
    setCargando(true);
    setError(null);

    const [
      pagosActualizados,
      obligacionesActualizadas,
      habitantesActualizados,
    ] = await Promise.all([
      cargarPagos(),
      cargarObligaciones(),
      cargarHabitantes(),
    ]);

    setPagos(pagosActualizados);
    setObligaciones(obligacionesActualizadas);
    setHabitantes(habitantesActualizados);
    setMostrarTabla(true);
    setTiempoRestante(300);
  } catch (err) {
    console.error("Error recargando informe:", err);

    setError(
      err.message || "No se pudieron cargar los datos del informe."
    );

    setPagos([]);
    setObligaciones([]);
    setHabitantes([]);
  } finally {
    setCargando(false);
  }
};

useEffect(() => {
  recargarDatos();
}, []);

useEffect(() => {
  if (!mostrarTabla) return undefined;

  setTiempoRestante(300);

  const intervalo = setInterval(() => {
    setTiempoRestante((tiempo) => {
      if (tiempo <= 1) {
        clearInterval(intervalo);
        return 0;
      }

      return tiempo - 1;
    });
  }, 1000);

  const timeout = setTimeout(() => {
    setMostrarTabla(false);
  }, 300000);

  return () => {
    clearInterval(intervalo);
    clearTimeout(timeout);
  };
}, [mostrarTabla]);

const pagosIndexados = useMemo(() => {
  const indicePorIdObligacion = {};
  const indicePorConcepto = {};
  const indicePorInmueblePeriodo = {};

  const registrarPago = (indice, clave, pago, valorPagado, fechaPago) => {
    if (!clave) return;

    if (!indice[clave]) {
      indice[clave] = {
        totalPagado: 0,
        fechaPago: "",
        ultimoTimestamp: 0,
        pagos: [],
      };
    }

    const timestamp = parseFechaPago(fechaPago);

    indice[clave].totalPagado += valorPagado;
    indice[clave].pagos.push(pago);

    if (timestamp >= indice[clave].ultimoTimestamp) {
      indice[clave].ultimoTimestamp = timestamp;
      indice[clave].fechaPago = fechaPago;
    }
  };

  (pagos || []).forEach((pago) => {
    const torre =
      pago["Torre/Manzana"] ||
      pago.TorreManzana ||
      pago.torre ||
      "";

    const apto =
      pago["Apto/Casa"] ||
      pago.AptoCasa ||
      pago.apto ||
      "";

    const periodo = pago.Periodo || pago.periodo || "";

    const concepto =
      pago.Concepto ||
      pago.ConceptoPago ||
      pago["Concepto Pago"] ||
      pago.concepto ||
      pago.conceptoPago ||
      "";

    const idObligacion = String(
      pago.ID_Obligacion ||
      pago.IdObligacion ||
      pago.idObligacion ||
      pago["ID Obligación"] ||
      ""
    ).trim();

    const estadoPago = normalizarEstado(
      pago.EstadoPago ||
      pago.Estado ||
      pago.estado ||
      "pagado"
    );

    const validoParaConciliacion = normalizarTexto(
      pago.ValidoParaConciliacion ||
      pago.validoParaConciliacion ||
      "SI"
    );

    const origenPago = normalizarTexto(
      pago.OrigenPago ||
      pago.origenPago ||
      ""
    ).toLowerCase();

    if (estadoPago !== "pagado") return;
    if (validoParaConciliacion === "NO") return;
    if (origenPago === "prueba") return;

    const valorPagado = limpiarNumero(
      pago.TotalAplicado ??
      pago.ValorPagado ??
      pago.Valor ??
      pago.TotalPagado ??
      pago.valor ??
      pago.montoPagar ??
      0
    );

    if (valorPagado <= 0) return;

    const fechaPago =
      pago["Fecha de pago"] ||
      pago.FechaPago ||
      pago.fechaPago ||
      pago.fecha ||
      "";

    const claveConConcepto = construirClave({
      torre,
      apto,
      periodo,
      concepto,
    });

    const claveInmueblePeriodo = construirClaveInmueblePeriodo({
      torre,
      apto,
      periodo,
    });

    // Si el pago trae ID_Obligacion, se aplica solo a esa obligacion.
    // Los cruces por concepto o por periodo son solo para pagos antiguos
    // sin ID. Asi un pago no se cuenta en dos obligaciones parecidas
    // (por ejemplo, dos intereses de mora del mismo mes).
    if (idObligacion) {
      registrarPago(
        indicePorIdObligacion,
        idObligacion,
        pago,
        valorPagado,
        fechaPago
      );
      return;
    }

    registrarPago(
      indicePorConcepto,
      claveConConcepto,
      pago,
      valorPagado,
      fechaPago
    );

    registrarPago(
      indicePorInmueblePeriodo,
      claveInmueblePeriodo,
      pago,
      valorPagado,
      fechaPago
    );
  });

  return {
    porIdObligacion: indicePorIdObligacion,
    porConcepto: indicePorConcepto,
    porInmueblePeriodo: indicePorInmueblePeriodo,
  };
}, [pagos]);

  // Indice de habitantes para completar datos de contacto.
  const habitantesIndexados = useMemo(() => {
    const porDocumento = {};
    const porInmueble = {};

    (habitantes || []).forEach((h) => {
      const documento = soloDigitos(
        h.DocumentoResidente || h.Documento || h.documento
      );

      const torre = normalizarTorre(
        h.TorreManzana || h["Torre/Manzana"] || h.torre
      );

      const apto = normalizarApto(h.AptoCasa || h["Apto/Casa"] || h.apto);

      const telefono = soloDigitos(h.Telefono || h["Teléfono"] || h.telefono);

      if (!telefono) return;

      if (documento && !porDocumento[documento]) {
        porDocumento[documento] = telefono;
      }

      const claveInmueble = `${torre}|${apto}`;

      if (torre && apto && !porInmueble[claveInmueble]) {
        porInmueble[claveInmueble] = telefono;
      }
    });

    return { porDocumento, porInmueble };
  }, [habitantes]);

  const filasMapeadas = useMemo(() => {
  return (obligaciones || []).map((item, index) => {
    const torre =
      item["Torre/Manzana"] ||
      item.TorreManzana ||
      item.torre ||
      "";

    const apto =
      item["Apto/Casa"] ||
      item.AptoCasa ||
      item.apto ||
      "";

    const periodo = item.Periodo || item.periodo || "";

    const concepto =
      item.Concepto ||
      item.concepto ||
      item.Subconcepto ||
      item.subconcepto ||
      item["Concepto Pago"] ||
      "";

    const valorBase = limpiarNumero(
      item.ValorBase ||
      item.valorBase ||
      item.Valor ||
      item.valor ||
      0
    );

    const intereses = limpiarNumero(
      item.Intereses ||
      item.intereses ||
      0
    );

    const otrosCobros = limpiarNumero(
      item.OtrosCobros ||
      item.otrosCobros ||
      0
    );

    const totalObligacion = limpiarNumero(
      item.TotalObligacion ||
      item.totalObligacion ||
      valorBase + intereses + otrosCobros
    );

    const idObligacion = String(
      item.ID_Obligacion ||
      item.IdObligacion ||
      item.idObligacion ||
      `OBL-${index + 1}`
    ).trim();

    const claveConConcepto = construirClave({
      torre,
      apto,
      periodo,
      concepto,
    });

    const claveInmueblePeriodo = construirClaveInmueblePeriodo({
      torre,
      apto,
      periodo,
    });

    let pagoRelacionado =
      pagosIndexados.porIdObligacion?.[idObligacion] ||
      pagosIndexados.porConcepto?.[claveConConcepto];

    if (!pagoRelacionado) {
      const obligacionesMismoPeriodo = (obligaciones || []).filter((obligacion) => {
        const torreObligacion =
          obligacion["Torre/Manzana"] ||
          obligacion.TorreManzana ||
          obligacion.torre ||
          "";

        const aptoObligacion =
          obligacion["Apto/Casa"] ||
          obligacion.AptoCasa ||
          obligacion.apto ||
          "";

        const periodoObligacion =
          obligacion.Periodo ||
          obligacion.periodo ||
          "";

        return (
          construirClaveInmueblePeriodo({
            torre: torreObligacion,
            apto: aptoObligacion,
            periodo: periodoObligacion,
          }) === claveInmueblePeriodo
        );
      });

      if (obligacionesMismoPeriodo.length === 1) {
        pagoRelacionado =
          pagosIndexados.porInmueblePeriodo?.[claveInmueblePeriodo];
      }
    }

    const totalPagadoBruto = pagoRelacionado?.totalPagado || 0;
    const totalPagado = Math.min(totalPagadoBruto, totalObligacion);
    const saldoAFavor = Math.max(totalPagadoBruto - totalObligacion, 0);
    const saldoPendiente = Math.max(totalObligacion - totalPagado, 0);

    const fechaPago =
      pagoRelacionado?.fechaPago ||
      item.FechaPago ||
      item["Fecha de pago"] ||
      item.FechaUltimoPago ||
      item.fechaUltimoPago ||
      "";

    const activo = normalizarTexto(
      item.Activo ||
      item.activo ||
      "SI"
    );

    const estadoArchivo = normalizarEstado(
      item.EstadoCalculado ||
      item.estadoCalculado ||
      item.Estado ||
      item.estado ||
      ""
    );

    // El telefono se toma de la obligacion y, si falta, de Habitantes.csv.
    const documentoNormalizado = soloDigitos(
      item.DocumentoResidente ||
        item.documentoResidente ||
        item.Documento ||
        item.documento
    );

    const telefonoResidente =
      soloDigitos(item.Telefono || item.telefono) ||
      habitantesIndexados.porDocumento?.[documentoNormalizado] ||
      habitantesIndexados.porInmueble?.[
        `${normalizarTorre(torre)}|${normalizarApto(apto)}`
      ] ||
      "";

    let estado = calcularEstadoPorFechas({
      periodo,
      fechaPago,
      saldoPendiente,
    });

    if (saldoPendiente <= 0 && totalObligacion > 0) {
      estado = "pagado";
    }

    if (activo === "NO" || estadoArchivo === "anulado") {
      estado = "anulado";
    }

    return {
      ID_Obligacion: idObligacion,

      TorreManzana: torre || "-",
      AptoCasa: apto || "-",
      "Torre/Manzana": torre || "-",
      "Apto/Casa": apto || "-",

      NombreResidente:
        item.NombreResidente ||
        item.nombreResidente ||
        item.Nombre ||
        item.nombre ||
        "-",

      DocumentoResidente:
        item.DocumentoResidente ||
        item.documentoResidente ||
        item.Documento ||
        item.documento ||
        "-",

      Telefono: telefonoResidente || "-",

      Periodo: periodo || "-",
      Concepto: concepto || "-",
      Subconcepto:
        item.Subconcepto ||
        item.subconcepto ||
        "-",

      FechaPago: formatearFechaVisual(fechaPago) || "No pagado",

      FechaGeneracion:
        item.FechaGeneracion ||
        item.fechaGeneracion ||
        "-",

      FechaVencimiento:
        item.FechaVencimiento ||
        item.fechaVencimiento ||
        "",

      ValorBase: valorBase,
      Intereses: intereses,
      OtrosCobros: otrosCobros,
      TotalObligacion: totalObligacion,
      TotalPagado: totalPagado,
      TotalPagadoBruto: totalPagadoBruto,
      SaldoAFavor: saldoAFavor,
      SaldoPendiente: saldoPendiente,

      EstadoArchivo: estadoArchivo,
      Activo: activo,
      Estado: estado,
      EstadoCalculado: estado,

      OrigenObligacion:
        item.OrigenObligacion ||
        item.origenObligacion ||
        "-",

      ID_ObligacionPadre:
        item.ID_ObligacionPadre ||
        item.idObligacionPadre ||
        "",

      Observaciones:
        item.Observaciones ||
        item.observaciones ||
        "-",

      NotasInternas:
        item.NotasInternas ||
        item.notasInternas ||
        "",

      id: idObligacion,

      label: `${concepto || "Obligación"} - ${periodo || "-"} - ${
        torre || "-"
      } ${apto || "-"} - $${totalObligacion.toLocaleString("es-CO")}`,
    };
  });
}, [obligaciones, pagosIndexados, habitantesIndexados]);

  const obligacionesFiltradas = useMemo(() => {
    return filasMapeadas
      .filter((fila) => {
        const estado = normalizarEstado(fila.EstadoCalculado);
        const filtroEstado = normalizarEstado(estadoFiltro);

        const estadoOk =
          filtroEstado === "" ||
          filtroEstado === "todos" ||
          estado === filtroEstado;

        const periodo = String(fila.Periodo || "").trim();
        const anioPeriodo = periodo.includes("-")
          ? periodo.split("-")[0]
          : periodo.includes("/")
          ? periodo.split("/")[2] || ""
          : "";

        const anioOk =
          anioFiltro === "" ||
          anioPeriodo === anioFiltro.trim();

        // Torre: con numero debe ser exacta (T2 no trae T21).
        // Solo la letra (T o M) trae todas las torres o manzanas.
        const torreBuscada = claveTorreFiltro(torreFiltro);
        const torreFila = claveTorreFiltro(fila.TorreManzana);

        const torreOk =
          torreBuscada === "" ||
          (/\d/.test(torreBuscada)
            ? torreFila === torreBuscada
            : torreFila.startsWith(torreBuscada));

        // Apto: empieza por lo escrito ("30" trae 301, 302...).
        const aptoBuscado = normalizarApto(aptoFiltro);

        const aptoOk =
          aptoBuscado === "" ||
          normalizarApto(fila.AptoCasa).startsWith(aptoBuscado);

        return estadoOk && anioOk && torreOk && aptoOk;
      })
      .sort((a, b) => {
        const fechaA = obtenerFechaVencimiento(a.Periodo)?.getTime() || 0;
        const fechaB = obtenerFechaVencimiento(b.Periodo)?.getTime() || 0;
        return fechaB - fechaA;
      });
  }, [
    filasMapeadas,
    estadoFiltro,
    anioFiltro,
    torreFiltro,
    aptoFiltro,
  ]);

  const resumen = useMemo(() => {
  const filasVigentes = (obligacionesFiltradas || []).filter((fila) => {
    const estado = normalizarEstado(
      fila.EstadoCalculado || fila.Estado
    );

    const activo = normalizarTexto(
      fila.Activo || "SI"
    );

    return activo !== "NO" && estado !== "anulado";
  });

  const pagados = filasVigentes.filter(
    (fila) =>
      normalizarEstado(fila.EstadoCalculado || fila.Estado) === "pagado"
  );

  const pendientes = filasVigentes.filter(
    (fila) =>
      normalizarEstado(fila.EstadoCalculado || fila.Estado) === "pendiente"
  );

  const morosos = filasVigentes.filter(
    (fila) =>
      normalizarEstado(fila.EstadoCalculado || fila.Estado) === "mora"
  );

  const anulados = (obligacionesFiltradas || []).filter((fila) => {
    const estado = normalizarEstado(
      fila.EstadoCalculado || fila.Estado
    );

    const activo = normalizarTexto(
      fila.Activo || "SI"
    );

    return activo === "NO" || estado === "anulado";
  });

  const carteraEnMora = morosos.reduce(
    (acumulado, fila) =>
      acumulado + (Number(fila.SaldoPendiente) || 0),
    0
  );

  const saldoPendienteTotal = filasVigentes.reduce(
    (acumulado, fila) =>
      acumulado + (Number(fila.SaldoPendiente) || 0),
    0
  );

  const totalPagado = filasVigentes.reduce(
    (acumulado, fila) =>
      acumulado + (Number(fila.TotalPagado) || 0),
    0
  );

  const saldoAFavorTotal = filasVigentes.reduce(
    (acumulado, fila) =>
      acumulado + (Number(fila.SaldoAFavor) || 0),
    0
  );

  const totalObligado = filasVigentes.reduce(
    (acumulado, fila) =>
      acumulado + (Number(fila.TotalObligacion) || 0),
    0
  );

  return {
    totalRegistros: filasVigentes.length,
    totalPagados: pagados.length,
    totalPendientes: pendientes.length,
    totalMora: morosos.length,
    totalAnulados: anulados.length,
    carteraEnMora,
    saldoPendienteTotal,
    totalPagado,
    saldoAFavorTotal,
    totalObligado,
  };
}, [obligacionesFiltradas]);

  const datosGrafico = useMemo(() => {
    const total =
      resumen.totalPagados +
      resumen.totalPendientes +
      resumen.totalMora ||
      1;

    const porcentajePagado = (
      (resumen.totalPagados / total) *
      100
    ).toFixed(1);

    const porcentajePendiente = (
      (resumen.totalPendientes / total) *
      100
    ).toFixed(1);

    const porcentajeMora = (
      (resumen.totalMora / total) *
      100
    ).toFixed(1);

    return {
      porcentajePagado,
      porcentajePendiente,
      porcentajeMora,
    };
  }, [resumen]);

  const obtenerEstadoPago = (fila) => {
    const estado = normalizarEstado(fila.EstadoCalculado || fila.Estado);

    if (estado === "mora") {
      return {
        texto: "En mora",
        fondo: "#fee2e2",
        color: "#b91c1c",
        borde: "#fecaca",
      };
    }

    if (estado === "pendiente") {
      return {
        texto: "Pendiente",
        fondo: "#fef3c7",
        color: "#b45309",
        borde: "#fde68a",
      };
    }

    return {
      texto: "Pagado",
      fondo: "#dcfce7",
      color: "#166534",
      borde: "#bbf7d0",
    };
  };

  // El formulario carga la cartera desde el backend y guarda el pago.
  const abrirModalPago = () => setShowPagoModal(true);

  const pagoGuardado = async () => {
    await recargarDatos();
    setShowPagoModal(false);
  };

  const exportarExcel = () => {
    if (!obligacionesFiltradas.length) {
      alert("No hay datos para exportar.");
      return;
    }

    const datosExportar = obligacionesFiltradas.map((fila) => ({
      ID_Obligacion: fila.ID_Obligacion,
      Inmueble: `${fila.TorreManzana} - ${fila.AptoCasa}`,
      Residente: fila.NombreResidente,
      Documento: fila.DocumentoResidente,
      Telefono: fila.Telefono,
      Periodo: fila.Periodo,
      Concepto: fila.Concepto,
      Subconcepto: fila.Subconcepto,
      FechaPago: fechaPagoExportable(fila.FechaPago),
      ValorBase: fila.ValorBase,
      Intereses: fila.Intereses,
      OtrosCobros: fila.OtrosCobros,
      TotalObligacion: fila.TotalObligacion,
      TotalPagado: fila.TotalPagado,
      SaldoPendiente: fila.SaldoPendiente,
      Estado: obtenerEstadoPago(fila).texto,
      Observaciones: fila.Observaciones,
    }));

    const ws = XLSX.utils.json_to_sheet(datosExportar);

    // La columna FechaPago se muestra en Excel como 4/03/2026.
    const columnaFecha = Object.keys(datosExportar[0]).indexOf("FechaPago");

    if (columnaFecha >= 0) {
      datosExportar.forEach((_, indice) => {
        const celda = ws[XLSX.utils.encode_cell({ r: indice + 1, c: columnaFecha })];

        if (celda && celda.t === "n") {
          celda.z = "d/mm/yyyy";
        }
      });
    }

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "InformeMorosidad");

    const wbout = XLSX.write(wb, {
      type: "array",
      bookType: "xlsx",
    });

    saveAs(
      new Blob([wbout], {
        type: "application/octet-stream",
      }),
      "informe_cartera_morosidad.xlsx"
    );
  };

  const exportarPDF = () => {
    if (!obligacionesFiltradas.length) {
      alert("No hay datos para exportar.");
      return;
    }

    const doc = new jsPDF("l", "pt", "a4");

    doc.setFontSize(14);
    doc.text("Informe de cartera y morosidad", 40, 40);

    doc.setFontSize(9);
    doc.text(
      `Estado: ${estadoFiltro} | Año: ${
        anioFiltro || "Todos"
      } | Registros: ${obligacionesFiltradas.length}`,
      40,
      58
    );

    const filasPDF = obligacionesFiltradas.map((fila) => [
      fila.ID_Obligacion,
      `${fila.TorreManzana} - ${fila.AptoCasa}`,
      fila.NombreResidente,
      fila.Periodo,
      fila.Concepto,
      fila.Subconcepto,
      fila.FechaPago,
      `$ ${Number(fila.TotalObligacion).toLocaleString("es-CO")}`,
      `$ ${Number(fila.TotalPagado).toLocaleString("es-CO")}`,
      `$ ${Number(fila.SaldoPendiente).toLocaleString("es-CO")}`,
      obtenerEstadoPago(fila).texto,
    ]);

    autoTable(doc, {
      startY: 76,
      head: [[
        "ID obligación",
        "Inmueble",
        "Residente",
        "Período",
        "Concepto",
        "Subconcepto",
        "Fecha pago",
        "Total obligación",
        "Pagado",
        "Saldo",
        "Estado",
      ]],
      body: filasPDF,
      styles: {
        fontSize: 7,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [24, 138, 172],
        textColor: 255,
        fontStyle: "bold",
      },
    });

    doc.save("informe_cartera_morosidad.pdf");
  };

  const thPago = {
    padding: "12px 14px",
    textAlign: "left",
    fontWeight: 700,
    color: "#0f172a",
    whiteSpace: "nowrap",
    fontSize: "0.9rem",
  };

  const tdPago = {
    padding: "11px 14px",
    borderBottom: "1px solid #e5e7eb",
    textAlign: "left",
    whiteSpace: "nowrap",
    color: "#334155",
    fontSize: "0.9rem",
  };

  const botonExcel = {
    padding: "8px 14px",
    borderRadius: "8px",
    border: "none",
    background: "#22c55e",
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "0.9em",
  };

  const botonPDF = {
    padding: "8px 14px",
    borderRadius: "8px",
    border: "none",
    background: "#ef4444",
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "0.9em",
  };

  const botonLimpiar = {
    padding: "9px 14px",
    borderRadius: "8px",
    border: "none",
    background: "#e5e7eb",
    cursor: "pointer",
    fontSize: "0.92em",
    fontWeight: 600,
    width: "100%",
  };

  const inputFiltro = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "0.92rem",
    background: "#fff",
  };

  const labelFiltro = {
    display: "block",
    fontSize: "0.86rem",
    color: "#475569",
    marginBottom: "6px",
    fontWeight: 600,
  };

  const botonEditarMini = {
    padding: "5px 10px",
    borderRadius: "6px",
    border: "none",
    background: "#3b82f6",
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "0.82em",
  };

  const sinDatos = !cargando && obligaciones.length === 0;
  const sinResultados =
    !cargando &&
    obligaciones.length > 0 &&
    obligacionesFiltradas.length === 0;

  return (
    <div
      style={{
        marginTop: "24px",
        marginLeft: "auto",
        marginRight: "auto",
        padding: "10px 0 24px",
        maxWidth: "95vw",
        width: "100%",
        background: "transparent",
      }}
    >
      <div style={{ marginBottom: "18px" }}>
        <h2
          style={{
            margin: "0 0 6px 0",
            color: "#0f766e",
            fontSize: "1.8rem",
          }}
        >
          Informe de cartera y morosidad
        </h2>

        <p
          style={{
            margin: 0,
            color: "#64748b",
            fontSize: "0.98rem",
          }}
        >
          Controla obligaciones, pagos aplicados, saldos pendientes y mora por inmueble y período.
        </p>
      </div>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "16px",
          marginBottom: "18px",
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            marginBottom: "14px",
          }}
        >
          <button
            onClick={recargarDatos}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: "#0ea5e9",
              color: "#fff",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "0.92em",
            }}
          >
            Recargar datos
          </button>

          <span
            style={{
              fontSize: "0.92em",
              color: "#64748b",
            }}
          >
            {cargando && "Cargando pagos y obligaciones..."}

            {!cargando &&
              obligaciones.length > 0 &&
              `Obligaciones cargadas: ${obligaciones.length} | Pagos cargados: ${pagos.length} | Registros mostrados: ${obligacionesFiltradas.length}`}

            {sinDatos && !error && "Sin obligaciones cargadas"}

            {error && (
              <span
                style={{
                  color: "#ef4444",
                  marginLeft: "8px",
                }}
              >
                {error}
              </span>
            )}
          </span>

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={abrirModalPago}
              style={{
                background: "#15aabf",
                color: "#fff",
                border: "none",
                borderRadius: "7px",
                padding: "7px 18px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Registrar pago recibido
            </button>

            <button
              type="button"
              onClick={() => setMostrarLiquidacion((v) => !v)}
              style={{
                background: "#7c3aed",
                color: "#fff",
                border: "none",
                borderRadius: "7px",
                padding: "7px 18px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Liquidar intereses
            </button>

            <button
              type="button"
              onClick={() => setMostrarRecordatorios(true)}
              style={{
                background: "#16a34a",
                color: "#fff",
                border: "none",
                borderRadius: "7px",
                padding: "7px 18px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Recordar a morosos
            </button>

            <button
              type="button"
              onClick={() => setMostrarPazYSalvo(true)}
              style={{
                background: "#0f766e",
                color: "#fff",
                border: "none",
                borderRadius: "7px",
                padding: "7px 18px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Paz y salvo
            </button>

            <button onClick={exportarExcel} style={botonExcel}>
              Exportar Excel
            </button>

            <button onClick={exportarPDF} style={botonPDF}>
              Exportar PDF
            </button>
          </div>
        </div>

        {mostrarPazYSalvo && (
          <PazYSalvo
            usuario={{ nombre: usuario?.nombre || usuario?.usuario || "Administrador" }}
            onCerrar={() => setMostrarPazYSalvo(false)}
          />
        )}

        {mostrarRecordatorios && (
          <RecordatoriosMorosos
            enviadoPor={usuario?.nombre || usuario?.usuario || "Administrador"}
            onCerrar={() => setMostrarRecordatorios(false)}
          />
        )}

        {mostrarLiquidacion && (
          <LiquidacionIntereses
            onLiquidado={recargarDatos}
            onCerrar={() => setMostrarLiquidacion(false)}
          />
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "12px",
            alignItems: "end",
          }}
        >
          <div>
            <label style={labelFiltro}>Estado</label>

            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              style={inputFiltro}
            >
              <option value="Todos">Todos</option>
              <option value="Mora">Solo en mora</option>
              <option value="Pagado">Solo pagados</option>
              <option value="Pendiente">Solo pendientes</option>
            </select>
          </div>

          <div>
            <label style={labelFiltro}>Año (período)</label>

            <input
              type="text"
              placeholder="Ej: 2026"
              value={anioFiltro}
              onChange={(e) => setAnioFiltro(e.target.value)}
              style={inputFiltro}
            />
          </div>

          <div>
            <label style={labelFiltro}>Torre/Manzana</label>

            <input
              type="text"
              placeholder="Ej: T-2, M-7"
              value={torreFiltro}
              onChange={(e) => setTorreFiltro(e.target.value)}
              style={inputFiltro}
            />
          </div>

          <div>
            <label style={labelFiltro}>Apto/Casa</label>

            <input
              type="text"
              placeholder="Ej: 302, 12"
              value={aptoFiltro}
              onChange={(e) => setAptoFiltro(e.target.value)}
              style={inputFiltro}
            />
          </div>

          <div>
            <button
              onClick={() => {
                setEstadoFiltro("Todos");
                setAnioFiltro("");
                setTorreFiltro("");
                setAptoFiltro("");
                setMostrarTabla(true);
              }}
              style={botonLimpiar}
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      {mostrarTabla && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
            marginBottom: "22px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              padding: "16px 18px",
              borderBottom: "1px solid #e2e8f0",
              background: "#f8fafc",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h3
                style={{
                  margin: "0 0 4px 0",
                  fontSize: "1.05rem",
                  color: "#0f172a",
                }}
              >
                Tabla de cartera y morosidad
              </h3>

              <p
                style={{
                  margin: 0,
                  fontSize: "0.9rem",
                  color: "#64748b",
                }}
              >
                Esta tabla se ocultará automáticamente en{" "}
                {Math.ceil(tiempoRestante / 60)} min.
              </p>
            </div>

            <button
              onClick={() => setMostrarTabla(false)}
              style={{
                padding: "8px 14px",
                borderRadius: "999px",
                border: "none",
                background: "#f97316",
                color: "#fff",
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: "0.9em",
                boxShadow: "0 3px 10px rgba(249,115,22,0.35)",
              }}
            >
              Ocultar tabla
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: "1750px",
                borderCollapse: "collapse",
                fontSize: "0.93em",
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: "#ecfeff",
                    borderBottom: "2px solid #cbd5e1",
                  }}
                >
                  <th style={thPago}>ID obligación</th>
                  <th style={thPago}>Inmueble</th>
                  <th style={thPago}>Residente</th>
                  <th style={thPago}>Documento</th>
                  <th style={thPago}>Período</th>
                  <th style={thPago}>Concepto</th>
                  <th style={thPago}>Subconcepto</th>
                  <th style={thPago}>Fecha pago</th>
                  <th style={thPago}>Valor base</th>
                  <th style={thPago}>Intereses</th>
                  <th style={thPago}>Otros cobros</th>
                  <th style={thPago}>Total obligación</th>
                  <th style={thPago}>Total pagado</th>
                  <th style={thPago}>Saldo pendiente</th>
                  <th style={thPago}>Estado</th>
                  <th style={thPago}>Observaciones</th>
                  <th style={thPago}>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {cargando ? (
                  <tr>
                    <td
                      colSpan={17}
                      style={{
                        ...tdPago,
                        textAlign: "center",
                        padding: "18px",
                        color: "#64748b",
                      }}
                    >
                      Cargando pagos y obligaciones...
                    </td>
                  </tr>
                ) : sinDatos ? (
                  <tr>
                    <td
                      colSpan={17}
                      style={{
                        ...tdPago,
                        textAlign: "center",
                        padding: "18px",
                        color: "#64748b",
                        fontStyle: "italic",
                      }}
                    >
                      No hay obligaciones registradas.
                    </td>
                  </tr>
                ) : sinResultados ? (
                  <tr>
                    <td
                      colSpan={17}
                      style={{
                        ...tdPago,
                        textAlign: "center",
                        padding: "18px",
                        color: "#64748b",
                        fontStyle: "italic",
                      }}
                    >
                      No hay datos que coincidan con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  obligacionesFiltradas.map((fila, idx) => {
                    const estadoVisual = obtenerEstadoPago(fila);

                    return (
                      <tr
                        key={fila.ID_Obligacion}
                        style={{
                          borderBottom: "1px solid #e5e7eb",
                          backgroundColor:
                            idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                        }}
                      >
                        <td style={tdPago}>{fila.ID_Obligacion}</td>

                        <td style={tdPago}>
                          {fila.TorreManzana} - {fila.AptoCasa}
                        </td>

                        <td style={tdPago}>{fila.NombreResidente}</td>

                        <td style={tdPago}>{fila.DocumentoResidente}</td>

                        <td style={tdPago}>{fila.Periodo}</td>

                        <td style={tdPago}>{fila.Concepto}</td>

                        <td style={tdPago}>{fila.Subconcepto}</td>

                        <td style={tdPago}>{fila.FechaPago}</td>

                        <td style={tdPago}>
                          ${Number(fila.ValorBase).toLocaleString("es-CO")}
                        </td>

                        <td style={tdPago}>
                          ${Number(fila.Intereses).toLocaleString("es-CO")}
                        </td>

                        <td style={tdPago}>
                          ${Number(fila.OtrosCobros).toLocaleString("es-CO")}
                        </td>

                        <td
                          style={{
                            ...tdPago,
                            fontWeight: 700,
                            color: "#0f172a",
                          }}
                        >
                          $
                          {Number(fila.TotalObligacion).toLocaleString(
                            "es-CO"
                          )}
                        </td>

                        <td
                          style={{
                            ...tdPago,
                            fontWeight: 700,
                            color:
                              Number(fila.TotalPagado) > 0
                                ? "#166534"
                                : "#64748b",
                          }}
                        >
                          $
                          {Number(fila.TotalPagado).toLocaleString("es-CO")}
                        </td>

                        <td
                          style={{
                            ...tdPago,
                            fontWeight: 700,
                            color:
                              Number(fila.SaldoPendiente) > 0
                                ? "#b91c1c"
                                : "#166534",
                          }}
                        >
                          $
                          {Number(fila.SaldoPendiente).toLocaleString(
                            "es-CO"
                          )}
                        </td>

                        <td style={tdPago}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "6px 12px",
                              borderRadius: "999px",
                              fontSize: "0.82rem",
                              fontWeight: 700,
                              background: estadoVisual.fondo,
                              color: estadoVisual.color,
                              border: `1px solid ${estadoVisual.borde}`,
                            }}
                          >
                            {estadoVisual.texto}
                          </span>
                        </td>

                        <td style={tdPago}>{fila.Observaciones}</td>

                        <td
                          style={{
                            ...tdPago,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <button
                            disabled
                            style={{
                              ...botonEditarMini,
                              opacity: 0.5,
                              cursor: "not-allowed",
                            }}
                            title="La edición de obligaciones estará disponible próximamente"
                          >
                            Próximamente
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!mostrarTabla && (
        <p
          style={{
            color: "#9ca3af",
            fontSize: "0.92em",
            marginTop: 0,
          }}
        >
          La tabla está oculta. Puedes volver a mostrarla con “Recargar datos”
          o cambiando algún filtro.
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(250px, 320px) 1fr",
          gap: "24px",
          alignItems: "center",
          maxWidth: "1120px",
          margin: "8px auto 0",
        }}
      >
        <div
          style={{
            padding: "18px",
            borderRadius: "16px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
            minHeight: "190px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <h3
            style={{
              margin: "0 0 10px 0",
              fontSize: "1rem",
              color: "#0f172a",
            }}
          >
            Resumen visual
          </h3>

          <p style={{ margin: "0 0 6px 0", fontSize: "0.92rem" }}>
            Registros filtrados: <strong>{resumen.totalRegistros}</strong>
          </p>

          <p style={{ margin: "0 0 6px 0", fontSize: "0.92rem" }}>
            Pagados:{" "}
            <strong style={{ color: "#166534" }}>
              {resumen.totalPagados}
            </strong>
          </p>

          <p style={{ margin: "0 0 6px 0", fontSize: "0.92rem" }}>
            Pendientes:{" "}
            <strong style={{ color: "#b45309" }}>
              {resumen.totalPendientes}
            </strong>
          </p>

          <p style={{ margin: "0 0 6px 0", fontSize: "0.92rem" }}>
            En mora:{" "}
            <strong style={{ color: "#b91c1c" }}>
              {resumen.totalMora}
            </strong>
          </p>

          <p style={{ margin: "0 0 6px 0", fontSize: "0.92rem" }}>
            Total pagado:{" "}
            <strong style={{ color: "#166534" }}>
              $
              {resumen.totalPagado.toLocaleString("es-CO")}
            </strong>
          </p>

          <p style={{ margin: "0 0 6px 0", fontSize: "0.92rem" }}>
            Saldo pendiente:{" "}
            <strong style={{ color: "#b45309" }}>
              $
              {resumen.saldoPendienteTotal.toLocaleString("es-CO")}
            </strong>
          </p>

          <p style={{ margin: 0, fontSize: "0.92rem" }}>
            Cartera en mora:{" "}
            <strong style={{ color: "#b91c1c" }}>
              $
              {resumen.carteraEnMora.toLocaleString("es-CO")}
            </strong>
          </p>
        </div>

        <div
          style={{
            textAlign: "center",
            padding: "8px 0",
          }}
        >
          <div
            style={{
              width: "190px",
              height: "190px",
              borderRadius: "50%",
              margin: "0 auto 10px",
              backgroundImage: `conic-gradient(
                #16a34a 0 ${datosGrafico.porcentajePagado}%,
                #f59e0b ${datosGrafico.porcentajePagado}% ${
                Number(datosGrafico.porcentajePagado) +
                Number(datosGrafico.porcentajePendiente)
              }%,
                #ef4444 ${
                  Number(datosGrafico.porcentajePagado) +
                  Number(datosGrafico.porcentajePendiente)
                }% 100%
              )`,
              boxShadow: "0 6px 18px rgba(0,0,0,0.14)",
            }}
          />

          <div
            style={{
              fontSize: "0.92em",
              color: "#334155",
              marginBottom: "4px",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "10px",
                height: "10px",
                borderRadius: "999px",
                background: "#16a34a",
                marginRight: "6px",
              }}
            />
            Pagado: {datosGrafico.porcentajePagado}% (
            {resumen.totalPagados})
          </div>

          <div
            style={{
              fontSize: "0.92em",
              color: "#334155",
              marginBottom: "4px",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "10px",
                height: "10px",
                borderRadius: "999px",
                background: "#f59e0b",
                marginRight: "6px",
              }}
            />
            Pendiente: {datosGrafico.porcentajePendiente}% (
            {resumen.totalPendientes})
          </div>

          <div
            style={{
              fontSize: "0.92em",
              color: "#334155",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "10px",
                height: "10px",
                borderRadius: "999px",
                background: "#ef4444",
                marginRight: "6px",
              }}
            />
            En mora: {datosGrafico.porcentajeMora}% ({resumen.totalMora})
          </div>
        </div>
      </div>

      {showPagoModal && (
        <FormularioPago
          registradoPor={usuario?.nombre || usuario?.usuario || "Administrador"}
          onGuardado={pagoGuardado}
          onClose={() => setShowPagoModal(false)}
        />
      )}
    </div>
  );
}

export default InformeMorosidad;