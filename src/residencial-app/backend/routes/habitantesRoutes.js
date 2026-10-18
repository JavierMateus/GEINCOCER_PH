// habitantesRoutes.js
// Habitantes.csv desde BaseResidencial.
//   GET  /api/habitantes           -> lista
//   POST /api/habitantes/validar   -> revisa una carga masiva sin guardar
//   POST /api/habitantes/importar  -> guarda las filas correctas (agrega y actualiza)
//   POST /api/habitantes/guardar   -> agrega o edita un habitante desde el formulario
//   POST /api/habitantes/mis-datos -> el residente actualiza su celular y correo
// Se monta en app.js pasando la carpeta base:
//   const habitantesRoutes = require("./routes/habitantesRoutes");
//   app.use("/api/habitantes", habitantesRoutes(baseResidencialDir));

const express = require("express");
const fs = require("fs");
const path = require("path");

const NOMBRE_ARCHIVO = "Habitantes.csv";

// Divide una linea de CSV respetando comillas dobles.
const separarLinea = (linea, delimitador) => {
  const valores = [];
  let actual = "";
  let entreComillas = false;

  for (let i = 0; i < linea.length; i += 1) {
    const caracter = linea[i];

    if (caracter === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else {
        entreComillas = !entreComillas;
      }
      continue;
    }

    if (caracter === delimitador && !entreComillas) {
      valores.push(actual.trim());
      actual = "";
      continue;
    }

    actual += caracter;
  }

  valores.push(actual.trim());

  return valores;
};

// Lee el archivo en UTF-8. Si Excel lo guardo en ANSI (Windows-1252),
// las tildes salen como "\uFFFD"; en ese caso se vuelve a leer en latin1.
const leerTexto = (rutaArchivo) => {
  const buffer = fs.readFileSync(rutaArchivo);
  const textoUtf8 = buffer.toString("utf8");

  const texto = textoUtf8.includes("\uFFFD")
    ? buffer.toString("latin1")
    : textoUtf8;

  // El BOM se elimina para que el primer encabezado no quede con basura.
  return texto.replace(/^\uFEFF/, "");
};

const leerHabitantes = (rutaArchivo) => {
  const texto = leerTexto(rutaArchivo);

  const lineas = texto
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean);

  if (lineas.length < 2) return [];

  // Si el archivo se guardo con comas en vez de punto y coma, se detecta aqui.
  const delimitador =
    (lineas[0].match(/;/g) || []).length >=
    (lineas[0].match(/,/g) || []).length
      ? ";"
      : ",";

  const encabezados = separarLinea(lineas[0], delimitador);

  return lineas.slice(1).map((linea) => {
    const valores = separarLinea(linea, delimitador);
    const fila = {};

    encabezados.forEach((encabezado, indice) => {
      fila[encabezado] = valores[indice] ?? "";
    });

    return fila;
  });
};

// ------------------------------------------------------------------
// Carga masiva: validacion y guardado
// ------------------------------------------------------------------

const ENCABEZADO = [
  "ID_Habitante", "NombreResidente", "DocumentoResidente", "Rol", "ID_Inmueble",
  "TorreManzana", "AptoCasa", "Tipo", "Telefono", "Email", "FechaEntrada", "FechaSalida",
];

const ROLES = ["Residente", "Administrador", "Seguridad", "Mantenimiento"];
const TIPOS = ["Propietario", "Arrendatario", "Familiar"];

// Nombres de columna antiguos o escritos distinto que tambien se aceptan.
const ALIAS = {
  idhabitante: "ID_Habitante", id: "ID_Habitante",
  nombreresidente: "NombreResidente", nombrecompleto: "NombreResidente", nombre: "NombreResidente",
  documentoresidente: "DocumentoResidente", documento: "DocumentoResidente", cedula: "DocumentoResidente",
  rol: "Rol",
  idinmueble: "ID_Inmueble", inmueble: "ID_Inmueble",
  torremanzana: "TorreManzana", torre: "TorreManzana", manzana: "TorreManzana",
  aptocasa: "AptoCasa", apto: "AptoCasa", casa: "AptoCasa", apartamento: "AptoCasa",
  tipo: "Tipo",
  telefono: "Telefono", celular: "Telefono",
  email: "Email", correo: "Email", correoelectronico: "Email",
  fechaentrada: "FechaEntrada", fechasalida: "FechaSalida",
};

const normalizar = (v) =>
  String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

const claveColumna = (v) => normalizar(v).replace(/[^a-z0-9]/g, "");

const soloDigitos = (v) => String(v ?? "").replace(/\D/g, "");

const limpiar = (v) => String(v ?? "").replace(/[;\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();

// Convierte una fila con cualquier nombre de columna al formato oficial.
const mapearFila = (fila) => {
  const salida = {};
  Object.entries(fila || {}).forEach(([col, valor]) => {
    const oficial = ALIAS[claveColumna(col)];
    if (oficial && salida[oficial] === undefined) salida[oficial] = limpiar(valor);
  });
  ENCABEZADO.forEach((c) => {
    if (salida[c] === undefined) salida[c] = "";
  });
  return salida;
};

// Fecha valida -> "4/03/2026". Acepta 4/03/2026, 2026-03-04 y numero serial de Excel.
const normalizarFecha = (valor) => {
  const t = String(valor ?? "").trim();
  if (!t) return { ok: true, texto: "" };

  let a, m, d;
  let p = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (p) [a, m, d] = [Number(p[1]), Number(p[2]), Number(p[3])];
  else if ((p = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/))) [d, m, a] = [Number(p[1]), Number(p[2]), Number(p[3])];
  else if (/^\d{5}$/.test(t)) {
    const f = new Date(Date.UTC(1899, 11, 30) + Number(t) * 86400000);
    [a, m, d] = [f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate()];
  } else return { ok: false };

  const f = new Date(Date.UTC(a, m - 1, d));
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d || a < 1950 || a > 2100) {
    return { ok: false };
  }
  return { ok: true, texto: `${d}/${String(m).padStart(2, "0")}/${a}`, clave: a * 10000 + m * 100 + d };
};

// "Torre 2", "t2", "T - 2" -> "T-2"; "Mz 7", "Manzana 7", "M7" -> "M-7"
const normalizarTorre = (valor) => {
  const t = normalizar(valor).replace(/\s+/g, "");
  if (!t) return "";
  const p = t.match(/^(torre|t|manzana|mza|mz|m)-?(\d+)$/);
  if (!p) return null;
  return `${p[1].startsWith("t") ? "T" : "M"}-${Number(p[2])}`;
};

const normalizarApto = (valor) => {
  const t = normalizar(valor).replace(/^(apartamento|apto|apt|casa)\s*/, "").replace(/\s+/g, "");
  return /^[0-9a-z-]+$/.test(t) ? t.toUpperCase() : null;
};

const canonico = (valor, lista) => lista.find((x) => normalizar(x) === normalizar(valor)) || null;

const CAMPOS_COMPARAR = ENCABEZADO.filter((c) => c !== "ID_Habitante");

// Valida todas las filas contra el archivo actual. No guarda nada.
const validarCarga = (filasEntrada, existentes) => {
  const claveExistente = (h) => `${soloDigitos(h.DocumentoResidente)}|${normalizar(h.ID_Inmueble)}`;
  const porClave = new Map(existentes.map((h) => [claveExistente(h), h]));

  // Nombre conocido por documento y ubicacion conocida por inmueble.
  const nombrePorDoc = new Map();
  const ubicPorInm = new Map();
  const inmPorUbic = new Map();
  existentes.forEach((h) => {
    const doc = soloDigitos(h.DocumentoResidente);
    if (doc && !nombrePorDoc.has(doc)) nombrePorDoc.set(doc, h.NombreResidente);
    const inm = normalizar(h.ID_Inmueble);
    const ubic = `${normalizarTorre(h.TorreManzana) || h.TorreManzana}|${normalizarApto(h.AptoCasa) || h.AptoCasa}`;
    if (inm && h.TorreManzana) {
      if (!ubicPorInm.has(inm)) ubicPorInm.set(inm, ubic);
      if (!inmPorUbic.has(ubic)) inmPorUbic.set(ubic, h.ID_Inmueble);
    }
  });

  const vistosEnArchivo = new Map();
  const nombreEnArchivo = new Map();

  return filasEntrada.map((original, indice) => {
    const f = mapearFila(original);
    const errores = [];
    const avisos = [];
    const filaExcel = indice + 2;

    // Fila totalmente vacia: se ignora.
    if (CAMPOS_COMPARAR.every((c) => !f[c])) {
      return { fila: filaExcel, estado: "vacia", datos: f, errores: [], avisos: [], cambios: [] };
    }

    // Nombre
    if (!f.NombreResidente) errores.push("Falta el nombre.");
    else if (f.NombreResidente.split(" ").length < 2) avisos.push("El nombre tiene una sola palabra. Revisa que esté completo.");

    // Documento
    const doc = soloDigitos(f.DocumentoResidente);
    if (!doc) errores.push("Falta el documento.");
    else if (doc.length < 5 || doc.length > 12) errores.push("El documento debe tener entre 5 y 12 números.");
    else {
      if (doc !== f.DocumentoResidente) avisos.push(`Documento limpiado: ${f.DocumentoResidente} → ${doc}.`);
      f.DocumentoResidente = doc;
    }

    // Rol
    const rol = canonico(f.Rol, ROLES);
    if (!f.Rol) errores.push("Falta el rol.");
    else if (!rol) errores.push(`Rol "${f.Rol}" no existe. Usa: ${ROLES.join(", ")}.`);
    else f.Rol = rol;

    // Inmueble (obligatorio para residentes)
    const esResidente = rol === "Residente";
    if (f.TorreManzana) {
      const torre = normalizarTorre(f.TorreManzana);
      if (!torre) errores.push(`Torre/Manzana "${f.TorreManzana}" no válida. Usa T-2 o M-7.`);
      else {
        if (torre !== f.TorreManzana) avisos.push(`Torre/Manzana corregida: "${f.TorreManzana}" → ${torre}.`);
        f.TorreManzana = torre;
      }
    }
    if (f.AptoCasa) {
      const apto = normalizarApto(f.AptoCasa);
      if (!apto) errores.push(`Apto/Casa "${f.AptoCasa}" no válido.`);
      else {
        if (apto !== f.AptoCasa) avisos.push(`Apto/Casa corregido: "${f.AptoCasa}" → ${apto}.`);
        f.AptoCasa = apto;
      }
    }
    f.ID_Inmueble = f.ID_Inmueble.toUpperCase();

    if (esResidente) {
      if (!f.ID_Inmueble) errores.push("Falta el ID_Inmueble.");
      if (!f.TorreManzana) errores.push("Falta la Torre/Manzana.");
      if (!f.AptoCasa) errores.push("Falta el Apto/Casa.");
      const tipo = canonico(f.Tipo, TIPOS);
      if (!f.Tipo) errores.push("Falta el tipo (Propietario, Arrendatario o Familiar).");
      else if (!tipo) errores.push(`Tipo "${f.Tipo}" no existe. Usa: ${TIPOS.join(", ")}.`);
      else f.Tipo = tipo;
    } else if (f.Tipo) {
      const tipo = canonico(f.Tipo, TIPOS);
      if (tipo) f.Tipo = tipo;
    }

    // Un inmueble siempre en la misma torre/apto, y viceversa.
    if (f.ID_Inmueble && f.TorreManzana && f.AptoCasa) {
      const inm = normalizar(f.ID_Inmueble);
      const ubic = `${f.TorreManzana}|${f.AptoCasa}`;
      const ubicConocida = ubicPorInm.get(inm);
      const inmConocido = inmPorUbic.get(ubic);
      if (ubicConocida && ubicConocida !== ubic) {
        errores.push(`${f.ID_Inmueble} ya corresponde a ${ubicConocida.replace("|", " - ")}.`);
      } else if (inmConocido && normalizar(inmConocido) !== inm) {
        errores.push(`${f.TorreManzana} - ${f.AptoCasa} ya tiene el código ${inmConocido}.`);
      } else {
        ubicPorInm.set(inm, ubic);
        inmPorUbic.set(ubic, f.ID_Inmueble);
      }
    }

    // Telefono
    if (f.Telefono) {
      const tel = soloDigitos(f.Telefono).replace(/^57(?=\d{10}$)/, "");
      if (tel.length !== 10) errores.push(`Teléfono "${f.Telefono}" debe tener 10 números.`);
      else f.Telefono = tel;
    } else if (esResidente) avisos.push("Sin teléfono.");

    // Correo
    if (f.Email) {
      f.Email = f.Email.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.Email)) errores.push(`Correo "${f.Email}" no es válido.`);
    } else if (esResidente) avisos.push("Sin correo: no podrá recibir notificaciones por email.");

    // Fechas
    const fe = normalizarFecha(f.FechaEntrada);
    const fs_ = normalizarFecha(f.FechaSalida);
    if (!fe.ok) errores.push(`Fecha de entrada "${f.FechaEntrada}" no es válida.`);
    else f.FechaEntrada = fe.texto;
    if (!fs_.ok) errores.push(`Fecha de salida "${f.FechaSalida}" no es válida.`);
    else f.FechaSalida = fs_.texto;
    if (fe.ok && fs_.ok && fe.clave && fs_.clave && fs_.clave < fe.clave) {
      errores.push("La fecha de salida es anterior a la de entrada.");
    }

    // Repetidos y nombre distinto para el mismo documento
    if (doc) {
      const clave = `${doc}|${normalizar(f.ID_Inmueble)}`;
      if (vistosEnArchivo.has(clave)) {
        errores.push(`Fila repetida: mismo documento e inmueble que la fila ${vistosEnArchivo.get(clave)}.`);
      } else vistosEnArchivo.set(clave, filaExcel);

      const nombrePrevio = nombreEnArchivo.get(doc) || nombrePorDoc.get(doc);
      if (f.NombreResidente && nombrePrevio && normalizar(nombrePrevio) !== normalizar(f.NombreResidente)) {
        errores.push(`El documento ${doc} ya pertenece a ${nombrePrevio}.`);
      } else if (f.NombreResidente && !nombreEnArchivo.has(doc)) nombreEnArchivo.set(doc, f.NombreResidente);
    }

    // Nuevo, actualizar o sin cambios
    let estado = "nuevo";
    let cambios = [];
    const existente = doc ? porClave.get(`${doc}|${normalizar(f.ID_Inmueble)}`) : null;
    if (existente) {
      const valorActual = (c) => {
        const v = String(existente[c] ?? "").trim();
        if (c === "FechaEntrada" || c === "FechaSalida") {
          const n = normalizarFecha(v);
          return n.ok ? n.texto : v;
        }
        return v;
      };
      cambios = CAMPOS_COMPARAR.filter((c) => valorActual(c) !== String(f[c] ?? "").trim());
      estado = cambios.length ? "actualizar" : "sin_cambios";
      f.ID_Habitante = existente.ID_Habitante;
    }

    if (errores.length) estado = "error";

    return { fila: filaExcel, estado, datos: f, errores, avisos, cambios };
  });
};

const resumir = (resultado) => {
  const r = { total: 0, nuevos: 0, actualizar: 0, sinCambios: 0, errores: 0, conAvisos: 0 };
  resultado.forEach((x) => {
    if (x.estado === "vacia") return;
    r.total += 1;
    if (x.estado === "nuevo") r.nuevos += 1;
    if (x.estado === "actualizar") r.actualizar += 1;
    if (x.estado === "sin_cambios") r.sinCambios += 1;
    if (x.estado === "error") r.errores += 1;
    if (x.avisos.length) r.conAvisos += 1;
  });
  return r;
};

// El cuerpo llega como texto para no depender del limite de express.json() en app.js
const leerCuerpo = (req) => {
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body || {};
};

const escribirHabitantes = (ruta, encabezados, filas) => {
  const lineas = [
    encabezados.join(";"),
    ...filas.map((f) => encabezados.map((c) => limpiar(f[c])).join(";")),
  ];
  const temporal = `${ruta}.tmp`;
  fs.writeFileSync(temporal, "\uFEFF" + lineas.join("\r\n") + "\r\n", "utf8");
  fs.renameSync(temporal, ruta);
};

module.exports = (baseResidencialDir) => {
  const router = express.Router();

  router.get("/", (req, res) => {
    const rutaArchivo = path.join(baseResidencialDir, NOMBRE_ARCHIVO);

    try {
      if (!fs.existsSync(rutaArchivo)) {
        return res.status(404).json({
          ok: false,
          error: `No se encontro ${NOMBRE_ARCHIVO} en ${baseResidencialDir}`,
          habitantes: [],
        });
      }

      const habitantes = leerHabitantes(rutaArchivo);

      return res.json({
        ok: true,
        total: habitantes.length,
        archivo: rutaArchivo,
        habitantes,
      });
    } catch (err) {
      console.error("Error leyendo Habitantes.csv:", err);

      return res.status(500).json({
        ok: false,
        error: err.message || "Error leyendo Habitantes.csv",
        habitantes: [],
      });
    }
  });

  const cuerpoTexto = express.text({ type: "*/*", limit: "10mb" });

  // Revisa el archivo y devuelve el resultado fila por fila. No guarda.
  router.post("/validar", cuerpoTexto, (req, res) => {
    try {
      const { filas = [] } = leerCuerpo(req);
      const rutaArchivo = path.join(baseResidencialDir, NOMBRE_ARCHIVO);
      const existentes = fs.existsSync(rutaArchivo) ? leerHabitantes(rutaArchivo) : [];
      const resultado = validarCarga(Array.isArray(filas) ? filas : [], existentes);
      return res.json({ ok: true, resumen: resumir(resultado), filas: resultado.filter((x) => x.estado !== "vacia") });
    } catch (err) {
      console.error("Error validando carga de habitantes:", err);
      return res.status(400).json({ ok: false, error: "No se pudo leer el archivo enviado." });
    }
  });

  // Vuelve a validar y guarda solo las filas correctas (agrega y actualiza).
  router.post("/importar", cuerpoTexto, (req, res) => {
    try {
      const { filas = [] } = leerCuerpo(req);
      const rutaArchivo = path.join(baseResidencialDir, NOMBRE_ARCHIVO);
      const existentes = fs.existsSync(rutaArchivo) ? leerHabitantes(rutaArchivo) : [];
      const resultado = validarCarga(Array.isArray(filas) ? filas : [], existentes);

      const aplicar = resultado.filter((x) => x.estado === "nuevo" || x.estado === "actualizar");
      if (!aplicar.length) {
        return res.json({ ok: true, mensaje: "No hay filas nuevas ni cambios para guardar.", resumen: resumir(resultado) });
      }

      // Respaldo
      if (fs.existsSync(rutaArchivo)) {
        const carpeta = path.join(baseResidencialDir, "respaldos");
        if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });
        const sello = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
        fs.copyFileSync(rutaArchivo, path.join(carpeta, `Habitantes_antes_carga_${sello}.csv`));
      }

      // Se conservan columnas extra que tenga el archivo actual.
      const extras = existentes.length
        ? Object.keys(existentes[0]).filter((c) => !ENCABEZADO.includes(c))
        : [];
      const encabezados = [...ENCABEZADO, ...extras];

      const clave = (h) => `${soloDigitos(h.DocumentoResidente)}|${normalizar(h.ID_Inmueble)}`;
      const lista = existentes.map((h) => ({ ...h }));
      const indice = new Map(lista.map((h, i) => [clave(h), i]));

      const idsUsados = new Set(lista.map((h) => String(h.ID_Habitante).trim()));
      let siguienteId = Math.max(0, ...lista.map((h) => Number(h.ID_Habitante) || 0)) + 1;

      aplicar.forEach(({ estado, datos }) => {
        if (estado === "actualizar") {
          const i = indice.get(clave(datos));
          lista[i] = { ...lista[i], ...datos, ID_Habitante: lista[i].ID_Habitante };
          return;
        }
        // Nuevo: usa el ID del archivo si esta libre; si no, el siguiente.
        let id = String(datos.ID_Habitante || "").trim();
        if (!/^\d+$/.test(id) || idsUsados.has(id)) {
          while (idsUsados.has(String(siguienteId))) siguienteId += 1;
          id = String(siguienteId);
        }
        idsUsados.add(id);
        siguienteId = Math.max(siguienteId, Number(id) + 1);
        lista.push({ ...datos, ID_Habitante: id });
        indice.set(clave(datos), lista.length - 1);
      });

      escribirHabitantes(rutaArchivo, encabezados, lista);

      const resumen = resumir(resultado);
      return res.json({
        ok: true,
        mensaje: `Guardado: ${resumen.nuevos} nuevo(s) y ${resumen.actualizar} actualizado(s). ${resumen.errores} fila(s) con errores no se guardaron.`,
        resumen,
        totalHabitantes: lista.length,
      });
    } catch (err) {
      console.error("Error importando habitantes:", err);
      return res.status(500).json({ ok: false, error: "No se pudo guardar la carga de habitantes." });
    }
  });

  // Agregar o editar UN habitante desde el formulario del administrador.
  // Cuerpo: { habitante: {...}, original: { documento, idInmueble } | null }
  //   original = null      -> agregar
  //   original con datos   -> editar esa fila (se puede cambiar cualquier dato)
  // Nadie se borra: para retirar a alguien se le pone FechaSalida.
  router.post("/guardar", cuerpoTexto, (req, res) => {
    try {
      const { habitante = {}, original = null } = leerCuerpo(req);
      const rutaArchivo = path.join(baseResidencialDir, NOMBRE_ARCHIVO);
      const existentes = fs.existsSync(rutaArchivo) ? leerHabitantes(rutaArchivo) : [];
      const clave = (h) => `${soloDigitos(h.DocumentoResidente)}|${normalizar(h.ID_Inmueble)}`;

      let indiceOriginal = -1;
      if (original) {
        const claveOriginal = `${soloDigitos(original.documento)}|${normalizar(original.idInmueble)}`;
        indiceOriginal = existentes.findIndex((h) => clave(h) === claveOriginal);
        if (indiceOriginal < 0) {
          return res.status(404).json({ ok: false, error: "No se encontró el habitante que intentas editar. Recarga la tabla." });
        }
      }

      // Se valida contra todos los demas (sin la fila que se esta editando).
      const otros = existentes.filter((_, i) => i !== indiceOriginal);
      const [resultado] = validarCarga([habitante], otros);

      if (!resultado || resultado.estado === "vacia") {
        return res.status(400).json({ ok: false, error: "El formulario está vacío." });
      }
      if (resultado.estado === "error") {
        return res.status(400).json({ ok: false, error: resultado.errores.join(" "), errores: resultado.errores });
      }
      if (!original && resultado.estado !== "nuevo") {
        return res.status(400).json({
          ok: false,
          error: "Esta persona ya está registrada en ese inmueble. Usa el botón Editar de la tabla.",
        });
      }
      if (original && resultado.estado !== "nuevo") {
        // Cambio de datos que coincide con otra fila existente (mismo documento e inmueble).
        return res.status(400).json({
          ok: false,
          error: "Ya existe otra fila con ese documento en ese inmueble.",
        });
      }

      // Respaldo
      if (fs.existsSync(rutaArchivo)) {
        const carpeta = path.join(baseResidencialDir, "respaldos");
        if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });
        const sello = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
        fs.copyFileSync(rutaArchivo, path.join(carpeta, `Habitantes_antes_edicion_${sello}.csv`));
      }

      const extras = existentes.length ? Object.keys(existentes[0]).filter((c) => !ENCABEZADO.includes(c)) : [];
      const encabezados = [...ENCABEZADO, ...extras];
      const datos = resultado.datos;
      const lista = existentes.map((h) => ({ ...h }));

      if (original) {
        lista[indiceOriginal] = { ...lista[indiceOriginal], ...datos, ID_Habitante: lista[indiceOriginal].ID_Habitante };
      } else {
        const siguienteId = Math.max(0, ...lista.map((h) => Number(h.ID_Habitante) || 0)) + 1;
        lista.push({ ...datos, ID_Habitante: String(siguienteId) });
      }

      escribirHabitantes(rutaArchivo, encabezados, lista);

      return res.json({
        ok: true,
        mensaje: original ? "Habitante actualizado." : "Habitante agregado.",
        avisos: resultado.avisos,
        habitantes: lista,
      });
    } catch (err) {
      console.error("Error guardando habitante:", err);
      return res.status(500).json({ ok: false, error: "No se pudo guardar el habitante." });
    }
  });

  // POST /mis-datos  { documento, telefono, email }
  // El residente actualiza su celular y correo. Se cambia en todas sus filas
  // de Habitantes.csv y queda constancia en CambiosDatos.csv.
  router.post("/mis-datos", cuerpoTexto, (req, res) => {
    try {
      const { documento, telefono, email } = leerCuerpo(req);
      const doc = soloDigitos(documento);
      const tel = soloDigitos(telefono);
      const correo = limpiar(email).toLowerCase();

      if (!doc) return res.status(400).json({ ok: false, error: "No se identificó al residente." });
      if (!/^3\d{9}$/.test(tel)) {
        return res.status(400).json({ ok: false, error: "El celular debe tener 10 números y empezar por 3." });
      }
      if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        return res.status(400).json({ ok: false, error: "El correo no tiene un formato válido." });
      }

      const rutaArchivo = path.join(baseResidencialDir, NOMBRE_ARCHIVO);
      if (!fs.existsSync(rutaArchivo)) return res.status(404).json({ ok: false, error: "No se encontró Habitantes.csv." });

      const existentes = leerHabitantes(rutaArchivo);
      const propias = existentes.filter((h) => soloDigitos(h.DocumentoResidente) === doc);
      if (!propias.length) return res.status(404).json({ ok: false, error: "Tu documento no aparece en Habitantes." });

      const anterior = { Telefono: soloDigitos(propias[0].Telefono), Email: limpiar(propias[0].Email).toLowerCase() };
      const cambios = [];
      if (anterior.Telefono !== tel) cambios.push({ campo: "Telefono", antes: anterior.Telefono, despues: tel });
      if (anterior.Email !== correo) cambios.push({ campo: "Email", antes: anterior.Email, despues: correo });
      const filasDistintas = propias.some((h) => soloDigitos(h.Telefono) !== tel || limpiar(h.Email).toLowerCase() !== correo);

      if (!cambios.length && !filasDistintas) {
        return res.json({ ok: true, mensaje: "No hubo cambios: tus datos ya estaban así.", telefono: tel, email: correo });
      }

      // Respaldo
      const carpeta = path.join(baseResidencialDir, "respaldos");
      if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });
      const sello = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
      fs.copyFileSync(rutaArchivo, path.join(carpeta, `Habitantes_antes_misdatos_${sello}.csv`));

      const extras = Object.keys(existentes[0]).filter((c) => !ENCABEZADO.includes(c));
      const lista = existentes.map((h) => (soloDigitos(h.DocumentoResidente) === doc ? { ...h, Telefono: tel, Email: correo } : h));
      escribirHabitantes(rutaArchivo, [...ENCABEZADO, ...extras], lista);

      // Constancia
      if (cambios.length) {
        const rutaCambios = path.join(baseResidencialDir, "CambiosDatos.csv");
        const p = Object.fromEntries(
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
          }).formatToParts(new Date()).map((x) => [x.type, x.value])
        );
        const fechaHora = `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}:${p.second}`;
        const nuevo = !fs.existsSync(rutaCambios);
        const lineas = cambios.map((c) =>
          [fechaHora, doc, propias[0].NombreResidente, "Habitantes", c.campo, c.antes, c.despues, "Panel del residente", propias[0].NombreResidente]
            .map(limpiar)
            .join(";")
        );
        const encabezado = "FechaHora;DocumentoResidente;NombreResidente;Archivo;Campo;ValorAnterior;ValorNuevo;Origen;RealizadoPor";
        fs.appendFileSync(rutaCambios, (nuevo ? "\uFEFF" + encabezado + "\r\n" : "") + lineas.join("\r\n") + "\r\n", "utf8");
      }

      return res.json({
        ok: true,
        mensaje: "Tus datos fueron actualizados.",
        telefono: tel,
        email: correo,
        cambios,
      });
    } catch (err) {
      console.error("Error actualizando mis datos:", err);
      return res.status(500).json({ ok: false, error: "No se pudieron actualizar tus datos." });
    }
  });

  return router;
};