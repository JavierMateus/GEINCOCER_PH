// src/components/MisDatosContacto.jsx
// Telefono y correo del residente en "Mis datos", con el boton para actualizarlos.
// Guarda en Habitantes.csv (todas las filas de ese documento) y deja constancia
// en CambiosDatos.csv.
//
// Props: documento, telefono, email (valores actuales)

import React, { useEffect, useState } from "react";
import { API_BASE } from "../config";

const estiloInput = {
  width: "100%",
  padding: "0.55em",
  borderRadius: 7,
  border: "1px solid #cbd5e1",
  marginTop: 4,
  boxSizing: "border-box",
};

function MisDatosContacto({ documento, telefono, email }) {
  const [actual, setActual] = useState({ telefono: telefono || "", email: email || "" });
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ telefono: "", email: "" });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });

  // Si llegan datos nuevos desde Habitantes (recarga), se reflejan.
  useEffect(() => {
    setActual({ telefono: telefono || "", email: email || "" });
  }, [telefono, email]);

  const abrir = () => {
    setForm({ telefono: actual.telefono, email: actual.email });
    setMensaje({ tipo: "", texto: "" });
    setEditando(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    const tel = form.telefono.replace(/\D/g, "");
    const correo = form.email.trim().toLowerCase();

    if (!/^3\d{9}$/.test(tel)) {
      setMensaje({ tipo: "error", texto: "El celular debe tener 10 números y empezar por 3." });
      return;
    }
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      setMensaje({ tipo: "error", texto: "El correo no tiene un formato válido." });
      return;
    }

    setGuardando(true);
    setMensaje({ tipo: "", texto: "" });
    try {
      const resp = await fetch(`${API_BASE}/api/habitantes/mis-datos`, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ documento, telefono: tel, email: correo }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error || "No se pudieron actualizar tus datos.");
      setActual({ telefono: data.telefono, email: data.email });
      setEditando(false);
      setMensaje({ tipo: "ok", texto: data.mensaje });
    } catch (err) {
      setMensaje({ tipo: "error", texto: err.message });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <p>
        <strong>Teléfono:</strong> {actual.telefono || "No disponible"}
      </p>
      <p>
        <strong>Email:</strong> {actual.email || "No disponible"}
      </p>

      {!editando && (
        <button
          type="button"
          onClick={abrir}
          style={{
            background: "#fff",
            color: "#188aac",
            border: "2px solid #188aac",
            borderRadius: 8,
            padding: "0.5em 1em",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Actualizar teléfono y correo
        </button>
      )}

      {editando && (
        <form onSubmit={guardar} style={{ marginTop: 8, padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <label style={{ fontWeight: "bold", fontSize: "0.85em", color: "#334155" }}>Celular</label>
          <input
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            inputMode="numeric"
            maxLength={13}
            placeholder="3001234567"
            style={estiloInput}
          />

          <label style={{ fontWeight: "bold", fontSize: "0.85em", color: "#334155", display: "block", marginTop: 10 }}>Correo</label>
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            type="email"
            placeholder="nombre@correo.com"
            style={estiloInput}
          />

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <button
              type="button"
              onClick={() => {
                setEditando(false);
                setMensaje({ tipo: "", texto: "" });
              }}
              disabled={guardando}
              style={{ background: "#e2e8f0", color: "#334155", border: "none", borderRadius: 7, padding: "0.5em 1em", cursor: "pointer" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              style={{ background: "#218290", color: "#fff", border: "none", borderRadius: 7, padding: "0.5em 1.2em", fontWeight: "bold", cursor: "pointer" }}
            >
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      )}

      {mensaje.texto && (
        <div
          style={{
            marginTop: 10,
            padding: 8,
            borderRadius: 8,
            fontWeight: 600,
            fontSize: "0.9em",
            color: mensaje.tipo === "ok" ? "#166534" : "#b91c1c",
            background: mensaje.tipo === "ok" ? "#dcfce7" : "#fee2e2",
          }}
        >
          {mensaje.texto}
        </div>
      )}
    </>
  );
}

export default MisDatosContacto;