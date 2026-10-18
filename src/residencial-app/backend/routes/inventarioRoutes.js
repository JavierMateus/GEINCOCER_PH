// routes/inventarioRoutes.js
// Carga de VEHÍCULOS y PARQUEADEROS desde Excel/CSV, con revisión automática contra
// la tabla de Habitantes (el inmueble de cada fila debe existir y escribirse igual).
//
// Funciona igual que la importación de habitantes: primero REVISA sin guardar nada
// y luego GUARDA solo las filas correctas. Nada se borra: para retirar un vehículo se
// pone Estado = retirado.
//
// Montaje en app.js (debajo de const rutasAuth = authRoutes(...)):
//   const inventarioRoutes = require("./routes/inventarioRoutes");
//   app.use("/api/inventario", inventarioRoutes(baseResidencialDir, rutasAuth.verificarAdmin));
//
// Rutas:
//   GET  /api/inventario/resumen     -> cantidades (para las tarjetas del panel)
//   POST /api/inventario/validar     -> revisa y devuelve el resultado fila por fila. No guarda.
//   POST /api/inventario/importar    -> guarda las filas correctas. Exige PIN de administrador.
//
// El cuerpo se envía como TEXTO con un JSON dentro (igual que /api/habitantes):
//   { vehiculos: [ {...fila...} ], parqueaderos: [ {...fila...} ],
//     inmueblesExtra: [ { id, torre, apto } ],   // opcional: inmuebles de una hoja de Habitantes aún sin guardar
//     modo: "agregar" | "reemplazar",             // por defecto "agregar" (agrega y actualiza)
//     adminDocumento, adminPin }                  // solo para importar
// Si "vehiculos" o "parqueaderos" no se envía, esa tabla no se toca.

const express = require("express");
const fs = require("fs");
const path = require("path");

const CARPETA_RESPALDOS = "respaldos";
const ARCH_HABITANTES = "Habitantes.csv";
const ARCH_VEHICULOS = "Vehiculos.csv";
const ARCH_PARQUEADEROS = "Parqueaderos.csv";
const ENC_VEH = ["ID_Vehiculo", "Placa", "Tipo", "Marca", "Color", "ID_Inmueble", "TorreManzana", "AptoCasa", "Estado"];
const ENC_PAR = ["ID_Parqueadero", "Codigo", "Tipo", "ID_Inmueble", "TorreManzana", "AptoCasa"];

// ---------- utilidades ----------
const limpiar = (v) => String(v ?? "").replace(/[;\r\n]+/g, " ").trim();
const normalizar = (v) =>
  String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
// Solo letras y números: "T-1", "t 1" y "T1" son iguales; "Torre/Manzana" y "TorreManzana" también.
const compacto = (v) => normalizar(v).replace(/[^a-z0-9]/g, "");

const ahoraBogota = () => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).formatToParts(new Date()).map((x) => [x.type, x.value])
  );
  return `${p.year}${p.month}${p.day}${p.hour === "24" ? "00" : p.hour}${p.minute}${p.second}`;
};

const separarLinea = (linea, delimitador) => {
  const celdas = [];
  let actual = "";
  let entreComillas = false;
  for (let i = 0; i < linea.length; i += 1) {
    const c = linea[i];
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') { actual += '"'; i += 1; } else entreComillas = !entreComillas;
    } else if (c === delimitador && !entreComillas) { celdas.push(actual); actual = ""; } else actual += c;
  }
  celdas.push(actual);
  return celdas.map((x) => x.trim());
};

// Lee un CSV (UTF-8 o Windows). Las columnas quedan con nombre "compacto".
const leerTabla = (ruta) => {
  if (!fs.existsSync(ruta)) return [];
  const buffer = fs.readFileSync(ruta);
  let texto = buffer.toString("utf8");
  if (texto.includes("\uFFFD")) texto = buffer.toString("latin1");
  texto = texto.replace(/^\uFEFF/, "");
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lineas.length < 2) return [];
  const delimitador = (lineas[0].match(/;/g) || []).length >= (lineas[0].match(/,/g) || []).length ? ";" : ",";
  const enc = separarLinea(lineas[0], delimitador).map(compacto);
  return lineas.slice(1).map((l) => {
    const valores = separarLinea(l, delimitador);
    const fila = {};
    enc.forEach((e, i) => { fila[e] = valores[i] ?? ""; });
    return fila;
  });
};

// Una fila recibida (con cualquier encabezado) -> claves compactas.
const claves = (fila) => {
  const k = {};
  Object.entries(fila || {}).forEach(([c, v]) => { k[compacto(c)] = String(v ?? "").trim(); });
  return k;
};
const vacia = (k) => Object.values(k).every((v) => v === "");

const tipoVehiculo = (valor) => {
  const t = compacto(valor);
  if (!t) return "";
  if (["carro", "auto", "automovil", "camioneta", "campero", "taxi"].includes(t)) return "Carro";
  if (["moto", "motocicleta", "motocarro"].includes(t)) return "Moto";
  if (["bicicleta", "bici"].includes(t)) return "Bicicleta";
  return "Otro";
};

// ---------- el inmueble debe existir en Habitantes ----------
const catalogoDe = (rutaHabitantes, extra) => {
  const lista = [];
  const visto = new Set();
  const agregar = (id, torre, apto) => {
    const c = { id: limpiar(id), torre: limpiar(torre), apto: limpiar(apto) };
    if (!c.torre || !c.apto) return;
    const clave = `${compacto(c.id)}|${compacto(`${c.torre} ${c.apto}`)}`;
    if (visto.has(clave)) return;
    visto.add(clave);
    lista.push(c);
  };
  leerTabla(rutaHabitantes).forEach((h) => agregar(h.idinmueble, h.torremanzana, h.aptocasa));
  (Array.isArray(extra) ? extra : []).forEach((e) => agregar(e.id, e.torre, e.apto));
  return lista;
};

const destino = (t, a) => compacto(`${t} ${a}`);

const resolverInmueble = (catalogo, idIn, torreIn, aptoIn) => {
  const id = limpiar(idIn);
  const torre = limpiar(torreIn);
  const apto = limpiar(aptoIn);
  const hayDestino = Boolean(torre && apto);
  const porDestino = hayDestino ? catalogo.filter((c) => destino(c.torre, c.apto) === destino(torre, apto)) : [];
  const avisos = [];

  if (id) {
    const porId = catalogo.filter((c) => compacto(c.id) === compacto(id));
    if (porId.length === 0) {
      if (porDestino.length > 0) {
        const c = porDestino[0];
        avisos.push(`El ID_Inmueble ${id} no existe en Habitantes; se usó ${c.id || "(sin ID)"} porque ${c.torre} / ${c.apto} sí coincide.`);
        return { ok: true, id: c.id, torre: c.torre, apto: c.apto, avisos };
      }
      return { ok: false, error: `El inmueble ${id}${hayDestino ? ` (${torre} / ${apto})` : ""} no existe en Habitantes.` };
    }
    if (hayDestino) {
      const c = porId.find((x) => destino(x.torre, x.apto) === destino(torre, apto));
      if (!c) {
        const reg = [...new Set(porId.map((x) => `${x.torre} / ${x.apto}`))].join(" o ");
        return { ok: false, error: `El inmueble ${porId[0].id} está en Habitantes como ${reg}, pero aquí dice ${torre} / ${apto}.` };
      }
      if (c.torre !== torre || c.apto !== apto) {
        avisos.push(`Se escribió ${torre} / ${apto} y se guardó como está en Habitantes: ${c.torre} / ${c.apto}.`);
      }
      return { ok: true, id: c.id, torre: c.torre, apto: c.apto, avisos };
    }
    const c = porId[0];
    return { ok: true, id: c.id, torre: c.torre, apto: c.apto, avisos };
  }

  if (!hayDestino) return { ok: false, error: "Falta el inmueble: indica el ID_Inmueble, o la torre y el apartamento." };
  if (porDestino.length === 0) return { ok: false, error: `El inmueble ${torre} / ${apto} no existe en Habitantes.` };
  const c = porDestino[0];
  if (c.id) avisos.push(`Se completó el ID_Inmueble: ${c.id}.`);
  if (c.torre !== torre || c.apto !== apto) avisos.push(`Se guardó como está en Habitantes: ${c.torre} / ${c.apto}.`);
  return { ok: true, id: c.id, torre: c.torre, apto: c.apto, avisos };
};

// ---------- tablas guardadas (formato único) ----------
const cargarVehiculos = (ruta) =>
  leerTabla(ruta).map((f, i) => ({
    ID_Vehiculo: limpiar(f.idvehiculo) || `VEH-${String(i + 1).padStart(3, "0")}`,
    Placa: limpiar(f.placa).toUpperCase().replace(/[\s-]/g, ""),
    Tipo: limpiar(f.tipo),
    Marca: limpiar(f.marca),
    Color: limpiar(f.color),
    ID_Inmueble: limpiar(f.idinmueble),
    TorreManzana: limpiar(f.torremanzana),
    AptoCasa: limpiar(f.aptocasa),
    Estado: normalizar(f.estado) === "retirado" ? "retirado" : "activo",
  })).filter((v) => v.Placa);

const cargarParqueaderos = (ruta) => {
  const lista = [];
  leerTabla(ruta).forEach((f) => {
    const base = {
      Tipo: limpiar(f.tipo) || "Residente",
      ID_Inmueble: limpiar(f.idinmueble),
      TorreManzana: limpiar(f.torremanzana),
      AptoCasa: limpiar(f.aptocasa),
    };
    const codigos = limpiar(f.codigo) ? [limpiar(f.codigo)] : [f.parqueadero1, f.parqueadero2].map(limpiar).filter(Boolean);
    codigos.forEach((c) => lista.push({ ...base, Codigo: c.toUpperCase() }));
  });
  return lista.map((p, i) => ({ ID_Parqueadero: `PAR-${String(i + 1).padStart(3, "0")}`, ...p }));
};

// ---------- revisión de filas ----------
const revisarVehiculos = (filas, catalogo, guardados) => {
  const porPlaca = new Map(guardados.map((v) => [compacto(v.Placa), v]));
  const vistas = new Map();
  const resultado = [];
  filas.forEach((original, i) => {
    const k = claves(original);
    if (vacia(k)) return;
    const n = i + 2; // fila en el Excel (la 1 es el encabezado)
    const errores = [];
    let avisos = [];
    const placa = limpiar(k.placa).toUpperCase().replace(/[\s-]/g, "");

    if (!/^[A-Z0-9]{5,7}$/.test(placa)) errores.push("Placa no válida (debe tener de 5 a 7 letras o números).");
    else if (vistas.has(placa)) errores.push(`Placa repetida en el archivo (también está en la fila ${vistas.get(placa)}).`);
    else vistas.set(placa, n);

    let tipo = tipoVehiculo(k.tipo);
    if (!tipo) { tipo = "Otro"; avisos.push("No traía el tipo de vehículo; se guardó como Otro."); }
    const estado = ["retirado", "inactivo"].includes(normalizar(k.estado)) ? "retirado" : "activo";

    const inm = resolverInmueble(catalogo, k.idinmueble, k.torremanzana || k.torre || k.manzana, k.aptocasa || k.apto || k.casa);
    if (!inm.ok) errores.push(inm.error); else avisos = avisos.concat(inm.avisos);

    const datos = {
      Placa: placa, Tipo: tipo, Marca: limpiar(k.marca), Color: limpiar(k.color),
      ID_Inmueble: inm.ok ? inm.id : limpiar(k.idinmueble),
      TorreManzana: inm.ok ? inm.torre : limpiar(k.torremanzana),
      AptoCasa: inm.ok ? inm.apto : limpiar(k.aptocasa),
      Estado: estado,
    };

    let estadoFila = "error";
    if (errores.length === 0) {
      const previo = porPlaca.get(compacto(placa));
      if (!previo) estadoFila = "nuevo";
      else {
        const igual = ["Tipo", "Marca", "Color", "ID_Inmueble", "TorreManzana", "AptoCasa", "Estado"].every((c) => previo[c] === datos[c]);
        estadoFila = igual ? "sin_cambios" : "actualizar";
        if (!igual && (previo.ID_Inmueble !== datos.ID_Inmueble || previo.AptoCasa !== datos.AptoCasa)) {
          avisos.push(`El vehículo cambia de inmueble: antes ${previo.TorreManzana} / ${previo.AptoCasa}, ahora ${datos.TorreManzana} / ${datos.AptoCasa}.`);
        }
      }
    }
    resultado.push({ hoja: "Vehiculos", fila: n, clave: placa || "(sin placa)", estado: estadoFila, errores, avisos, datos });
  });
  return resultado;
};

const revisarParqueaderos = (filas, catalogo, guardados) => {
  const porCodigo = new Map(guardados.map((p) => [compacto(p.Codigo), p]));
  const vistos = new Map();
  const resultado = [];
  filas.forEach((original, i) => {
    const k = claves(original);
    if (vacia(k)) return;
    const n = i + 2;
    // Formato nuevo: una fila por parqueadero (Codigo). Formato antiguo: Parqueadero1 y Parqueadero2.
    let codigos = limpiar(k.codigo) ? [limpiar(k.codigo)] : [];
    const formatoAntiguo = codigos.length === 0 && (k.parqueadero1 || k.parqueadero2);
    if (formatoAntiguo) codigos = [k.parqueadero1, k.parqueadero2].map(limpiar).filter(Boolean);
    if (codigos.length === 0) codigos = [""]; // se reporta como error

    codigos.forEach((codigoCrudo) => {
      const errores = [];
      let avisos = formatoAntiguo ? ["Formato antiguo (Parqueadero1/Parqueadero2): se convirtió a una fila por parqueadero."] : [];
      const codigo = codigoCrudo.toUpperCase();
      if (!codigo) errores.push("Falta el código del parqueadero.");
      else if (vistos.has(compacto(codigo))) errores.push(`Código repetido en el archivo (también está en la fila ${vistos.get(compacto(codigo))}).`);
      else vistos.set(compacto(codigo), n);

      const hayInmueble = Boolean(limpiar(k.idinmueble) || limpiar(k.torremanzana) || limpiar(k.aptocasa));
      const t = compacto(k.tipo);
      let tipo = "";
      if (t.includes("visit")) tipo = "Visitante";
      else if (t.includes("comun")) tipo = "Comunal";
      else if (t.includes("resid") || t.includes("propio") || t.includes("asign")) tipo = "Residente";
      else if (!t && (hayInmueble || formatoAntiguo)) tipo = "Residente";
      else if (!t) errores.push("Indica el tipo (Residente, Visitante o Comunal) o el inmueble al que pertenece.");
      else errores.push(`Tipo "${limpiar(k.tipo)}" no válido (usa Residente, Visitante o Comunal).`);

      let inm = { ok: true, id: "", torre: "", apto: "", avisos: [] };
      if (tipo === "Residente" || hayInmueble) {
        inm = resolverInmueble(catalogo, k.idinmueble, k.torremanzana || k.torre || k.manzana, k.aptocasa || k.apto || k.casa);
        if (!inm.ok) errores.push(inm.error); else avisos = avisos.concat(inm.avisos);
      }

      const datos = { Codigo: codigo, Tipo: tipo, ID_Inmueble: inm.ok ? inm.id : "", TorreManzana: inm.ok ? inm.torre : "", AptoCasa: inm.ok ? inm.apto : "" };
      let estadoFila = "error";
      if (errores.length === 0) {
        const previo = porCodigo.get(compacto(codigo));
        if (!previo) estadoFila = "nuevo";
        else {
          const igual = ["Tipo", "ID_Inmueble", "TorreManzana", "AptoCasa"].every((c) => previo[c] === datos[c]);
          estadoFila = igual ? "sin_cambios" : "actualizar";
          if (!igual && (previo.ID_Inmueble !== datos.ID_Inmueble || previo.AptoCasa !== datos.AptoCasa)) {
            avisos.push(`El parqueadero cambia de dueño: antes ${previo.TorreManzana || "(libre)"} / ${previo.AptoCasa || ""}, ahora ${datos.TorreManzana || "(libre)"} / ${datos.AptoCasa || ""}.`);
          }
        }
      }
      resultado.push({ hoja: "Parqueaderos", fila: n, clave: codigo || "(sin código)", estado: estadoFila, errores, avisos, datos });
    });
  });
  return resultado;
};

const resumir = (filas) => {
  const r = { total: filas.length, nuevos: 0, actualizar: 0, sinCambios: 0, errores: 0, conAvisos: 0 };
  filas.forEach((f) => {
    if (f.estado === "nuevo") r.nuevos += 1;
    else if (f.estado === "actualizar") r.actualizar += 1;
    else if (f.estado === "sin_cambios") r.sinCambios += 1;
    else r.errores += 1;
    if (f.avisos.length > 0) r.conAvisos += 1;
  });
  return r;
};

module.exports = (baseDir, verificarAdmin) => {
  const router = express.Router();
  const rutaHab = path.join(baseDir, ARCH_HABITANTES);
  const rutaVeh = path.join(baseDir, ARCH_VEHICULOS);
  const rutaPar = path.join(baseDir, ARCH_PARQUEADEROS);
  const cuerpoTexto = express.text({ type: "*/*", limit: "10mb" });

  const leerCuerpo = (req) => {
    try {
      return typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    } catch (_) {
      return null;
    }
  };

  // Revisa todo lo que venga en el cuerpo. No guarda nada.
  const revisar = (cuerpo) => {
    const catalogo = catalogoDe(rutaHab, cuerpo.inmueblesExtra);
    const advertencias = [];
    if (catalogo.length === 0) advertencias.push("No hay habitantes cargados, así que ningún inmueble puede validarse. Carga primero la hoja de Habitantes.");
    const salida = { catalogo: catalogo.length, advertencias };
    if (Array.isArray(cuerpo.vehiculos)) salida.vehiculos = revisarVehiculos(cuerpo.vehiculos, catalogo, cargarVehiculos(rutaVeh));
    if (Array.isArray(cuerpo.parqueaderos)) salida.parqueaderos = revisarParqueaderos(cuerpo.parqueaderos, catalogo, cargarParqueaderos(rutaPar));
    return salida;
  };

  const resumenDe = (r) => ({
    vehiculos: r.vehiculos ? resumir(r.vehiculos) : null,
    parqueaderos: r.parqueaderos ? resumir(r.parqueaderos) : null,
  });

  const errorDeArchivo = (res, err) => {
    if (err.code === "EPERM" || err.code === "EBUSY") {
      return res.status(423).json({ ok: false, error: "No se pudo guardar: un archivo de datos está abierto en otro programa (por ejemplo Excel). Ciérralo e inténtalo de nuevo." });
    }
    console.error("❌ Error en inventario:", err);
    return res.status(500).json({ ok: false, error: "No se pudo completar la operación." });
  };

  router.get("/resumen", (req, res) => {
    try {
      const vehiculos = cargarVehiculos(rutaVeh);
      const parqueaderos = cargarParqueaderos(rutaPar);
      return res.json({
        vehiculos: vehiculos.filter((v) => v.Estado !== "retirado").length,
        parqueaderos: parqueaderos.length,
        manejaParqueaderos: parqueaderos.length > 0,
      });
    } catch (err) {
      return errorDeArchivo(res, err);
    }
  });

  router.post("/validar", cuerpoTexto, (req, res) => {
    try {
      const cuerpo = leerCuerpo(req);
      if (!cuerpo) return res.status(400).json({ ok: false, error: "El contenido enviado no es válido." });
      if (!Array.isArray(cuerpo.vehiculos) && !Array.isArray(cuerpo.parqueaderos)) {
        return res.status(400).json({ ok: false, error: "No llegó ninguna hoja de vehículos ni de parqueaderos." });
      }
      const r = revisar(cuerpo);
      return res.json({ ok: true, ...r, resumen: resumenDe(r) });
    } catch (err) {
      return errorDeArchivo(res, err);
    }
  });

  router.post("/importar", cuerpoTexto, (req, res) => {
    try {
      const cuerpo = leerCuerpo(req);
      if (!cuerpo) return res.status(400).json({ ok: false, error: "El contenido enviado no es válido." });
      if (!Array.isArray(cuerpo.vehiculos) && !Array.isArray(cuerpo.parqueaderos)) {
        return res.status(400).json({ ok: false, error: "No llegó ninguna hoja de vehículos ni de parqueaderos." });
      }
      if (typeof verificarAdmin !== "function") {
        return res.status(500).json({ ok: false, error: "La verificación de administrador no está configurada." });
      }
      const admin = verificarAdmin(cuerpo.adminDocumento, cuerpo.adminPin);
      if (!admin.ok) return res.status(admin.status || 401).json({ ok: false, error: admin.error });

      const reemplazar = cuerpo.modo === "reemplazar";
      const r = revisar(cuerpo);
      const resumen = resumenDe(r);
      const conErrores = (resumen.vehiculos?.errores || 0) + (resumen.parqueaderos?.errores || 0);
      if (reemplazar && conErrores > 0) {
        return res.status(400).json({
          ok: false,
          error: "No se puede reemplazar mientras haya filas con errores, porque se perderían. Corrígelas o usa \"agregar y actualizar\".",
          resumen,
        });
      }

      const sello = ahoraBogota();
      const respaldar = (ruta, nombre) => {
        if (!fs.existsSync(ruta)) return;
        const carpeta = path.join(baseDir, CARPETA_RESPALDOS);
        if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });
        fs.copyFileSync(ruta, path.join(carpeta, `${nombre}_antes_importar_${sello}.csv`));
      };
      const guardar = (ruta, encabezados, filas) => {
        const temporal = `${ruta}.tmp`;
        const lineas = filas.map((f) => encabezados.map((e) => limpiar(f[e])).join(";"));
        const contenido = "\uFEFF" + encabezados.join(";") + "\r\n" + lineas.map((l) => l + "\r\n").join("");
        try {
          fs.writeFileSync(temporal, contenido, "utf8");
          fs.renameSync(temporal, ruta);
        } catch (err) {
          try { fs.unlinkSync(temporal); } catch (_) { /* ya no existe */ }
          throw err;
        }
      };
      const siguienteNumero = (filas, campo, prefijo) =>
        filas.reduce((m, f) => Math.max(m, Number(String(f[campo]).replace(prefijo, "")) || 0), 0) + 1;

      // ----- vehículos -----
      if (r.vehiculos) {
        const guardados = cargarVehiculos(rutaVeh);
        const buenas = r.vehiculos.filter((f) => f.estado === "nuevo" || f.estado === "actualizar");
        let final = reemplazar ? [] : guardados.slice();
        let n = siguienteNumero(guardados, "ID_Vehiculo", "VEH-");
        const todasBuenas = reemplazar ? r.vehiculos.filter((f) => f.estado !== "error") : buenas;
        todasBuenas.forEach((f) => {
          const pos = final.findIndex((v) => compacto(v.Placa) === compacto(f.datos.Placa));
          const previo = guardados.find((v) => compacto(v.Placa) === compacto(f.datos.Placa));
          if (pos >= 0) final[pos] = { ...final[pos], ...f.datos };
          else final.push({ ID_Vehiculo: previo ? previo.ID_Vehiculo : `VEH-${String(n++).padStart(3, "0")}`, ...f.datos });
        });
        respaldar(rutaVeh, "Vehiculos");
        guardar(rutaVeh, ENC_VEH, final);
      }

      // ----- parqueaderos -----
      if (r.parqueaderos) {
        const guardados = cargarParqueaderos(rutaPar);
        const buenas = r.parqueaderos.filter((f) => f.estado === "nuevo" || f.estado === "actualizar");
        let final = reemplazar ? [] : guardados.slice();
        let n = siguienteNumero(guardados, "ID_Parqueadero", "PAR-");
        const todasBuenas = reemplazar ? r.parqueaderos.filter((f) => f.estado !== "error") : buenas;
        todasBuenas.forEach((f) => {
          const pos = final.findIndex((p) => compacto(p.Codigo) === compacto(f.datos.Codigo));
          const previo = guardados.find((p) => compacto(p.Codigo) === compacto(f.datos.Codigo));
          if (pos >= 0) final[pos] = { ...final[pos], ...f.datos };
          else final.push({ ID_Parqueadero: previo ? previo.ID_Parqueadero : `PAR-${String(n++).padStart(3, "0")}`, ...f.datos });
        });
        respaldar(rutaPar, "Parqueaderos");
        guardar(rutaPar, ENC_PAR, final);
      }

      const partes = [];
      if (resumen.vehiculos) partes.push(`Vehículos: ${resumen.vehiculos.nuevos} nuevo(s) y ${resumen.vehiculos.actualizar} actualizado(s).`);
      if (resumen.parqueaderos) partes.push(`Parqueaderos: ${resumen.parqueaderos.nuevos} nuevo(s) y ${resumen.parqueaderos.actualizar} actualizado(s).`);
      if (conErrores > 0) partes.push(`${conErrores} fila(s) con errores no se guardaron.`);
      console.log(`📦 Inventario importado por ${admin.nombre}: ${partes.join(" ")}`);
      return res.json({ ok: true, mensaje: `Guardado por ${admin.nombre}. ${partes.join(" ")}`, resumen });
    } catch (err) {
      return errorDeArchivo(res, err);
    }
  });

  return router;
};