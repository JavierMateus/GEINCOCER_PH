import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "./config";

const ConfirmarPagoMp = () => {
  const [paymentId, setPaymentId] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const navigate = useNavigate();

  const handleRegresar = () => {
    navigate("/admin/pagos"); // vuelve al Panel de Pagos - Administrador
  };

  const manejarConfirmar = async () => {
    if (!paymentId.trim()) {
      setMensaje("Debes ingresar un paymentId");
      return;
    }
    setCargando(true);
    setMensaje("");
    try {
      const resp = await axios.post(
        `${API_BASE}/api/mercadopago/confirmar`,
        { paymentId: paymentId.trim() }
      );

      if (resp.data.exito) {
        setMensaje(resp.data.mensaje || "Pago confirmado y guardado en CSV");
      } else {
        setMensaje(resp.data.mensaje || "No fue posible confirmar el pago");
      }
    } catch (err) {
      setMensaje(
        "Error al confirmar: " +
          (err.response?.data?.mensaje || err.message)
      );
    }
    setCargando(false);
  };

  return (
    <div style={{ padding: "40px", maxWidth: "600px", margin: "0 auto" }}>
      <button
        onClick={handleRegresar}
        style={{
          marginBottom: "15px",
          padding: "6px 14px",
          backgroundColor: "#54d812ff",
          color: "#080707ff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "0.9em",
          fontWeight: "500",
        }}
      >
        ← Regresar
      </button>

      <h2>Confirmar Pago Mercado Pago</h2>
      <p>
        Pega el <strong>paymentId</strong> del pago realizado en Mercado Pago y
        se guardará en Pagos.csv si está aprobado.
      </p>
      <input
        type="text"
        value={paymentId}
        onChange={(e) => setPaymentId(e.target.value)}
        placeholder="paymentId"
        style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
      />
      <button
        onClick={manejarConfirmar}
        disabled={cargando}
        style={{
          padding: "10px 20px",
          background: "#28a745",
          color: "white",
          border: "none",
          borderRadius: "4px",
        }}
      >
        {cargando ? "Confirmando..." : "Confirmar pago y guardar en CSV"}
      </button>
      {mensaje && (
        <p style={{ marginTop: "15px", fontWeight: "bold" }}>{mensaje}</p>
      )}
    </div>
  );
};

export default ConfirmarPagoMp;
