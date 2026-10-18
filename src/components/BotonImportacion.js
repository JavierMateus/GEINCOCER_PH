import React, { useRef } from "react";

const coloresBoton = {
  notificaciones: "linear-gradient(135deg, #f8ed9f 0%, #f7e5b7 100%)",
  habitantes: "linear-gradient(135deg, #cdeeee 0%, #b8e6ef 100%)",
  inmuebles: "linear-gradient(135deg, #dcdcff 0%, #cfdaf6 100%)",
  parqueaderos: "linear-gradient(135deg, #ffe2c2 0%, #ffe9cf 100%)",
  incidentes: "linear-gradient(135deg, #ffd4d8 0%, #ffdcca 100%)",
  pagos: "linear-gradient(135deg, #e6d7ff 0%, #ddd0f9 100%)",
  reservas: "linear-gradient(135deg, #d8f2e7 0%, #cfeedd 100%)",
  vehiculos: "linear-gradient(135deg, #d8e9ff 0%, #cfe3ff 100%)",
  mantenimiento: "linear-gradient(135deg, #ffd9df 0%, #ffe7d2 100%)",
};

const iconos = {
  notificaciones: "📢",
  habitantes: "👨‍👩‍👧",
  inmuebles: "🏢",
  parqueaderos: "🅿️",
  incidentes: "⚠️",
  pagos: "💳",
  reservas: "📅",
  vehiculos: "🚗",
  mantenimiento: "🔧",
};

export default function BotonImportacion({ tipo, titulo, onFileChange }) {
  const fileInputRef = useRef();

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <button
        type="button"
        style={{
          width: "185px",
          minHeight: "104px",
          margin: "0.25em",
          padding: "14px 12px",
          borderRadius: "16px",
          background: coloresBoton[tipo],
          color: "#1f2937",
          fontWeight: 700,
          fontSize: "0.95rem",
          lineHeight: 1.2,
          boxShadow: "0 6px 16px rgba(15, 23, 42, 0.08)",
          border: "1px solid rgba(255,255,255,0.55)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          position: "relative",
          transition: "transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease",
          textAlign: "center",
        }}
        onClick={handleButtonClick}
        onMouseOver={(e) => {
          e.currentTarget.style.boxShadow = "0 10px 22px rgba(15, 23, 42, 0.12)";
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.filter = "saturate(1.02)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(15, 23, 42, 0.08)";
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.filter = "saturate(1)";
        }}
      >
        <span
          style={{
            fontSize: "1.8rem",
            marginBottom: "8px",
            lineHeight: 1,
          }}
        >
          {iconos[tipo]}
        </span>

        <span
          style={{
            display: "block",
            maxWidth: "130px",
            whiteSpace: "normal",
            wordBreak: "break-word",
          }}
        >
          {titulo}
        </span>
      </button>

      <input
        type="file"
        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        style={{ display: "none" }}
        ref={fileInputRef}
        onChange={onFileChange}
      />
    </div>
  );
}