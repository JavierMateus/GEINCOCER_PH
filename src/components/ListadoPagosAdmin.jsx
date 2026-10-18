import React, { useEffect, useMemo, useState } from "react";
import { descargarComprobante } from "./comprobantePago";

const limpiarTexto = (valor) => String(valor ?? "").trim();

const limpiarNumero = (valor) => {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;

  const texto = String(valor)
    .replace(/\$/g, "")
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^\d.-]/g, "");

  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
};

const parseFechaFlexible = (valor) => {
  const texto = limpiarTexto(valor);
  if (!texto || texto === "-" || texto.toLowerCase() === "no pagado") return 0;

  const isoConHora = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:[tT ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?/);
  if (isoConHora) {
    const [, y, m, d, hh = "00", mm = "00", ss = "00", ms = "0"] = isoConHora;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss), Number(ms)).getTime();
  }

  const fechaLatina = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (fechaLatina) {
    let [, d, m, y, hh = "00", mm = "00", ss = "00"] = fechaLatina;
    const anio = y.length === 2 ? Number(`20${y}`) : Number(y);
    return new Date(anio, Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)).getTime();
  }

  const timestamp = new Date(texto).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const formatearFecha = (valor) => {
  const timestamp = parseFechaFlexible(valor);
  if (!timestamp) return "-";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
};

const normalizarEstado = (valor) => {
  const texto = limpiarTexto(valor).toLowerCase();
  if (!texto) return "pendiente";
  if (texto.includes("anulad")) return "anulado";
  if (texto.includes("mora")) return "mora";
  if (texto.includes("pend")) return "pendiente";
  if (texto.includes("pag")) return "pagado";
  return texto;
};

function ListadoPagosAdmin({ onBack, setVistaActiva, volverA }) {
  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [torreFiltro, setTorreFiltro] = useState("");
  const [aptoFiltro, setAptoFiltro] = useState("");
  const [anulando, setAnulando] = useState(null);
  const [formAnular, setFormAnular] = useState({ documento: "", pin: "", motivo: "" });
  const [enviandoAnular, setEnviandoAnular] = useState(false);

  useEffect(() => {
    cargarPagos();
  }, []);

  const manejarRegresar = () => {
    if (typeof onBack === "function") {
      onBack();
      return;
    }
    if (typeof setVistaActiva === "function") {
      setVistaActiva(volverA || "panelPagos");
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
    }
  };

  async function cargarPagos() {
    try {
      setCargando(true);
      setError("");
      const resp = await fetch("/api/pagos", { cache: "no-store" });
      if (!resp.ok) throw new Error(`No se pudieron cargar pagos. Error ${resp.status}`);
      const data = await resp.json();
      setPagos(Array.isArray(data?.pagos) ? data.pagos : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error cargando pagos.");
      setPagos([]);
    } finally {
      setCargando(false);
    }
  }

    function abrirAnular(idPago) {
    setFormAnular({ documento: "", pin: "", motivo: "" });
    setAnulando({ idPago });
  }

  async function confirmarAnular() {
    if (enviandoAnular) return;
    try {
      setEnviandoAnular(true);
      const resp = await fetch("/api/pagos-recibidos/anular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idPago: anulando.idPago,
          motivo: formAnular.motivo,
          adminDocumento: formAnular.documento,
          adminPin: formAnular.pin,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || "No se pudo anular el pago.");
      setAnulando(null);
      alert(data.mensaje || "Pago anulado.");
      await cargarPagos();
    } catch (err) {
      alert(err.message);
    } finally {
      setEnviandoAnular(false);
    }
  }

  const pagosNormalizados = useMemo(() => {
    return pagos.map((pago, index) => {
      const fechaPagoRaw = pago.FechaPago ?? pago["Fecha de pago"] ?? pago.fechaPago ?? "";
      const fechaRegistroRaw = pago.FechaRegistro ?? pago.fechaRegistro ?? pago["Fecha Registro"] ?? "";
      const metodoPago = pago.MetodoPago ?? pago["Método Pago"] ?? pago.metodoPago ?? "-";
      const conceptoPago = pago.ConceptoPago ?? pago["Concepto Pago"] ?? pago.Concepto ?? "-";
      const valorPagado = pago.ValorPagado ?? pago.Valor ?? pago.TotalAplicado ?? 0;
      const intereses = pago.Intereses ?? 0;
      const otrosCobros = pago.OtrosCobros ?? pago["Cobro Especial"] ?? 0;
      const documento = pago.DocumentoResidente ?? pago.Documento ?? "-";
      const nombre = pago.NombreResidente ?? pago.Nombre ?? "-";
      const telefono = pago.Telefono ?? pago.telefono ?? "-";
      const torre = pago.TorreManzana ?? pago["Torre/Manzana"] ?? "-";
      const apto = pago.AptoCasa ?? pago["Apto/Casa"] ?? "-";
      const estado = normalizarEstado(pago.EstadoPago ?? pago.Estado ?? pago.estado);
      const idPago = pago.ID_Pago ?? pago.IDPago ?? `PAGO-${index + 1}`;

      return {
        IDPago: idPago,
        TieneID: Boolean(pago.ID_Pago ?? pago.IDPago),
        TorreManzana: limpiarTexto(torre) || "-",
        AptoCasa: limpiarTexto(apto) || "-",
        NombreResidente: limpiarTexto(nombre) || "-",
        DocumentoResidente: limpiarTexto(documento) || "-",
        Telefono: limpiarTexto(telefono) || "-",
        Periodo: limpiarTexto(pago.Periodo ?? pago.periodo) || "-",
        ConceptoPago: limpiarTexto(conceptoPago) || "-",
        ValorPagado: limpiarNumero(valorPagado),
        Intereses: limpiarNumero(intereses),
        OtrosCobros: limpiarNumero(otrosCobros),
        EstadoPago: estado,
        EstadoPagoTexto:
          estado === "pagado"
            ? "Pagado"
            : estado === "mora"
            ? "En mora"
            : estado === "anulado"
            ? "Anulado"
            : "Pendiente",
        FechaPago: formatearFecha(fechaPagoRaw),
        FechaPagoTS: parseFechaFlexible(fechaPagoRaw),
        FechaRegistro: formatearFecha(fechaRegistroRaw),
        FechaRegistroTS: parseFechaFlexible(fechaRegistroRaw),
        MetodoPago: limpiarTexto(metodoPago) || "-",
        Observaciones: limpiarTexto(pago.Observaciones ?? pago.observaciones) || "-",
        RegistradoPor: limpiarTexto(pago.RegistradoPor ?? pago.registradoPor) || "-",
      };
    });
  }, [pagos]);

  const pagosFiltrados = useMemo(() => {
    return pagosNormalizados
      .filter((pago) => {
        const torreOk = torreFiltro ? pago.TorreManzana.toLowerCase().includes(torreFiltro.toLowerCase()) : true;
        const aptoOk = aptoFiltro ? pago.AptoCasa.toLowerCase().includes(aptoFiltro.toLowerCase()) : true;
        return torreOk && aptoOk;
      })
      .sort((a, b) => {
        const fechaA = a.FechaRegistroTS || a.FechaPagoTS || 0;
        const fechaB = b.FechaRegistroTS || b.FechaPagoTS || 0;
        if (fechaB !== fechaA) return fechaB - fechaA;
        return String(b.IDPago).localeCompare(String(a.IDPago));
      });
  }, [pagosNormalizados, torreFiltro, aptoFiltro]);

  const th = {
    padding: "12px 10px",
    textAlign: "left",
    fontWeight: 700,
    color: "#0f172a",
    whiteSpace: "nowrap",
    fontSize: "0.85rem",
    borderBottom: "2px solid #cbd5e1",
  };

  const td = {
    padding: "10px 10px",
    textAlign: "left",
    whiteSpace: "nowrap",
    color: "#334155",
    fontSize: "0.84rem",
    borderBottom: "1px solid #e5e7eb",
    verticalAlign: "top",
  };

  const inputFiltro = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: "0.92rem",
    background: "#fff",
  };

  return (
    <div style={{ width: "100%", maxWidth: "98vw", margin: "0 auto", padding: "10px 8px 24px" }}>
      <div style={{ marginBottom: 18 }}>
        <button
          type="button"
          onClick={manejarRegresar}
          style={{
            background: "#84cc16",
            color: "#111827",
            border: "none",
            borderRadius: 8,
            padding: "8px 14px",
            cursor: "pointer",
            fontWeight: 700,
            marginBottom: 14,
          }}
        >
          ← Regresar
        </button>

        <h2 style={{ margin: "0 0 6px 0", color: "#111827" }}>Listado de pagos</h2>
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.95rem" }}>
          Ordenados por fecha de confirmación/registro, mostrando también la fecha efectiva del pago.
        </p>
      </div>

      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, marginBottom: 14, boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <button type="button" onClick={cargarPagos} style={{ background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 700 }}>
            Recargar pagos
          </button>
          <span style={{ color: "#64748b", fontSize: "0.92rem" }}>
            Pagos cargados: {pagos.length} | Registros mostrados: {pagosFiltrados.length}
          </span>
          {error ? <span style={{ color: "#dc2626", fontSize: "0.92rem" }}>{error}</span> : null}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 12, alignItems: "end" }}>
          <div>
            <label style={{ display: "block", marginBottom: 6, color: "#475569", fontWeight: 600 }}>Torre/Manzana</label>
            <input type="text" value={torreFiltro} onChange={(e) => setTorreFiltro(e.target.value)} placeholder="Ej: Torre 7 o Mz 7" style={inputFiltro} />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 6, color: "#475569", fontWeight: 600 }}>Apto/Casa</label>
            <input type="text" value={aptoFiltro} onChange={(e) => setAptoFiltro(e.target.value)} placeholder="Ej: Apto 501 o Casa 12" style={inputFiltro} />
          </div>
          <button type="button" onClick={() => { setTorreFiltro(""); setAptoFiltro(""); }} style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: "#e5e7eb", cursor: "pointer", fontSize: "0.92em", fontWeight: 600 }}>
            Limpiar filtros
          </button>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 1800, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#ecfeff" }}>
                <th style={th}>ID pago</th>
                <th style={th}>Comprobante</th>
                <th style={th}>Fecha pago</th>
                <th style={th}>Fecha registro</th>
                <th style={th}>Torre/Manzana</th>
                <th style={th}>Apto/Casa</th>
                <th style={th}>Nombre</th>
                <th style={th}>Documento</th>
                <th style={th}>Teléfono</th>
                <th style={th}>Período</th>
                <th style={th}>Concepto</th>
                <th style={th}>Valor pagado</th>
                <th style={th}>Intereses</th>
                <th style={th}>Cobro especial</th>
                <th style={th}>Método pago</th>
                <th style={th}>Estado</th>
                <th style={th}>Observaciones</th>
                <th style={th}>Registrado por</th>
                                <th style={th}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={19} style={{ ...td, textAlign: "center", padding: 18 }}>Cargando pagos...</td></tr>
              ) : pagosFiltrados.length === 0 ? (
                <tr><td colSpan={19} style={{ ...td, textAlign: "center", padding: 18, color: "#64748b" }}>No hay pagos para mostrar.</td></tr>
              ) : (
                pagosFiltrados.map((pago, idx) => (
                  <tr key={pago.IDPago} style={{ background: idx % 2 === 0 ? "#fff" : "#f8fafc" }}>
                    <td style={td}>{pago.IDPago}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      {pago.TieneID ? (
                        <button
                          type="button"
                          onClick={() => descargarComprobante(pago.IDPago).catch((err) => alert(err.message))}
                          style={{ background: "#fff", color: "#0e7490", border: "1px solid #0e7490", borderRadius: 6, padding: "4px 10px", fontWeight: 700, cursor: "pointer" }}
                        >
                          PDF
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td style={td}>{pago.FechaPago}</td>
                    <td style={td}>{pago.FechaRegistro}</td>
                    <td style={td}>{pago.TorreManzana}</td>
                    <td style={td}>{pago.AptoCasa}</td>
                    <td style={td}>{pago.NombreResidente}</td>
                    <td style={td}>{pago.DocumentoResidente}</td>
                    <td style={td}>{pago.Telefono}</td>
                    <td style={td}>{pago.Periodo}</td>
                    <td style={td}>{pago.ConceptoPago}</td>
                    <td style={{ ...td, fontWeight: 700, color: "#0f172a" }}>${pago.ValorPagado.toLocaleString("es-CO")}</td>
                    <td style={td}>${pago.Intereses.toLocaleString("es-CO")}</td>
                    <td style={td}>${pago.OtrosCobros.toLocaleString("es-CO")}</td>
                    <td style={td}>{pago.MetodoPago}</td>
                    <td style={td}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "6px 12px", borderRadius: 999, fontSize: "0.82rem", fontWeight: 700, background: pago.EstadoPago === "pagado" ? "#dcfce7" : pago.EstadoPago === "mora" ? "#fee2e2" : pago.EstadoPago === "anulado" ? "#e5e7eb" : "#fef3c7", color: pago.EstadoPago === "pagado" ? "#166534" : pago.EstadoPago === "mora" ? "#b91c1c" : pago.EstadoPago === "anulado" ? "#374151" : "#b45309", border: pago.EstadoPago === "pagado" ? "1px solid #bbf7d0" : pago.EstadoPago === "mora" ? "1px solid #fecaca" : pago.EstadoPago === "anulado" ? "1px solid #d1d5db" : "1px solid #fde68a" }}>
                        {pago.EstadoPagoTexto}
                      </span>
                    </td>
                    <td style={{ ...td, whiteSpace: "normal", minWidth: 240 }}>{pago.Observaciones}</td>
                    <td style={td}>{pago.RegistradoPor}</td>
                                        <td style={{ ...td, textAlign: "center" }}>
                      {pago.TieneID && pago.EstadoPago !== "anulado" && !/^MP-/i.test(String(pago.IDPago)) ? (
                        <button
                          type="button"
                          onClick={() => abrirAnular(pago.IDPago)}
                          style={{ background: "#fff", color: "#b91c1c", border: "1px solid #b91c1c", borderRadius: 6, padding: "4px 10px", fontWeight: 700, cursor: "pointer" }}
                        >
                          Anular
                        </button>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
            {anulando && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 22, width: "min(440px, 92vw)", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 6px", color: "#b91c1c" }}>Anular pago</h3>
            <p style={{ margin: "0 0 14px", color: "#475569", fontSize: "0.92em" }}>
              Pago {anulando.idPago}. Se anula completo y la deuda vuelve a la cartera del residente. Solo un administrador puede hacerlo.
            </p>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600, color: "#475569" }}>Documento del administrador</label>
            <input type="text" value={formAnular.documento} onChange={(e) => setFormAnular({ ...formAnular, documento: e.target.value })} style={{ ...inputFiltro, marginBottom: 10 }} />
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600, color: "#475569" }}>PIN del administrador</label>
            <input type="password" inputMode="numeric" autoComplete="off" value={formAnular.pin} onChange={(e) => setFormAnular({ ...formAnular, pin: e.target.value })} style={{ ...inputFiltro, marginBottom: 10 }} />
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600, color: "#475569" }}>Motivo (mínimo 10 caracteres)</label>
            <textarea rows={3} value={formAnular.motivo} onChange={(e) => setFormAnular({ ...formAnular, motivo: e.target.value })} style={{ ...inputFiltro, marginBottom: 14, resize: "vertical" }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setAnulando(null)} style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: "#e5e7eb", cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
              <button type="button" onClick={confirmarAnular} disabled={enviandoAnular} style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: "#b91c1c", color: "#fff", cursor: "pointer", fontWeight: 700, opacity: enviandoAnular ? 0.6 : 1 }}>
                {enviandoAnular ? "Anulando..." : "Anular pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ListadoPagosAdmin;
