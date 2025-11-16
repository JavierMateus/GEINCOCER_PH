import React, { useState } from "react";

const camposBase = {
  "ID_Pago": "",
  "ID_Inmueble": "",
  "Torre/Manzana": "",
  "Apto/Casa": "",
  "ID_Habitante": "",
  "Nombre": "",
  "Telefono": "",
  "Periodo": "",
  "Valor": "",
  "Estado": "Pagado",
  "Fecha de pago": "",
  "Método Pago": "Transferencia",
  "Referencia/Transacción": "",
  "Intereses": "",
  "Cobro Especial": "",
  "Observaciones": ""
};

const coloresBG = { header: "#15aabf", body: "#fff" };

function FormularioPago({ onGuardar, onClose }) {
  const [pago, setPago] = useState(camposBase);
  const [error, setError] = useState("");

  function handleChange(e) {
    setPago({ ...pago, [e.target.name]: e.target.value });
  }

  function guardar() {
    if (!pago["ID_Pago"] || !pago.Nombre || !pago.Valor) {
      setError("ID, Nombre y Valor son obligatorios");
      return;
    }
    setError("");
    onGuardar({ ...pago, Valor: Number(pago.Valor) });
  }

  return (
    <div style={{
      position: "fixed", left: 0, top: 0, zIndex: 9999,
      width: "100vw", height: "100vh", background: "#0008",
      display: "flex", justifyContent: "center", alignItems: "center"
    }}>
      <div style={{
        background: "#fff", borderRadius: 14,
        boxShadow: "0 8px 32px #15aabf44", padding: 30, minWidth: 370, maxWidth: 420
      }}>
        <h2 style={{ color: coloresBG.header, textAlign: "center", marginBottom: 18 }}>
          Registrar Pago Manual
        </h2>
        <form onSubmit={e => { e.preventDefault(); guardar(); }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {Object.keys(camposBase).map(campo =>
              <div key={campo} style={{ flex: "0 1 47%" }}>
                <label style={{ color: "#444", fontWeight: "bold" }}>{campo}</label>
                <input
                  type={campo === "Valor" ? "number" : "text"}
                  name={campo}
                  value={pago[campo]}
                  onChange={handleChange}
                  style={{
                    width: "100%", padding: 6, margin: "4px 0 10px",
                    borderRadius: 6, border: "1px solid #15aabf33",
                    background: campo === "Estado" ? "#e3fafd" : "#f5faff",
                    fontWeight: campo === "Estado" ? "bold" : "normal"
                  }}
                  required={["ID_Pago", "Nombre", "Valor"].includes(campo)}
                  maxLength={52}
                  min={campo === "Valor" ? 0 : undefined}
                />
              </div>
            )}
          </div>
          <div style={{
            color: "crimson", fontWeight: "bold", margin: "8px 0", minHeight: 22
          }}>{error}</div>
          <div style={{ display: "flex", gap: 16, justifyContent: "flex-end" }}>
            <button 
              type="button"
              style={{ background: "#2224", color: "#fff", border: "none", borderRadius: 7, padding: "7px 20px" }}
              onClick={onClose}>Cancelar</button>
            <button type="submit"
              style={{
                background: "#15aabf", color: "#fff", border: "none",
                borderRadius: 7, padding: "7px 18px", fontWeight: "bold"
              }}
            >Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FormularioPago;
