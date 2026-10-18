// routes/consultaSeguridadRoutes.js
// Consulta LIMITADA para la portería: residentes, vehículos y parqueaderos.
// Solo entrega lo que un vigilante necesita. NO entrega documentos, correos ni pagos.
// Para vehículos y parqueaderos entrega el nombre y teléfono de contacto del inmueble
// (hasta 3 personas, el propietario primero) para poder avisar en una emergencia.
//
// Montaje en app.js:
//   const consultaSeguridadRoutes = require("./routes/consultaSeguridadRoutes");
//   app.use("/api/consulta-seguridad", consultaSeguridadRoutes(baseResidencialDir));
//
// Rutas:
//   GET /api/consulta-seguridad/residentes?q=texto
//   GET /api/consulta-seguridad/vehiculos?q=texto
//   GET /api/consulta-seguridad/configuracion   -> { manejaParqueaderos: true|false }
//
// Parqueaderos opcionales: si no hay parqueaderos cargados (conjunto con parqueadero
// comunal), la consulta trabaja solo con vehículos y no muestra nada de parqueaderos.

const express = require("express");
const fs = require("fs");
const path = require("path");

const ARCHIVO_HABITANTES = "Habitantes.csv";
const ARCHIVO_VEHICULOS = "Vehiculos.csv";
const ARCHIVO_PARQUEADEROS = "Parqueaderos.csv";
const MINIMO_CARACTERES = 2;
const MAXIMO_RESULTADOS = 20;

// Minúsculas y sin tildes, para que "perez" encuentre "Pérez".
const normalizar = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

// Solo letras y números: "T-2", "t 2" y "T2" se tratan igual; "ABC-123" y "abc123" también.
const compacto = (valor) => normalizar(valor).replace(/[^a-z0-9]/g, "");

// Acepta 2026-10-09 o 09/10/2026. Devuelve "AAAAMMDD" o "".
const claveFecha = (valor) => {
  const t = String(valor ?? "").trim();
  let m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}${m[2].padStart(2, "0")}${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}${m[2].padStart(2, "0")}${m[1].padStart(2, "0")}`;
  return "";
};

const hoyClave = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).replace(/-/g, "");

// Separa una línea CSV respetando comillas.
const separarLinea = (linea, delimitador) => {
  const celdas = [];
  let actual = "";
  let entreComillas = false;
  for (let i = 0; i < linea.length; i += 1) {
    const c = linea[i];
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') { actual += '"'; i += 1; }
      else entreComillas = !entreComillas;
    } else if (c === delimitador && !entreComillas) {
      celdas.push(actual); actual = "";
    } else {
      actual += c;
    }
  }
  celdas.push(actual);
  return celdas.map((x) => x.trim());
};

// Lee un CSV. Las columnas quedan con nombre "compacto" (sin tildes, barras ni guiones):
// "Torre/Manzana" y "TorreManzana" se leen igual. Acepta archivos UTF-8 o Windows (Excel).
const leerTabla = (ruta) => {
  if (!fs.existsSync(ruta)) return [];
  const buffer = fs.readFileSync(ruta);
  let texto = buffer.toString("utf8");
  if (texto.includes("\uFFFD")) texto = buffer.toString("latin1");
  texto = texto.replace(/^\uFEFF/, "");
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lineas.length < 2) return [];
  const delimitador = (lineas[0].match(/;/g) || []).length >= (lineas[0].match(/,/g) || []).length ? ";" : ",";
  const encabezados = separarLinea(lineas[0], delimitador).map(compacto);
  return lineas.slice(1).map((linea) => {
    const valores = separarLinea(linea, delimitador);
    const fila = {};
    encabezados.forEach((e, i) => { fila[e] = valores[i] ?? ""; });
    return fila;
  });
};

const dato = (fila, ...claves) => {
  for (const c of claves) {
    const v = String(fila[c] ?? "").trim();
    if (v) return v;
  }
  return "";
};

module.exports = (baseDir) => {
  const router = express.Router();
  const rutaHabitantes = path.join(baseDir, ARCHIVO_HABITANTES);
  const rutaVehiculos = path.join(baseDir, ARCHIVO_VEHICULOS);
  const rutaParqueaderos = path.join(baseDir, ARCHIVO_PARQUEADEROS);

  const validarConsulta = (req, res) => {
    const consulta = String(req.query.q || "").trim();
    if (consulta.length < MINIMO_CARACTERES) {
      res.status(400).json({
        error: `Escribe al menos ${MINIMO_CARACTERES} caracteres para buscar.`,
      });
      return null;
    }
    return consulta;
  };

  // Parqueaderos como una lista de { codigo, tipo, idInmueble, torreManzana, aptoCasa }.
  // Acepta el formato nuevo (una fila por parqueadero) y el antiguo (Parqueadero1 / Parqueadero2).
  const leerParqueaderos = () => {
    const cupos = [];
    leerTabla(rutaParqueaderos).forEach((f) => {
      const base = {
        tipo: dato(f, "tipo") || "Residente",
        idInmueble: dato(f, "idinmueble"),
        torreManzana: dato(f, "torremanzana"),
        aptoCasa: dato(f, "aptocasa"),
      };
      const codigo = dato(f, "codigo");
      if (codigo) {
        cupos.push({ ...base, codigo });
      } else {
        ["parqueadero1", "parqueadero2"].forEach((col) => {
          const c = dato(f, col);
          if (c) cupos.push({ ...base, codigo: c });
        });
      }
    });
    return cupos;
  };

  // Contactos de un inmueble, para emergencias con un vehículo: residentes activos con
  // teléfono, el propietario primero. Se leen de Habitantes, así el número siempre está al día.
  const MAX_CONTACTOS = 3;
  const prioridadTipo = (tipo) => {
    const t = normalizar(tipo);
    if (t.includes("propiet")) return 0;
    if (t.includes("arrend")) return 1;
    return 2;
  };
  const leerContactos = () => {
    const hoy = hoyClave();
    return leerTabla(rutaHabitantes)
      .map((h) => ({
        nombre: dato(h, "nombreresidente", "nombre"),
        tipo: dato(h, "tipo", "tiporesidente"),
        telefono: dato(h, "telefono"),
        idInmueble: dato(h, "idinmueble"),
        torreManzana: dato(h, "torremanzana"),
        aptoCasa: dato(h, "aptocasa"),
        salida: claveFecha(dato(h, "fechasalida")),
      }))
      .filter((h) => h.nombre && h.telefono && h.torreManzana && h.aptoCasa && (!h.salida || h.salida > hoy));
  };
  const contactosDe = (contactos, idInmueble, torre, apto) =>
    contactos
      .filter((h) =>
        idInmueble && h.idInmueble
          ? compacto(h.idInmueble) === compacto(idInmueble)
          : compacto(`${h.torreManzana} ${h.aptoCasa}`) === compacto(`${torre} ${apto}`)
      )
      .sort((x, y) => prioridadTipo(x.tipo) - prioridadTipo(y.tipo))
      .slice(0, MAX_CONTACTOS)
      .map(({ nombre, tipo, telefono }) => ({ nombre, tipo, telefono }));

  router.get("/configuracion", (req, res) => {
    try {
      return res.json({ manejaParqueaderos: leerParqueaderos().length > 0 });
    } catch (error) {
      console.error("❌ Error leyendo la configuración de parqueaderos:", error);
      return res.status(500).json({ error: "No se pudo leer la configuración." });
    }
  });

  router.get("/residentes", (req, res) => {
    try {
      const consulta = validarConsulta(req, res);
      if (consulta === null) return undefined;

      const q = normalizar(consulta);
      const qCompacto = compacto(consulta);
      const hoy = hoyClave();

      const resultados = leerTabla(rutaHabitantes)
        .map((h) => ({
          nombre: dato(h, "nombreresidente", "nombre"),
          torreManzana: dato(h, "torremanzana"),
          aptoCasa: dato(h, "aptocasa"),
          tipo: dato(h, "tipo"),
          telefono: dato(h, "telefono"),
          salida: claveFecha(dato(h, "fechasalida")),
        }))
        // Solo personas que viven en un inmueble y que no han salido del conjunto.
        .filter((h) => h.nombre && h.torreManzana && h.aptoCasa && (!h.salida || h.salida > hoy))
        .filter((h) => {
          const destino = compacto(`${h.torreManzana} ${h.aptoCasa}`);
          return (
            normalizar(h.nombre).includes(q) ||
            normalizar(`${h.torreManzana} ${h.aptoCasa}`).includes(q) ||
            (qCompacto.length >= MINIMO_CARACTERES && destino.includes(qCompacto))
          );
        })
        .slice(0, MAXIMO_RESULTADOS)
        // Se entregan SOLO estos campos.
        .map(({ nombre, torreManzana, aptoCasa, tipo, telefono }) => ({ nombre, torreManzana, aptoCasa, tipo, telefono }));

      return res.json({ resultados });
    } catch (error) {
      console.error("❌ Error en consulta de residentes:", error);
      return res.status(500).json({ error: "No se pudo realizar la consulta." });
    }
  });

  router.get("/vehiculos", (req, res) => {
    try {
      const consulta = validarConsulta(req, res);
      if (consulta === null) return undefined;

      const qCompacto = compacto(consulta);
      const cupos = leerParqueaderos();
      const manejaParqueaderos = cupos.length > 0;
      const contactos = leerContactos();

      // Parqueaderos de un inmueble (por ID_Inmueble o, si no lo trae, por torre y apto).
      const cuposDe = (idInmueble, torre, apto) =>
        cupos.filter((c) =>
          idInmueble && c.idInmueble
            ? compacto(c.idInmueble) === compacto(idInmueble)
            : compacto(`${c.torreManzana} ${c.aptoCasa}`) === compacto(`${torre} ${apto}`)
        );

      const vehiculos = leerTabla(rutaVehiculos)
        .map((v) => ({
          placa: dato(v, "placa").toUpperCase().replace(/[\s-]/g, ""),
          tipo: dato(v, "tipo"),
          marca: dato(v, "marca"),
          color: dato(v, "color"),
          idInmueble: dato(v, "idinmueble"),
          torreManzana: dato(v, "torremanzana"),
          aptoCasa: dato(v, "aptocasa"),
          estado: normalizar(dato(v, "estado")),
        }))
        .filter((v) => v.placa && v.estado !== "retirado" && v.estado !== "inactivo")
        .map((v) => ({ ...v, cupos: manejaParqueaderos ? cuposDe(v.idInmueble, v.torreManzana, v.aptoCasa) : [] }))
        .filter((v) => {
          const destino = compacto(`${v.torreManzana} ${v.aptoCasa}`);
          return (
            compacto(v.placa).includes(qCompacto) ||
            destino.includes(qCompacto) ||
            // También se encuentra el vehículo buscando el código de su parqueadero.
            v.cupos.some((c) => compacto(c.codigo) === qCompacto)
          );
        })
        .slice(0, MAXIMO_RESULTADOS)
        // Se entregan SOLO estos campos.
        .map((v) => ({
          placa: v.placa,
          tipo: v.tipo,
          marca: v.marca,
          color: v.color,
          torreManzana: v.torreManzana,
          aptoCasa: v.aptoCasa,
          parqueaderos: v.cupos.map((c) => c.codigo),
          contactos: contactosDe(contactos, v.idInmueble, v.torreManzana, v.aptoCasa),
        }));

      // Parqueaderos que coinciden con la búsqueda (por código o por torre y apto),
      // para saber a quién pertenece aunque no tenga vehículo registrado.
      const parqueaderos = manejaParqueaderos
        ? cupos
            .filter((c) => {
              const destino = compacto(`${c.torreManzana} ${c.aptoCasa}`);
              return compacto(c.codigo).includes(qCompacto) || destino.includes(qCompacto);
            })
            .slice(0, MAXIMO_RESULTADOS)
            .map((c) => ({
              codigo: c.codigo,
              tipo: c.tipo,
              torreManzana: c.torreManzana,
              aptoCasa: c.aptoCasa,
              contactos: contactosDe(contactos, c.idInmueble, c.torreManzana, c.aptoCasa),
            }))
        : [];

      return res.json({ manejaParqueaderos, vehiculos, parqueaderos });
    } catch (error) {
      console.error("❌ Error en consulta de vehículos:", error);
      return res.status(500).json({ error: "No se pudo realizar la consulta." });
    }
  });

  return router;
};