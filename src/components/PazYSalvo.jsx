// src/components/PazYSalvo.jsx
// Ventana para revisar y expedir el paz y salvo de un inmueble.
//   - Administrador: elige el inmueble de una lista.
//   - Residente: se abre con su propio inmueble (prop inmuebleFijo).
// Si hay deudas en mora, muestra cuales son y no deja expedir.
//
// Props:
//   usuario       -> quien lo solicita
//   inmuebleFijo  -> { torre, apto } (opcional, para el residente)
//   onCerrar      -> cierra la ventana

import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config";
import { expedirPazYSalvo } from "./pazYSalvoPdf";

const pesos = (n) => `$${Number(n || 0).toLocaleString("es-CO")}`;
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const periodoTexto = (p) => {
  const m = String(p || "").match(/^(\d{4})-(\d{2})$/);
  return m ? `${MESES[Number(m[2]) - 1]} ${m[1]}` : p || "";
};
const conceptoTexto = (c, s) => {
  const base = String(c || "").replace(/_/g, " ").trim();
  if (base === "administracion") return "Cuota de administración";
  if (base === "interes mora") return "Intereses de mora";
  const sub = String(s || "").replace(/_/g, " ").trim();
  const t = sub && sub !== base ? `${base} (${sub})` : base;
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const num = (t) => Number(String(t).replace(/\D/g, "")) || 0;

function PazYSalvo({ usuario, inmuebleFijo, onCerrar }) {
  const [inmuebles, setInmuebles] = useState([]);
  const [seleccion, setSeleccion] = useState(inmuebleFijo ? `${inmuebleFijo.torre}|${inmuebleFijo.apto}` : "");
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });

  // Lista de inmuebles (solo para el administrador)
  useEffect(() => {
    if (inmuebleFijo) return;
    fetch(`${API_BASE}/api/habitantes`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const mapa = new Map();
        (data.habitantes || []).forEach((h) => {
          if (String(h.Rol).toLowerCase() !== "residente" || !h.TorreManzana || !h.AptoCasa) return;
          const clave = `${h.TorreManzana}|${h.AptoCasa}`;
          const actual = mapa.get(clave);
          if (!actual || String(h.Tipo).toLowerCase() === "propietario") {
            mapa.set(clave, { clave, torre: h.TorreManzana, apto: h.AptoCasa, nombre: h.NombreResidente });
          }
        });
        setInmuebles([...mapa.values()]);
      })
      .catch(() => setMensaje({ tipo: "error", texto: "No se pudo cargar la lista de inmuebles." }));
  }, [inmuebleFijo]);

  const ordenados = useMemo(
    () =>
      [...inmuebles].sort((a, b) =>
        a.torre[0] !== b.torre[0] ? a.torre.localeCompare(b.torre) : num(a.torre) - num(b.torre) || num(a.apto) - num(b.apto)
      ),
    [inmuebles]
  );

  // Revisar estado cuando cambia el inmueble
  useEffect(() => {
    if (!seleccion) {
      setEstado(null);
      return;
    }
    const [torre, apto] = seleccion.split("|");
    setCargando(true);
    setMensaje({ tipo: "", texto: "" });
    fetch(`${API_BASE}/api/pagos-recibidos/paz-y-salvo/estado?torre=${encodeURIComponent(torre)}&apto=${encodeURIComponent(apto)}`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "No se pudo revisar el inmueble.");
        setEstado(data);
      })
      .catch((err) => {
        setEstado(null);
        setMensaje({ tipo: "error", texto: err.message });
      })
      .finally(() => setCargando(false));
  }, [seleccion]);

  const expedir = async () => {
    const [torre, apto] = seleccion.split("|");
    setCargando(true);
    setMensaje({ tipo: "", texto: "" });
    try {
      const d = await expedirPazYSalvo({ torre, apto, solicitadoPor: usuario?.nombre || "" });
      setMensaje({ tipo: "ok", texto: `Paz y salvo ${d.numero} expedido. Válido hasta el ${d.validoHasta}.` });
    } catch (err) {
      setMensaje({ tipo: "error", texto: err.message });
    } finally {
      setCargando(false);
    }
  };

  const totalMora = (estado?.enMora || []).reduce((s, o) => s + o.saldo, 0);
  const totalPorVencer = (estado?.porVencer || []).reduce((s, o) => s + o.saldo, 0);

  const filaDeuda = (o) => (
    <tr key={o.id} style={{ borderTop: "1px solid #e2e8f0" }}>
      <td style={{ padding: 6 }}>{o.id}</td>
      <td style={{ padding: 6 }}>{conceptoTexto(o.concepto, o.subconcepto)}</td>
      <td style={{ padding: 6 }}>{periodoTexto(o.periodo)}</td>
      <td style={{ padding: 6 }}>{o.vence}</td>
      <td style={{ padding: 6, textAlign: "right" }}>{pesos(o.saldo)}</td>
    </tr>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#0008", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 680, maxHeight: "94vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0, color: "#188aac" }}>Paz y salvo</h2>
          <button type="button" onClick={onCerrar} style={{ background: "#64748b", color: "#fff", border: "none", borderRadius: 7, padding: "6px 16px", cursor: "pointer" }}>
            Cerrar
          </button>
        </div>

        <p style={{ color: "#475569", fontSize: 14 }}>
          Se expide por inmueble cuando no tiene obligaciones en mora. Vale hasta el último día del mes.
        </p>

        {!inmuebleFijo && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontWeight: "bold", color: "#334155", fontSize: "0.85em" }}>Inmueble</label>
            <select
              value={seleccion}
              onChange={(e) => setSeleccion(e.target.value)}
              style={{ width: "100%", padding: "0.6em", borderRadius: 7, border: "1px solid #cbd5e1", marginTop: 4 }}
            >
              <option value="">Selecciona un inmueble...</option>
              {ordenados.map((i) => (
                <option key={i.clave} value={i.clave}>
                  {i.torre} - {i.apto} · {i.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        {cargando && <p style={{ color: "#218290" }}>Revisando...</p>}

        {estado && !cargando && (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
            <div style={{ fontWeight: 700, color: "#0f172a" }}>
              {estado.torreManzana} - {estado.aptoCasa}
            </div>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 10 }}>
              Titular: {estado.titular?.nombre || "Sin titular registrado"}
              {estado.titular?.tipo && ` (${estado.titular.tipo})`}
            </div>

            {estado.puede ? (
              <div style={{ padding: 10, borderRadius: 8, background: "#dcfce7", color: "#166534", fontWeight: 700 }}>
                Sin obligaciones en mora: se puede expedir el paz y salvo.
              </div>
            ) : (
              <>
                <div style={{ padding: 10, borderRadius: 8, background: "#fee2e2", color: "#b91c1c", fontWeight: 700 }}>
                  Tiene {estado.enMora.length} obligación(es) en mora por {pesos(totalMora)}. Para expedir el paz y salvo debe ponerse al día.
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 8 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                      <th style={{ padding: 6 }}>Obligación</th>
                      <th style={{ padding: 6 }}>Concepto</th>
                      <th style={{ padding: 6 }}>Periodo</th>
                      <th style={{ padding: 6 }}>Venció</th>
                      <th style={{ padding: 6, textAlign: "right" }}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>{estado.enMora.map(filaDeuda)}</tbody>
                </table>
              </>
            )}

            {estado.porVencer.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 13, color: "#b45309" }}>
                Tiene {pesos(totalPorVencer)} que aún no vence. No impide el paz y salvo; el certificado lo menciona.
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button
                type="button"
                onClick={expedir}
                disabled={!estado.puede || cargando}
                style={{
                  padding: "0.65em 1.5em",
                  borderRadius: 8,
                  border: "none",
                  background: estado.puede ? "#218290" : "#cbd5e1",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: estado.puede ? "pointer" : "not-allowed",
                }}
              >
                Expedir y descargar PDF
              </button>
            </div>
          </div>
        )}

        {mensaje.texto && (
          <div
            style={{
              marginTop: 14,
              padding: 10,
              borderRadius: 8,
              fontWeight: 600,
              color: mensaje.tipo === "ok" ? "#166534" : "#b91c1c",
              background: mensaje.tipo === "ok" ? "#dcfce7" : "#fee2e2",
            }}
          >
            {mensaje.texto}
          </div>
        )}
      </div>
    </div>
  );
}

export default PazYSalvo;