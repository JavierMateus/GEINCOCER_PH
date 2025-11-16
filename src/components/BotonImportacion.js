// BotonImportacion.js
import React, { useRef } from "react";


const coloresBoton = {
  notificaciones: "linear-gradient(135deg, #fae57c 30%, #ffe398 100%)",
  habitantes: "linear-gradient(135deg, #1eb8aa 30%, #69e2ff 100%)",
  inmuebles: "linear-gradient(135deg, #8884ff 30%, #56cad2 100%)",
  parqueaderos: "linear-gradient(135deg, #ffae73 30%, #ffeba1 100%)",
  incidentes: "linear-gradient(135deg, #fd6076 30%, #ffbb90 100%)",
  pagos: "linear-gradient(135deg, #9933fa 30%, #c7a0f5 100%)",
  reservas: "linear-gradient(135deg, #39c194 30%, #8ae6c6 100%)",
  vehiculos: "linear-gradient(135deg, #3380fa 30%, #69afff 100%)",
  mantenimiento: "linear-gradient(135deg, #e82e4aff 30%, #ffe0bb 100%)"
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
  mantenimiento: "🔧"
};


export default function BotonImportacion({ tipo, titulo, onFileChange, props }) {
  const fileInputRef = useRef();

  // Abre el diálogo de archivos al hacer click en el botón
  const handleButtonClick = () => {
    fileInputRef.current.click();
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
      <button
        type="button"
        style={{
          width: "220px",
          height: "120px",
          margin: "0.7em",
          borderRadius: "18px",
          background: coloresBoton[tipo],
          color: "#232325",
          fontWeight: "bold",
          fontSize: "1.13em",
          boxShadow: "0 6px 24px #b5cbe35d",
          border: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          position: "relative",
          transition: "box-shadow 0.2s, transform 0.15s"
        }}
        onClick={handleButtonClick}
        onMouseOver={e => {
          e.currentTarget.style.boxShadow = "0 12px 32px #b5cbe38d";
          e.currentTarget.style.transform = "translateY(-4px) scale(1.03)";
        }}
        onMouseOut={e => {
          e.currentTarget.style.boxShadow = "0 6px 24px #b5cbe35d";
          e.currentTarget.style.transform = "none";
        }}
      >
        <span style={{ fontSize: "2.6em", marginBottom: "0.25em" }}>{iconos[tipo]}</span>
        {titulo}
      </button>
      <input
        type="file"
        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        style={{ display: 'none' }}
        ref={fileInputRef}
        onChange={onFileChange}
      />
    </div>
  );
}
