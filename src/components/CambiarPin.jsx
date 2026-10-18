// src/components/CambiarPin.jsx
// Pantalla obligatoria para crear el PIN de 4 numeros en el primer ingreso
// (o despues de que el administrador lo restablece).
// Tambien sirve para cambiar el PIN cuando la persona quiera.
//
// Props:
//   usuario      -> datos que devolvio /api/auth/ingresar
//   claveActual  -> lo que la persona escribio para entrar (nombre o PIN).
//                   Solo se usa cuando es obligatorio.
//   obligatorio  -> true: pantalla completa, no deja continuar sin crear el PIN.
//                   false: ventana para cambiar el PIN; pide el PIN actual.
//   onListo()    -> se llama cuando el PIN quedo guardado
//   onCancelar() -> solo si no es obligatorio; si es obligatorio, cierra sesion

import React, { useState } from "react";
import { API_BASE } from "../config";

const estiloInput = {
  width: "100%",
  padding: "0.8em",
  margin: "0.4em 0 0.9em",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "1.4em",
  letterSpacing: "0.6em",
  textAlign: "center",
  boxSizing: "border-box",
};

function CambiarPin({ usuario, claveActual, obligatorio = true, onListo, onCancelar }) {
  const [pinActual, setPinActual] = useState("");
  const [pin, setPin] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const soloNumeros = (valor) => valor.replace(/\D/g, "").slice(0, 4);

  const guardar = async (e) => {
    e.preventDefault();
    setError("");

    if (!obligatorio && !/^\d{4}$/.test(pinActual)) {
      setError("Escribe tu PIN actual (4 números).");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError("El PIN debe tener exactamente 4 números.");
      return;
    }
    if (pin !== confirmacion) {
      setError("Los dos PIN no coinciden.");
      return;
    }

    setGuardando(true);
    try {
      const resp = await fetch(`${API_BASE}/api/auth/crear-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documento: usuario?.documento,
          clave: obligatorio ? claveActual : pinActual,
          pinNuevo: pin,
          pinConfirmacion: confirmacion,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || "No se pudo guardar el PIN.");

      alert(data.mensaje || "PIN guardado.");
      if (onListo) onListo();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      style={{
        ...(obligatorio
          ? { minHeight: "100vh" }
          : { position: "fixed", inset: 0, zIndex: 10000, background: "#0008" }),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5em",
        boxSizing: "border-box",
        ...(obligatorio ? { background: "linear-gradient(135deg, #e3edf7 0%, #f5fafd 100%)" } : {}),
      }}
    >
      <form
        onSubmit={guardar}
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "#fff",
          borderRadius: "18px",
          boxShadow: "0 4px 18px #c2d6e170",
          padding: "2em",
          boxSizing: "border-box",
        }}
      >
        <h2 style={{ margin: 0, color: "#188aac", textAlign: "center" }}>
          {obligatorio ? "Crea tu PIN" : "Cambiar PIN"}
        </h2>

        <p style={{ color: "#555", textAlign: "center", fontSize: "0.95em" }}>
          Hola, <strong>{usuario?.nombre}</strong>.{" "}
          {obligatorio
            ? "Por seguridad debes crear un PIN de 4 números. Desde ahora entrarás con tu documento y este PIN."
            : "Escribe tu nuevo PIN de 4 números."}
        </p>

        {!obligatorio && (
          <>
            <label style={{ fontWeight: "bold", color: "#444" }}>PIN actual</label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={pinActual}
              onChange={(e) => {
                setPinActual(soloNumeros(e.target.value));
                setError("");
              }}
              placeholder="••••"
              style={estiloInput}
              autoFocus
            />
          </>
        )}

        <label style={{ fontWeight: "bold", color: "#444" }}>PIN nuevo</label>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          value={pin}
          onChange={(e) => {
            setPin(soloNumeros(e.target.value));
            setError("");
          }}
          placeholder="••••"
          style={estiloInput}
          autoFocus={obligatorio}
        />

        <label style={{ fontWeight: "bold", color: "#444" }}>Repite el PIN</label>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          value={confirmacion}
          onChange={(e) => {
            setConfirmacion(soloNumeros(e.target.value));
            setError("");
          }}
          placeholder="••••"
          style={estiloInput}
        />

        <ul style={{ color: "#64748b", fontSize: "0.82em", paddingLeft: "1.2em", marginTop: 0 }}>
          <li>No uses 4 números iguales (1111).</li>
          <li>No uses secuencias (1234, 4321).</li>
          <li>No uses los últimos 4 números de tu documento.</li>
        </ul>

        {error && (
          <div style={{ color: "#b91c1c", background: "#fee2e2", padding: "0.6em", borderRadius: "8px", marginBottom: "0.8em", textAlign: "center" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={guardando}
          style={{
            width: "100%",
            padding: "0.9em",
            border: "none",
            borderRadius: "10px",
            background: guardando ? "#94a3b8" : "#218290",
            color: "#fff",
            fontWeight: "bold",
            fontSize: "1em",
            cursor: guardando ? "not-allowed" : "pointer",
          }}
        >
          {guardando ? "Guardando..." : "Guardar PIN"}
        </button>

        <button
          type="button"
          onClick={onCancelar}
          style={{
            width: "100%",
            marginTop: "0.7em",
            padding: "0.7em",
            border: "1px solid #cbd5e1",
            borderRadius: "10px",
            background: "#fff",
            color: "#475569",
            cursor: "pointer",
          }}
        >
          {obligatorio ? "Salir" : "Cancelar"}
        </button>
      </form>
    </div>
  );
}

export default CambiarPin;