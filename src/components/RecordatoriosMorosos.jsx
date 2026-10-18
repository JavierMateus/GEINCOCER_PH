// src/components/RecordatoriosMorosos.jsx
// Recordatorios de cobro para residentes en mora.
//   - Lista a cada residente con saldo vencido (opcional: tambien lo que esta por vencer).
//   - Arma un mensaje con su saldo y el detalle de cada obligacion.
//   - Botones WhatsApp y Correo: abren la aplicacion con el mensaje listo;
//     el administrador solo revisa y presiona Enviar.
//   - Cada envio queda anotado en BaseResidencial\Recordatorios.csv.
//
// Props:
//   enviadoPor -> nombre de quien envia (opcional)
//   onCerrar   -> cierra la ventana

import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config";

const NOMBRE_CONJUNTO = "GEINCOCER";

const MENSAJE_BASE =
  "Hola {nombre}, le saludamos de la Administración {conjunto}.\n\n" +
  "Le recordamos que el inmueble {inmueble} tiene un saldo pendiente de {total}:\n" +
  "{detalle}\n\n" +
  "Puede pagar en línea desde la aplicación (Pagos Online) o por transferencia, enviando el soporte a la administración. " +
  "Recuerde que los saldos vencidos generan intereses de mora (Ley 675 de 2001, art. 30).\n\n" +
  "Si ya realizó el pago, por favor ignore este mensaje. ¡Gracias!";

const CLAVE_PLANTILLA = "plantillaRecordatorioMora";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const pesos = (n) => `$${Number(n || 0).toLocaleString("es-CO")}`;

const periodoTexto = (p) => {
  const m = String(p || "").match(/^(\d{4})-(\d{2})$/);
  return m ? `${MESES[Number(m[2]) - 1]} ${m[1]}` : p || "";
};

const conceptoTexto = (c, s) => {
  const base = String(c || "").replace(/_/g, " ").trim();
  const sub = String(s || "").replace(/_/g, " ").trim();
  if (base === "administracion") return "Cuota de administración";
  if (base === "interes mora") return "Intereses de mora";
  const t = sub && sub !== base ? `${base} (${sub})` : base;
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const fechaVisual = (v) => {
  const t = String(v || "").trim();
  const p = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return p ? `${Number(p[3])}/${p[2]}/${p[1]}` : t;
};

const fechaHoraVisual = (v) => {
  const p = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return p ? `${Number(p[3])}/${p[2]}/${p[1]} ${p[4]}:${p[5]}` : v;
};

const armarMensaje = (plantilla, r) => {
  const detalle = r.obligaciones
    .map(
      (o) =>
        `• ${conceptoTexto(o.concepto, o.subconcepto)} ${periodoTexto(o.periodo)}: ${pesos(o.saldo)}` +
        (o.estado === "mora" ? ` (venció el ${fechaVisual(o.vence)})` : ` (vence el ${fechaVisual(o.vence)})`)
    )
    .join("\n");

  return plantilla
    .replace(/\{nombre\}/g, r.nombre)
    .replace(/\{inmueble\}/g, r.inmueble)
    .replace(/\{total\}/g, pesos(r.total))
    .replace(/\{detalle\}/g, detalle)
    .replace(/\{conjunto\}/g, NOMBRE_CONJUNTO);
};

const botonBase = {
  border: "none",
  borderRadius: 7,
  padding: "6px 12px",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 13,
};

function RecordatoriosMorosos({ enviadoPor, onCerrar }) {
  const [residentes, setResidentes] = useState([]);
  const [incluirPendientes, setIncluirPendientes] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [plantilla, setPlantilla] = useState(() => localStorage.getItem(CLAVE_PLANTILLA) || MENSAJE_BASE);
  const [editando, setEditando] = useState(false);
  const [abierto, setAbierto] = useState("");
  const [copiado, setCopiado] = useState("");

  const cargar = async () => {
    setCargando(true);
    setError("");
    try {
      const resp = await fetch(`${API_BASE}/api/pagos-recibidos/morosos${incluirPendientes ? "?incluirPendientes=1" : ""}`, { cache: "no-store" });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error || "No se pudo cargar la lista.");
      setResidentes(data.residentes);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incluirPendientes]);

  useEffect(() => {
    localStorage.setItem(CLAVE_PLANTILLA, plantilla);
  }, [plantilla]);

  const totales = useMemo(
    () => ({
      personas: residentes.length,
      mora: residentes.reduce((s, r) => s + r.totalMora, 0),
      pendiente: residentes.reduce((s, r) => s + r.totalPendiente, 0),
    }),
    [residentes]
  );

  const registrar = async (r, canal) => {
    try {
      const resp = await fetch(`${API_BASE}/api/pagos-recibidos/recordatorios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documento: r.documento,
          nombre: r.nombre,
          canal,
          total: r.total,
          obligaciones: r.obligaciones.map((o) => o.id),
          enviadoPor: enviadoPor || "Administrador",
        }),
      });
      const data = await resp.json();
      if (data.ok) {
        setResidentes((lista) =>
          lista.map((x) => (x.documento === r.documento ? { ...x, ultimoRecordatorio: { fecha: data.fecha, canal } } : x))
        );
      }
    } catch (err) {
      console.error("No se pudo anotar el recordatorio:", err);
    }
  };

  const enviarWhatsApp = (r) => {
    const mensaje = armarMensaje(plantilla, r);
    window.open(`https://wa.me/57${r.telefono}?text=${encodeURIComponent(mensaje)}`, "_blank");
    registrar(r, "WhatsApp");
  };

  const enviarCorreo = (r) => {
    const mensaje = armarMensaje(plantilla, r);
    const asunto = `Recordatorio de pago - ${r.inmueble} - ${NOMBRE_CONJUNTO}`;
    window.location.href = `mailto:${r.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`;
    registrar(r, "Correo");
  };

  const copiar = async (r) => {
    try {
      await navigator.clipboard.writeText(armarMensaje(plantilla, r));
      setCopiado(r.documento);
      setTimeout(() => setCopiado(""), 2000);
    } catch {
      alert("No se pudo copiar. Abre 'Ver mensaje' y cópialo a mano.");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#0008", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 1000, maxHeight: "94vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0, color: "#188aac" }}>Recordatorios de cobro</h2>
          <button type="button" onClick={onCerrar} style={{ ...botonBase, background: "#64748b", color: "#fff" }}>
            Cerrar
          </button>
        </div>

        <p style={{ color: "#475569", fontSize: 14 }}>
          Los botones abren WhatsApp o tu correo con el mensaje listo. Revisa y presiona <strong>Enviar</strong> en esa aplicación.
          Cada envío queda anotado con fecha y hora.
        </p>

        {/* Opciones */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer", fontSize: 14 }}>
            <input type="checkbox" checked={incluirPendientes} onChange={(e) => setIncluirPendientes(e.target.checked)} />
            Incluir también cuotas que aún no vencen
          </label>
          <button type="button" onClick={() => setEditando((v) => !v)} style={{ ...botonBase, background: "#fff", color: "#218290", border: "1px solid #218290" }}>
            {editando ? "Ocultar mensaje" : "Editar mensaje"}
          </button>
        </div>

        {editando && (
          <div style={{ marginBottom: 14 }}>
            <textarea
              value={plantilla}
              onChange={(e) => setPlantilla(e.target.value)}
              rows={9}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box", fontFamily: "inherit", fontSize: 14 }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 12, color: "#64748b" }}>
              <span>
                Palabras que se reemplazan solas: <strong>{"{nombre}"}</strong>, <strong>{"{inmueble}"}</strong>, <strong>{"{total}"}</strong>,{" "}
                <strong>{"{detalle}"}</strong>, <strong>{"{conjunto}"}</strong>
              </span>
              <button type="button" onClick={() => setPlantilla(MENSAJE_BASE)} style={{ ...botonBase, background: "#f1f5f9", color: "#475569", padding: "3px 10px" }}>
                Restaurar mensaje original
              </button>
            </div>
          </div>
        )}

        {/* Resumen */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          {[
            ["Residentes", totales.personas, "#0f172a"],
            ["Total en mora", pesos(totales.mora), "#b91c1c"],
            ...(incluirPendientes ? [["Por vencer", pesos(totales.pendiente), "#b45309"]] : []),
          ].map(([t, v, c]) => (
            <div key={t} style={{ background: "#f8fafc", borderRadius: 10, padding: "8px 14px" }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>{t}</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: c }}>{v}</div>
            </div>
          ))}
        </div>

        {cargando && <p style={{ color: "#218290" }}>Cargando...</p>}
        {error && <div style={{ padding: 10, borderRadius: 8, background: "#fee2e2", color: "#b91c1c", fontWeight: 600 }}>{error}</div>}

        {!cargando && !error && !residentes.length && (
          <div style={{ padding: 16, textAlign: "center", color: "#166534", background: "#dcfce7", borderRadius: 10, fontWeight: 600 }}>
            No hay residentes en mora. ¡Cartera al día!
          </div>
        )}

        {/* Lista */}
        {residentes.map((r) => {
          const telOk = /^\d{10}$/.test(r.telefono);
          const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email);
          return (
            <div key={r.documento} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>{r.nombre}</div>
                  <div style={{ fontSize: 13, color: "#475569" }}>
                    {r.inmueble} · CC {r.documento}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {telOk ? r.telefono : "Sin celular"} · {emailOk ? r.email : "Sin correo"}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, color: r.totalMora > 0 ? "#b91c1c" : "#b45309", fontSize: 17 }}>{pesos(r.total)}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {r.obligaciones.length} obligación(es)
                    {r.ultimoRecordatorio && (
                      <span>
                        {" "}· Último aviso: {fechaHoraVisual(r.ultimoRecordatorio.fecha)} ({r.ultimoRecordatorio.canal})
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={!telOk}
                    onClick={() => enviarWhatsApp(r)}
                    title={telOk ? "" : "No tiene celular de 10 números en Habitantes"}
                    style={{ ...botonBase, background: telOk ? "#16a34a" : "#e2e8f0", color: telOk ? "#fff" : "#94a3b8", cursor: telOk ? "pointer" : "not-allowed" }}
                  >
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    disabled={!emailOk}
                    onClick={() => enviarCorreo(r)}
                    title={emailOk ? "" : "No tiene correo válido en Habitantes"}
                    style={{ ...botonBase, background: emailOk ? "#2563eb" : "#e2e8f0", color: emailOk ? "#fff" : "#94a3b8", cursor: emailOk ? "pointer" : "not-allowed" }}
                  >
                    Correo
                  </button>
                  <button type="button" onClick={() => copiar(r)} style={{ ...botonBase, background: "#fff", color: "#475569", border: "1px solid #94a3b8" }}>
                    {copiado === r.documento ? "¡Copiado!" : "Copiar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbierto(abierto === r.documento ? "" : r.documento)}
                    style={{ ...botonBase, background: "#fff", color: "#218290", border: "1px solid #218290" }}
                  >
                    {abierto === r.documento ? "Ocultar" : "Ver mensaje"}
                  </button>
                </div>
              </div>

              {abierto === r.documento && (
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, background: "#f8fafc", padding: 12, borderRadius: 8, marginTop: 10, marginBottom: 0 }}>
                  {armarMensaje(plantilla, r)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RecordatoriosMorosos;