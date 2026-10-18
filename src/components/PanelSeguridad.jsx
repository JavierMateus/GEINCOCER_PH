// components/PanelSeguridad.jsx
// Panel de la portería: registrar entradas y salidas de visitantes.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config";
import BitacoraSeguridad from "./BitacoraSeguridad";

const MOTIVOS = ["Visita", "Domicilio", "Proveedor", "Servicio técnico", "Otro"];
const FORM_VACIO = {
  nombre: "", documento: "", torreManzana: "", aptoCasa: "",
  residente: "", placa: "", motivo: "Visita", observaciones: "",
};

const TEAL = "#218290";
const TEAL_OSCURO = "#17677f";
const TINTA = "#0f172a";
const GRIS = "#475569";
const BORDE = "#cbd5e1";

const tarjeta = {
  background: "#fff", borderRadius: 16, padding: 20,
  boxShadow: "0 6px 24px rgba(33,130,144,0.12)", marginBottom: 18,
};
const etiqueta = { display: "block", marginBottom: 4, fontWeight: 600, fontSize: "0.88em", color: GRIS };
const campo = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: "1em",
  border: `1px solid ${BORDE}`, borderRadius: 8, color: TINTA, background: "#fff",
};
const botonPrimario = {
  padding: "11px 18px", border: "none", borderRadius: 10, background: TEAL,
  color: "#fff", fontWeight: 700, fontSize: "1em", cursor: "pointer",
};
const botonSecundario = {
  padding: "9px 14px", borderRadius: 10, background: "#fff", color: TEAL,
  border: `2px solid ${TEAL}`, fontWeight: 700, cursor: "pointer",
};
const th = { textAlign: "left", padding: "8px 10px", fontSize: "0.85em", color: GRIS, borderBottom: `2px solid ${BORDE}`, whiteSpace: "nowrap" };
const td = { padding: "8px 10px", fontSize: "0.92em", color: TINTA, borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" };

const hoyColombia = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

export default function PanelSeguridad({ usuario, onCambiarPin, onSalir, onVolverAdmin }) {
  const guardia = usuario?.nombre || "Portería";
  const [visitas, setVisitas] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo: "ok" | "error", texto }
  const [busqueda, setBusqueda] = useState("");
  // El panel de administración puede abrirlo directamente en la bitácora (vistaInicial).
  const [vista, setVista] = useState(usuario?.vistaInicial === "bitacora" ? "bitacora" : "visitantes");
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState(null); // null = aún no se ha consultado
  const [errorConsulta, setErrorConsulta] = useState("");
  const [consultaVeh, setConsultaVeh] = useState("");
  const [resultadoVeh, setResultadoVeh] = useState(null); // null = aún no se ha consultado
  const [errorVeh, setErrorVeh] = useState("");
  const [manejaParqueaderos, setManejaParqueaderos] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/visitantes`, { cache: "no-store" });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || "No se pudo cargar el registro.");
      setVisitas(Array.isArray(data.visitas) ? data.visitas : []);
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message || "No hay conexión con el servidor." });
    }
  }, []);

  // Carga inicial y refresco cada 20 segundos (por si hay más de un vigilante).
  useEffect(() => {
    cargar();
    const timer = setInterval(cargar, 20000);
    return () => clearInterval(timer);
  }, [cargar]);

  // Consulta de residentes: espera un momento después de escribir para no saturar al servidor.
  useEffect(() => {
    const texto = consulta.trim();
    if (texto.length < 2) {
      setResultados(null);
      setErrorConsulta("");
      return undefined;
    }
    let vigente = true;
    const espera = setTimeout(async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/consulta-seguridad/residentes?q=${encodeURIComponent(texto)}`);
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data.error || "No se pudo realizar la consulta.");
        if (!vigente) return;
        setResultados(data.resultados || []);
        setErrorConsulta("");
      } catch (err) {
        if (!vigente) return;
        setResultados(null);
        setErrorConsulta(err.message);
      }
    }, 300);
    return () => { vigente = false; clearTimeout(espera); };
  }, [consulta]);

  // ¿El conjunto tiene parqueaderos propios cargados? Si no, la consulta no los muestra.
  useEffect(() => {
    let vigente = true;
    fetch(`${API_BASE}/api/consulta-seguridad/configuracion`)
      .then((r) => r.json())
      .then((d) => { if (vigente) setManejaParqueaderos(Boolean(d.manejaParqueaderos)); })
      .catch(() => {});
    return () => { vigente = false; };
  }, []);

  // Consulta de vehículos (y parqueaderos, si el conjunto los maneja).
  useEffect(() => {
    const texto = consultaVeh.trim();
    if (texto.length < 2) {
      setResultadoVeh(null);
      setErrorVeh("");
      return undefined;
    }
    let vigente = true;
    const espera = setTimeout(async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/consulta-seguridad/vehiculos?q=${encodeURIComponent(texto)}`);
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data.error || "No se pudo realizar la consulta.");
        if (!vigente) return;
        setResultadoVeh(data);
        setManejaParqueaderos(Boolean(data.manejaParqueaderos));
        setErrorVeh("");
      } catch (err) {
        if (!vigente) return;
        setResultadoVeh(null);
        setErrorVeh(err.message);
      }
    }, 300);
    return () => { vigente = false; clearTimeout(espera); };
  }, [consultaVeh]);

  const dentro = useMemo(() => visitas.filter((v) => v.Estado === "dentro").slice().reverse(), [visitas]);
  const entradasHoy = useMemo(() => visitas.filter((v) => v.FechaEntrada === hoyColombia()).length, [visitas]);

  const historial = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = q
      ? visitas.filter((v) =>
          [v.NombreVisitante, v.DocumentoVisitante, v.TorreManzana, v.AptoCasa, v.Placa, v.ResidenteVisitado]
            .join(" ").toLowerCase().includes(q))
      : visitas;
    return lista.slice(0, 50);
  }, [visitas, busqueda]);

  const cambiar = (clave) => (e) => setForm({ ...form, [clave]: e.target.value });

  // Pasa el destino y el residente consultados al formulario de entrada.
  const usarEnRegistro = (r) => {
    setForm((f) => ({ ...f, torreManzana: r.torreManzana, aptoCasa: r.aptoCasa, residente: r.nombre }));
    const campo = document.getElementById("vis-nombre");
    if (campo) {
      campo.scrollIntoView({ behavior: "smooth", block: "center" });
      campo.focus();
    }
  };

  const registrarEntrada = async (e) => {
    e.preventDefault();
    if (guardando) return;
    setAviso(null);
    setGuardando(true);
    try {
      const resp = await fetch(`${API_BASE}/api/visitantes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, registradoPor: guardia }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || "No se pudo registrar la entrada.");
      setForm(FORM_VACIO);
      setAviso({ tipo: "ok", texto: `Entrada registrada: ${data.visita?.NombreVisitante || "visitante"}.` });
      await cargar();
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    } finally {
      setGuardando(false);
    }
  };

  const registrarSalida = async (visita) => {
    if (!window.confirm(`¿Registrar la salida de ${visita.NombreVisitante}?`)) return;
    setAviso(null);
    try {
      const resp = await fetch(`${API_BASE}/api/visitantes/${encodeURIComponent(visita.ID_Visita)}/salida`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registradoPor: guardia }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || "No se pudo registrar la salida.");
      setAviso({ tipo: "ok", texto: `Salida registrada: ${visita.NombreVisitante}.` });
      await cargar();
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16, textAlign: "left" }}>
      <div style={{ ...tarjeta, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0, color: TEAL_OSCURO }}>Portería</h2>
          <p style={{ margin: "4px 0 0", color: GRIS }}>Turno de {guardia}</p>
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.6em", fontWeight: 800, color: TEAL, lineHeight: 1 }}>{dentro.length}</div>
            <div style={{ color: GRIS, fontSize: "0.9em" }}>dentro ahora</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.6em", fontWeight: 700, color: TINTA, lineHeight: 1.1 }}>{entradasHoy}</div>
            <div style={{ color: GRIS, fontSize: "0.9em" }}>entradas hoy</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {onVolverAdmin && <button type="button" style={botonSecundario} onClick={onVolverAdmin}>Volver a administración</button>}
            {onCambiarPin && <button type="button" style={botonSecundario} onClick={onCambiarPin}>Cambiar mi PIN</button>}
            {onSalir && <button type="button" style={{ ...botonPrimario, padding: "9px 14px" }} onClick={onSalir}>Salir</button>}
          </div>
        </div>
      </div>

      <div role="tablist" style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[["visitantes", "Visitantes"], ["bitacora", "Bitácora"]].map(([clave, texto]) => (
          <button
            key={clave}
            type="button"
            role="tab"
            aria-selected={vista === clave}
            onClick={() => setVista(clave)}
            style={{ ...botonSecundario, background: vista === clave ? TEAL : "#fff", color: vista === clave ? "#fff" : TEAL }}
          >
            {texto}
          </button>
        ))}
      </div>

      {vista === "bitacora" && <BitacoraSeguridad usuario={usuario} />}

      {vista === "visitantes" && (
        <>
          {aviso && (
            <div
              role="status"
              style={{
                ...tarjeta, padding: "12px 16px", marginBottom: 18,
                background: aviso.tipo === "ok" ? "#dcfce7" : "#fee2e2",
                color: aviso.tipo === "ok" ? "#166534" : "#991b1b", fontWeight: 600,
              }}
            >
              {aviso.texto}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, alignItems: "start" }}>
            <form onSubmit={registrarEntrada} style={{ ...tarjeta, marginBottom: 0 }}>
              <h3 style={{ margin: "0 0 14px", color: TEAL_OSCURO }}>Registrar entrada</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="vis-nombre" style={etiqueta}>Nombre del visitante *</label>
                  <input id="vis-nombre" style={campo} value={form.nombre} onChange={cambiar("nombre")} autoComplete="off" />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="vis-doc" style={etiqueta}>Documento *</label>
                  <input id="vis-doc" style={campo} value={form.documento} onChange={cambiar("documento")} inputMode="numeric" autoComplete="off" />
                </div>
                <div>
                  <label htmlFor="vis-torre" style={etiqueta}>Torre / Manzana *</label>
                  <input id="vis-torre" style={campo} value={form.torreManzana} onChange={cambiar("torreManzana")} placeholder="Ej: T-2" autoComplete="off" />
                </div>
                <div>
                  <label htmlFor="vis-apto" style={etiqueta}>Apto / Casa *</label>
                  <input id="vis-apto" style={campo} value={form.aptoCasa} onChange={cambiar("aptoCasa")} placeholder="Ej: 302" autoComplete="off" />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="vis-res" style={etiqueta}>Residente que autoriza</label>
                  <input id="vis-res" style={campo} value={form.residente} onChange={cambiar("residente")} autoComplete="off" />
                </div>
                <div>
                  <label htmlFor="vis-motivo" style={etiqueta}>Motivo</label>
                  <select id="vis-motivo" style={campo} value={form.motivo} onChange={cambiar("motivo")}>
                    {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="vis-placa" style={etiqueta}>Placa del vehículo</label>
                  <input id="vis-placa" style={{ ...campo, textTransform: "uppercase" }} value={form.placa} onChange={cambiar("placa")} maxLength={8} autoComplete="off" />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="vis-obs" style={etiqueta}>Observaciones</label>
                  <input id="vis-obs" style={campo} value={form.observaciones} onChange={cambiar("observaciones")} autoComplete="off" />
                </div>
              </div>
              <button type="submit" disabled={guardando} style={{ ...botonPrimario, width: "100%", marginTop: 16, opacity: guardando ? 0.6 : 1 }}>
                {guardando ? "Registrando..." : "Registrar entrada"}
              </button>
            </form>

            <div style={{ ...tarjeta, marginBottom: 0 }}>
              <h3 style={{ margin: "0 0 14px", color: TEAL_OSCURO }}>Dentro del conjunto ({dentro.length})</h3>
              {dentro.length === 0 ? (
                <p style={{ color: GRIS, margin: 0 }}>No hay visitantes dentro. Las entradas que registres aparecerán aquí.</p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {dentro.map((v) => (
                    <div key={v.ID_Visita} style={{ border: `1px solid ${BORDE}`, borderRadius: 12, padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: TINTA }}>{v.NombreVisitante}</div>
                        <div style={{ color: GRIS, fontSize: "0.88em" }}>
                          Va a {v.TorreManzana}, {v.AptoCasa}. Entró a las {v.HoraEntrada}
                          {v.FechaEntrada !== hoyColombia() ? ` del ${v.FechaEntrada}` : ""}.
                        </div>
                        <div style={{ color: GRIS, fontSize: "0.88em" }}>
                          {v.Motivo}
                          {v.Placa ? `, placa ${v.Placa}` : ""}
                          {v.ResidenteVisitado ? `, autoriza ${v.ResidenteVisitado}` : ""}
                        </div>
                      </div>
                      <button type="button" style={botonSecundario} onClick={() => registrarSalida(v)}>Registrar salida</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ ...tarjeta, marginTop: 18 }}>
            <h3 style={{ margin: "0 0 4px", color: TEAL_OSCURO }}>Consultar residentes</h3>
            <p style={{ margin: "0 0 12px", color: GRIS, fontSize: "0.9em" }}>
              Busca por nombre, o por torre y apartamento, para saber a quién llamar y autorizar la visita.
            </p>
            <input
              aria-label="Consultar residentes"
              style={campo}
              placeholder="Nombre, o torre y apartamento (ej: T-2 302)"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              autoComplete="off"
            />
            {errorConsulta && <p style={{ color: "#991b1b", fontWeight: 600, margin: "10px 0 0" }}>{errorConsulta}</p>}
            {consulta.trim().length > 0 && consulta.trim().length < 2 && (
              <p style={{ color: GRIS, margin: "10px 0 0" }}>Escribe al menos 2 caracteres.</p>
            )}
            {resultados && resultados.length === 0 && (
              <p style={{ color: GRIS, margin: "10px 0 0" }}>No hay residentes que coincidan con esa búsqueda.</p>
            )}
            {resultados && resultados.length > 0 && (
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                {resultados.map((r, i) => (
                  <div key={`${r.nombre}-${r.torreManzana}-${r.aptoCasa}-${i}`} style={{ border: `1px solid ${BORDE}`, borderRadius: 12, padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: TINTA }}>{r.nombre}</div>
                      <div style={{ color: GRIS, fontSize: "0.88em" }}>
                        {r.torreManzana}, {r.aptoCasa}{r.tipo ? `. ${r.tipo}` : ""}
                      </div>
                      {r.telefono && (
                        <a href={`tel:${r.telefono}`} style={{ color: TEAL_OSCURO, fontWeight: 600, fontSize: "0.92em" }}>{r.telefono}</a>
                      )}
                    </div>
                    <button type="button" style={botonSecundario} onClick={() => usarEnRegistro(r)}>Usar en el registro</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ ...tarjeta, marginTop: 18 }}>
            <h3 style={{ margin: "0 0 4px", color: TEAL_OSCURO }}>{manejaParqueaderos ? "Consultar vehículos y parqueaderos" : "Consultar vehículos"}</h3>
            <p style={{ margin: "0 0 12px", color: GRIS, fontSize: "0.9em" }}>
              {manejaParqueaderos
                ? "Busca por placa, por torre y apartamento, o por el código del parqueadero."
                : "Busca por placa, o por torre y apartamento."}
            </p>
            <input
              aria-label="Consultar vehículos"
              style={campo}
              placeholder={manejaParqueaderos ? "Placa, torre y apartamento, o parqueadero" : "Placa, o torre y apartamento"}
              value={consultaVeh}
              onChange={(e) => setConsultaVeh(e.target.value)}
              autoComplete="off"
            />
            {errorVeh && <p style={{ color: "#991b1b", fontWeight: 600, margin: "10px 0 0" }}>{errorVeh}</p>}
            {consultaVeh.trim().length > 0 && consultaVeh.trim().length < 2 && (
              <p style={{ color: GRIS, margin: "10px 0 0" }}>Escribe al menos 2 caracteres.</p>
            )}
            {resultadoVeh && (() => {
              const vehiculos = resultadoVeh.vehiculos || [];
              const parqueaderosSueltos = (resultadoVeh.parqueaderos || []).filter(
                (p) => !vehiculos.some((v) => (v.parqueaderos || []).includes(p.codigo))
              );
              if (vehiculos.length === 0 && parqueaderosSueltos.length === 0) {
                return (
                  <p style={{ color: GRIS, margin: "10px 0 0" }}>
                    No hay vehículos registrados con esa búsqueda. Si es una visita, regístrala en "Registrar entrada".
                  </p>
                );
              }
              // Contactos del inmueble para avisar en una emergencia.
              const bloqueContactos = (contactos) => (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${BORDE}` }}>
                  {contactos && contactos.length > 0 ? (
                    contactos.map((c, idx) => (
                      <div key={`${c.nombre}-${idx}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ color: TINTA, fontSize: "0.92em" }}>{c.nombre}{c.tipo ? ` (${c.tipo})` : ""}</span>
                        <a href={`tel:${String(c.telefono).replace(/[^\d+]/g, "")}`} style={{ ...botonSecundario, textDecoration: "none", padding: "6px 12px" }}>
                          Llamar {c.telefono}
                        </a>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "#92400e", fontWeight: 600, fontSize: "0.9em" }}>
                      Sin teléfono registrado para este inmueble. Comunícate con la administración.
                    </div>
                  )}
                </div>
              );

              return (
                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  {vehiculos.map((v) => (
                    <div key={v.placa} style={{ border: `1px solid ${BORDE}`, borderRadius: 12, padding: "10px 12px" }}>
                      <div style={{ fontWeight: 800, color: TINTA, letterSpacing: "0.04em" }}>{v.placa}</div>
                      <div style={{ color: GRIS, fontSize: "0.9em" }}>
                        {[v.tipo, v.marca, v.color].filter(Boolean).join(", ")}
                      </div>
                      <div style={{ color: GRIS, fontSize: "0.9em" }}>Inmueble: {v.torreManzana}, {v.aptoCasa}</div>
                      {manejaParqueaderos && v.parqueaderos && v.parqueaderos.length > 0 && (
                        <div style={{ color: TEAL_OSCURO, fontWeight: 600, fontSize: "0.9em" }}>
                          Parqueadero{v.parqueaderos.length > 1 ? "s" : ""}: {v.parqueaderos.join(", ")}
                        </div>
                      )}
                    {bloqueContactos(v.contactos)}
</div>
                  ))}
                  {parqueaderosSueltos.map((p) => (
                    <div key={p.codigo} style={{ border: `1px solid ${BORDE}`, borderRadius: 12, padding: "10px 12px" }}>
                      <div style={{ fontWeight: 800, color: TINTA }}>Parqueadero {p.codigo}</div>
                      <div style={{ color: GRIS, fontSize: "0.9em" }}>
                        {p.torreManzana}, {p.aptoCasa}{p.tipo ? `. ${p.tipo}` : ""}. Sin vehículo registrado.
                      </div>
                    {bloqueContactos(p.contactos)}
</div>
                  ))}
                </div>
              );
            })()}
          </div>

          <div style={{ ...tarjeta, marginTop: 18 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: TEAL_OSCURO }}>Historial reciente</h3>
              <input
                aria-label="Buscar en el historial"
                style={{ ...campo, width: "min(320px, 100%)" }}
                placeholder="Buscar por nombre, documento, apto o placa"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>Fecha</th><th style={th}>Entrada</th><th style={th}>Salida</th>
                    <th style={th}>Visitante</th><th style={th}>Documento</th><th style={th}>Destino</th>
                    <th style={th}>Motivo</th><th style={th}>Placa</th><th style={th}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.length === 0 ? (
                    <tr><td style={td} colSpan={9}>{busqueda ? "Ninguna visita coincide con la búsqueda." : "Aún no hay visitas registradas."}</td></tr>
                  ) : (
                    historial.map((v) => (
                      <tr key={v.ID_Visita}>
                        <td style={td}>{v.FechaEntrada}</td>
                        <td style={td}>{v.HoraEntrada}</td>
                        <td style={td}>{v.HoraSalida || "-"}</td>
                        <td style={td}>{v.NombreVisitante}</td>
                        <td style={td}>{v.DocumentoVisitante}</td>
                        <td style={td}>{v.TorreManzana}, {v.AptoCasa}</td>
                        <td style={td}>{v.Motivo}</td>
                        <td style={td}>{v.Placa || "-"}</td>
                        <td style={{ ...td, fontWeight: 700, color: v.Estado === "dentro" ? TEAL : GRIS }}>{v.Estado === "dentro" ? "Dentro" : "Salió"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

