// src/components/CargaHabitantes.jsx
// Carga masiva de habitantes desde Excel (.xlsx/.xls) o CSV.
// 1. Lee el archivo en el navegador.
// 2. El backend revisa cada fila (/api/habitantes/validar) y no guarda nada.
// 3. El administrador ve la vista previa y confirma.
// 4. Se guardan solo las filas correctas (/api/habitantes/importar):
//    las nuevas se agregan y las que ya existen se actualizan. Nadie se borra.
//
// Props:
//   archivo     -> archivo elegido por el administrador
//   onCerrar    -> cierra la ventana
//   onImportado -> recibe la lista actualizada de habitantes despues de guardar

import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { API_BASE } from "../config";

const ESTADOS = {
  nuevo: { texto: "Nuevo", color: "#166534", fondo: "#dcfce7" },
  actualizar: { texto: "Actualizar", color: "#1d4ed8", fondo: "#dbeafe" },
  sin_cambios: { texto: "Sin cambios", color: "#475569", fondo: "#f1f5f9" },
  error: { texto: "Error", color: "#b91c1c", fondo: "#fee2e2" },
};

const fechaTexto = (y, m, d) => `${d}/${String(m).padStart(2, "0")}/${y}`;

// Lee el archivo y devuelve las filas como objetos { columna: valor }.
const leerArchivo = async (archivo) => {
  const nombre = archivo.name.toLowerCase();
  const buffer = await archivo.arrayBuffer();

  if (nombre.endsWith(".csv") || nombre.endsWith(".txt")) {
    let texto = new TextDecoder("utf-8").decode(buffer);
    if (texto.includes("\uFFFD")) texto = new TextDecoder("windows-1252").decode(buffer);
    texto = texto.replace(/^\uFEFF/, "");
    const primera = texto.split(/\r?\n/)[0] || "";
    const separador = primera.split(";").length >= primera.split(",").length ? ";" : ",";
    const libro = XLSX.read(texto, { type: "string", FS: separador, raw: true });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    return XLSX.utils.sheet_to_json(hoja, { defval: "", raw: false });
  }

  const libro = XLSX.read(buffer, { type: "array" });
  const nombreHoja =
    libro.SheetNames.find((n) => n.trim().toLowerCase() === "habitantes") ||
    libro.SheetNames.find((n) => n.trim().toLowerCase() !== "instrucciones") ||
    libro.SheetNames[0];
  const hoja = libro.Sheets[nombreHoja];

  // Fechas reales de Excel -> 4/03/2026. Lo demas se deja como texto.
  Object.keys(hoja).forEach((ref) => {
    if (ref.startsWith("!")) return;
    const celda = hoja[ref];
    if (celda.t === "n" && celda.z && XLSX.SSF.is_date(celda.z)) {
      const f = XLSX.SSF.parse_date_code(celda.v);
      if (f) hoja[ref] = { t: "s", v: fechaTexto(f.y, f.m, f.d) };
    } else if (celda.t === "n") {
      hoja[ref] = { t: "s", v: String(celda.v) };
    }
  });

  return XLSX.utils.sheet_to_json(hoja, { defval: "", raw: true });
};

const enviar = async (ruta, filas) => {
  // Se envia como texto para que no lo frene el limite de tamano de express.json()
  const resp = await fetch(`${API_BASE}/api/habitantes/${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ filas }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.ok === false) throw new Error(data.error || "El servidor no respondió correctamente.");
  return data;
};

function CargaHabitantes({ archivo, onCerrar, onImportado }) {
  const [filasArchivo, setFilasArchivo] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [filtro, setFiltro] = useState("todas");
  const [estadoProceso, setEstadoProceso] = useState("leyendo"); // leyendo | listo | guardando | guardado
  const [error, setError] = useState("");
  const [mensajeFinal, setMensajeFinal] = useState("");

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const filas = await leerArchivo(archivo);
        if (!filas.length) throw new Error("El archivo no tiene filas con datos.");
        const data = await enviar("validar", filas);
        if (!activo) return;
        setFilasArchivo(filas);
        setResultado(data);
        setEstadoProceso("listo");
      } catch (err) {
        if (!activo) return;
        setError(err.message || "No se pudo leer el archivo.");
        setEstadoProceso("listo");
      }
    })();
    return () => {
      activo = false;
    };
  }, [archivo]);

  const resumen = resultado?.resumen;
  const porGuardar = resumen ? resumen.nuevos + resumen.actualizar : 0;

  const filasVisibles = useMemo(() => {
    const filas = resultado?.filas || [];
    if (filtro === "todas") return filas;
    if (filtro === "avisos") return filas.filter((f) => f.avisos.length);
    return filas.filter((f) => f.estado === filtro);
  }, [resultado, filtro]);

  const descargarErrores = () => {
    const conError = (resultado?.filas || []).filter((f) => f.estado === "error");
    const datos = conError.map((f) => ({
      ...filasArchivo[f.fila - 2],
      Errores: f.errores.join(" | "),
    }));
    const hoja = XLSX.utils.json_to_sheet(datos);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Habitantes");
    XLSX.writeFile(libro, "Habitantes_por_corregir.xlsx");
  };

  const guardar = async () => {
    const ok = window.confirm(
      `Se guardarán ${resumen.nuevos} habitante(s) nuevo(s) y se actualizarán ${resumen.actualizar}.` +
        (resumen.errores ? `\n${resumen.errores} fila(s) con errores NO se guardarán.` : "") +
        "\n\nAntes de guardar se hace una copia de respaldo. ¿Continuar?"
    );
    if (!ok) return;

    setEstadoProceso("guardando");
    setError("");
    try {
      const data = await enviar("importar", filasArchivo);
      setMensajeFinal(data.mensaje);
      setEstadoProceso("guardado");

      const resp = await fetch(`${API_BASE}/api/habitantes`, { cache: "no-store" });
      const lista = await resp.json();
      if (onImportado) onImportado(Array.isArray(lista.habitantes) ? lista.habitantes : []);
    } catch (err) {
      setError(err.message);
      setEstadoProceso("listo");
    }
  };

  const chip = (clave, texto, valor, color) => (
    <button
      type="button"
      key={clave}
      onClick={() => setFiltro(clave)}
      style={{
        border: filtro === clave ? `2px solid ${color}` : "2px solid transparent",
        background: "#f8fafc",
        borderRadius: 10,
        padding: "8px 14px",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b" }}>{texto}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{valor}</div>
    </button>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "#0008",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 24,
          width: "100%",
          maxWidth: 1100,
          maxHeight: "94vh",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, color: "#188aac" }}>Carga masiva de habitantes</h2>
            <div style={{ color: "#64748b", fontSize: 14 }}>Archivo: {archivo?.name}</div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={estadoProceso === "guardando"}
            style={{ background: "#64748b", color: "#fff", border: "none", borderRadius: 7, padding: "6px 16px", cursor: "pointer" }}
          >
            {estadoProceso === "guardado" ? "Cerrar" : "Cancelar"}
          </button>
        </div>

        {estadoProceso === "leyendo" && <p style={{ color: "#218290" }}>Revisando el archivo...</p>}

        {error && (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "#fee2e2", color: "#b91c1c", fontWeight: 600 }}>
            {error}
          </div>
        )}

        {mensajeFinal && (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "#dcfce7", color: "#166534", fontWeight: 600 }}>
            {mensajeFinal}
          </div>
        )}

        {resumen && (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "16px 0" }}>
              {chip("todas", "Filas leídas", resumen.total, "#0f172a")}
              {chip("nuevo", "Nuevos", resumen.nuevos, "#166534")}
              {chip("actualizar", "Se actualizan", resumen.actualizar, "#1d4ed8")}
              {chip("sin_cambios", "Sin cambios", resumen.sinCambios, "#475569")}
              {chip("error", "Con errores", resumen.errores, "#b91c1c")}
              {chip("avisos", "Con avisos", resumen.conAvisos, "#b45309")}
            </div>

            <p style={{ color: "#475569", fontSize: 13, marginTop: 0 }}>
              Las filas en <strong style={{ color: "#b91c1c" }}>rojo</strong> no se guardarán. Los avisos en{" "}
              <strong style={{ color: "#b45309" }}>naranja</strong> no impiden guardar; son correcciones automáticas o
              datos recomendados que faltan.
            </p>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                    <th style={{ padding: 8 }}>Fila</th>
                    <th style={{ padding: 8 }}>Estado</th>
                    <th style={{ padding: 8 }}>Nombre</th>
                    <th style={{ padding: 8 }}>Documento</th>
                    <th style={{ padding: 8 }}>Rol</th>
                    <th style={{ padding: 8 }}>Inmueble</th>
                    <th style={{ padding: 8 }}>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filasVisibles.map((f) => {
                    const e = ESTADOS[f.estado] || ESTADOS.sin_cambios;
                    const d = f.datos;
                    return (
                      <tr
                        key={f.fila}
                        style={{ borderTop: "1px solid #e2e8f0", background: f.estado === "error" ? "#fff5f5" : "#fff" }}
                      >
                        <td style={{ padding: 8 }}>{f.fila}</td>
                        <td style={{ padding: 8 }}>
                          <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: e.color, background: e.fondo, whiteSpace: "nowrap" }}>
                            {e.texto}
                          </span>
                        </td>
                        <td style={{ padding: 8 }}>{d.NombreResidente || "-"}</td>
                        <td style={{ padding: 8 }}>{d.DocumentoResidente || "-"}</td>
                        <td style={{ padding: 8 }}>{d.Rol || "-"}</td>
                        <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                          {[d.TorreManzana, d.AptoCasa].filter(Boolean).join(" - ") || "-"}
                        </td>
                        <td style={{ padding: 8 }}>
                          {f.errores.map((t, i) => (
                            <div key={`e${i}`} style={{ color: "#b91c1c" }}>• {t}</div>
                          ))}
                          {f.avisos.map((t, i) => (
                            <div key={`a${i}`} style={{ color: "#b45309" }}>• {t}</div>
                          ))}
                          {f.estado === "actualizar" && (
                            <div style={{ color: "#1d4ed8" }}>Cambia: {f.cambios.join(", ")}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!filasVisibles.length && (
                    <tr>
                      <td colSpan={7} style={{ padding: 12, textAlign: "center", color: "#64748b" }}>
                        No hay filas en este grupo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {estadoProceso !== "guardado" && (
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 18 }}>
                {resumen.errores > 0 && (
                  <button
                    type="button"
                    onClick={descargarErrores}
                    style={{ background: "#fff", color: "#b91c1c", border: "2px solid #b91c1c", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer" }}
                  >
                    Descargar filas con errores
                  </button>
                )}
                <button
                  type="button"
                  onClick={guardar}
                  disabled={!porGuardar || estadoProceso === "guardando"}
                  style={{
                    background: porGuardar ? "#218290" : "#cbd5e1",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 20px",
                    fontWeight: 700,
                    cursor: porGuardar ? "pointer" : "not-allowed",
                  }}
                >
                  {estadoProceso === "guardando"
                    ? "Guardando..."
                    : porGuardar
                    ? `Guardar ${porGuardar} fila(s) correcta(s)`
                    : "No hay nada nuevo para guardar"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default CargaHabitantes;