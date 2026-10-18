// components/BitacoraSeguridad.jsx
// Bitácora de novedades e incidentes. El vigilante registra; el administrador
// (con su PIN) marca las novedades como atendidas.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config";

const TIPOS = ["Novedad general", "Incidente", "Daño o mantenimiento", "Objeto perdido", "Emergencia"];
const GRAVEDADES = ["Baja", "Media", "Alta"];
const FORM_VACIO = { tipo: "Novedad general", gravedad: "Baja", ubicacion: "", descripcion: "" };

const TEAL = "#218290";
const TEAL_OSCURO = "#17677f";
const TINTA = "#0f172a";
const GRIS = "#475569";
const BORDE = "#cbd5e1";

const COLOR_GRAVEDAD = {
  Alta: { fondo: "#fee2e2", texto: "#991b1b" },
  Media: { fondo: "#fef3c7", texto: "#92400e" },
  Baja: { fondo: "#ccfbf1", texto: "#115e59" },
};

const tarjeta = { background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 6px 24px rgba(33,130,144,0.12)", marginBottom: 18 };
const etiqueta = { display: "block", marginBottom: 4, fontWeight: 600, fontSize: "0.88em", color: GRIS };
const campo = { width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: "1em", border: `1px solid ${BORDE}`, borderRadius: 8, color: TINTA, background: "#fff" };
const botonPrimario = { padding: "11px 18px", border: "none", borderRadius: 10, background: TEAL, color: "#fff", fontWeight: 700, fontSize: "1em", cursor: "pointer" };
const botonSecundario = { padding: "9px 14px", borderRadius: 10, background: "#fff", color: TEAL, border: `2px solid ${TEAL}`, fontWeight: 700, cursor: "pointer" };

export default function BitacoraSeguridad({ usuario }) {
  const guardia = usuario?.nombre || "Portería";
  // Solo quien realmente es administrador ve el botón de atender (el servidor además lo exige).
  const esAdmin = usuario?.rol === "Administrador";

  const [novedades, setNovedades] = useState([]);
  const [filtro, setFiltro] = useState("abiertas"); // "abiertas" | "todas"
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo: "ok" | "error", texto }
  const [atendiendo, setAtendiendo] = useState(null); // novedad que se va a atender
  const [formAtender, setFormAtender] = useState({ documento: "", pin: "", nota: "" });
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/bitacora`, { cache: "no-store" });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || "No se pudo cargar la bitácora.");
      setNovedades(Array.isArray(data.novedades) ? data.novedades : []);
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message || "No hay conexión con el servidor." });
    }
  }, []);

  useEffect(() => {
    cargar();
    const timer = setInterval(cargar, 20000);
    return () => clearInterval(timer);
  }, [cargar]);

  const abiertas = useMemo(() => novedades.filter((n) => n.Estado === "abierta").length, [novedades]);
  const visibles = useMemo(
    () => (filtro === "abiertas" ? novedades.filter((n) => n.Estado === "abierta") : novedades),
    [novedades, filtro]
  );

  const cambiar = (clave) => (e) => setForm({ ...form, [clave]: e.target.value });

  const registrar = async (e) => {
    e.preventDefault();
    if (guardando) return;
    setAviso(null);
    setGuardando(true);
    try {
      const resp = await fetch(`${API_BASE}/api/bitacora`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, registradoPor: guardia }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || "No se pudo registrar la novedad.");
      setForm(FORM_VACIO);
      setAviso({ tipo: "ok", texto: "Novedad registrada en la bitácora." });
      await cargar();
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    } finally {
      setGuardando(false);
    }
  };

  const abrirAtender = (novedad) => {
    setFormAtender({ documento: usuario?.documento || "", pin: "", nota: "" });
    setAtendiendo(novedad);
  };

  const confirmarAtender = async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      const resp = await fetch(`${API_BASE}/api/bitacora/${encodeURIComponent(atendiendo.ID_Novedad)}/atender`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nota: formAtender.nota, adminDocumento: formAtender.documento, adminPin: formAtender.pin }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || "No se pudo marcar como atendida.");
      setAtendiendo(null);
      setAviso({ tipo: "ok", texto: "Novedad marcada como atendida." });
      await cargar();
    } catch (err) {
      alert(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      {aviso && (
        <div role="status" style={{ ...tarjeta, padding: "12px 16px", background: aviso.tipo === "ok" ? "#dcfce7" : "#fee2e2", color: aviso.tipo === "ok" ? "#166534" : "#991b1b", fontWeight: 600 }}>
          {aviso.texto}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, alignItems: "start" }}>
        <form onSubmit={registrar} style={{ ...tarjeta, marginBottom: 0 }}>
          <h3 style={{ margin: "0 0 4px", color: TEAL_OSCURO }}>Registrar novedad</h3>
          <p style={{ margin: "0 0 14px", color: GRIS, fontSize: "0.9em" }}>
            La fecha, la hora y tu nombre se anotan solos. Una vez guardada, la novedad no se puede editar ni borrar.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label htmlFor="bit-tipo" style={etiqueta}>Tipo</label>
              <select id="bit-tipo" style={campo} value={form.tipo} onChange={cambiar("tipo")}>
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="bit-gravedad" style={etiqueta}>Gravedad</label>
              <select id="bit-gravedad" style={campo} value={form.gravedad} onChange={cambiar("gravedad")}>
                {GRAVEDADES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="bit-ubic" style={etiqueta}>Dónde ocurrió *</label>
              <input id="bit-ubic" style={campo} value={form.ubicacion} onChange={cambiar("ubicacion")} placeholder="Ej: Torre 2, piso 3" autoComplete="off" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="bit-desc" style={etiqueta}>Qué pasó * (mínimo 10 caracteres)</label>
              <textarea id="bit-desc" rows={4} style={{ ...campo, resize: "vertical" }} value={form.descripcion} onChange={cambiar("descripcion")} />
            </div>
          </div>
          <button type="submit" disabled={guardando} style={{ ...botonPrimario, width: "100%", marginTop: 16, opacity: guardando ? 0.6 : 1 }}>
            {guardando ? "Guardando..." : "Registrar novedad"}
          </button>
        </form>

        <div style={{ ...tarjeta, marginBottom: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ margin: 0, color: TEAL_OSCURO }}>Novedades</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" aria-pressed={filtro === "abiertas"} onClick={() => setFiltro("abiertas")}
                style={{ ...botonSecundario, padding: "6px 12px", background: filtro === "abiertas" ? TEAL : "#fff", color: filtro === "abiertas" ? "#fff" : TEAL }}>
                Abiertas ({abiertas})
              </button>
              <button type="button" aria-pressed={filtro === "todas"} onClick={() => setFiltro("todas")}
                style={{ ...botonSecundario, padding: "6px 12px", background: filtro === "todas" ? TEAL : "#fff", color: filtro === "todas" ? "#fff" : TEAL }}>
                Todas ({novedades.length})
              </button>
            </div>
          </div>

          {visibles.length === 0 ? (
            <p style={{ color: GRIS, margin: 0 }}>
              {filtro === "abiertas" ? "No hay novedades abiertas." : "Aún no hay novedades registradas."}
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {visibles.map((n) => {
                const color = COLOR_GRAVEDAD[n.Gravedad] || COLOR_GRAVEDAD.Baja;
                return (
                  <div key={n.ID_Novedad} style={{ border: `1px solid ${BORDE}`, borderRadius: 12, padding: "10px 12px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ background: color.fondo, color: color.texto, fontWeight: 700, fontSize: "0.82em", borderRadius: 999, padding: "2px 10px" }}>
                        Gravedad {n.Gravedad.toLowerCase()}
                      </span>
                      <span style={{ fontWeight: 700, color: TINTA }}>{n.Tipo}</span>
                      <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: "0.85em", color: n.Estado === "abierta" ? "#92400e" : "#166534" }}>
                        {n.Estado === "abierta" ? "Abierta" : "Atendida"}
                      </span>
                    </div>
                    <div style={{ color: TINTA }}>{n.Descripcion}</div>
                    <div style={{ color: GRIS, fontSize: "0.86em", marginTop: 4 }}>
                      {n.Ubicacion}. Registró {n.RegistradoPor} el {n.Fecha} a las {n.Hora}.
                    </div>
                    {n.Estado === "atendida" && (
                      <div style={{ color: "#166534", fontSize: "0.86em", marginTop: 4 }}>
                        Atendida por {n.AtendidaPor} el {n.FechaAtencion} a las {n.HoraAtencion}. {n.NotaAtencion}
                      </div>
                    )}
                    {esAdmin && n.Estado === "abierta" && (
                      <button type="button" style={{ ...botonSecundario, marginTop: 8 }} onClick={() => abrirAtender(n)}>
                        Marcar atendida
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {atendiendo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 22, width: "min(440px, 92vw)", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 6px", color: TEAL_OSCURO }}>Marcar como atendida</h3>
            <p style={{ margin: "0 0 14px", color: GRIS, fontSize: "0.92em" }}>
              {atendiendo.Tipo} en {atendiendo.Ubicacion}. Confirma con tu PIN de administrador y deja constancia de lo que se hizo.
            </p>
            {!usuario?.documento && (
              <>
                <label htmlFor="at-doc" style={etiqueta}>Documento del administrador</label>
                <input id="at-doc" style={{ ...campo, marginBottom: 10 }} value={formAtender.documento} onChange={(e) => setFormAtender({ ...formAtender, documento: e.target.value })} />
              </>
            )}
            <label htmlFor="at-pin" style={etiqueta}>PIN del administrador</label>
            <input id="at-pin" type="password" inputMode="numeric" autoComplete="off" style={{ ...campo, marginBottom: 10 }} value={formAtender.pin} onChange={(e) => setFormAtender({ ...formAtender, pin: e.target.value })} />
            <label htmlFor="at-nota" style={etiqueta}>Qué se hizo (mínimo 10 caracteres)</label>
            <textarea id="at-nota" rows={3} style={{ ...campo, marginBottom: 14, resize: "vertical" }} value={formAtender.nota} onChange={(e) => setFormAtender({ ...formAtender, nota: e.target.value })} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setAtendiendo(null)} style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: "#e5e7eb", cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
              <button type="button" onClick={confirmarAtender} disabled={enviando} style={{ ...botonPrimario, padding: "9px 14px", opacity: enviando ? 0.6 : 1 }}>
                {enviando ? "Guardando..." : "Marcar atendida"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

