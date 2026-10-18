// routes/cuotasRoutes.js
// Generacion de la cuota de administracion del mes para todos los inmuebles.
//
// Se monta en app.js:
//   const cuotasRoutes = require("./routes/cuotasRoutes");
//   app.use("/api/cuotas", cuotasRoutes(baseResidencialDir));
//
// Rutas:
//   GET  /api/cuotas/config                 -> valores actuales
//   POST /api/cuotas/config                 -> guarda valores { valorApartamento, valorCasa, diaVencimiento }
//   GET  /api/cuotas/previa?periodo=2026-11 -> calcula sin guardar
//   POST /api/cuotas/generar { periodo, registradoPor } -> guarda en obligaciones_residente.csv
//
// Reglas:
//   - Una cuota por inmueble (Torre/Manzana + Apto/Casa) con residentes activos en el periodo.
//   - Valor por tipo: torre (T-) = apartamento, manzana (M-) = casa. Se toma de ConfigCuotas.csv.
//   - Queda a nombre del Propietario activo. Si no hay, del Arrendatario.
//   - Si el inmueble ya tiene la cuota ordinaria de ese periodo, no se repite.
//   - Vence el dia configurado (10) del mismo mes.
//   - Antes de guardar se hace una copia de respaldo.

const express = require("express");
const fs = require("fs");
const path = require("path");

const ARCHIVO_OBLIGACIONES = "obligaciones_residente.csv";
const ARCHIVO_HABITANTES = "Habitantes.csv";
const ARCHIVO_CONFIG = "ConfigCuotas.csv";
const CARPETA_RESPALDOS = "respaldos";

const CONFIG_INICIAL = { valorApartamento: 100000, valorCasa: 100000, diaVencimiento: 10 };

const ENCABEZADO_OBLIGACIONES = [
  "ID_Obligacion", "DocumentoResidente", "NombreResidente", "TorreManzana", "AptoCasa",
  "Periodo", "Concepto", "Subconcepto", "ValorBase", "Intereses", "OtrosCobros",
  "TotalObligacion", "SaldoPendiente", "FechaGeneracion", "FechaVencimiento", "FechaPago",
  "EstadoCalculado", "Activo", "OrigenObligacion", "ID_ObligacionPadre", "Observaciones",
  "NotasInternas",
];

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// ------------------------------------------------------------------
// CSV
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
  if (!fs.existsSync(ruta)) return { encabezados: [], filas: [], tieneBOM: false, finLinea: "\r\n" };
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

const limpiarCelda = (valor) => String(valor ?? "").replace(/[;\r\n]+/g, ", ").trim();

const escribirCSV = (ruta, { encabezados, filas, tieneBOM, finLinea }) => {
  const lineas = [
    encabezados.join(";"),
    ...filas.map((fila) => encabezados.map((enc) => limpiarCelda(fila[enc])).join(";")),
  ];
  const temporal = `${ruta}.tmp`;
  fs.writeFileSync(temporal, (tieneBOM ? "\uFEFF" : "") + lineas.join(finLinea) + finLinea, "utf8");
  fs.renameSync(temporal, ruta);
};

// ------------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------------

const normalizar = (v) =>
  String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

const soloDigitos = (v) => String(v ?? "").replace(/\D/g, "");

const aNumero = (v) => {
  const n = Number(String(v ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

// Fecha -> numero AAAAMMDD para comparar. Acepta 4/03/2026 y 2026-03-04.
const claveFecha = (valor) => {
  const t = String(valor ?? "").trim();
  let p = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (p) return Number(p[1]) * 10000 + Number(p[2]) * 100 + Number(p[3]);
  p = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) return Number(p[3]) * 10000 + Number(p[2]) * 100 + Number(p[1]);
  return null;
};

const fechaHoy = () => {
  const f = new Date();
  return `${f.getDate()}/${String(f.getMonth() + 1).padStart(2, "0")}/${f.getFullYear()}`;
};

const periodoActual = () => {
  const f = new Date();
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}`;
};

const ultimoDia = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();

// Ubicacion comparable: "T-2" / "t2" / "Torre 2" -> "T2"; apto sin espacios ni ceros a la izquierda.
const claveUbicacion = (torre, apto) => {
  const t = normalizar(torre).replace(/\s+/g, "").replace(/^(torre)/, "t").replace(/^(manzana|mza|mz)/, "m").replace(/-/g, "");
  const a = normalizar(apto).replace(/\s+/g, "").replace(/^0+(?=\d)/, "");
  return `${t.toUpperCase()}|${a.toUpperCase()}`;
};

const tipoInmueble = (torre) => (normalizar(torre).startsWith("m") ? "Casa" : "Apartamento");

const formatoPesos = (n) => `$${Number(n || 0).toLocaleString("es-CO")}`;

// ------------------------------------------------------------------
// Configuracion (ConfigCuotas.csv: Parametro;Valor)
// ------------------------------------------------------------------

const leerConfig = (baseDir) => {
  const { filas } = leerCSV(path.join(baseDir, ARCHIVO_CONFIG));
  const mapa = Object.fromEntries(filas.map((f) => [f.Parametro, f.Valor]));
  return {
    valorApartamento: aNumero(mapa.ValorCuotaApartamento) || CONFIG_INICIAL.valorApartamento,
    valorCasa: aNumero(mapa.ValorCuotaCasa) || CONFIG_INICIAL.valorCasa,
    diaVencimiento: aNumero(mapa.DiaVencimiento) || CONFIG_INICIAL.diaVencimiento,
    existeArchivo: fs.existsSync(path.join(baseDir, ARCHIVO_CONFIG)),
  };
};

const guardarConfig = (baseDir, config) => {
  escribirCSV(path.join(baseDir, ARCHIVO_CONFIG), {
    encabezados: ["Parametro", "Valor", "Descripcion"],
    filas: [
      { Parametro: "ValorCuotaApartamento", Valor: config.valorApartamento, Descripcion: "Cuota mensual de administracion para inmuebles en torre (T-)" },
      { Parametro: "ValorCuotaCasa", Valor: config.valorCasa, Descripcion: "Cuota mensual de administracion para casas en manzana (M-)" },
      { Parametro: "DiaVencimiento", Valor: config.diaVencimiento, Descripcion: "Dia del mes hasta el cual se paga sin mora" },
    ],
    tieneBOM: true,
    finLinea: "\r\n",
  });
};

// ------------------------------------------------------------------
// Calculo de la vista previa
// ------------------------------------------------------------------

const calcular = (baseDir, periodo) => {
  const [anio, mes] = periodo.split("-").map(Number);
  const inicio = anio * 10000 + mes * 100 + 1;
  const fin = anio * 10000 + mes * 100 + ultimoDia(anio, mes);

  const config = leerConfig(baseDir);
  const dia = Math.min(config.diaVencimiento, ultimoDia(anio, mes));
  const fechaVencimiento = `${dia}/${String(mes).padStart(2, "0")}/${anio}`;

  const habitantes = leerCSV(path.join(baseDir, ARCHIVO_HABITANTES)).filas;
  const obligaciones = leerCSV(path.join(baseDir, ARCHIVO_OBLIGACIONES)).filas;

  // Residentes activos en algun dia del periodo
  const activos = habitantes.filter((h) => {
    if (normalizar(h.Rol) !== "residente") return false;
    if (!h.TorreManzana || !h.AptoCasa) return false;
    const entrada = claveFecha(h.FechaEntrada);
    const salida = claveFecha(h.FechaSalida);
    if (entrada && entrada > fin) return false;
    if (salida && salida < inicio) return false;
    return true;
  });

  // Agrupar por inmueble
  const inmuebles = new Map();
  activos.forEach((h) => {
    const clave = claveUbicacion(h.TorreManzana, h.AptoCasa);
    if (!inmuebles.has(clave)) inmuebles.set(clave, []);
    inmuebles.get(clave).push(h);
  });

  // Cuotas ordinarias ya generadas en ese periodo
  const yaGeneradas = new Map();
  obligaciones.forEach((o) => {
    if (o.Periodo !== periodo) return;
    if (normalizar(o.Concepto) !== "administracion") return;
    if (normalizar(o.Subconcepto) !== "cuota_ordinaria") return;
    if (normalizar(o.Activo) === "no") return;
    yaGeneradas.set(claveUbicacion(o.TorreManzana, o.AptoCasa), o.ID_Obligacion);
  });

  const filas = [...inmuebles.values()].map((personas) => {
    const base = personas[0];
    const propietario = personas.find((p) => normalizar(p.Tipo) === "propietario");
    const arrendatario = personas.find((p) => normalizar(p.Tipo) === "arrendatario");
    const responsable = propietario || arrendatario || null;
    const tipo = tipoInmueble(base.TorreManzana);
    const valor = tipo === "Casa" ? config.valorCasa : config.valorApartamento;
    const existente = yaGeneradas.get(claveUbicacion(base.TorreManzana, base.AptoCasa));

    let estado = "generar";
    let detalle = "";
    if (existente) {
      estado = "existe";
      detalle = `Ya tiene la cuota de este mes (${existente}).`;
    } else if (!responsable) {
      estado = "sin_responsable";
      detalle = "No tiene propietario ni arrendatario activo. Revisa sus datos en Habitantes.";
    } else if (!propietario) {
      detalle = "Sin propietario registrado: queda a nombre del arrendatario.";
    }

    return {
      estado,
      detalle,
      idInmueble: base.ID_Inmueble,
      torreManzana: base.TorreManzana,
      aptoCasa: base.AptoCasa,
      tipo,
      valor,
      documento: soloDigitos(responsable?.DocumentoResidente),
      nombre: responsable?.NombreResidente || "",
      tipoResponsable: responsable?.Tipo || "",
    };
  });

  // Orden: torres y manzanas por numero, luego apto
  const num = (t) => Number(String(t).replace(/\D/g, "")) || 0;
  filas.sort((a, b) =>
    a.torreManzana[0] !== b.torreManzana[0]
      ? a.torreManzana.localeCompare(b.torreManzana)
      : num(a.torreManzana) - num(b.torreManzana) || num(a.aptoCasa) - num(b.aptoCasa)
  );

  const aGenerar = filas.filter((f) => f.estado === "generar");
  const avisos = [];
  if (periodo < periodoActual()) {
    avisos.push("Es un periodo pasado: las cuotas quedarán vencidas desde su fecha de vencimiento y la liquidación de intereses las tomará en cuenta.");
  }
  if (!config.existeArchivo) {
    avisos.push("Aún no has guardado los valores de la cuota: se usan los valores iniciales.");
  }

  return {
    periodo,
    nombreMes: `${MESES[mes - 1]} ${anio}`,
    fechaVencimiento,
    config,
    filas,
    avisos,
    resumen: {
      inmuebles: filas.length,
      aGenerar: aGenerar.length,
      yaExisten: filas.filter((f) => f.estado === "existe").length,
      sinResponsable: filas.filter((f) => f.estado === "sin_responsable").length,
      totalGenerar: aGenerar.reduce((s, f) => s + f.valor, 0),
    },
  };
};

const periodoValido = (p) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(p || ""));

// ------------------------------------------------------------------
// Rutas
// ------------------------------------------------------------------

module.exports = (baseResidencialDir) => {
  const router = express.Router();

  router.get("/config", (req, res) => {
    try {
      return res.json({ ok: true, config: leerConfig(baseResidencialDir) });
    } catch (err) {
      console.error("Error leyendo ConfigCuotas:", err);
      return res.status(500).json({ ok: false, error: "No se pudo leer la configuración de cuotas." });
    }
  });

  router.post("/config", (req, res) => {
    try {
      const valorApartamento = aNumero(req.body?.valorApartamento);
      const valorCasa = aNumero(req.body?.valorCasa);
      const diaVencimiento = aNumero(req.body?.diaVencimiento);
      if (valorApartamento < 1000 || valorCasa < 1000) {
        return res.status(400).json({ ok: false, error: "Los valores de la cuota deben ser de al menos $1.000." });
      }
      if (diaVencimiento < 1 || diaVencimiento > 31) {
        return res.status(400).json({ ok: false, error: "El día de vencimiento debe estar entre 1 y 31." });
      }
      guardarConfig(baseResidencialDir, { valorApartamento, valorCasa, diaVencimiento });
      return res.json({ ok: true, mensaje: "Valores guardados.", config: leerConfig(baseResidencialDir) });
    } catch (err) {
      console.error("Error guardando ConfigCuotas:", err);
      return res.status(500).json({ ok: false, error: "No se pudieron guardar los valores." });
    }
  });

  router.get("/previa", (req, res) => {
    try {
      const periodo = String(req.query.periodo || "");
      if (!periodoValido(periodo)) return res.status(400).json({ ok: false, error: "Elige un periodo válido (año y mes)." });
      return res.json({ ok: true, ...calcular(baseResidencialDir, periodo) });
    } catch (err) {
      console.error("Error calculando cuotas:", err);
      return res.status(500).json({ ok: false, error: "No se pudo calcular la vista previa." });
    }
  });

  router.post("/generar", (req, res) => {
    try {
      const periodo = String(req.body?.periodo || "");
      const registradoPor = String(req.body?.registradoPor || "Administrador");
      if (!periodoValido(periodo)) return res.status(400).json({ ok: false, error: "Elige un periodo válido (año y mes)." });

      const previa = calcular(baseResidencialDir, periodo);
      const aGenerar = previa.filas.filter((f) => f.estado === "generar");
      if (!aGenerar.length) {
        return res.json({ ok: true, creadas: [], mensaje: "No hay cuotas nuevas para generar en este periodo." });
      }

      const rutaObligaciones = path.join(baseResidencialDir, ARCHIVO_OBLIGACIONES);
      const csv = leerCSV(rutaObligaciones);
      if (!csv.encabezados.length) csv.encabezados = [...ENCABEZADO_OBLIGACIONES];

      // Respaldo
      let rutaRespaldo = "";
      if (fs.existsSync(rutaObligaciones)) {
        const carpeta = path.join(baseResidencialDir, CARPETA_RESPALDOS);
        if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });
        const sello = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
        rutaRespaldo = path.join(carpeta, `obligaciones_residente_antes_cuotas_${periodo}_${sello}.csv`);
        fs.copyFileSync(rutaObligaciones, rutaRespaldo);
      }

      let ultimo = Math.max(0, ...csv.filas.map((o) => Number(String(o.ID_Obligacion).replace(/\D/g, "")) || 0));
      const hoy = fechaHoy();

      const creadas = aGenerar.map((f) => {
        ultimo += 1;
        const id = `OBL-${String(ultimo).padStart(4, "0")}`;
        const fila = {};
        csv.encabezados.forEach((c) => {
          fila[c] = "";
        });
        Object.assign(fila, {
          ID_Obligacion: id,
          DocumentoResidente: f.documento,
          NombreResidente: f.nombre,
          TorreManzana: f.torreManzana,
          AptoCasa: f.aptoCasa,
          Periodo: periodo,
          Concepto: "administracion",
          Subconcepto: "cuota_ordinaria",
          ValorBase: String(f.valor),
          Intereses: "0",
          OtrosCobros: "0",
          TotalObligacion: String(f.valor),
          SaldoPendiente: String(f.valor),
          FechaGeneracion: hoy,
          FechaVencimiento: previa.fechaVencimiento,
          FechaPago: "",
          EstadoCalculado: "pendiente",
          Activo: "SI",
          OrigenObligacion: "generacion_mensual",
          ID_ObligacionPadre: "",
          Observaciones: `Cuota ordinaria de ${previa.nombreMes} (${f.tipo.toLowerCase()})`,
          NotasInternas: `Generada por ${registradoPor} el ${hoy}`,
        });
        csv.filas.push(fila);
        return { id, ...f };
      });

      escribirCSV(rutaObligaciones, csv);

      const total = creadas.reduce((s, c) => s + c.valor, 0);
      return res.json({
        ok: true,
        creadas,
        respaldo: rutaRespaldo,
        mensaje: `Se generaron ${creadas.length} cuota(s) de ${previa.nombreMes} por ${formatoPesos(total)}. Vencen el ${previa.fechaVencimiento}.`,
      });
    } catch (err) {
      console.error("Error generando cuotas:", err);
      return res.status(500).json({ ok: false, error: "No se pudieron generar las cuotas." });
    }
  });

  return router;
};