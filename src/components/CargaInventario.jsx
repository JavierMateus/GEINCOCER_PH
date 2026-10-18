// src/components/CargaInventario.jsx
// Carga de UN solo Excel con hasta tres hojas: Habitantes, Vehiculos y Parqueaderos.
// 1. Lee el archivo en el navegador (también acepta un CSV de vehículos o de parqueaderos).
// 2. El servidor revisa cada fila y no guarda nada (revisión automática contra Habitantes).
// 3. El administrador ve la vista previa, confirma y escribe su PIN.
// 4. Se guardan solo las filas correctas. Nada se borra.
//
// Props:
//   archivo     -> archivo elegido por el administrador
//   usuario     -> el administrador que ingresó (se usa su documento para el PIN)
//   onCerrar    -> cierra la ventana
//   onImportado -> recibe la lista actualizada de habitantes (si se guardaron habitantes)

import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { API_BASE } from "../config";

const ESTADOS = {
  nuevo: { texto: "Nuevo", color: "#166534", fondo: "#dcfce7" },
  actualizar: { texto: "Actualizar", color: "#1d4ed8", fondo: "#dbeafe" },
  sin_cambios: { texto: "Sin cambios", color: "#475569", fondo: "#f1f5f9" },
  error: { texto: "Error", color: "#b91c1c", fondo: "#fee2e2" },
};

const HOJAS = {
  habitantes: { titulo: "Habitantes", nombreHoja: "Habitantes" },
  vehiculos: { titulo: "Vehículos", nombreHoja: "Vehiculos" },
  parqueaderos: { titulo: "Parqueaderos", nombreHoja: "Parqueaderos" },
};

const ENCABEZADOS_PLANTILLA = {
  Habitantes: ["ID_Habitante", "NombreResidente", "DocumentoResidente", "Rol", "ID_Inmueble", "TorreManzana", "AptoCasa", "Tipo", "Telefono", "Email", "FechaEntrada", "FechaSalida"],
  Vehiculos: ["Placa", "Tipo", "Marca", "Color", "ID_Inmueble", "TorreManzana", "AptoCasa", "Estado"],
  Parqueaderos: ["Codigo", "Tipo", "ID_Inmueble", "TorreManzana", "AptoCasa"],
};

const INSTRUCCIONES = [
  "Plantilla de carga de GEINCOCER: habitantes, vehículos y parqueaderos",
  "",
  "1. Llena solo las hojas que necesites. No cambies los encabezados (la primera fila de cada hoja).",
  "2. ID_Inmueble, TorreManzana y AptoCasa deben escribirse IGUAL que en la hoja Habitantes (por ejemplo: INM007, T-1, 104).",
  "3. Vehiculos: la placa es obligatoria. Tipo: Carro, Moto, Bicicleta u Otro. Estado: activo o retirado.",
  "4. Parqueaderos: una fila por parqueadero. Tipo: Residente (necesita inmueble), Visitante o Comunal.",
  "5. Si el conjunto NO tiene parqueaderos propios (parqueadero comunal), deja la hoja Parqueaderos vacía. Los parqueaderos se ocultan solos.",
  "6. Nada se borra al cargar: para retirar un vehículo pon Estado = retirado.",
  "7. Antes de guardar, la app revisa todo y te muestra fila por fila qué está bien y qué hay que corregir.",
];

export const descargarPlantillaInventario = () => {
  const libro = XLSX.utils.book_new();
  const hojaInstr = XLSX.utils.aoa_to_sheet(INSTRUCCIONES.map((l) => [l]));
  hojaInstr["!cols"] = [{ wch: 120 }];
  XLSX.utils.book_append_sheet(libro, hojaInstr, "Instrucciones");
  Object.entries(ENCABEZADOS_PLANTILLA).forEach(([nombre, enc]) => {
    const hoja = XLSX.utils.aoa_to_sheet([enc]);
    hoja["!cols"] = enc.map((e) => ({ wch: Math.max(14, e.length + 2) }));
    XLSX.utils.book_append_sheet(libro, hoja, nombre);
  });
  XLSX.writeFile(libro, "Plantilla_carga_GEINCOCER.xlsx");
};

const compacto = (v) =>
  String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const fechaTexto = (y, m, d) => `${d}/${String(m).padStart(2, "0")}/${y}`;

// Una hoja de Excel -> filas { columna: valor }. Los números quedan como texto ("104", no 104).
const hojaAFilas = (hoja, conFechas) => {
  Object.keys(hoja).forEach((ref) => {
    if (ref.startsWith("!")) return;
    const celda = hoja[ref];
    if (conFechas && celda.t === "n" && celda.z && XLSX.SSF.is_date(celda.z)) {
      const f = XLSX.SSF.parse_date_code(celda.v);
      if (f) hoja[ref] = { t: "s", v: fechaTexto(f.y, f.m, f.d) };
    } else if (celda.t === "n") {
      hoja[ref] = { t: "s", v: String(celda.v) };
    }
  });
  return XLSX.utils.sheet_to_json(hoja, { defval: "", raw: true });
};

// Devuelve { habitantes, vehiculos, parqueaderos }. Cada una es una lista de filas, o null si no vino.
export const leerLibro = async (archivo) => {
  const nombre = archivo.name.toLowerCase();
  const buffer = await archivo.arrayBuffer();
  const salida = { habitantes: null, vehiculos: null, parqueaderos: null };

  if (nombre.endsWith(".csv") || nombre.endsWith(".txt")) {
    let texto = new TextDecoder("utf-8").decode(buffer);
    if (texto.includes("\uFFFD")) texto = new TextDecoder("windows-1252").decode(buffer);
    texto = texto.replace(/^\uFEFF/, "");
    const primera = texto.split(/\r?\n/)[0] || "";
    const separador = primera.split(";").length >= primera.split(",").length ? ";" : ",";
    const libro = XLSX.read(texto, { type: "string", FS: separador, raw: true });
    const filas = hojaAFilas(libro.Sheets[libro.SheetNames[0]], false);
    const columnas = primera.split(separador).map(compacto);
    if (columnas.includes("placa")) salida.vehiculos = filas;
    else if (columnas.includes("codigo") || columnas.includes("parqueadero1") || columnas.includes("parqueadero2")) salida.parqueaderos = filas;
    else if (columnas.includes("documentoresidente") || columnas.includes("nombreresidente")) salida.habitantes = filas;
    return salida;
  }

  const libro = XLSX.read(buffer, { type: "array" });
  libro.SheetNames.forEach((n) => {
    const c = compacto(n);
    if (c.includes("instruccion")) return;
    const hoja = libro.Sheets[n];
    if (c.includes("habitante")) salida.habitantes = hojaAFilas(hoja, true);
    else if (c.includes("vehicul")) salida.vehiculos = hojaAFilas(hoja, false);
    else if (c.includes("parqueader")) salida.parqueaderos = hojaAFilas(hoja, false);
  });
  return salida;
};

const enviar = async (ruta, cuerpo) => {
  // Se envía como texto para que no lo frene el límite de tamaño de express.json()
  const resp = await fetch(`${API_BASE}${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(cuerpo),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.ok === false) {
    const err = new Error(data.error || "El servidor no respondió correctamente.");
    err.estado = resp.status;
    throw err;
  }
  return data;
};

const contar = (filas) => {
  const r = { total: filas.length, nuevos: 0, actualizar: 0, sinCambios: 0, errores: 0, conAvisos: 0 };
  filas.forEach((f) => {
    if (f.estado === "nuevo") r.nuevos += 1;
    else if (f.estado === "actualizar") r.actualizar += 1;
    else if (f.estado === "sin_cambios") r.sinCambios += 1;
    else r.errores += 1;
    if (f.avisos && f.avisos.length) r.conAvisos += 1;
  });
  return r;
};

const COLUMNAS = {
  habitantes: [
    ["Nombre", (d) => d.NombreResidente],
    ["Documento", (d) => d.DocumentoResidente],
    ["Rol", (d) => d.Rol],
    ["Inmueble", (d) => [d.ID_Inmueble, d.TorreManzana, d.AptoCasa].filter(Boolean).join(" · ")],
  ],
  vehiculos: [
    ["Placa", (d) => d.Placa],
    ["Tipo", (d) => d.Tipo],
    ["Marca / color", (d) => [d.Marca, d.Color].filter(Boolean).join(", ")],
    ["Inmueble", (d) => [d.ID_Inmueble, d.TorreManzana, d.AptoCasa].filter(Boolean).join(" · ")],
    ["Estado", (d) => d.Estado],
  ],
  parqueaderos: [
    ["Código", (d) => d.Codigo],
    ["Tipo", (d) => d.Tipo],
    ["Inmueble", (d) => [d.ID_Inmueble, d.TorreManzana, d.AptoCasa].filter(Boolean).join(" · ")],
  ],
};

function CargaInventario({ archivo, usuario, onCerrar, onImportado }) {
  const [filas, setFilas] = useState({ habitantes: null, vehiculos: null, parqueaderos: null });
  const [resultado, setResultado] = useState({ habitantes: null, vehiculos: null, parqueaderos: null });
  const [extra, setExtra] = useState([]);
  const [advertencias, setAdvertencias] = useState([]);
  const [hoja, setHoja] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [estadoProceso, setEstadoProceso] = useState("leyendo"); // leyendo | listo | guardando | guardado
  const [error, setError] = useState("");
  const [mensajeFinal, setMensajeFinal] = useState("");
  const [reemplazar, setReemplazar] = useState(false);
  const [pinAbierto, setPinAbierto] = useState(false);
  const [credenciales, setCredenciales] = useState({ documento: "", pin: "" });
  const [errorPin, setErrorPin] = useState("");

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const leidas = await leerLibro(archivo);
        const hayHabitantes = Array.isArray(leidas.habitantes) && leidas.habitantes.length > 0;
        const hayInventario = Array.isArray(leidas.vehiculos) || Array.isArray(leidas.parqueaderos);
        if (!hayHabitantes && !hayInventario) {
          throw new Error("No encontré datos. El Excel debe tener hojas llamadas Habitantes, Vehiculos o Parqueaderos (puedes bajar la plantilla).");
        }
        const res = { habitantes: null, vehiculos: null, parqueaderos: null };
        let inmuebles = [];

        // Habitantes: usa la revisión que ya existe, sin modificarla.
        if (hayHabitantes) {
          const datos = await enviar("/api/habitantes/validar", { filas: leidas.habitantes });
          res.habitantes = datos.filas || [];
          inmuebles = res.habitantes
            .filter((f) => f.estado !== "error" && f.datos && f.datos.TorreManzana && f.datos.AptoCasa)
            .map((f) => ({ id: f.datos.ID_Inmueble || "", torre: f.datos.TorreManzana, apto: f.datos.AptoCasa }));
        }

        // Vehículos y parqueaderos: se comparan con Habitantes (los ya guardados y los de esta hoja).
        let avisosServidor = [];
        if (hayInventario) {
          const datos = await enviar("/api/inventario/validar", {
            vehiculos: leidas.vehiculos || undefined,
            parqueaderos: leidas.parqueaderos || undefined,
            inmueblesExtra: inmuebles,
          });
          res.vehiculos = datos.vehiculos || (leidas.vehiculos ? [] : null);
          res.parqueaderos = datos.parqueaderos || (leidas.parqueaderos ? [] : null);
          avisosServidor = datos.advertencias || [];
        }
        if (!activo) return;
        setFilas({ habitantes: hayHabitantes ? leidas.habitantes : null, vehiculos: leidas.vehiculos, parqueaderos: leidas.parqueaderos });
        setResultado(res);
        setExtra(inmuebles);
        setAdvertencias(avisosServidor);
        setHoja(["habitantes", "vehiculos", "parqueaderos"].find((h) => res[h] !== null) || "");
        setEstadoProceso("listo");
      } catch (err) {
        if (!activo) return;
        setError(err.message || "No se pudo leer el archivo.");
        setEstadoProceso("listo");
      }
    })();
    return () => { activo = false; };
  }, [archivo]);

  const hojasPresentes = ["habitantes", "vehiculos", "parqueaderos"].filter((h) => resultado[h] !== null);
  const conteos = useMemo(() => {
    const c = {};
    hojasPresentes.forEach((h) => { c[h] = contar(resultado[h]); });
    return c;
  }, [resultado]); // eslint-disable-line react-hooks/exhaustive-deps

  const hayInventario = resultado.vehiculos !== null || resultado.parqueaderos !== null;
  const erroresInventario = (conteos.vehiculos?.errores || 0) + (conteos.parqueaderos?.errores || 0);
  const porGuardar = hojasPresentes.reduce((t, h) => t + conteos[h].nuevos + conteos[h].actualizar, 0);
  const puedeGuardar = (porGuardar > 0 || (reemplazar && hayInventario)) && estadoProceso !== "guardando";

  const filasVisibles = useMemo(() => {
    const lista = hoja ? resultado[hoja] || [] : [];
    if (filtro === "todas") return lista;
    if (filtro === "avisos") return lista.filter((f) => f.avisos && f.avisos.length);
    return lista.filter((f) => f.estado === filtro);
  }, [resultado, hoja, filtro]);

  const descargarErrores = () => {
    const libro = XLSX.utils.book_new();
    hojasPresentes.forEach((h) => {
      const conError = (resultado[h] || []).filter((f) => f.estado === "error");
      if (!conError.length) return;
      const datos = conError.map((f) => ({ ...(filas[h]?.[f.fila - 2] || {}), Errores: f.errores.join(" | ") }));
      XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(datos), HOJAS[h].nombreHoja);
    });
    XLSX.writeFile(libro, "Filas_por_corregir.xlsx");
  };

  const pedirGuardar = () => {
    setErrorPin("");
    if (hayInventario) {
      setCredenciales({ documento: usuario?.documento || "", pin: "" });
      setPinAbierto(true);
    } else {
      guardar();
    }
  };

  const guardar = async () => {
    setEstadoProceso("guardando");
    setError("");
    setErrorPin("");
    try {
      const partes = [];
      if (hayInventario) {
        const enviarVeh = filas.vehiculos && (filas.vehiculos.length > 0 || reemplazar);
        const enviarPar = filas.parqueaderos && (filas.parqueaderos.length > 0 || reemplazar);
        const datos = await enviar("/api/inventario/importar", {
          vehiculos: enviarVeh ? filas.vehiculos : undefined,
          parqueaderos: enviarPar ? filas.parqueaderos : undefined,
          inmueblesExtra: extra,
          modo: reemplazar ? "reemplazar" : "agregar",
          adminDocumento: credenciales.documento,
          adminPin: credenciales.pin,
        });
        partes.push(datos.mensaje);
      }
      if (resultado.habitantes && (conteos.habitantes.nuevos + conteos.habitantes.actualizar) > 0) {
        const datos = await enviar("/api/habitantes/importar", { filas: filas.habitantes });
        partes.push(datos.mensaje);
        const resp = await fetch(`${API_BASE}/api/habitantes`, { cache: "no-store" });
        const lista = await resp.json();
        if (onImportado) onImportado(Array.isArray(lista.habitantes) ? lista.habitantes : []);
      }
      window.dispatchEvent(new Event("inventario-actualizado"));
      setPinAbierto(false);
      setMensajeFinal(partes.join(" "));
      setEstadoProceso("guardado");
    } catch (err) {
      if (pinAbierto) setErrorPin(err.message);
      else setError(err.message);
      setEstadoProceso("listo");
    }
  };

  const chip = (clave, texto, valor, color) => (
    <button
      type="button"
      key={clave}
      onClick={() => setFiltro(clave)}
      style={{ border: filtro === clave ? `2px solid ${color}` : "2px solid transparent", background: "#f8fafc", borderRadius: 10, padding: "8px 14px", cursor: "pointer", textAlign: "left" }}
    >
      <div style={{ fontSize: 12, color: "#64748b" }}>{texto}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{valor}</div>
    </button>
  );

  const c = conteos[hoja];
  const columnas = COLUMNAS[hoja] || [];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#0008", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 1100, maxHeight: "94vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, color: "#188aac" }}>Carga de habitantes, vehículos y parqueaderos</h2>
            <div style={{ color: "#64748b", fontSize: 14 }}>Archivo: {archivo?.name}</div>
          </div>
          <button type="button" onClick={onCerrar} disabled={estadoProceso === "guardando"} style={{ background: "#64748b", color: "#fff", border: "none", borderRadius: 7, padding: "6px 16px", cursor: "pointer" }}>
            {estadoProceso === "guardado" ? "Cerrar" : "Cancelar"}
          </button>
        </div>

        {estadoProceso === "leyendo" && <p style={{ color: "#218290" }}>Revisando el archivo...</p>}
        {error && <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "#fee2e2", color: "#b91c1c", fontWeight: 600 }}>{error}</div>}
        {mensajeFinal && <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "#dcfce7", color: "#166534", fontWeight: 600 }}>{mensajeFinal}</div>}
        {advertencias.map((a) => (
          <div key={a} style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "#fef3c7", color: "#92400e", fontWeight: 600 }}>{a}</div>
        ))}

        {hojasPresentes.length > 0 && c && (
          <>
            <div role="tablist" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0 0" }}>
              {hojasPresentes.map((h) => (
                <button
                  key={h}
                  type="button"
                  role="tab"
                  aria-selected={hoja === h}
                  onClick={() => { setHoja(h); setFiltro("todas"); }}
                  style={{ padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontWeight: 700, border: "2px solid #218290", background: hoja === h ? "#218290" : "#fff", color: hoja === h ? "#fff" : "#218290" }}
                >
                  {HOJAS[h].titulo} ({conteos[h].total}){conteos[h].errores > 0 ? ` · ${conteos[h].errores} con errores` : ""}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "16px 0" }}>
              {chip("todas", "Filas leídas", c.total, "#0f172a")}
              {chip("nuevo", "Nuevos", c.nuevos, "#166534")}
              {chip("actualizar", "Se actualizan", c.actualizar, "#1d4ed8")}
              {chip("sin_cambios", "Sin cambios", c.sinCambios, "#475569")}
              {chip("error", "Con errores", c.errores, "#b91c1c")}
              {chip("avisos", "Con avisos", c.conAvisos, "#b45309")}
            </div>

            <p style={{ color: "#475569", fontSize: 13, marginTop: 0 }}>
              Las filas en <strong style={{ color: "#b91c1c" }}>rojo</strong> no se guardarán. Los avisos en{" "}
              <strong style={{ color: "#b45309" }}>naranja</strong> no impiden guardar: son correcciones automáticas.
            </p>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                    <th style={{ padding: 8 }}>Fila</th>
                    <th style={{ padding: 8 }}>Estado</th>
                    {columnas.map(([titulo]) => <th key={titulo} style={{ padding: 8 }}>{titulo}</th>)}
                    <th style={{ padding: 8 }}>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filasVisibles.map((f, i) => {
                    const e = ESTADOS[f.estado] || ESTADOS.sin_cambios;
                    const d = f.datos || {};
                    return (
                      <tr key={`${f.fila}-${i}`} style={{ borderTop: "1px solid #e2e8f0", background: f.estado === "error" ? "#fff5f5" : "#fff" }}>
                        <td style={{ padding: 8 }}>{f.fila}</td>
                        <td style={{ padding: 8 }}>
                          <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: e.color, background: e.fondo, whiteSpace: "nowrap" }}>{e.texto}</span>
                        </td>
                        {columnas.map(([titulo, leer]) => <td key={titulo} style={{ padding: 8, whiteSpace: "nowrap" }}>{leer(d) || "-"}</td>)}
                        <td style={{ padding: 8 }}>
                          {(f.errores || []).map((t, k) => <div key={`e${k}`} style={{ color: "#b91c1c" }}>• {t}</div>)}
                          {(f.avisos || []).map((t, k) => <div key={`a${k}`} style={{ color: "#b45309" }}>• {t}</div>)}
                          {f.estado === "actualizar" && f.cambios && <div style={{ color: "#1d4ed8" }}>Cambia: {f.cambios.join(", ")}</div>}
                        </td>
                      </tr>
                    );
                  })}
                  {!filasVisibles.length && (
                    <tr><td colSpan={columnas.length + 3} style={{ padding: 12, textAlign: "center", color: "#64748b" }}>No hay filas en este grupo.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {hayInventario && estadoProceso !== "guardado" && (
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 16, color: "#475569", fontSize: 14 }}>
                <input type="checkbox" checked={reemplazar} disabled={erroresInventario > 0} onChange={(e) => setReemplazar(e.target.checked)} style={{ marginTop: 3 }} />
                <span>
                  <strong>Reemplazar la lista anterior</strong> de vehículos y parqueaderos por lo que dice este archivo
                  (lo que no esté, se quita de la lista; se guarda una copia de respaldo). Sirve, por ejemplo, para dejar sin
                  parqueaderos un conjunto con parqueadero comunal: carga una hoja Parqueaderos vacía.
                  {erroresInventario > 0 && <em style={{ color: "#b91c1c" }}> No disponible mientras haya filas con errores.</em>}
                </span>
              </label>
            )}

            {estadoProceso !== "guardado" && (
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 18 }}>
                {hojasPresentes.some((h) => conteos[h].errores > 0) && (
                  <button type="button" onClick={descargarErrores} style={{ background: "#fff", color: "#b91c1c", border: "2px solid #b91c1c", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer" }}>
                    Descargar filas con errores
                  </button>
                )}
                <button
                  type="button"
                  onClick={pedirGuardar}
                  disabled={!puedeGuardar}
                  style={{ background: puedeGuardar ? "#218290" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 700, cursor: puedeGuardar ? "pointer" : "not-allowed" }}
                >
                  {estadoProceso === "guardando" ? "Guardando..." : puedeGuardar ? `Guardar ${porGuardar} fila(s) correcta(s)` : "No hay nada nuevo para guardar"}
                </button>
              </div>
            )}
          </>
        )}

        {pinAbierto && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001 }}>
            <div style={{ background: "#fff", borderRadius: 14, padding: 22, width: "min(420px, 92vw)", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
              <h3 style={{ margin: "0 0 6px", color: "#17677f" }}>Confirmar con tu PIN</h3>
              <p style={{ margin: "0 0 14px", color: "#475569", fontSize: "0.92em" }}>
                Se guardarán {porGuardar} fila(s) correcta(s){reemplazar ? " y se reemplazará la lista anterior" : ""}. Antes se hace una copia de respaldo. Solo un administrador puede hacerlo.
              </p>
              <label htmlFor="inv-doc" style={{ display: "block", marginBottom: 4, fontWeight: 600, color: "#475569" }}>Documento del administrador</label>
              <input id="inv-doc" value={credenciales.documento} onChange={(e) => setCredenciales({ ...credenciales, documento: e.target.value })} style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, marginBottom: 10 }} />
              <label htmlFor="inv-pin" style={{ display: "block", marginBottom: 4, fontWeight: 600, color: "#475569" }}>PIN del administrador</label>
              <input id="inv-pin" type="password" inputMode="numeric" autoComplete="off" value={credenciales.pin} onChange={(e) => setCredenciales({ ...credenciales, pin: e.target.value })} style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, marginBottom: 10 }} />
              {errorPin && <div style={{ padding: 10, borderRadius: 8, background: "#fee2e2", color: "#b91c1c", fontWeight: 600, marginBottom: 10 }}>{errorPin}</div>}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setPinAbierto(false)} disabled={estadoProceso === "guardando"} style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: "#e5e7eb", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
                <button type="button" onClick={guardar} disabled={estadoProceso === "guardando"} style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: "#218290", color: "#fff", cursor: "pointer", fontWeight: 700, opacity: estadoProceso === "guardando" ? 0.6 : 1 }}>
                  {estadoProceso === "guardando" ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CargaInventario;

