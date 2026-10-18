// src/components/PagoOnline.jsx
// Formulario de pago en linea del residente.
// El residente marca las obligaciones que va a pagar. Los valores salen de
// la base de datos y no se pueden editar. Cada valor queda ligado a su
// ID_Obligacion. Si marca una cuota, sus intereses se marcan solos, porque
// el pago se aplica primero a intereses (art. 1653 Codigo Civil).

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";

const formatearMoneda = (valor) =>
  `$${Math.round(Number(valor || 0)).toLocaleString("es-CO")}`;

const aNumero = (valor) =>
  Number(String(valor ?? 0).replace(/[^\d.-]/g, "")) || 0;

const esInteres = (o) =>
  String(o?.Concepto || "").trim().toLowerCase() === "interes_mora";

const idDe = (o) => String(o?.ID_Obligacion || "").trim();

const padreDe = (o) => String(o?.ID_ObligacionPadre || "").trim();

const saldoDe = (o) => aNumero(o?.SaldoPendiente);

const nombreConcepto = (o) => {
  const concepto = String(o?.Concepto || "").trim();
  const sub = String(o?.Subconcepto || "").trim();
  return sub && sub !== concepto ? `${concepto} · ${sub}` : concepto || "Sin concepto";
};

const estadoEtiqueta = (o) => {
  const estado = String(o?.EstadoCalculado || "").toLowerCase();
  if (estado === "mora") return { texto: "En mora", color: "#dc2626", fondo: "#fee2e2" };
  return { texto: "Pendiente", color: "#b45309", fondo: "#fef3c7" };
};

const estiloEntrada = (conError) => ({
  width: "100%",
  padding: "10px",
  border: conError ? "2px solid #c33" : "1px solid #ddd",
  borderRadius: "6px",
  boxSizing: "border-box",
  fontFamily: "inherit",
});

const estiloSoloLectura = {
  ...estiloEntrada(false),
  background: "#f1f5f9",
  color: "#334155",
};

const estiloEtiqueta = {
  display: "block",
  fontWeight: "600",
  marginBottom: "5px",
  color: "#333",
};

function PagoOnline({
  initialData = {},
  obligaciones = [],
  onBack = null,
  embebido = false,
}) {
  const navigate = useNavigate();

  const handleRegresar = () => {
    if (onBack) {
      onBack();
      return;
    }
    navigate(-1);
  };

  const [datos, setDatos] = useState({
    nombre: initialData.nombre || "",
    documento: initialData.documento || "",
    email: initialData.email || "",
    telefono: initialData.telefono || "",
    torre_manzana: initialData.torre_manzana || "",
    apto_casa: initialData.apto_casa || "",
  });

  const [seleccion, setSeleccion] = useState({});
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");

  // Completa correo y telefono desde Habitantes.csv si no vienen.
  useEffect(() => {
    const documento = String(initialData.documento || "").replace(/\D/g, "");
    if (!documento) return;

    const cargarContacto = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/habitantes`, { cache: "no-store" });
        if (!resp.ok) return;
        const data = await resp.json();
        const lista = Array.isArray(data.habitantes) ? data.habitantes : [];

        const habitante = lista.find(
          (h) =>
            String(h.DocumentoResidente || h.Documento || "").replace(/\D/g, "") === documento
        );

        if (!habitante) return;

        setDatos((prev) => ({
          ...prev,
          email: prev.email || habitante.Email || "",
          telefono: prev.telefono || habitante.Telefono || "",
          torre_manzana: prev.torre_manzana || habitante.TorreManzana || "",
          apto_casa: prev.apto_casa || habitante.AptoCasa || "",
        }));
      } catch (err) {
        console.warn("No se pudo cargar el contacto del residente:", err);
      }
    };

    cargarContacto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData.documento]);

  // Solo obligaciones con saldo pendiente.
  const pendientes = useMemo(
    () => (Array.isArray(obligaciones) ? obligaciones : []).filter((o) => saldoDe(o) > 0),
    [obligaciones]
  );

  // Intereses agrupados bajo la obligacion que los genero.
  const interesesPorPadre = useMemo(() => {
    const mapa = {};
    pendientes.filter(esInteres).forEach((o) => {
      const padre = padreDe(o);
      if (!padre) return;
      (mapa[padre] = mapa[padre] || []).push(o);
    });
    return mapa;
  }, [pendientes]);

  // Orden de la lista: cada cuota seguida de sus intereses.
  // Los intereses cuyo origen ya esta pagado aparecen solos.
  const grupos = useMemo(() => {
    const idsPendientes = new Set(pendientes.map(idDe));
    const lista = [];

    pendientes
      .filter((o) => !esInteres(o))
      .forEach((o) => {
        lista.push({ principal: o, intereses: interesesPorPadre[idDe(o)] || [] });
      });

    pendientes
      .filter((o) => esInteres(o) && !idsPendientes.has(padreDe(o)))
      .forEach((o) => {
        lista.push({ principal: o, intereses: [] });
      });

    return lista;
  }, [pendientes, interesesPorPadre]);

  // Un interes queda bloqueado si su cuota de origen esta marcada.
  const bloqueadoPorPadre = (o) => esInteres(o) && Boolean(seleccion[padreDe(o)]);

  const alternar = (o) => {
    const id = idDe(o);
    if (bloqueadoPorPadre(o)) return;

    setSeleccion((prev) => {
      const nueva = { ...prev };
      const marcar = !prev[id];

      nueva[id] = marcar;

      // Al marcar una cuota se marcan sus intereses.
      if (!esInteres(o) && marcar) {
        (interesesPorPadre[id] || []).forEach((i) => {
          nueva[idDe(i)] = true;
        });
      }

      return nueva;
    });

    if (errores.obligaciones) setErrores((e) => ({ ...e, obligaciones: "" }));
  };

  const marcarTodo = () => {
    const todas = {};
    pendientes.forEach((o) => {
      todas[idDe(o)] = true;
    });
    setSeleccion(todas);
    if (errores.obligaciones) setErrores((e) => ({ ...e, obligaciones: "" }));
  };

  const limpiarSeleccion = () => setSeleccion({});

  const seleccionadas = useMemo(
    () => pendientes.filter((o) => seleccion[idDe(o)]),
    [pendientes, seleccion]
  );

  // Desglose: intereses, capital y otros cobros.
  const resumen = useMemo(() => {
    let intereses = 0;
    let capital = 0;
    let otros = 0;

    seleccionadas.forEach((o) => {
      const saldo = saldoDe(o);
      if (esInteres(o)) {
        intereses += saldo;
      } else {
        // Si la obligacion trae otros cobros, se separan del capital.
        const otrosObl = Math.min(aNumero(o.OtrosCobros), saldo);
        otros += otrosObl;
        capital += saldo - otrosObl;
      }
    });

    return { intereses, capital, otros, total: intereses + capital + otros };
  }, [seleccionadas]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDatos({ ...datos, [name]: value });
    if (errores[name]) setErrores({ ...errores, [name]: "" });
  };

  const validar = () => {
    const nuevos = {};

    if (!datos.nombre.trim()) nuevos.nombre = "El nombre es requerido";
    if (!datos.documento.trim()) nuevos.documento = "El documento es requerido";
    if (!datos.email.trim() || !/\S+@\S+\.\S+/.test(datos.email)) {
      nuevos.email = "Email válido requerido";
    }
    if (!String(datos.telefono).trim()) nuevos.telefono = "El teléfono es requerido";
    if (!seleccionadas.length) {
      nuevos.obligaciones = "Marca al menos una obligación para pagar";
    }

    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validar()) return;

    setEnviando(true);
    setMensajeExito("");

    // Los intereses van primero, como manda la ley.
    const detalle = [...seleccionadas]
      .sort((a, b) => Number(esInteres(b)) - Number(esInteres(a)))
      .map((o) => ({
        ID_Obligacion: idDe(o),
        ID_ObligacionPadre: padreDe(o),
        Periodo: o.Periodo || "",
        Concepto: o.Concepto || "",
        Subconcepto: o.Subconcepto || "",
        EsInteres: esInteres(o),
        Valor: saldoDe(o),
      }));

    const conceptos = [...new Set(detalle.map((d) => d.Concepto))];

    const descripcion =
      `Pago de ${detalle.length} obligación(es): ` +
      detalle.map((d) => `${d.ID_Obligacion} ${d.Subconcepto || d.Concepto} ${d.Periodo}`).join(", ");

    try {
      const response = await fetch(`${API_BASE}/api/mercadopago/crear-preferencia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Campos que el backend ya conoce.
          descripcion,
          monto: resumen.total,
          concepto: conceptos.length === 1 ? conceptos[0] : "varios",
          documento: datos.documento,
          nombre: datos.nombre,
          email: datos.email,
          telefono: datos.telefono,
          torre_manzana: datos.torre_manzana,
          apto_casa: datos.apto_casa,
          intereses: resumen.intereses,
          cobro_especial: resumen.otros,
          // Nuevo: detalle por obligacion para registrar cada pago con su ID.
          obligaciones: detalle,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Error al procesar el pago");
      }
      setMensajeExito("✓ Redirigiendo a Mercado Pago...");

      setTimeout(() => {
        window.location.href = data.url;
      }, 1500);
    } catch (error) {
      setErrores({ general: error.message });
      setEnviando(false);
    }
  };

  const filaObligacion = (o, esHija = false) => {
    const id = idDe(o);
    const marcado = Boolean(seleccion[id]);
    const bloqueado = bloqueadoPorPadre(o);
    const etiqueta = estadoEtiqueta(o);

    return (
      <label
        key={id}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          padding: "10px 12px",
          marginLeft: esHija ? "26px" : 0,
          marginBottom: "6px",
          borderRadius: "8px",
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
          style={{ marginTop: "3px", width: "16px", height: "16px" }}
        />

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.92em" }}>
            {esHija ? "↳ Interés de mora" : nombreConcepto(o)}
          </div>
          <div style={{ fontSize: "0.8em", color: "#64748b" }}>
            {id} · Período {o.Periodo || "-"}
            {esInteres(o) && padreDe(o) ? ` · Origen ${padreDe(o)}` : ""}
          </div>
          {bloqueado && (
            <div style={{ fontSize: "0.78em", color: "#15803d", marginTop: "2px" }}>
              Se paga junto con su cuota
            </div>
          )}
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, color: "#0f172a" }}>{formatearMoneda(saldoDe(o))}</div>
          <span
            style={{
              display: "inline-block",
              marginTop: "3px",
              padding: "1px 8px",
              borderRadius: "999px",
              fontSize: "0.72em",
              fontWeight: 700,
              color: etiqueta.color,
              background: etiqueta.fondo,
            }}
          >
            {etiqueta.texto}
          </span>
        </div>
      </label>
    );
  };

  return (
    <div
      style={{
        padding: "20px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: embebido ? "auto" : "100vh",
        background: "linear-gradient(135deg, #e3edf7 0%, #f5fafd 100%)",
      }}
    >
      <div
        style={{
          maxWidth: "560px",
          width: "100%",
          backgroundColor: "#ffffff",
          padding: "30px",
          borderRadius: "16px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
          }}
        >
          <button
            type="button"
            onClick={handleRegresar}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              backgroundColor: "#09d11aff",
              color: "#222322ff",
              cursor: "pointer",
              fontSize: "0.9em",
              fontWeight: "500",
            }}
          >
            ← Regresar
          </button>

          <h2
            style={{
              margin: 0,
              color: "#218290",
              textAlign: "center",
              fontSize: "1.6em",
              flex: 1,
            }}
          >
            Formulario de Pago
          </h2>
        </div>

        <p style={{ textAlign: "center", color: "#666", marginBottom: "25px", fontSize: "0.95em" }}>
          Marca las obligaciones que vas a pagar
        </p>

        {errores.general && (
          <div
            style={{
              backgroundColor: "#fee",
              color: "#c33",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "15px",
              textAlign: "center",
              fontWeight: "bold",
            }}
          >
            {errores.general}
          </div>
        )}

        {mensajeExito && (
          <div
            style={{
              backgroundColor: "#efe",
              color: "#363",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "15px",
              textAlign: "center",
              fontWeight: "bold",
            }}
          >
            {mensajeExito}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Datos del residente */}
          <div
            style={{
              backgroundColor: "#f9f9f9",
              padding: "15px",
              borderRadius: "10px",
              marginBottom: "20px",
              borderLeft: "4px solid #218290",
            }}
          >
            <h3 style={{ margin: "0 0 15px 0", color: "#218290", fontSize: "1.1em" }}>
              📋 Información del Residente
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={estiloEtiqueta}>Nombre</label>
                <input value={datos.nombre} readOnly style={estiloSoloLectura} />
              </div>
              <div>
                <label style={estiloEtiqueta}>Documento</label>
                <input value={datos.documento} readOnly style={estiloSoloLectura} />
              </div>
              <div>
                <label style={estiloEtiqueta}>Torre / Manzana</label>
                <input value={datos.torre_manzana} readOnly style={estiloSoloLectura} />
              </div>
              <div>
                <label style={estiloEtiqueta}>Apto / Casa</label>
                <input value={datos.apto_casa} readOnly style={estiloSoloLectura} />
              </div>
            </div>

            <div style={{ marginTop: "12px" }}>
              <label style={estiloEtiqueta}>Correo electrónico</label>
              <input
                type="email"
                name="email"
                placeholder="Ej: juan@example.com"
                value={datos.email}
                onChange={handleChange}
                style={estiloEntrada(errores.email)}
              />
              {errores.email && (
                <span style={{ color: "#c33", fontSize: "0.85em" }}>{errores.email}</span>
              )}
            </div>

            <div style={{ marginTop: "12px" }}>
              <label style={estiloEtiqueta}>Teléfono de contacto</label>
              <input
                type="tel"
                name="telefono"
                placeholder="Ej: 3001234567"
                value={datos.telefono}
                onChange={handleChange}
                style={estiloEntrada(errores.telefono)}
              />
              {errores.telefono && (
                <span style={{ color: "#c33", fontSize: "0.85em" }}>{errores.telefono}</span>
              )}
            </div>
          </div>

          {/* Obligaciones */}
          <div
            style={{
              backgroundColor: "#f9f9f9",
              padding: "15px",
              borderRadius: "10px",
              marginBottom: "20px",
              borderLeft: "4px solid #28a745",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
                marginBottom: "12px",
              }}
            >
              <h3 style={{ margin: 0, color: "#28a745", fontSize: "1.1em" }}>
                💳 Obligaciones pendientes
              </h3>

              {pendientes.length > 0 && (
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={marcarTodo}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      border: "1px solid #86efac",
                      background: "#f0fdf4",
                      color: "#15803d",
                      fontSize: "0.8em",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Marcar todo
                  </button>
                  <button
                    type="button"
                    onClick={limpiarSeleccion}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      color: "#475569",
                      fontSize: "0.8em",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Limpiar
                  </button>
                </div>
              )}
            </div>

            {pendientes.length === 0 ? (
              <div style={{ color: "#15803d", fontWeight: 600, textAlign: "center", padding: "10px" }}>
                No tienes obligaciones pendientes. Estás al día.
              </div>
            ) : (
              grupos.map((g) => (
                <div key={idDe(g.principal)}>
                  {filaObligacion(g.principal)}
                  {g.intereses.map((i) => filaObligacion(i, true))}
                </div>
              ))
            )}

            {errores.obligaciones && (
              <span style={{ color: "#c33", fontSize: "0.85em" }}>{errores.obligaciones}</span>
            )}
          </div>

          {/* Resumen */}
          {seleccionadas.length > 0 && (
            <div
              style={{
                backgroundColor: "#f0f8ff",
                padding: "15px",
                borderRadius: "8px",
                marginBottom: "20px",
                border: "1px solid #cce5ff",
              }}
            >
              <div style={{ display: "grid", rowGap: "4px", fontSize: "0.92em", color: "#334155" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Intereses de mora</span>
                  <span>{formatearMoneda(resumen.intereses)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Capital (cuotas, multas y otros)</span>
                  <span>{formatearMoneda(resumen.capital)}</span>
                </div>
                {resumen.otros > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Cobros especiales</span>
                    <span>{formatearMoneda(resumen.otros)}</span>
                  </div>
                )}
              </div>

              <div style={{ textAlign: "center", marginTop: "10px" }}>
                <p style={{ margin: "0 0 5px 0", fontSize: "0.9em", color: "#666" }}>
                  <strong>Monto a Pagar:</strong>
                </p>
                <p style={{ margin: 0, fontSize: "1.8em", color: "#28a745", fontWeight: "bold" }}>
                  {formatearMoneda(resumen.total)}
                </p>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.8em", color: "#64748b" }}>
                  {seleccionadas.length} obligación(es) seleccionada(s)
                </p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={enviando || pendientes.length === 0}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: enviando || pendientes.length === 0 ? "#ccc" : "#28a745",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "1.1em",
              fontWeight: "bold",
              cursor: enviando || pendientes.length === 0 ? "not-allowed" : "pointer",
              transition: "background-color 0.3s",
              marginTop: "10px",
            }}
          >
            {enviando
              ? "Procesando..."
              : seleccionadas.length
              ? `Pagar ${formatearMoneda(resumen.total)}`
              : "Pagar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default PagoOnline;