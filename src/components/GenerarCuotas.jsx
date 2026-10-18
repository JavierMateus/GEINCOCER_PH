// src/components/GenerarCuotas.jsx
// Ventana del administrador para generar la cuota de administracion del mes.
//   1. Valores de la cuota (apartamento / casa) y dia de vencimiento.
//   2. Periodo -> vista previa (no guarda).
//   3. Confirmar -> se crean las obligaciones en obligaciones_residente.csv.
//
// Props:
//   usuario  -> administrador en sesion (para "Generada por")
//   onCerrar -> cierra la ventana

import React, { useEffect, useState } from "react";
import { API_BASE } from "../config";

const pesos = (n) => `$${Number(n || 0).toLocaleString("es-CO")}`;

const periodoActual = () => {
  const f = new Date();
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}`;
};

const ESTADOS = {
  generar: { texto: "Se genera", color: "#166534", fondo: "#dcfce7" },
  existe: { texto: "Ya existe", color: "#475569", fondo: "#f1f5f9" },
  sin_responsable: { texto: "Sin responsable", color: "#b91c1c", fondo: "#fee2e2" },
};

const estiloInput = {
  width: "100%",
  padding: "0.55em",
  borderRadius: "7px",
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
  marginTop: "3px",
};

const Campo = ({ etiqueta, children, ancho = "1 1 160px" }) => (
  <div style={{ flex: ancho, minWidth: 0 }}>
    <label style={{ fontWeight: "bold", color: "#334155", fontSize: "0.82em" }}>{etiqueta}</label>
    {children}
  </div>
);

function GenerarCuotas({ usuario, onCerrar }) {
  const [config, setConfig] = useState({ valorApartamento: "", valorCasa: "", diaVencimiento: "" });
  const [configGuardada, setConfigGuardada] = useState(null);
  const [periodo, setPeriodo] = useState(periodoActual());
  const [previa, setPrevia] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });
  const [generado, setGenerado] = useState(false);

  const mostrar = (tipo, texto) => setMensaje({ tipo, texto });

  useEffect(() => {
    fetch(`${API_BASE}/api/cuotas/config`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error);
        setConfig({
          valorApartamento: String(data.config.valorApartamento),
          valorCasa: String(data.config.valorCasa),
          diaVencimiento: String(data.config.diaVencimiento),
        });
        setConfigGuardada(data.config);
      })
      .catch(() => mostrar("error", "No se pudo leer la configuración. Revisa que el backend esté encendido."));
  }, []);

  const cambiosSinGuardar =
    configGuardada &&
    (Number(config.valorApartamento) !== configGuardada.valorApartamento ||
      Number(config.valorCasa) !== configGuardada.valorCasa ||
      Number(config.diaVencimiento) !== configGuardada.diaVencimiento);

  const guardarConfig = async () => {
    setCargando(true);
    mostrar("", "");
    try {
      const resp = await fetch(`${API_BASE}/api/cuotas/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error || "No se pudo guardar.");
      setConfigGuardada(data.config);
      setPrevia(null);
      mostrar("ok", "Valores guardados. Ahora revisa la vista previa.");
    } catch (err) {
      mostrar("error", err.message);
    } finally {
      setCargando(false);
    }
  };

  const verPrevia = async () => {
    setCargando(true);
    mostrar("", "");
    setGenerado(false);
    try {
      const resp = await fetch(`${API_BASE}/api/cuotas/previa?periodo=${periodo}`, { cache: "no-store" });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error || "No se pudo calcular.");
      setPrevia(data);
    } catch (err) {
      mostrar("error", err.message);
    } finally {
      setCargando(false);
    }
  };

  const generar = async () => {
    const r = previa.resumen;
    const ok = window.confirm(
      `Se generarán ${r.aGenerar} cuota(s) de ${previa.nombreMes} por ${pesos(r.totalGenerar)}.\n` +
        `Vencen el ${previa.fechaVencimiento}.\n\nAntes de guardar se hace una copia de respaldo. ¿Continuar?`
    );
    if (!ok) return;

    setCargando(true);
    mostrar("", "");
    try {
      const resp = await fetch(`${API_BASE}/api/cuotas/generar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodo, registradoPor: usuario?.nombre || "Administrador" }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error || "No se pudieron generar.");
      mostrar("ok", data.mensaje);
      setGenerado(true);
      // Recalcula para que la tabla muestre "Ya existe"
      const resp2 = await fetch(`${API_BASE}/api/cuotas/previa?periodo=${periodo}`, { cache: "no-store" });
      const data2 = await resp2.json();
      if (data2.ok) setPrevia(data2);
    } catch (err) {
      mostrar("error", err.message);
    } finally {
      setCargando(false);
    }
  };

  const r = previa?.resumen;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#0008", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 960, maxHeight: "94vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0, color: "#188aac" }}>Generar cuotas de administración</h2>
          <button type="button" onClick={onCerrar} disabled={cargando} style={{ background: "#64748b", color: "#fff", border: "none", borderRadius: 7, padding: "6px 16px", cursor: "pointer" }}>
            Cerrar
          </button>
        </div>

        {/* 1. Valores */}
        <h4 style={{ margin: "18px 0 6px", color: "#0f172a" }}>1. Valor de la cuota mensual</h4>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Campo etiqueta="Apartamento (torres T-)">
            <input value={config.valorApartamento} onChange={(e) => setConfig({ ...config, valorApartamento: e.target.value.replace(/\D/g, "") })} inputMode="numeric" style={estiloInput} />
          </Campo>
          <Campo etiqueta="Casa (manzanas M-)">
            <input value={config.valorCasa} onChange={(e) => setConfig({ ...config, valorCasa: e.target.value.replace(/\D/g, "") })} inputMode="numeric" style={estiloInput} />
          </Campo>
          <Campo etiqueta="Vence el día" ancho="0 1 120px">
            <input value={config.diaVencimiento} onChange={(e) => setConfig({ ...config, diaVencimiento: e.target.value.replace(/\D/g, "").slice(0, 2) })} inputMode="numeric" style={estiloInput} />
          </Campo>
          <button
            type="button"
            onClick={guardarConfig}
            disabled={cargando || !cambiosSinGuardar}
            style={{ padding: "0.55em 1.2em", borderRadius: 8, border: "none", background: cambiosSinGuardar ? "#f59e0b" : "#e2e8f0", color: cambiosSinGuardar ? "#fff" : "#94a3b8", fontWeight: 700, cursor: cambiosSinGuardar ? "pointer" : "default" }}
          >
            Guardar valores
          </button>
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
          Apartamento {pesos(config.valorApartamento)} · Casa {pesos(config.valorCasa)}. El cambio de valor aplica a las cuotas que se generen desde ahora; las anteriores no cambian.
        </div>

        {/* 2. Periodo */}
        <h4 style={{ margin: "18px 0 6px", color: "#0f172a" }}>2. Mes a generar</h4>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Campo etiqueta="Periodo" ancho="0 1 200px">
            <input type="month" value={periodo} onChange={(e) => { setPeriodo(e.target.value); setPrevia(null); setGenerado(false); }} style={estiloInput} />
          </Campo>
          <button
            type="button"
            onClick={verPrevia}
            disabled={cargando || !periodo || cambiosSinGuardar}
            title={cambiosSinGuardar ? "Primero guarda los valores" : ""}
            style={{ padding: "0.55em 1.2em", borderRadius: 8, border: "none", background: "#218290", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: cambiosSinGuardar ? 0.5 : 1 }}
          >
            Ver vista previa
          </button>
          {cambiosSinGuardar && <span style={{ color: "#b45309", fontSize: 13 }}>Primero guarda los valores.</span>}
        </div>

        {mensaje.texto && (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 8, fontWeight: 600, color: mensaje.tipo === "ok" ? "#166534" : "#b91c1c", background: mensaje.tipo === "ok" ? "#dcfce7" : "#fee2e2" }}>
            {mensaje.texto}
          </div>
        )}

        {/* 3. Vista previa */}
        {previa && (
          <>
            <h4 style={{ margin: "18px 0 6px", color: "#0f172a" }}>
              3. Vista previa: {previa.nombreMes} · vence el {previa.fechaVencimiento}
            </h4>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              {[
                ["Inmuebles ocupados", r.inmuebles, "#0f172a"],
                ["Se generan", r.aGenerar, "#166534"],
                ["Ya tenían cuota", r.yaExisten, "#475569"],
                ["Sin responsable", r.sinResponsable, "#b91c1c"],
                ["Total a cobrar", pesos(r.totalGenerar), "#1d4ed8"],
              ].map(([t, v, c]) => (
                <div key={t} style={{ background: "#f8fafc", borderRadius: 10, padding: "8px 14px" }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{t}</div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: c }}>{v}</div>
                </div>
              ))}
            </div>

            {previa.avisos.map((a) => (
              <div key={a} style={{ color: "#b45309", fontSize: 13, marginBottom: 6 }}>• {a}</div>
            ))}

            <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                    <th style={{ padding: 8 }}>Inmueble</th>
                    <th style={{ padding: 8 }}>Tipo</th>
                    <th style={{ padding: 8 }}>A nombre de</th>
                    <th style={{ padding: 8 }}>Documento</th>
                    <th style={{ padding: 8, textAlign: "right" }}>Valor</th>
                    <th style={{ padding: 8 }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.filas.map((f) => {
                    const e = ESTADOS[f.estado];
                    return (
                      <tr key={`${f.torreManzana}-${f.aptoCasa}`} style={{ borderTop: "1px solid #e2e8f0" }}>
                        <td style={{ padding: 8, whiteSpace: "nowrap" }}>{f.torreManzana} - {f.aptoCasa}</td>
                        <td style={{ padding: 8 }}>{f.tipo}</td>
                        <td style={{ padding: 8 }}>
                          {f.nombre || "-"}
                          {f.tipoResponsable && <span style={{ color: "#64748b", fontSize: 12 }}> ({f.tipoResponsable})</span>}
                        </td>
                        <td style={{ padding: 8 }}>{f.documento || "-"}</td>
                        <td style={{ padding: 8, textAlign: "right" }}>{pesos(f.valor)}</td>
                        <td style={{ padding: 8 }}>
                          <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: e.color, background: e.fondo, whiteSpace: "nowrap" }}>{e.texto}</span>
                          {f.detalle && <div style={{ fontSize: 12, color: f.estado === "generar" ? "#b45309" : "#64748b", marginTop: 2 }}>{f.detalle}</div>}
                        </td>
                      </tr>
                    );
                  })}
                  {!previa.filas.length && (
                    <tr>
                      <td colSpan={6} style={{ padding: 14, textAlign: "center", color: "#64748b" }}>
                        No hay inmuebles con residentes activos en este periodo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {!generado && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <button
                  type="button"
                  onClick={generar}
                  disabled={cargando || !r.aGenerar}
                  style={{ padding: "0.65em 1.6em", borderRadius: 8, border: "none", background: r.aGenerar ? "#218290" : "#cbd5e1", color: "#fff", fontWeight: 700, cursor: r.aGenerar ? "pointer" : "not-allowed" }}
                >
                  {cargando ? "Generando..." : r.aGenerar ? `Generar ${r.aGenerar} cuota(s) por ${pesos(r.totalGenerar)}` : "No hay cuotas nuevas para generar"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default GenerarCuotas;