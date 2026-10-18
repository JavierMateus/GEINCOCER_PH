// routes/liquidacionInteresesRoutes.js
// Liquidacion mensual de intereses de mora (Ley 675 de 2001, art. 30).
//
// Se monta en app.js pasando la carpeta base:
//   const liquidacionInteresesRoutes = require("./routes/liquidacionInteresesRoutes");
//   app.use("/api/liquidacion-intereses", liquidacionInteresesRoutes(baseResidencialDir));
//
// Rutas:
//   GET  /api/liquidacion-intereses/previa?corte=2026-09   -> calcula sin guardar
//   POST /api/liquidacion-intereses/confirmar { corte }     -> calcula y guarda
//
// Reglas:
//   - Solo generan interes los conceptos de CONCEPTOS_CON_INTERES.
//   - El interes se calcula sobre el capital (ValorBase) pendiente, nunca
//     sobre otros intereses (anatocismo prohibido, art. 2235 C.C.).
//   - Cada dia usa la tasa de su mes, tomada de TasasInteres.csv.
//   - El interes corre desde el dia siguiente al vencimiento hasta el
//     corte, o hasta el pago si el capital se pago antes.
//   - En las obligaciones de interes, FechaGeneracion = fecha hasta la
//     cual ya se liquido. Asi no se cobra dos veces el mismo dia.
//   - Antes de guardar se hace una copia de respaldo del archivo.

const express = require("express");
const fs = require("fs");
const path = require("path");

const ARCHIVO_OBLIGACIONES = "obligaciones_residente.csv";
const ARCHIVO_PAGOS = "Pagos.csv";
const ARCHIVO_TASAS = "TasasInteres.csv";
const CARPETA_RESPALDOS = "respaldos";

// Conceptos que generan interes de mora. Las multas y las reservas
// no estan incluidas. Si el reglamento del conjunto lo permite, se agregan aqui.
const CONCEPTOS_CON_INTERES = ["administracion", "extraordinaria"];

const DIA_VENCIMIENTO = 10;
const MS_DIA = 24 * 60 * 60 * 1000;

// ------------------------------------------------------------------
// Lectura y escritura de CSV
// ------------------------------------------------------------------

const leerTexto = (ruta) => {
  const buffer = fs.readFileSync(ruta);
  const utf8 = buffer.toString("utf8");
  const texto = utf8.includes("\uFFFD") ? buffer.toString("latin1") : utf8;

  return {
    texto: texto.replace(/^\uFEFF/, ""),
    tieneBOM: utf8.charCodeAt(0) === 0xfeff,
    finLinea: texto.includes("\r\n") ? "\r\n" : "\n",
  };
};

const leerCSV = (ruta) => {
  const { texto, tieneBOM, finLinea } = leerTexto(ruta);

  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");

  if (!lineas.length) return { encabezados: [], filas: [], tieneBOM, finLinea };

  const encabezados = lineas[0].split(";").map((e) => e.trim());

  const filas = lineas.slice(1).map((linea) => {
    const valores = linea.split(";");
    const fila = {};

    encabezados.forEach((enc, i) => {
      fila[enc] = (valores[i] ?? "").trim();
    });

    return fila;
  });

  return { encabezados, filas, tieneBOM, finLinea };
};

// Un punto y coma dentro de un texto romperia las columnas.
const limpiarCelda = (valor) =>
  String(valor ?? "").replace(/[;\r\n]+/g, ", ").trim();

const escribirCSV = (ruta, { encabezados, filas, tieneBOM, finLinea }) => {
  const lineas = [
    encabezados.join(";"),
    ...filas.map((fila) => encabezados.map((enc) => limpiarCelda(fila[enc])).join(";")),
  ];

  const contenido = (tieneBOM ? "\uFEFF" : "") + lineas.join(finLinea) + finLinea;

  fs.writeFileSync(ruta, contenido, "utf8");
};

// ------------------------------------------------------------------
// Utilidades de fechas y numeros
// ------------------------------------------------------------------

const aNumero = (valor) => {
  const texto = String(valor ?? "").trim();
  if (!texto) return 0;
  // Acepta 28,79 y 28.79
  const normal = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
  const n = Number(normal.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

// Fechas como dias UTC enteros: evita los corrimientos por zona horaria.
const diaUTC = (anio, mes, dia) => Date.UTC(anio, mes - 1, dia) / MS_DIA;

const leerFecha = (valor) => {
  const texto = String(valor || "").trim();

  let p = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (p) return diaUTC(Number(p[1]), Number(p[2]), Number(p[3]));

  p = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) return diaUTC(Number(p[3]), Number(p[2]), Number(p[1]));

  return null;
};

const fechaVisual = (dia) => {
  const f = new Date(dia * MS_DIA);
  return `${f.getUTCDate()}/${String(f.getUTCMonth() + 1).padStart(2, "0")}/${f.getUTCFullYear()}`;
};

const mesDeDia = (dia) => {
  const f = new Date(dia * MS_DIA);
  return `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, "0")}`;
};

const ultimoDiaDelMes = (mes) => {
  const [anio, m] = mes.split("-").map(Number);
  return diaUTC(anio, m + 1, 1) - 1;
};

const mesSiguiente = (mes) => {
  const [anio, m] = mes.split("-").map(Number);
  return m === 12 ? `${anio + 1}-01` : `${anio}-${String(m + 1).padStart(2, "0")}`;
};

const normalizar = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const formatoTasa = (tasa) => `${String(tasa).replace(".", ",")} %`;

// ------------------------------------------------------------------
// Calculo
// ------------------------------------------------------------------

const cargarTasas = (dir) => {
  const ruta = path.join(dir, ARCHIVO_TASAS);

  if (!fs.existsSync(ruta)) {
    throw new Error(`No se encontro ${ARCHIVO_TASAS} en ${dir}`);
  }

  const { filas } = leerCSV(ruta);
  const tasas = {};
  const advertencias = [];

  filas.forEach((f) => {
    const mes = String(f.Mes || "").trim();
    if (!/^\d{4}-\d{2}$/.test(mes)) return;

    const ibc = aNumero(f.InteresBancarioCorriente);
    const maxima = aNumero(f.TasaMoraMaxima) || ibc * 1.5;
    const aplicada = aNumero(f.TasaMoraAplicada) || maxima;
    const limiteLegal = ibc * 1.5;

    if (ibc > 0 && aplicada > limiteLegal + 0.01) {
      advertencias.push(
        `La tasa de ${mes} (${formatoTasa(aplicada)}) supera 1,5 veces el interés bancario corriente (${formatoTasa(limiteLegal.toFixed(2))}). Se usó el límite legal.`
      );
      tasas[mes] = limiteLegal;
      return;
    }

    tasas[mes] = aplicada;
  });

  return { tasas, advertencias };
};

// Capital pagado a una obligacion, por dia de pago.
const pagosDeCapital = (pagos, idObligacion) =>
  pagos
    .filter((p) => String(p.ID_Obligacion || "").trim() === idObligacion)
    .filter((p) => normalizar(p.EstadoPago || p.Estado || "pagado").includes("pag"))
    .filter((p) => normalizar(p.ValidoParaConciliacion || "si") !== "no")
    .map((p) => {
      const total = aNumero(p.TotalAplicado) || aNumero(p.ValorPagado);
      const intereses = aNumero(p.InteresesPagados);
      return {
        dia: leerFecha(p.FechaPago),
        capital: Math.max(total - intereses, 0),
      };
    })
    .filter((p) => p.dia !== null && p.capital > 0)
    .sort((a, b) => a.dia - b.dia);

const calcularLiquidacion = (dir, corteMes) => {
  if (!/^\d{4}-\d{2}$/.test(String(corteMes || ""))) {
    throw new Error("El mes de corte debe tener el formato AAAA-MM, por ejemplo 2026-09.");
  }

  const diaCorte = ultimoDiaDelMes(corteMes);

  // No se pueden liquidar dias que todavia no han pasado.
  const hoy = new Date();
  const diaHoy = diaUTC(hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate());

  if (diaCorte >= diaHoy) {
    throw new Error(
      `El mes ${corteMes} todavía no ha terminado. Solo se pueden liquidar meses cerrados.`
    );
  }
  const periodoCobro = mesSiguiente(corteMes);
  const [anioCobro, mesCobro] = periodoCobro.split("-").map(Number);
  const vencimientoCobro = diaUTC(anioCobro, mesCobro, DIA_VENCIMIENTO);

  const { filas: obligaciones } = leerCSV(path.join(dir, ARCHIVO_OBLIGACIONES));
  const { filas: pagos } = leerCSV(path.join(dir, ARCHIVO_PAGOS));
  const { tasas, advertencias } = cargarTasas(dir);

  // Hasta que dia se liquido ya cada obligacion.
  const liquidadoHasta = {};

  obligaciones
    .filter((o) => normalizar(o.Concepto) === "interes_mora")
    .filter((o) => normalizar(o.Activo || "si") !== "no")
    .forEach((o) => {
      const padre = String(o.ID_ObligacionPadre || "").trim();
      const hasta = leerFecha(o.FechaGeneracion);
      if (!padre || hasta === null) return;
      liquidadoHasta[padre] = Math.max(liquidadoHasta[padre] ?? -Infinity, hasta);
    });

  const items = [];
  const mesesSinTasa = new Set();

  obligaciones.forEach((o) => {
    const id = String(o.ID_Obligacion || "").trim();
    const concepto = normalizar(o.Concepto);

    if (!id) return;
    if (normalizar(o.Activo || "si") === "no") return;
    if (!CONCEPTOS_CON_INTERES.includes(concepto)) return;

    const capitalInicial = aNumero(o.ValorBase);
    const vencimiento = leerFecha(o.FechaVencimiento);

    if (capitalInicial <= 0 || vencimiento === null) return;

    const desde = Math.max(vencimiento + 1, (liquidadoHasta[id] ?? -Infinity) + 1);

    if (desde > diaCorte) return;

    const pagosCapital = pagosDeCapital(pagos, id);

    // Capital pagado antes de que empiece este tramo.
    let capitalPagado = pagosCapital
      .filter((p) => p.dia < desde)
      .reduce((acc, p) => acc + p.capital, 0);

    let interes = 0;
    let diasMora = 0;
    let primerDia = null;
    let ultimoDia = null;
    const tasasUsadas = {};

    for (let dia = desde; dia <= diaCorte; dia += 1) {
      // Pagos hechos ese dia reducen el capital desde ese mismo dia.
      pagosCapital
        .filter((p) => p.dia === dia)
        .forEach((p) => {
          capitalPagado += p.capital;
        });

      const capital = Math.max(capitalInicial - capitalPagado, 0);
      if (capital <= 0) break;

      const mes = mesDeDia(dia);
      const tasaAnual = tasas[mes];

      if (!tasaAnual) {
        mesesSinTasa.add(mes);
        continue;
      }

      const tasaDiaria = Math.pow(1 + tasaAnual / 100, 1 / 365) - 1;

      interes += capital * tasaDiaria;
      diasMora += 1;
      tasasUsadas[mes] = tasaAnual;
      if (primerDia === null) primerDia = dia;
      ultimoDia = dia;
    }

    const valor = Math.round(interes);
    if (valor <= 0) return;

    items.push({
      ID_ObligacionPadre: id,
      DocumentoResidente: o.DocumentoResidente,
      NombreResidente: o.NombreResidente,
      TorreManzana: o.TorreManzana,
      AptoCasa: o.AptoCasa,
      ConceptoPadre: o.Concepto,
      PeriodoPadre: o.Periodo,
      CapitalBase: Math.max(capitalInicial - capitalPagado, 0),
      Desde: fechaVisual(primerDia),
      Hasta: fechaVisual(ultimoDia),
      DiasMora: diasMora,
      Tasas: Object.entries(tasasUsadas).map(([mes, tasa]) => `${mes}: ${formatoTasa(tasa)}`),
      Interes: valor,
    });
  });

  return {
    corte: corteMes,
    fechaCorte: fechaVisual(diaCorte),
    periodoCobro,
    vencimientoCobro: fechaVisual(vencimientoCobro),
    items,
    total: items.reduce((acc, it) => acc + it.Interes, 0),
    mesesSinTasa: [...mesesSinTasa].sort(),
    advertencias,
  };
};

// ------------------------------------------------------------------
// Rutas
// ------------------------------------------------------------------

module.exports = (baseResidencialDir) => {
  const router = express.Router();

  router.get("/previa", (req, res) => {
    try {
      const resultado = calcularLiquidacion(baseResidencialDir, req.query.corte);
      return res.json({ ok: true, ...resultado });
    } catch (err) {
      console.error("Error en vista previa de liquidacion:", err);
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post("/confirmar", (req, res) => {
    try {
      const corte = req.body?.corte;
      const resultado = calcularLiquidacion(baseResidencialDir, corte);

      if (resultado.mesesSinTasa.length) {
        return res.status(400).json({
          ok: false,
          error: `Faltan tasas en TasasInteres.csv para: ${resultado.mesesSinTasa.join(", ")}. Regístralas antes de liquidar.`,
        });
      }

      if (!resultado.items.length) {
        return res.json({ ok: true, creadas: [], mensaje: "No hay intereses por liquidar en este corte." });
      }

      const rutaObligaciones = path.join(baseResidencialDir, ARCHIVO_OBLIGACIONES);
      const csv = leerCSV(rutaObligaciones);

      // Respaldo antes de escribir.
      const carpetaRespaldos = path.join(baseResidencialDir, CARPETA_RESPALDOS);
      if (!fs.existsSync(carpetaRespaldos)) fs.mkdirSync(carpetaRespaldos, { recursive: true });

      const sello = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const rutaRespaldo = path.join(
        carpetaRespaldos,
        `obligaciones_residente_antes_liquidacion_${corte}_${sello}.csv`
      );
      fs.copyFileSync(rutaObligaciones, rutaRespaldo);

      // Siguiente numero OBL-####
      let ultimo = csv.filas.reduce((max, f) => {
        const n = Number(String(f.ID_Obligacion || "").replace(/\D/g, ""));
        return Number.isFinite(n) && n > max ? n : max;
      }, 0);

      const creadas = resultado.items.map((it) => {
        ultimo += 1;
        const id = `OBL-${String(ultimo).padStart(4, "0")}`;

        const fila = {};
        csv.encabezados.forEach((enc) => {
          fila[enc] = "";
        });

        Object.assign(fila, {
          ID_Obligacion: id,
          DocumentoResidente: it.DocumentoResidente,
          NombreResidente: it.NombreResidente,
          TorreManzana: it.TorreManzana,
          AptoCasa: it.AptoCasa,
          Periodo: resultado.periodoCobro,
          Concepto: "interes_mora",
          Subconcepto: `interes_${normalizar(it.ConceptoPadre)}`,
          ValorBase: "0",
          Intereses: String(it.Interes),
          OtrosCobros: "0",
          TotalObligacion: String(it.Interes),
          SaldoPendiente: String(it.Interes),
          FechaGeneracion: resultado.fechaCorte,
          FechaVencimiento: resultado.vencimientoCobro,
          FechaPago: "",
          EstadoCalculado: "pendiente",
          Activo: "SI",
          OrigenObligacion: "liquidacion_automatica",
          ID_ObligacionPadre: it.ID_ObligacionPadre,
          Observaciones: `Interés de mora de ${it.ID_ObligacionPadre}: ${it.DiasMora} días (${it.Desde} al ${it.Hasta})`,
          NotasInternas: `Liquidación con corte ${resultado.fechaCorte}. Tasas ${it.Tasas.join(" / ")}`,
        });

        csv.filas.push(fila);
        return { ...it, ID_Obligacion: id };
      });

      escribirCSV(rutaObligaciones, csv);

      return res.json({
        ok: true,
        creadas,
        total: resultado.total,
        respaldo: rutaRespaldo,
      });
    } catch (err) {
      console.error("Error confirmando liquidacion:", err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
};

// Exportado para pruebas.
module.exports.calcularLiquidacion = calcularLiquidacion;