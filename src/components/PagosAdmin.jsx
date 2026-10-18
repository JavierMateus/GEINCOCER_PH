import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FormularioPago from "./FormularioPago";

const PagosAdmin = () => {
  const navigate = useNavigate();
  const [showPagoModal, setShowPagoModal] = useState(false);

  const handleRegresar = () => {
    navigate("/");
  };

  const handleConfirmarPagoMp = () => {
    navigate("/admin/confirmar-pago-mp");
  };

  return (
    <div style={{ padding: "20px" }}>
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

      <h2 style={{ marginBottom: "20px" }}>Panel de Pagos - Administrador</h2>

      <p style={{ marginBottom: "20px" }}>
        Desde aquí puedes acceder al formulario de pago en línea para los residentes
        y confirmar pagos realizados en Mercado Pago para guardarlos en el CSV.
      </p>

      <Link to="/residente/pagos">
        <button
          style={{
            padding: "10px 20px",
            backgroundColor: "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            fontWeight: "bold",
            cursor: "pointer",
            marginRight: "10px",
          }}
        >
          Ir a formulario de pago
        </button>
      </Link>

      <button
        onClick={handleConfirmarPagoMp}
        style={{
          padding: "10px 20px",
          backgroundColor: "#6f42c1",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          fontWeight: "bold",
          cursor: "pointer",
          marginRight: "10px",
        }}
      >
        Confirmar Pago MP
      </button>

      <button
        onClick={() => setShowPagoModal(true)}
        style={{
          padding: "10px 20px",
          backgroundColor: "#15aabf",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          fontWeight: "bold",
          cursor: "pointer",
          marginRight: "10px",
        }}
      >
        Registrar pago recibido
      </button>

      <Link to="/admin/pagos/listado">
        <button
          style={{
            padding: "10px 20px",
            backgroundColor: "green",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Ver listado de pagos
        </button>
      </Link>

      {showPagoModal && (
        <FormularioPago
          onGuardado={() => setShowPagoModal(false)}
          onClose={() => setShowPagoModal(false)}
        />
      )}
    </div>
  );
};

export default PagosAdmin;