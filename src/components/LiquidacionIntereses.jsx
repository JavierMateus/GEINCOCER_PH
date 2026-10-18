// src/components/LiquidacionIntereses.jsx
// Liquidacion mensual de intereses de mora con vista previa.
// Primero calcula sin guardar. Solo guarda si el administrador confirma.

import React, { useState } from "react";

const formatearMoneda = (valor) =>
  `$${Number(valor || 0).toLocaleString("es-CO")}`;

// Por defecto: el ultimo mes cerrado (el mes anterior al actual).
const mesAnterior = () => {
  const hoy = new Date();
  const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
};

const th = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: "0.85em",
  color: "#0f172a",
  borderBottom: "2px solid #cbd5e1",
  whiteSpace: "nowrap",
};

const td = {
  padding: "9px 12px",
  fontSize: "0.85em",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top",
};

const boton = (fondo) => ({
  background: fondo,
  color: "#fff",
  border: "none",
  borderRadius: "7px",
  padding: "8px 18px",
  fontWeight: "bold",
  cursor: "pointer",
});

function LiquidacionIntereses({ onLiquidado, onCerrar }) {
  const [corte, setCorte] = useState(mesAnterior());
  const [previa, setPrevia] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const calcularPrevia = async () => {
    setCargando(true);
    setError("");
    setMensaje("");
    setPrevia(null);

    try {
      const resp = await fetch(
        `/api/liquidacion-intereses/previa?corte=${encodeURIComponent(corte)}`,
        { cache: "no-store" }
      );
      const data = await resp.json();

      if (!data.ok) throw new Error(data.error || "No se pudo calcular la vista previa.");

      setPrevia(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const confirmar = async () => {
    if (!previa || !previa.items.length) return;

    const seguro = window.confirm(
      `Se crearán ${previa.items.length} obligaciones de interés por ${formatearMoneda(previa.total)} ` +
        `con corte al ${previa.fechaCorte} y vencimiento el ${previa.vencimientoCobro}.\n\n¿Confirmas la liquidación?`
    );

    if (!seguro) return;

    setCargando(true);
    setError("");

    try {
      const resp = await fetch("/api/liquidacion-intereses/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ corte }),
      });
      const data = await resp.json();

      if (!data.ok) throw new Error(data.error || "No se pudo guardar la liquidación.");

      const ids = (data.creadas || []).map((c) => c.ID_Obligacion).join(", ");

      setMensaje(
        data.creadas?.length
          ? `Liquidación guardada: ${ids} por ${formatearMoneda(data.total)}. Se guardó una copia de respaldo.`
          : data.mensaje || "No había intereses por liquidar."
      );
      setPrevia(null);

      if (onLiquidado) onLiquidado();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const sinTasas = previa?.mesesSinTasa?.length > 0;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #dbe7ef",
        borderRadius: "14px",
        padding: "16px 18px",
        margin: "14px 0",
        boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 4px 0", color: "#0f766e", fontSize: "1.05rem" }}>
            Liquidación de intereses de mora
          </h3>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.85em", maxWidth: "640px" }}>
            Calcula el interés sobre el capital vencido de administración y cuotas
            extraordinarias, con la tasa de cada mes registrada en TasasInteres.csv.
            Las multas y reservas no generan interés.
          </p>
        </div>

        {onCerrar && (
          <button type="button" onClick={onCerrar} style={boton("#64748b")}>
            Cerrar
          </button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "10px",
          flexWrap: "wrap",
          marginTop: "14px",
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: "0.8em", color: "#475569", marginBottom: "4px" }}>
            Mes de corte
          </label>
          <input
            type="month"
            value={corte}
            onChange={(e) => {
              setCorte(e.target.value);
              setPrevia(null);
              setMensaje("");
            }}
            style={{
              padding: "7px 10px",
              borderRadius: "7px",
              border: "1px solid #cbd5e1",
            }}
          />
        </div>

        <button
          type="button"
          onClick={calcularPrevia}
          disabled={cargando || !corte}
          style={boton("#0284c7")}
        >
          {cargando ? "Calculando..." : "Calcular vista previa"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: "12px", color: "#b91c1c", fontSize: "0.9em" }}>{error}</div>
      )}

      {mensaje && (
        <div style={{ marginTop: "12px", color: "#047857", fontSize: "0.9em", fontWeight: "bold" }}>
          {mensaje}
        </div>
      )}

      {previa && (
        <div style={{ marginTop: "14px" }}>
          <div style={{ fontSize: "0.88em", color: "#334155", marginBottom: "8px" }}>
            Corte: <strong>{previa.fechaCorte}</strong> · Se cobra en el período{" "}
            <strong>{previa.periodoCobro}</strong> · Vence el{" "}
            <strong>{previa.vencimientoCobro}</strong>
          </div>

          {previa.advertencias?.map((a) => (
            <div key={a} style={{ color: "#b45309", fontSize: "0.85em", marginBottom: "6px" }}>
              {a}
            </div>
          ))}

          {sinTasas && (
            <div style={{ color: "#b91c1c", fontSize: "0.88em", marginBottom: "8px" }}>
              Faltan tasas para: {previa.mesesSinTasa.join(", ")}. Regístralas en
              TasasInteres.csv antes de confirmar.
            </div>
          )}

          {previa.items.length === 0 ? (
            <div style={{ color: "#64748b", fontSize: "0.9em" }}>
              No hay intereses por liquidar en este corte.
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ background: "#f0fdfa" }}>
                    <tr>
                      <th style={th}>Obligación origen</th>
                      <th style={th}>Residente</th>
                      <th style={th}>Inmueble</th>
                      <th style={th}>Concepto</th>
                      <th style={th}>Capital vencido</th>
                      <th style={th}>Desde</th>
                      <th style={th}>Hasta</th>
                      <th style={th}>Días</th>
                      <th style={th}>Tasas aplicadas (E.A.)</th>
                      <th style={th}>Interés</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previa.items.map((it) => (
                      <tr key={it.ID_ObligacionPadre}>
                        <td style={td}>{it.ID_ObligacionPadre}</td>
                        <td style={td}>{it.NombreResidente}</td>
                        <td style={td}>{`${it.TorreManzana} - ${it.AptoCasa}`}</td>
                        <td style={td}>
                          <div>{it.ConceptoPadre}</div>
                          <div style={{ fontSize: "0.85em", color: "#64748b" }}>{it.PeriodoPadre}</div>
                        </td>
                        <td style={td}>{formatearMoneda(it.CapitalBase)}</td>
                        <td style={td}>{it.Desde}</td>
                        <td style={td}>{it.Hasta}</td>
                        <td style={td}>{it.DiasMora}</td>
                        <td style={td}>
                          {it.Tasas.map((t) => (
                            <div key={t}>{t}</div>
                          ))}
                        </td>
                        <td style={{ ...td, fontWeight: "bold", color: "#b91c1c" }}>
                          {formatearMoneda(it.Interes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                  marginTop: "12px",
                }}
              >
                <div style={{ fontSize: "0.95em" }}>
                  {previa.items.length} intereses por{" "}
                  <strong>{formatearMoneda(previa.total)}</strong>
                </div>

                <button
                  type="button"
                  onClick={confirmar}
                  disabled={cargando || sinTasas}
                  style={{
                    ...boton(sinTasas ? "#94a3b8" : "#16a34a"),
                    cursor: sinTasas ? "not-allowed" : "pointer",
                  }}
                >
                  Confirmar y generar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default LiquidacionIntereses;