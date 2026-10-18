// src/components/FormularioPago.jsx
// Registrar pago recibido (administrador).
//
// 1) Se elige el residente.
// 2) Se marcan sus obligaciones pendientes (al marcar una cuota se marcan
//    sus intereses).
// 3) Se escribe el valor recibido. El sistema lo reparte solo:
//    primero intereses y luego capital, empezando por lo mas antiguo.
//    Si no alcanza, la ultima obligacion queda como abono parcial.
// 4) Se guarda en /api/pagos-recibidos/registrar: una fila por obligacion.
//
// Lo usan InformeMorosidad.jsx y PagosAdmin.jsx.

import React, { useEffect, useMemo, useState } from "react";
import { descargarComprobante } from "./comprobantePago";

const metodosPago = ["Transferencia", "Consignación", "Efectivo", "Mercado Pago", "Otro"];
const metodosConReferencia = ["Transferencia", "Consignación", "Mercado Pago"];

const coloresBG = { header: "#15aabf", body: "#fff" };

const aNumero = (valor) => Number(String(valor ?? 0).replace(/[^\d.-]/g, "")) || 0;

const formatearMoneda = (valor) => `$${Math.round(Number(valor || 0)).toLocaleString("es-CO")}`;

const soloDigitos = (valor) => String(valor ?? "").replace(/\D/g, "");

const esInteres = (o) => String(o?.Concepto || "").trim().toLowerCase() === "interes_mora";

const idDe = (o) => String(o?.ID_Obligacion || "").trim();

const padreDe = (o) => String(o?.ID_ObligacionPadre || "").trim();

const saldoDe = (o) => aNumero(o?.SaldoPendiente);

// Acepta 10/07/2026 y 2026-07-10. Devuelve AAAAMMDD para ordenar.
const claveFecha = (valor) => {
  const texto = String(valor || "").trim();
  let p = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (p) return Number(p[1]) * 10000 + Number(p[2]) * 100 + Number(p[3]);
  p = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) return Number(p[3]) * 10000 + Number(p[2]) * 100 + Number(p[1]);
  return 0;
};

// Mismo orden que el backend: intereses primero, luego lo mas antiguo.
const ordenImputacion = (a, b) => {
  const ia = esInteres(a) ? 0 : 1;
  const ib = esInteres(b) ? 0 : 1;
  if (ia !== ib) return ia - ib;
  const fa = claveFecha(a.FechaVencimiento);
  const fb = claveFecha(b.FechaVencimiento);
  if (fa !== fb) return fa - fb;
  return idDe(a).localeCompare(idDe(b));
};

const hoyISO = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

const nombreConcepto = (o) => {
  const concepto = String(o?.Concepto || "").trim();
  const sub = String(o?.Subconcepto || "").trim();
  return sub && sub !== concepto ? `${concepto} · ${sub}` : concepto || "Sin concepto";
};

function FormularioPago(props) {
  const onClose = props?.onClose;
  const onBack = props?.onBack || onClose;
  const onGuardado = props?.onGuardado;
  const registradoPor = props?.registradoPor || "Administrador";

  const [cartera, setCartera] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [documento, setDocumento] = useState("");
  const [seleccion, setSeleccion] = useState({});
  const [valorRecibido, setValorRecibido] = useState("");
  const [valorEditado, setValorEditado] = useState(false);
  const [fechaPago, setFechaPago] = useState(hoyISO());
  const [metodoPago, setMetodoPago] = useState("Transferencia");
  const [referencia, setReferencia] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const requiereReferencia = metodosConReferencia.includes(metodoPago);

  // Saldos calculados en el servidor (misma regla con la que se valida).
  useEffect(() => {
    const cargar = async () => {
      try {
        const resp = await fetch("/api/pagos-recibidos/cartera", { cache: "no-store" });
        const data = await resp.json();
        setCartera(Array.isArray(data.obligaciones) ? data.obligaciones : []);
      } catch (err) {
        console.error("No se pudo cargar la cartera:", err);
        setErrores({ general: "No se pudo cargar la cartera. Revisa que el backend esté encendido." });
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, []);

  const pendientes = useMemo(() => cartera.filter((o) => saldoDe(o) > 0), [cartera]);

  // Residentes con saldo pendiente.
  const residentes = useMemo(() => {
    const mapa = {};
    pendientes.forEach((o) => {
      const doc = soloDigitos(o.DocumentoResidente);
      if (!doc) return;
      if (!mapa[doc]) {
        mapa[doc] = {
          documento: doc,
          nombre: o.NombreResidente || "",
          inmueble: `${o.TorreManzana || ""} - ${o.AptoCasa || ""}`,
          telefono: o.Telefono || "",
          saldo: 0,
          cantidad: 0,
        };
      }
      mapa[doc].saldo += saldoDe(o);
      mapa[doc].cantidad += 1;
    });
    return Object.values(mapa).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [pendientes]);

  const residente = residentes.find((r) => r.documento === documento) || null;

  const pendientesResidente = useMemo(
    () => pendientes.filter((o) => soloDigitos(o.DocumentoResidente) === documento),
    [pendientes, documento]
  );

  const interesesPorPadre = useMemo(() => {
    const mapa = {};
    pendientesResidente.filter(esInteres).forEach((o) => {
      const padre = padreDe(o);
      if (padre) (mapa[padre] = mapa[padre] || []).push(o);
    });
    return mapa;
  }, [pendientesResidente]);

  // Cada cuota seguida de sus intereses. Intereses sin cuota pendiente, solos.
  const grupos = useMemo(() => {
    const ids = new Set(pendientesResidente.map(idDe));
    const capitales = pendientesResidente
      .filter((o) => !esInteres(o))
      .sort((a, b) => claveFecha(a.FechaVencimiento) - claveFecha(b.FechaVencimiento));

    return [
      ...capitales.map((o) => ({ principal: o, intereses: interesesPorPadre[idDe(o)] || [] })),
      ...pendientesResidente
        .filter((o) => esInteres(o) && !ids.has(padreDe(o)))
        .map((o) => ({ principal: o, intereses: [] })),
    ];
  }, [pendientesResidente, interesesPorPadre]);

  const seleccionadas = useMemo(
    () => pendientesResidente.filter((o) => seleccion[idDe(o)]),
    [pendientesResidente, seleccion]
  );

  const totalMarcado = useMemo(
    () => seleccionadas.reduce((s, o) => s + saldoDe(o), 0),
    [seleccionadas]
  );

  // Mientras no se edite a mano, el valor recibido sigue al total marcado.
  useEffect(() => {
    if (!valorEditado) setValorRecibido(totalMarcado ? String(totalMarcado) : "");
  }, [totalMarcado, valorEditado]);

  const valor = Math.round(aNumero(valorRecibido));

  // Vista previa del reparto.
  const reparto = useMemo(() => {
    let disponible = valor;
    return [...seleccionadas].sort(ordenImputacion).map((o) => {
      const aplicado = Math.max(Math.min(saldoDe(o), disponible), 0);
      disponible -= aplicado;
      return { obligacion: o, aplicado, queda: saldoDe(o) - aplicado };
    });
  }, [seleccionadas, valor]);

  const bloqueadoPorPadre = (o) => esInteres(o) && Boolean(seleccion[padreDe(o)]);

  const limpiarError = (campo) => setErrores((e) => ({ ...e, [campo]: "", general: "" }));

  const cambiarResidente = (doc) => {
    setDocumento(doc);
    setSeleccion({});
    setValorEditado(false);
    limpiarError("documento");
  };

  const alternar = (o) => {
    if (bloqueadoPorPadre(o)) return;
    const id = idDe(o);
    setSeleccion((prev) => {
      const nueva = { ...prev, [id]: !prev[id] };
      if (!esInteres(o) && nueva[id]) {
        (interesesPorPadre[id] || []).forEach((i) => {
          nueva[idDe(i)] = true;
        });
      }
      return nueva;
    });
    limpiarError("obligaciones");
  };

  const marcarTodo = () => {
    const todas = {};
    pendientesResidente.forEach((o) => {
      todas[idDe(o)] = true;
    });
    setSeleccion(todas);
    limpiarError("obligaciones");
  };

  const validar = () => {
    const e = {};
    if (!documento) e.documento = "Selecciona el residente.";
    if (!seleccionadas.length) e.obligaciones = "Marca al menos una obligación.";
    if (!(valor > 0)) e.valorRecibido = "El valor recibido debe ser mayor que cero.";
    else if (valor > totalMarcado) {
      e.valorRecibido = `Supera lo marcado (${formatearMoneda(totalMarcado)}). Corrige el valor o marca más obligaciones.`;
    }
    if (!fechaPago) e.fechaPago = "La fecha de pago es obligatoria.";
    else if (fechaPago > hoyISO()) e.fechaPago = "La fecha de pago no puede ser futura.";
    if (requiereReferencia && !referencia.trim()) {
      e.referencia = "La referencia es obligatoria para este método.";
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const guardar = async () => {
    if (!validar()) return;

    setGuardando(true);
    try {
      const resp = await fetch("/api/pagos-recibidos/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documento,
          obligaciones: seleccionadas.map(idDe),
          valorRecibido: valor,
          fechaPago,
          metodoPago,
          referencia: referencia.trim(),
          observaciones: observaciones.trim(),
          registradoPor,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || `Error ${resp.status} al guardar el pago.`);

      const quiereComprobante = window.confirm(
        `${data.mensaje}\n\n` +
          (data.filas || [])
            .map(
              (f) =>
                `${f.ID_Obligacion}: ${formatearMoneda(f.Aplicado)}` +
                (f.SaldoPendiente > 0 ? ` (queda ${formatearMoneda(f.SaldoPendiente)})` : " (pagada)")
            )
            .join("\n") +
          "\n\n¿Descargar el comprobante en PDF?"
      );

      if (quiereComprobante && data.filas?.length) {
        try {
          await descargarComprobante(data.filas[0].ID_Pago);
        } catch (errPdf) {
          alert(`El pago quedó guardado, pero no se pudo generar el comprobante: ${errPdf.message}`);
        }
      }

      if (onGuardado) await onGuardado(data);
      else if (onClose) onClose();
    } catch (err) {
      setErrores({ general: err.message || "No se pudo guardar el pago." });
    } finally {
      setGuardando(false);
    }
  };

  // ---------------- Estilos ----------------

  const inputStyle = {
    width: "100%",
    padding: 8,
    margin: "4px 0 10px",
    borderRadius: 6,
    border: "1px solid #15aabf33",
    background: "#f5faff",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  const labelStyle = { color: "#444", fontWeight: "bold" };

  const renderError = (campo) =>
    errores[campo] ? (
      <div style={{ color: "crimson", fontSize: 12, marginTop: -6, marginBottom: 8 }}>{errores[campo]}</div>
    ) : null;

  const filaObligacion = (o, esHija = false) => {
    const id = idDe(o);
    const marcado = Boolean(seleccion[id]);
    const bloqueado = bloqueadoPorPadre(o);
    const mora = String(o.EstadoCalculado || "").toLowerCase() === "mora";

    return (
      <label
        key={id}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "8px 12px",
          marginLeft: esHija ? 26 : 0,
          marginBottom: 6,
          borderRadius: 8,
          border: marcado ? "1px solid #86efac" : "1px solid #e2e8f0",
          background: marcado ? "#f0fdf4" : "#fff",
          cursor: bloqueado ? "default" : "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={marcado}
          disabled={bloqueado}
          onChange={() => alternar(o)}
          style={{ marginTop: 3, width: 16, height: 16 }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>
            {esHija ? "↳ Interés de mora" : nombreConcepto(o)}
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {id} · Período {o.Periodo || "-"} · Vence {o.FechaVencimiento || "-"}
            {esInteres(o) && padreDe(o) ? ` · Origen ${padreDe(o)}` : ""}
          </div>
          {bloqueado && (
            <div style={{ fontSize: 12, color: "#15803d" }}>Se paga junto con su cuota</div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700 }}>{formatearMoneda(saldoDe(o))}</div>
          <span
            style={{
              display: "inline-block",
              marginTop: 3,
              padding: "1px 8px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              color: mora ? "#dc2626" : "#b45309",
              background: mora ? "#fee2e2" : "#fef3c7",
            }}
          >
            {mora ? "En mora" : "Pendiente"}
          </span>
        </div>
      </label>
    );
  };

  // ---------------- Pantalla ----------------

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 9999,
        width: "100vw",
        height: "100vh",
        background: "#0008",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: coloresBG.body,
          borderRadius: 14,
          boxShadow: "0 8px 32px #15aabf44",
          padding: 30,
          width: "100%",
          maxWidth: 760,
          maxHeight: "92vh",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 10 }}>
          <button
            type="button"
            onClick={onBack}
            style={{ background: "transparent", color: coloresBG.header, border: "none", fontWeight: "bold", cursor: "pointer", padding: 0 }}
          >
            ← Regresar
          </button>
          <h2 style={{ color: coloresBG.header, margin: 0, flex: 1, textAlign: "center" }}>Registrar pago recibido</h2>
          <div style={{ width: 80 }} />
        </div>

        {errores.general && (
          <div style={{ background: "#fee2e2", color: "#b91c1c", padding: 12, borderRadius: 8, marginBottom: 14, fontWeight: 600 }}>
            {errores.general}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          {/* 1. Residente */}
          <h3 style={{ color: coloresBG.header, marginTop: 0 }}>1. Residente</h3>
          <select
            value={documento}
            onChange={(e) => cambiarResidente(e.target.value)}
            style={inputStyle}
            disabled={cargando}
          >
            <option value="">
              {cargando ? "Cargando cartera..." : residentes.length ? "Selecciona el residente" : "No hay residentes con saldo pendiente"}
            </option>
            {residentes.map((r) => (
              <option key={r.documento} value={r.documento}>
                {r.nombre} · {r.inmueble} · Doc. {r.documento} · Debe {formatearMoneda(r.saldo)}
              </option>
            ))}
          </select>
          {renderError("documento")}

          {/* 2. Obligaciones */}
          {residente && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <h3 style={{ color: coloresBG.header, margin: "8px 0" }}>2. Obligaciones que paga</h3>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={marcarTodo}
                    style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #86efac", background: "#f0fdf4", color: "#15803d", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                  >
                    Marcar todo
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeleccion({})}
                    style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              {grupos.map((g) => (
                <div key={idDe(g.principal)}>
                  {filaObligacion(g.principal)}
                  {g.intereses.map((i) => filaObligacion(i, true))}
                </div>
              ))}
              {renderError("obligaciones")}

              {/* 3. Datos del pago */}
              <h3 style={{ color: coloresBG.header, marginTop: 18 }}>3. Datos del pago</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: "1 1 30%" }}>
                  <label style={labelStyle}>Valor recibido *</label>
                  <input
                    type="number"
                    min="0"
                    value={valorRecibido}
                    onChange={(e) => {
                      setValorRecibido(e.target.value);
                      setValorEditado(true);
                      limpiarError("valorRecibido");
                    }}
                    style={inputStyle}
                  />
                  {renderError("valorRecibido")}
                  {valorEditado && totalMarcado > 0 && (
                    <button
                      type="button"
                      onClick={() => setValorEditado(false)}
                      style={{ marginTop: -6, marginBottom: 8, background: "none", border: "none", color: coloresBG.header, cursor: "pointer", padding: 0, fontSize: 12 }}
                    >
                      Usar total marcado ({formatearMoneda(totalMarcado)})
                    </button>
                  )}
                </div>

                <div style={{ flex: "1 1 30%" }}>
                  <label style={labelStyle}>Fecha de pago *</label>
                  <input
                    type="date"
                    value={fechaPago}
                    max={hoyISO()}
                    onChange={(e) => {
                      setFechaPago(e.target.value);
                      limpiarError("fechaPago");
                    }}
                    style={inputStyle}
                  />
                  {renderError("fechaPago")}
                </div>

                <div style={{ flex: "1 1 30%" }}>
                  <label style={labelStyle}>Método de pago *</label>
                  <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} style={inputStyle}>
                    {metodosPago.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: "1 1 48%" }}>
                  <label style={labelStyle}>Referencia / Transacción {requiereReferencia ? "*" : ""}</label>
                  <input
                    value={referencia}
                    onChange={(e) => {
                      setReferencia(e.target.value);
                      limpiarError("referencia");
                    }}
                    style={inputStyle}
                  />
                  {renderError("referencia")}
                </div>

                <div style={{ flex: "1 1 48%" }}>
                  <label style={labelStyle}>Observaciones</label>
                  <input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} style={inputStyle} />
                </div>
              </div>

              {/* Reparto */}
              {reparto.length > 0 && valor > 0 && (
                <div style={{ background: "#f0f8ff", border: "1px solid #cce5ff", borderRadius: 8, padding: 12, marginTop: 6 }}>
                  <div style={{ fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                    Así se aplicará el pago (intereses primero):
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: "#64748b", textAlign: "left" }}>
                        <th style={{ padding: 4 }}>Obligación</th>
                        <th style={{ padding: 4, textAlign: "right" }}>Saldo</th>
                        <th style={{ padding: 4, textAlign: "right" }}>Se aplica</th>
                        <th style={{ padding: 4, textAlign: "right" }}>Queda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reparto.map(({ obligacion, aplicado, queda }) => (
                        <tr key={idDe(obligacion)} style={{ borderTop: "1px solid #dbeafe" }}>
                          <td style={{ padding: 4 }}>
                            {idDe(obligacion)} · {esInteres(obligacion) ? "interés" : obligacion.Concepto}
                          </td>
                          <td style={{ padding: 4, textAlign: "right" }}>{formatearMoneda(saldoDe(obligacion))}</td>
                          <td style={{ padding: 4, textAlign: "right", fontWeight: 700, color: "#15803d" }}>
                            {formatearMoneda(aplicado)}
                          </td>
                          <td style={{ padding: 4, textAlign: "right", color: queda > 0 ? "#dc2626" : "#15803d" }}>
                            {queda > 0 ? formatearMoneda(queda) : "Pagada"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontWeight: 700 }}>
                    <span>Total marcado: {formatearMoneda(totalMarcado)}</span>
                    <span style={{ color: valor > totalMarcado ? "#dc2626" : "#15803d" }}>
                      Recibido: {formatearMoneda(valor)}
                    </span>
                  </div>
                  {valor < totalMarcado && (
                    <div style={{ fontSize: 12, color: "#b45309", marginTop: 4 }}>
                      Abono parcial: quedan {formatearMoneda(totalMarcado - valor)} pendientes.
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div style={{ display: "flex", gap: 16, justifyContent: "flex-end", marginTop: 18 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ background: "#64748b", color: "#fff", border: "none", borderRadius: 7, padding: "7px 20px", cursor: "pointer" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || !residente}
              style={{
                background: guardando || !residente ? "#94a3b8" : "#15aabf",
                color: "#fff",
                border: "none",
                borderRadius: 7,
                padding: "7px 18px",
                fontWeight: "bold",
                cursor: guardando || !residente ? "not-allowed" : "pointer",
              }}
            >
              {guardando ? "Guardando..." : valor > 0 ? `Confirmar pago ${formatearMoneda(valor)}` : "Confirmar pago"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FormularioPago;