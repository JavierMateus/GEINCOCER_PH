// components/PanelMantenimiento.jsx
// Panel del personal de mantenimiento: tareas con estados (pendiente, en proceso, completada)
// y notas de avance. El administrador también puede entrar (rol Mantenimiento) y cancelar
// una tarea abierta con su PIN.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config";

const PRIORIDADES = ["Baja", "Media", "Alta", "Urgente"];
const ORDEN_PRIORIDAD = { Urgente: 0, Alta: 1, Media: 2, Baja: 3 };
const FORM_VACIO = { titulo: "", ubicacion: "", prioridad: "Media", descripcion: "" };
const ETIQUETA_ESTADO = { pendiente: "Pendiente", en_proceso: "En proceso", completada: "Completada", cancelada: "Cancelada" };
const ETIQUETA_NOTA = { inicio: "Inicio", avance: "Avance", cierre: "Cierre", cancelacion: "Cancelación" };

const TEAL = "#218290";
const TEAL_OSCURO = "#17677f";
const TINTA = "#0f172a";
const GRIS = "#475569";
const BORDE = "#cbd5e1";

const COLOR_PRIORIDAD = {
  Urgente: { fondo: "#fee2e2", texto: "#991b1b" },
  Alta: { fondo: "#ffedd5", texto: "#9a3412" },
  Media: { fondo: "#fef3c7", texto: "#92400e" },
  Baja: { fondo: "#ccfbf1", texto: "#115e59" },
};
const COLOR_ESTADO = { pendiente: "#92400e", en_proceso: "#1d4ed8", completada: "#166534", cancelada: "#64748b" };

const tarjeta = { background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 6px 24px rgba(33,130,144,0.12)", marginBottom: 18 };
const etiqueta = { display: "block", marginBottom: 4, fontWeight: 600, fontSize: "0.88em", color: GRIS };
const campo = { width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: "1em", border: `1px solid ${BORDE}`, borderRadius: 8, color: TINTA, background: "#fff" };
const botonPrimario = { padding: "11px 18px", border: "none", borderRadius: 10, background: TEAL, color: "#fff", fontWeight: 700, fontSize: "1em", cursor: "pointer" };
const botonSecundario = { padding: "9px 14px", borderRadius: 10, background: "#fff", color: TEAL, border: `2px solid ${TEAL}`, fontWeight: 700, cursor: "pointer" };

export default function PanelMantenimiento({ usuario, onCambiarPin, onSalir, onVolverAdmin }) {
  const persona = usuario?.nombre || "Mantenimiento";
  // Solo quien realmente es administrador ve "Cancelar tarea" (el servidor además lo exige con el PIN).
  const esAdmin = usuario?.rol === "Administrador";

  const [tareas, setTareas] = useState([]);
  const [filtro, setFiltro] = useState("abiertas"); // "abiertas" | "completadas" | "todas"
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo: "ok" | "error", texto }
  const [accion, setAccion] = useState(null); // { tipo: "completar" | "nota" | "cancelar", tarea }
  const [formAccion, setFormAccion] = useState({ nota: "", pin: "", documento: "" });
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/mantenimiento`, { cache: "no-store" });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || "No se pudieron cargar las tareas.");
      setTareas(Array.isArray(data.tareas) ? data.tareas : []);
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message || "No hay conexión con el servidor." });
    }
  }, []);

  useEffect(() => {
    cargar();
    const timer = setInterval(cargar, 20000);
    return () => clearInterval(timer);
  }, [cargar]);

  const abierta = (t) => t.Estado === "pendiente" || t.Estado === "en_proceso";
  const abiertas = useMemo(() => tareas.filter(abierta), [tareas]);
  const urgentes = abiertas.filter((t) => t.Prioridad === "Urgente").length;

  const visibles = useMemo(() => {
    if (filtro === "abiertas") {
      // Las más urgentes primero; a igual prioridad, la más antigua primero.
      return abiertas.slice().sort((a, b) =>
        (ORDEN_PRIORIDAD[a.Prioridad] ?? 9) - (ORDEN_PRIORIDAD[b.Prioridad] ?? 9) ||
        `${a.Fecha} ${a.Hora}`.localeCompare(`${b.Fecha} ${b.Hora}`)
      );
    }
    if (filtro === "completadas") return tareas.filter((t) => t.Estado === "completada");
    return tareas;
  }, [tareas, abiertas, filtro]);

  const cambiar = (clave) => (e) => setForm({ ...form, [clave]: e.target.value });

  const llamar = async (ruta, metodo, cuerpo) => {
    const resp = await fetch(`${API_BASE}/api/mantenimiento${ruta}`, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || "No se pudo completar la operación.");
    return data;
  };

  const crearTarea = async (e) => {
    e.preventDefault();
    if (guardando) return;
    setAviso(null);
    setGuardando(true);
    try {
      await llamar("", "POST", { ...form, creadaPor: persona });
      setForm(FORM_VACIO);
      setAviso({ tipo: "ok", texto: "Tarea creada." });
      await cargar();
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    } finally {
      setGuardando(false);
    }
  };

  const iniciar = async (tarea) => {
    setAviso(null);
    try {
      await llamar(`/${encodeURIComponent(tarea.ID_Tarea)}/estado`, "PUT", { estado: "en_proceso", autor: persona });
      setAviso({ tipo: "ok", texto: "La tarea quedó en proceso." });
      await cargar();
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    }
  };

  const abrirAccion = (tipo, tarea) => {
    setFormAccion({ nota: "", pin: "", documento: usuario?.documento || "" });
    setAccion({ tipo, tarea });
  };

  const confirmarAccion = async () => {
    if (enviando || !accion) return;
    const id = encodeURIComponent(accion.tarea.ID_Tarea);
    setEnviando(true);
    try {
      if (accion.tipo === "completar") {
        await llamar(`/${id}/estado`, "PUT", { estado: "completada", nota: formAccion.nota, autor: persona });
      } else if (accion.tipo === "nota") {
        await llamar(`/${id}/notas`, "POST", { nota: formAccion.nota, autor: persona });
      } else {
        await llamar(`/${id}/cancelar`, "PUT", { motivo: formAccion.nota, adminDocumento: formAccion.documento, adminPin: formAccion.pin });
      }
      const textos = { completar: "Tarea completada.", nota: "Nota agregada.", cancelar: "Tarea cancelada." };
      setAviso({ tipo: "ok", texto: textos[accion.tipo] });
      setAccion(null);
      await cargar();
    } catch (err) {
      alert(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const TEXTOS_ACCION = {
    completar: { titulo: "Completar tarea", ayuda: "Cuenta qué se hizo (mínimo 10 caracteres). Quedará como constancia.", boton: "Completar" },
    nota: { titulo: "Agregar nota de avance", ayuda: "La nota queda en el historial de la tarea y no se puede editar.", boton: "Guardar nota" },
    cancelar: { titulo: "Cancelar tarea", ayuda: "Solo un administrador puede cancelar. Escribe el motivo y confirma con tu PIN. La tarea no se borra: queda como cancelada.", boton: "Cancelar tarea" },
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16, textAlign: "left" }}>
      <div style={{ ...tarjeta, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0, color: TEAL_OSCURO }}>Mantenimiento</h2>
          <p style={{ margin: "4px 0 0", color: GRIS }}>Sesión de {persona}</p>
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.6em", fontWeight: 800, color: TEAL, lineHeight: 1 }}>{abiertas.length}</div>
            <div style={{ color: GRIS, fontSize: "0.9em" }}>tareas abiertas</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.6em", fontWeight: 700, color: urgentes > 0 ? "#991b1b" : TINTA, lineHeight: 1.1 }}>{urgentes}</div>
            <div style={{ color: GRIS, fontSize: "0.9em" }}>urgentes</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {onVolverAdmin && <button type="button" style={botonSecundario} onClick={onVolverAdmin}>Volver a administración</button>}
            {onCambiarPin && <button type="button" style={botonSecundario} onClick={onCambiarPin}>Cambiar mi PIN</button>}
            {onSalir && <button type="button" style={{ ...botonPrimario, padding: "9px 14px" }} onClick={onSalir}>Salir</button>}
          </div>
        </div>
      </div>

      {aviso && (
        <div role="status" style={{ ...tarjeta, padding: "12px 16px", background: aviso.tipo === "ok" ? "#dcfce7" : "#fee2e2", color: aviso.tipo === "ok" ? "#166534" : "#991b1b", fontWeight: 600 }}>
          {aviso.texto}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, alignItems: "start" }}>
        <form onSubmit={crearTarea} style={{ ...tarjeta, marginBottom: 0 }}>
          <h3 style={{ margin: "0 0 14px", color: TEAL_OSCURO }}>Nueva tarea</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="man-titulo" style={etiqueta}>Qué hay que hacer *</label>
              <input id="man-titulo" style={campo} value={form.titulo} onChange={cambiar("titulo")} placeholder="Ej: Cambiar bombillos" autoComplete="off" />
            </div>
            <div>
              <label htmlFor="man-ubic" style={etiqueta}>Dónde *</label>
              <input id="man-ubic" style={campo} value={form.ubicacion} onChange={cambiar("ubicacion")} placeholder="Ej: Torre 2, ascensor" autoComplete="off" />
            </div>
            <div>
              <label htmlFor="man-prio" style={etiqueta}>Prioridad</label>
              <select id="man-prio" style={campo} value={form.prioridad} onChange={cambiar("prioridad")}>
                {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="man-desc" style={etiqueta}>Detalle (opcional)</label>
              <textarea id="man-desc" rows={3} style={{ ...campo, resize: "vertical" }} value={form.descripcion} onChange={cambiar("descripcion")} />
            </div>
          </div>
          <button type="submit" disabled={guardando} style={{ ...botonPrimario, width: "100%", marginTop: 16, opacity: guardando ? 0.6 : 1 }}>
            {guardando ? "Creando..." : "Crear tarea"}
          </button>
        </form>

        <div style={{ ...tarjeta, marginBottom: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ margin: 0, color: TEAL_OSCURO }}>Tareas</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[["abiertas", `Abiertas (${abiertas.length})`], ["completadas", "Completadas"], ["todas", "Todas"]].map(([clave, texto]) => (
                <button
                  key={clave}
                  type="button"
                  aria-pressed={filtro === clave}
                  onClick={() => setFiltro(clave)}
                  style={{ ...botonSecundario, padding: "6px 12px", background: filtro === clave ? TEAL : "#fff", color: filtro === clave ? "#fff" : TEAL }}
                >
                  {texto}
                </button>
              ))}
            </div>
          </div>

          {visibles.length === 0 ? (
            <p style={{ color: GRIS, margin: 0 }}>
              {filtro === "abiertas" ? "No hay tareas abiertas." : "No hay tareas en esta lista."}
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {visibles.map((t) => {
                const color = COLOR_PRIORIDAD[t.Prioridad] || COLOR_PRIORIDAD.Baja;
                return (
                  <div key={t.ID_Tarea} style={{ border: `1px solid ${BORDE}`, borderRadius: 12, padding: "10px 12px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ background: color.fondo, color: color.texto, fontWeight: 700, fontSize: "0.82em", borderRadius: 999, padding: "2px 10px" }}>
                        Prioridad {t.Prioridad.toLowerCase()}
                      </span>
                      <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: "0.85em", color: COLOR_ESTADO[t.Estado] || GRIS }}>
                        {ETIQUETA_ESTADO[t.Estado] || t.Estado}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, color: TINTA }}>{t.Titulo}</div>
                    <div style={{ color: GRIS, fontSize: "0.9em" }}>{t.Ubicacion}</div>
                    {t.Descripcion && <div style={{ color: TINTA, fontSize: "0.92em", marginTop: 2 }}>{t.Descripcion}</div>}
                    <div style={{ color: GRIS, fontSize: "0.84em", marginTop: 4 }}>
                      Creada por {t.CreadaPor} el {t.Fecha} a las {t.Hora}.
                      {t.Estado === "completada" || t.Estado === "cancelada"
                        ? ` ${ETIQUETA_ESTADO[t.Estado]} por ${t.CerradaPor} el ${t.FechaCierre} a las ${t.HoraCierre}.`
                        : ""}
                    </div>

                    {t.notas && t.notas.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${BORDE}`, display: "grid", gap: 4 }}>
                        {t.notas.map((n) => (
                          <div key={n.ID_Nota} style={{ fontSize: "0.86em", color: GRIS }}>
                            <strong style={{ color: TINTA }}>{ETIQUETA_NOTA[n.Tipo] || n.Tipo}</strong> ({n.Fecha} {n.Hora}, {n.Autor}): {n.Nota}
                          </div>
                        ))}
                      </div>
                    )}

                    {abierta(t) && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                        {t.Estado === "pendiente" && <button type="button" style={botonSecundario} onClick={() => iniciar(t)}>Iniciar</button>}
                        <button type="button" style={botonSecundario} onClick={() => abrirAccion("nota", t)}>Agregar nota</button>
                        <button type="button" style={{ ...botonPrimario, padding: "9px 14px" }} onClick={() => abrirAccion("completar", t)}>Completar</button>
                        {esAdmin && (
                          <button type="button" style={{ ...botonSecundario, color: "#b91c1c", borderColor: "#b91c1c" }} onClick={() => abrirAccion("cancelar", t)}>
                            Cancelar tarea
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {accion && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 22, width: "min(440px, 92vw)", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 6px", color: accion.tipo === "cancelar" ? "#b91c1c" : TEAL_OSCURO }}>{TEXTOS_ACCION[accion.tipo].titulo}</h3>
            <p style={{ margin: "0 0 4px", fontWeight: 600, color: TINTA }}>{accion.tarea.Titulo}</p>
            <p style={{ margin: "0 0 14px", color: GRIS, fontSize: "0.92em" }}>{TEXTOS_ACCION[accion.tipo].ayuda}</p>
            {accion.tipo === "cancelar" && (
              <>
                {!usuario?.documento && (
                  <>
                    <label htmlFor="ac-doc" style={etiqueta}>Documento del administrador</label>
                    <input id="ac-doc" style={{ ...campo, marginBottom: 10 }} value={formAccion.documento} onChange={(e) => setFormAccion({ ...formAccion, documento: e.target.value })} />
                  </>
                )}
                <label htmlFor="ac-pin" style={etiqueta}>PIN del administrador</label>
                <input id="ac-pin" type="password" inputMode="numeric" autoComplete="off" style={{ ...campo, marginBottom: 10 }} value={formAccion.pin} onChange={(e) => setFormAccion({ ...formAccion, pin: e.target.value })} />
              </>
            )}
            <label htmlFor="ac-nota" style={etiqueta}>{accion.tipo === "cancelar" ? "Motivo" : "Nota"}</label>
            <textarea id="ac-nota" rows={3} style={{ ...campo, marginBottom: 14, resize: "vertical" }} value={formAccion.nota} onChange={(e) => setFormAccion({ ...formAccion, nota: e.target.value })} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setAccion(null)} style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: "#e5e7eb", cursor: "pointer", fontWeight: 600 }}>Volver</button>
              <button type="button" onClick={confirmarAccion} disabled={enviando} style={{ ...botonPrimario, padding: "9px 14px", opacity: enviando ? 0.6 : 1, background: accion.tipo === "cancelar" ? "#b91c1c" : TEAL }}>
                {enviando ? "Guardando..." : TEXTOS_ACCION[accion.tipo].boton}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

