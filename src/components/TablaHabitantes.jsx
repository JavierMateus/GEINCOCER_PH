// src/components/TablaHabitantes.jsx
// Tabla de habitantes del administrador:
//   - Filtro por nombre y cedula.
//   - Agregar un habitante y editar uno existente (guarda en BaseResidencial\Habitantes.csv).
//   - Dar de baja = poner FechaSalida. Nadie se borra (sus pagos y obligaciones se conservan).
//
// Props:
//   habitantes    -> lista que viene de /api/habitantes
//   onActualizar  -> recibe la lista nueva despues de guardar
//   onOcultar     -> oculta la tabla

import React, { useMemo, useState } from "react";
import { API_BASE } from "../config";

const COLUMNAS = [
  "ID_Habitante", "NombreResidente", "DocumentoResidente", "Rol", "ID_Inmueble",
  "TorreManzana", "AptoCasa", "Tipo", "Telefono", "Email", "FechaEntrada", "FechaSalida",
];

const VACIO = {
  NombreResidente: "", DocumentoResidente: "", Rol: "Residente", ID_Inmueble: "",
  TorreManzana: "", AptoCasa: "", Tipo: "Propietario", Telefono: "", Email: "",
  FechaEntrada: "", FechaSalida: "",
};

const sinTildes = (v) =>
  String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const soloDigitos = (v) => String(v ?? "").replace(/\D/g, "");

// "4/03/2026" o "2026-03-04" -> "2026-03-04" (para el calendario)
const aISO = (v) => {
  const t = String(v ?? "").trim();
  let p = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (p) return `${p[1]}-${p[2].padStart(2, "0")}-${p[3].padStart(2, "0")}`;
  p = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (p) return `${p[3]}-${p[2].padStart(2, "0")}-${p[1].padStart(2, "0")}`;
  return "";
};

// "2026-03-04" o "4/03/2026" -> "4/03/2026" (para mostrar)
const aVisual = (v) => {
  const iso = aISO(v);
  if (!iso) return String(v ?? "");
  const [a, m, d] = iso.split("-");
  return `${Number(d)}/${m}/${a}`;
};

const hoyISO = () => {
  const f = new Date();
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
};

const estaRetirado = (h) => {
  const salida = aISO(h.FechaSalida);
  return Boolean(salida) && salida <= hoyISO();
};

const claveUbicacion = (torre, apto) =>
  `${sinTildes(torre).replace(/[^a-z0-9]/g, "").replace(/^torre/, "t").replace(/^(manzana|mza|mz)/, "m")}|${sinTildes(apto).replace(/\s+/g, "")}`;

const estiloInput = {
  width: "100%",
  padding: "0.55em",
  borderRadius: "7px",
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
  marginTop: "3px",
};

const Campo = ({ etiqueta, children, ancho = "1 1 200px" }) => (
  <div style={{ flex: ancho, minWidth: 0 }}>
    <label style={{ fontWeight: "bold", color: "#334155", fontSize: "0.82em" }}>{etiqueta}</label>
    {children}
  </div>
);

function TablaHabitantes({ habitantes = [], onActualizar, onOcultar }) {
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroCedula, setFiltroCedula] = useState("");
  const [form, setForm] = useState(null); // null = cerrado
  const [original, setOriginal] = useState(null); // null = agregar
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const lista = Array.isArray(habitantes) ? habitantes : [];

  const filtrados = useMemo(() => {
    const palabras = sinTildes(filtroNombre).split(/\s+/).filter(Boolean);
    const cedula = soloDigitos(filtroCedula);
    return lista.filter((h) => {
      const nombre = sinTildes(h.NombreResidente);
      return palabras.every((p) => nombre.includes(p)) && (!cedula || soloDigitos(h.DocumentoResidente).includes(cedula));
    });
  }, [lista, filtroNombre, filtroCedula]);

  // Codigo de inmueble: si la torre/apto ya existe se usa el mismo; si no, el siguiente libre.
  const sugerirInmueble = (torre, apto) => {
    if (!torre || !apto) return "";
    const clave = claveUbicacion(torre, apto);
    const existente = lista.find((h) => h.ID_Inmueble && claveUbicacion(h.TorreManzana, h.AptoCasa) === clave);
    if (existente) return existente.ID_Inmueble;
    const mayor = Math.max(0, ...lista.map((h) => Number(String(h.ID_Inmueble).replace(/\D/g, "")) || 0));
    return `INM${String(mayor + 1).padStart(3, "0")}`;
  };

  const abrirAgregar = () => {
    setOriginal(null);
    setForm({ ...VACIO, FechaEntrada: hoyISO() });
    setError("");
    setMensaje("");
  };

  const abrirEditar = (h) => {
    setOriginal({ documento: h.DocumentoResidente, idInmueble: h.ID_Inmueble });
    setForm({
      ...VACIO,
      ...h,
      FechaEntrada: aISO(h.FechaEntrada),
      FechaSalida: aISO(h.FechaSalida),
    });
    setError("");
    setMensaje("");
  };

  const cambiar = (campo, valor) => {
    setForm((f) => {
      const nuevo = { ...f, [campo]: valor };
      // Al agregar, el codigo de inmueble se completa solo con la torre/apto.
      if (!original && (campo === "TorreManzana" || campo === "AptoCasa")) {
        nuevo.ID_Inmueble = sugerirInmueble(nuevo.TorreManzana, nuevo.AptoCasa);
      }
      if (campo === "Rol" && valor !== "Residente" && !original) {
        nuevo.ID_Inmueble = "";
        nuevo.TorreManzana = "";
        nuevo.AptoCasa = "";
        nuevo.Tipo = "";
      }
      if (campo === "Rol" && valor === "Residente" && !nuevo.Tipo) nuevo.Tipo = "Propietario";
      return nuevo;
    });
    setError("");
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError("");
    try {
      const resp = await fetch(`${API_BASE}/api/habitantes/guardar`, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ habitante: form, original }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) throw new Error(data.error || "No se pudo guardar.");

      if (onActualizar) onActualizar(data.habitantes);
      const avisos = (data.avisos || []).filter((a) => !a.startsWith("Sin "));
      setMensaje(`${data.mensaje} ${form.NombreResidente}${avisos.length ? ` (${avisos.join(" ")})` : ""}`);
      setForm(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const esResidente = form?.Rol === "Residente";

  return (
    <div style={{ marginTop: "1em" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, color: "#0f172a" }}>Tabla de habitantes</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={abrirAgregar}
            style={{ padding: "0.55em 1.2em", borderRadius: 8, border: "none", background: "#218290", color: "#fff", fontWeight: "bold", cursor: "pointer" }}
          >
            + Agregar habitante
          </button>
          {onOcultar && (
            <button
              type="button"
              onClick={onOcultar}
              style={{ padding: "0.55em 1.2em", borderRadius: 8, border: "1px solid #94a3b8", background: "#fff", color: "#475569", cursor: "pointer" }}
            >
              Ocultar
            </button>
          )}
        </div>
      </div>

      {/* Filtro */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", margin: "0.8em 0" }}>
        <Campo etiqueta="Nombre" ancho="2 1 240px">
          <input value={filtroNombre} onChange={(e) => setFiltroNombre(e.target.value)} placeholder="Ej: Paula, rojas" style={estiloInput} />
        </Campo>
        <Campo etiqueta="Cédula" ancho="1 1 180px">
          <input value={filtroCedula} onChange={(e) => setFiltroCedula(e.target.value)} placeholder="Ej: 1113789020" inputMode="numeric" style={estiloInput} />
        </Campo>
        <button
          type="button"
          onClick={() => {
            setFiltroNombre("");
            setFiltroCedula("");
          }}
          style={{ padding: "0.55em 1.2em", borderRadius: 8, border: "1px solid #218290", background: "#fff", color: "#218290", cursor: "pointer", fontWeight: "bold" }}
        >
          Limpiar
        </button>
        <div style={{ color: "#475569", fontSize: "0.9em", paddingBottom: "0.5em" }}>
          Mostrando <strong>{filtrados.length}</strong> de <strong>{lista.length}</strong>
        </div>
      </div>

      {mensaje && (
        <div style={{ padding: 10, borderRadius: 8, background: "#dcfce7", color: "#166534", fontWeight: 600, marginBottom: 10 }}>
          {mensaje}
        </div>
      )}

      {/* Tabla */}
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f1f5f9" }}>
              {COLUMNAS.map((c) => (
                <th key={c} style={{ padding: 8, textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid #e2e8f0" }}>
                  {c}
                </th>
              ))}
              <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }} />
            </tr>
          </thead>
          <tbody>
            {filtrados.map((h) => {
              const retirado = estaRetirado(h);
              return (
                <tr
                  key={`${h.ID_Habitante}-${h.DocumentoResidente}-${h.ID_Inmueble}`}
                  style={{ borderTop: "1px solid #e2e8f0", background: retirado ? "#f8fafc" : "#fff", color: retirado ? "#94a3b8" : "inherit" }}
                >
                  {COLUMNAS.map((c) => (
                    <td key={c} style={{ padding: 8, whiteSpace: c === "NombreResidente" ? "normal" : "nowrap" }}>
                      {c === "FechaEntrada" || c === "FechaSalida" ? aVisual(h[c]) : h[c]}
                      {c === "FechaSalida" && retirado && (
                        <span style={{ marginLeft: 6, padding: "1px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: "#b91c1c", background: "#fee2e2" }}>
                          Retirado
                        </span>
                      )}
                    </td>
                  ))}
                  <td style={{ padding: 8 }}>
                    <button
                      type="button"
                      onClick={() => abrirEditar(h)}
                      style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #218290", background: "#fff", color: "#218290", fontWeight: 700, cursor: "pointer" }}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              );
            })}
            {!filtrados.length && (
              <tr>
                <td colSpan={COLUMNAS.length + 1} style={{ padding: 14, textAlign: "center", color: "#64748b" }}>
                  No hay habitantes que coincidan con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Formulario agregar / editar */}
      {form && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#0008", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box" }}>
          <form
            onSubmit={guardar}
            style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 680, maxHeight: "94vh", overflowY: "auto", boxSizing: "border-box" }}
          >
            <h2 style={{ marginTop: 0, color: "#188aac" }}>{original ? "Editar habitante" : "Agregar habitante"}</h2>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <Campo etiqueta="Nombre completo *" ancho="2 1 300px">
                <input value={form.NombreResidente} onChange={(e) => cambiar("NombreResidente", e.target.value)} style={estiloInput} required />
              </Campo>
              <Campo etiqueta="Cédula / documento *">
                <input value={form.DocumentoResidente} onChange={(e) => cambiar("DocumentoResidente", e.target.value)} inputMode="numeric" style={estiloInput} required />
              </Campo>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <Campo etiqueta="Rol *">
                <select value={form.Rol} onChange={(e) => cambiar("Rol", e.target.value)} style={estiloInput}>
                  <option>Residente</option>
                  <option>Administrador</option>
                  <option>Seguridad</option>
                  <option>Mantenimiento</option>
                </select>
              </Campo>
              <Campo etiqueta={`Tipo${esResidente ? " *" : ""}`}>
                <select value={form.Tipo} onChange={(e) => cambiar("Tipo", e.target.value)} style={estiloInput}>
                  {!esResidente && <option value="">(no aplica)</option>}
                  <option>Propietario</option>
                  <option>Arrendatario</option>
                  <option>Familiar</option>
                </select>
              </Campo>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <Campo etiqueta={`Torre / Manzana${esResidente ? " *" : ""}`}>
                <input value={form.TorreManzana} onChange={(e) => cambiar("TorreManzana", e.target.value)} placeholder="T-2 o M-7" style={estiloInput} />
              </Campo>
              <Campo etiqueta={`Apto / Casa${esResidente ? " *" : ""}`}>
                <input value={form.AptoCasa} onChange={(e) => cambiar("AptoCasa", e.target.value)} placeholder="302 o 12" style={estiloInput} />
              </Campo>
              <Campo etiqueta={`Código inmueble${esResidente ? " *" : ""}`}>
                <input value={form.ID_Inmueble} onChange={(e) => cambiar("ID_Inmueble", e.target.value)} placeholder="Se llena solo" style={estiloInput} />
              </Campo>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <Campo etiqueta="Celular (10 números)">
                <input value={form.Telefono} onChange={(e) => cambiar("Telefono", e.target.value)} inputMode="numeric" placeholder="3001234567" style={estiloInput} />
              </Campo>
              <Campo etiqueta="Correo" ancho="2 1 260px">
                <input value={form.Email} onChange={(e) => cambiar("Email", e.target.value)} type="email" placeholder="nombre@email.com" style={estiloInput} />
              </Campo>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
              <Campo etiqueta="Fecha de entrada">
                <input type="date" value={form.FechaEntrada} onChange={(e) => cambiar("FechaEntrada", e.target.value)} style={estiloInput} />
              </Campo>
              <Campo etiqueta="Fecha de salida (solo si se retira)">
                <input type="date" value={form.FechaSalida} onChange={(e) => cambiar("FechaSalida", e.target.value)} style={estiloInput} />
              </Campo>
              {original && (
                <div style={{ display: "flex", gap: 6 }}>
                  {!form.FechaSalida ? (
                    <button
                      type="button"
                      onClick={() => cambiar("FechaSalida", hoyISO())}
                      style={{ padding: "0.55em 1em", borderRadius: 7, border: "1px solid #b91c1c", background: "#fff", color: "#b91c1c", fontWeight: 700, cursor: "pointer" }}
                    >
                      Dar de baja hoy
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => cambiar("FechaSalida", "")}
                      style={{ padding: "0.55em 1em", borderRadius: 7, border: "1px solid #166534", background: "#fff", color: "#166534", fontWeight: 700, cursor: "pointer" }}
                    >
                      Reactivar
                    </button>
                  )}
                </div>
              )}
            </div>

            {form.FechaSalida && (
              <p style={{ color: "#b45309", fontSize: 13, marginTop: 0 }}>
                Con fecha de salida cumplida, la persona ya no podrá entrar a la aplicación. Sus pagos y obligaciones se conservan.
              </p>
            )}

            {error && (
              <div style={{ padding: 10, borderRadius: 8, background: "#fee2e2", color: "#b91c1c", fontWeight: 600, marginBottom: 12 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setForm(null)}
                disabled={guardando}
                style={{ padding: "0.6em 1.3em", borderRadius: 8, border: "none", background: "#64748b", color: "#fff", cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                style={{ padding: "0.6em 1.5em", borderRadius: 8, border: "none", background: "#218290", color: "#fff", fontWeight: 700, cursor: "pointer" }}
              >
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default TablaHabitantes;