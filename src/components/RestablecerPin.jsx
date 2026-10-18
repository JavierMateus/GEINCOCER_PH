// src/components/RestablecerPin.jsx
// Ventana del administrador para restablecer el PIN olvidado de un habitante.
// Al restablecerlo, la persona vuelve a entrar con su documento y su nombre
// completo, y el sistema le pide crear un PIN nuevo. Tambien quita el bloqueo
// por intentos fallidos.
//
// Props:
//   usuario   -> administrador que esta en sesion (necesita usuario.documento)
//   onCerrar  -> cierra la ventana

import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config";

const normalizar = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const soloDigitos = (valor) => String(valor ?? "").replace(/\D/g, "");

function RestablecerPin({ usuario, onCerrar }) {
  const [habitantes, setHabitantes] = useState([]);
  const [estados, setEstados] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState("");
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });

  const cargar = async () => {
    setCargando(true);
    try {
      const [respH, respE] = await Promise.all([
        fetch(`${API_BASE}/api/habitantes`, { cache: "no-store" }),
        fetch(`${API_BASE}/api/auth/estado-pines`, { cache: "no-store" }),
      ]);
      const dataH = await respH.json();
      const dataE = await respE.json();

      setHabitantes(Array.isArray(dataH.habitantes) ? dataH.habitantes : []);

      const mapa = {};
      (dataE.estados || []).forEach((e) => {
        mapa[e.documento] = e;
      });
      setEstados(mapa);
    } catch (err) {
      setMensaje({ tipo: "error", texto: "No se pudo cargar la lista. Revisa que el backend esté encendido." });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const filas = useMemo(() => {
    const texto = normalizar(busqueda);
    return habitantes
      .map((h) => {
        const documento = soloDigitos(h.DocumentoResidente || h.Documento);
        return {
          documento,
          nombre: h.NombreResidente || h.Nombre || "",
          rol: h.Rol || "",
          inmueble: [h.TorreManzana, h.AptoCasa].filter(Boolean).join(" - "),
          estado: estados[documento] || null,
        };
      })
      .filter((f) => f.documento)
      .filter(
        (f) =>
          !texto ||
          normalizar(f.nombre).includes(texto) ||
          f.documento.includes(texto) ||
          normalizar(f.inmueble).includes(texto)
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [habitantes, estados, busqueda]);

  const restablecer = async (fila) => {
    setMensaje({ tipo: "", texto: "" });

    if (!/^\d{4}$/.test(adminPin)) {
      setMensaje({ tipo: "error", texto: "Escribe arriba tu PIN de administrador (4 números) para confirmar." });
      return;
    }

    const ok = window.confirm(
      `¿Restablecer el PIN de ${fila.nombre} (${fila.documento})?\n\n` +
        "La persona deberá entrar con su documento y su nombre completo, y crear un PIN nuevo."
    );
    if (!ok) return;

    setProcesando(fila.documento);
    try {
      const resp = await fetch(`${API_BASE}/api/auth/restablecer-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminDocumento: usuario?.documento,
          adminPin,
          documento: fila.documento,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || "No se pudo restablecer el PIN.");

      setMensaje({ tipo: "ok", texto: `${fila.nombre}: ${data.mensaje}` });
      await cargar();
    } catch (err) {
      setMensaje({ tipo: "error", texto: err.message });
    } finally {
      setProcesando("");
    }
  };

  const etiqueta = (estado) => {
    if (estado?.bloqueado) return { texto: "Bloqueado", color: "#b91c1c", fondo: "#fee2e2" };
    if (estado?.tienePin) return { texto: "Con PIN", color: "#166534", fondo: "#dcfce7" };
    return { texto: "Sin PIN", color: "#b45309", fondo: "#fef3c7" };
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "#0008",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 24,
          width: "100%",
          maxWidth: 760,
          maxHeight: "92vh",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0, color: "#188aac" }}>Restablecer PIN de un habitante</h2>
          <button
            type="button"
            onClick={onCerrar}
            style={{ background: "#64748b", color: "#fff", border: "none", borderRadius: 7, padding: "6px 16px", cursor: "pointer" }}
          >
            Cerrar
          </button>
        </div>

        <p style={{ color: "#475569", fontSize: 14 }}>
          Úsalo cuando alguien olvide su PIN o quede bloqueado. La persona entrará con su documento y su
          nombre completo, y el sistema le pedirá crear un PIN nuevo.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ fontWeight: "bold", color: "#444", fontSize: 13 }}>Tu PIN de administrador</label>
            <input
              type="password"
              inputMode="numeric"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box", marginTop: 4 }}
            />
          </div>
          <div style={{ flex: "2 1 260px" }}>
            <label style={{ fontWeight: "bold", color: "#444", fontSize: 13 }}>Buscar</label>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, documento o inmueble"
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box", marginTop: 4 }}
            />
          </div>
        </div>

        {mensaje.texto && (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              marginBottom: 12,
              fontWeight: 600,
              color: mensaje.tipo === "ok" ? "#166534" : "#b91c1c",
              background: mensaje.tipo === "ok" ? "#dcfce7" : "#fee2e2",
            }}
          >
            {mensaje.texto}
          </div>
        )}

        {cargando ? (
          <div style={{ color: "#64748b" }}>Cargando...</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                <th style={{ padding: 8 }}>Nombre</th>
                <th style={{ padding: 8 }}>Documento</th>
                <th style={{ padding: 8 }}>Rol</th>
                <th style={{ padding: 8 }}>Inmueble</th>
                <th style={{ padding: 8 }}>Estado</th>
                <th style={{ padding: 8 }} />
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const e = etiqueta(f.estado);
                const esYo = f.documento === soloDigitos(usuario?.documento);
                const puede = !esYo && (f.estado?.tienePin || f.estado?.bloqueado);
                return (
                  <tr key={f.documento} style={{ borderTop: "1px solid #e2e8f0" }}>
                    <td style={{ padding: 8 }}>{f.nombre}</td>
                    <td style={{ padding: 8 }}>{f.documento}</td>
                    <td style={{ padding: 8 }}>{f.rol}</td>
                    <td style={{ padding: 8 }}>{f.inmueble || "-"}</td>
                    <td style={{ padding: 8 }}>
                      <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: e.color, background: e.fondo }}>
                        {e.texto}
                      </span>
                    </td>
                    <td style={{ padding: 8, textAlign: "right" }}>
                      {esYo ? (
                        <span style={{ fontSize: 12, color: "#64748b" }}>Tú</span>
                      ) : (
                        <button
                          type="button"
                          disabled={!puede || procesando === f.documento}
                          onClick={() => restablecer(f)}
                          title={puede ? "" : "Aún no tiene PIN: entra con su nombre"}
                          style={{
                            background: puede ? "#f59e0b" : "#e2e8f0",
                            color: puede ? "#fff" : "#94a3b8",
                            border: "none",
                            borderRadius: 6,
                            padding: "5px 12px",
                            fontWeight: 700,
                            cursor: puede ? "pointer" : "not-allowed",
                          }}
                        >
                          {procesando === f.documento ? "..." : "Restablecer"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filas.length && (
                <tr>
                  <td colSpan={6} style={{ padding: 12, color: "#64748b", textAlign: "center" }}>
                    No hay habitantes que coincidan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default RestablecerPin;