// NotificacionesPanel.js
import React, { useState } from "react";

function iconoArchivo(tipo) {
  switch (tipo) {
    case "pdf":   return "📄";
    case "xlsx":
    case "xls":   return "📊";
    case "jpg":
    case "jpeg":
    case "png":   return "🖼️";
    case "doc":
    case "docx":  return "📝";
    default:      return "📁";
  }
}

function NotificacionesPanel({ archivos = [], setArchivos, onClose }) {
  // Estado para almacenar fecha/Hora solo del archivo que se va a adjuntar
  const [fechaPublicacion, setFechaPublicacion] = useState("");

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, width: "100vw", height: "100vh",
      background: "#192d3e29", zIndex: 11,
      display: "flex", justifyContent: "center", alignItems: "center"
    }}>
      <div style={{
        background: "#fff",
        minWidth: 430, maxWidth: "90vw",
        borderRadius: 16,
        boxShadow: "0 3px 40px #95d0e591",
        padding: "2.6em 2em 1.2em"
      }}>
        <h3 style={{ color: "#218290", marginBottom: ".9em" }}>Notificaciones</h3>
        <label style={{ fontWeight: "bold", marginTop: "8px" }}>
          Fecha de publicación:
          <input
            type="datetime-local"
            value={fechaPublicacion}
            onChange={e => setFechaPublicacion(e.target.value)}
            style={{ marginLeft: "12px", padding: "6px", borderRadius: "8px" }}
            required
          />
        </label>
        <input
          type="file"
          multiple
          accept="" // acepta todo
          onChange={e => {
            const nuevos = Array.from(e.target.files).map(f => ({
              nombre: f.name,
              fecha: new Date().toLocaleDateString("es-CO"),
              tipo: f.name.split(".").pop().toLowerCase(),
              url: URL.createObjectURL(f),
              fechaPublicacion: fechaPublicacion, // asocia la fecha seleccionada
              leido: false
            }));
            setArchivos(a => [...nuevos, ...a]);
          }}
          style={{ margin: "0.6em 0 1.5em" }}
        />

        <table style={{ width: "100%", fontSize: "1em", marginBottom: "1em", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f6fafe"}}>
              <th>Archivo</th>
              <th>Fecha Adjunta</th>
              <th>Publicación</th>
              <th>Abrir</th>
              <th>Descargar</th>
            </tr>
          </thead>
          <tbody>
            {(archivos || []).map((a, i) => (
              <tr key={i}>
                <td>
                  <span style={{ fontSize: "1.5em", marginRight: 8 }}>{iconoArchivo(a.tipo)}</span>
                  {a.nombre}
                </td>
                <td>{a.fecha}</td>
                <td>
                  {a.fechaPublicacion
                    ? new Date(a.fechaPublicacion).toLocaleString("es-CO")
                    : "No programada"}
                </td>
                <td>
                  <a href={a.url} target="_blank" rel="noopener noreferrer"
                    style={{ color: "#198fcf", fontWeight: "bold", textDecoration: "underline" }}>
                    Abrir archivo
                  </a>
                </td>
                <td>
                  <a href={a.url} download style={{
                    background: "#218290", color: "#fff",
                    padding: "6px 16px", borderRadius: 10,
                    textDecoration: "none", fontWeight: "bold"
                  }}>
                    Descargar
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={onClose} style={{
          padding: "8px 22px",
          borderRadius: "11px",
          background: "#086689",
          color: "#fff", fontWeight: "bold", border: "none"
        }}>Cerrar</button>
      </div>
    </div>
  );
}

export default NotificacionesPanel;
