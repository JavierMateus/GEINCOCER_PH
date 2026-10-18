import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

function CapturaPagoMercadoPago() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [mensaje, setMensaje] = useState("Procesando tu pago...");
  const [tipo, setTipo] = useState("info"); // "info", "success", "error"

  useEffect(() => {
    // Leer parámetros de la URL
    const status = searchParams.get("status");
    const preferenceId = searchParams.get("preferenceId");
    const payment_id = searchParams.get("payment_id");
    const external_reference = searchParams.get("external_reference");

    // Si no hay parámetros, redirigir
    if (!status) {
      setMensaje("⚠️ Error: No se encontraron datos de pago.");
      setTipo("error");
      setTimeout(() => navigate("/"), 3000);
      return;
    }

    // Crear objeto con datos del pago
    const nuevoPago = {
      IDPago: `PAG-${Date.now()}`, // ID único basado en timestamp
      IDInmueble: external_reference || "SIN-DATO",
      TorreManzana: "Online",
      AptoCasa: "-",
      IDHabitante: "-",
      Nombre: "Pago Online",
      Telefono: "-",
      Periodo: new Date().toLocaleDateString("es-CO"),
      Valor: "0", // Mercado Pago no devuelve el monto en la URL
      Estado: status === "success" ? "Pagado" : status === "failure" ? "Rechazado" : "Pendiente",
      "Fecha de pago": new Date().toLocaleDateString("es-CO"),
      "Método Pago": "Mercado Pago",
      "Referencia/Transacción": payment_id || preferenceId || "SIN-DATO",
      Intereses: "0",
      "Cobro Especial": "0",
      Observaciones: `Pago procesado automáticamente. Preference ID: ${preferenceId}`,
      "Registrado por": "Sistema Automático",
      "Fecha Registro": new Date().toLocaleDateString("es-CO"),
      Comprobante: "-",
      URL: "-"
    };

    // Guardar en localStorage (temporal, luego sincronizar con CSV)
    const pagosGuardados = localStorage.getItem("pagosOnline");
    const pagosList = pagosGuardados ? JSON.parse(pagosGuardados) : [];
    pagosList.push(nuevoPago);
    localStorage.setItem("pagosOnline", JSON.stringify(pagosList));

    // Mostrar mensaje según status
    if (status === "success") {
      setMensaje("✅ ¡Pago exitoso! Tu transacción ha sido procesada correctamente.");
      setTipo("success");
      setTimeout(() => navigate("/admin/pagos"), 3000);
    } else if (status === "failure") {
      setMensaje("❌ Pago rechazado. Por favor, intenta de nuevo.");
      setTipo("error");
      setTimeout(() => navigate("/residente/pagos"), 3000);
    } else if (status === "pending") {
      setMensaje("⏳ Tu pago está pendiente. Te notificaremos cuando se complete.");
      setTipo("info");
      setTimeout(() => navigate("/admin/pagos"), 3000);
    }
  }, [searchParams, navigate]);

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      background: "linear-gradient(135deg, #e3edf7 0%, #f5fafd 100%)"
    }}>
      <div style={{
        background: "#fff",
        borderRadius: "18px",
        boxShadow: "0 8px 32px #c2d6e12a",
        padding: "3em 2em",
        textAlign: "center",
        maxWidth: "500px",
        animation: "fadeIn 0.5s ease-in"
      }}>
        <h1 style={{
          fontSize: "1.8em",
          color: tipo === "success" ? "#31980c" : tipo === "error" ? "#e43c38" : "#188aac",
          marginBottom: "1em"
        }}>
          {tipo === "success" ? "¡Éxito!" : tipo === "error" ? "Error" : "Procesando..."}
        </h1>
        <p style={{
          fontSize: "1.1em",
          color: "#555",
          marginBottom: "2em",
          lineHeight: "1.6"
        }}>
          {mensaje}
        </p>
        <p style={{ color: "#999", fontSize: "0.9em" }}>
          Serás redirigido automáticamente en 3 segundos...
        </p>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

export default CapturaPagoMercadoPago;
