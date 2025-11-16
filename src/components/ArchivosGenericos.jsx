import React, { useState } from "react";

function ArchivosGenericos() {
  const [archivosSubidos, setArchivosSubidos] = useState([]);

  // Maneja la subida de cualquier archivo
  function handleGenericFileUpload(e) {
    const files = Array.from(e.target.files);
    const nuevosArchivos = files.map(file => ({
      nombre: file.name,
      tipo: file.type,
      size: file.size,
      url: URL.createObjectURL(file)
    }));
    setArchivosSubidos(prev => [...prev, ...nuevosArchivos]);
  }
/*
  return (
    <div style={{ padding: "2em" }}>
      <h2>Gestión de Archivos Generales</h2>
      <input
        type="file"
        multiple
        onChange={handleGenericFileUpload}
        style={{ marginBottom: "1em" }}
      />
      {archivosSubidos.length > 0 && (
        <div>
          <h3>Archivos Subidos</h3>
          <ul>
            {archivosSubidos.map((file, i) => (
              <li key={i}>
                {file.nombre} &nbsp;
                <span style={{color: "#888", fontSize: "0.89em"}}>({Math.round(file.size/1024)} KB)</span>
                <a
                  href={file.url}
                  download={file.nombre}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginLeft: "1em",
                    background: "#218290",
                    color: "#fff",
                    padding: "0.33em 1em",
                    borderRadius: "8px",
                    fontWeight: "bold",
                    textDecoration: "none"
                  }}
                >
                  Descargar / Ver
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
  */
}

export default ArchivosGenericos;
