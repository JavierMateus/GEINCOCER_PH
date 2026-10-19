import React, { useEffect, useState } from "react";

import { API_BASE } from "../config";

function PQRSAdmin() {
  const [pqrs, setPqrs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [respuestas, setRespuestas] = useState({});
  const [archivosRespuesta, setArchivosRespuesta] = useState({});
  const [filtroEstado, setFiltroEstado] = useState("todas");
  const [ordenFechaAsc, setOrdenFechaAsc] = useState(false);

  const cargarPqrs = async () => {
    try {
      setCargando(true);
      setError("");

      const response = await fetch(`${API_BASE}/api/pqrs`);
      if (!response.ok) {
        throw new Error("No se pudo cargar la lista de PQRS");
      }

      const data = await response.json();
      const lista = Array.isArray(data) ? data : [];

      setPqrs(lista);

      const respuestasIniciales = {};
      lista.forEach((item, index) => {
        const id = item.ID || index;
        respuestasIniciales[id] = item.RespuestaAdmin && item.RespuestaAdmin !== "-"
          ? item.RespuestaAdmin
          : "";
      });

      setRespuestas(respuestasIniciales);
    } catch (err) {
      console.error("Error al cargar PQRS en administración:", err);
      setError("No se pudieron cargar las PQRS.");
      setPqrs([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPqrs();
  }, []);

  const guardarRespuestaPqrs = async (id) => {
    try {
      const respuestaAdmin = (respuestas[id] || "").trim();

      if (!respuestaAdmin) {
        alert("Debes escribir una respuesta antes de guardar.");
        return;
      }

      const response = await fetch(`${API_BASE}/api/pqrs/${id}/respuesta`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          RespuestaAdmin: respuestaAdmin,
          Estado: "Respondida",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "No se pudo guardar la respuesta");
      }

      alert("Respuesta guardada correctamente.");
      cargarPqrs();
    } catch (error) {
      console.error("Error al guardar respuesta:", error);
      alert(error.message || "Error al guardar la respuesta.");
    }
  };

  const subirArchivoRespuesta = async (id) => {
    try {
      const archivo = archivosRespuesta[id];

      if (!archivo) {
        alert("Debes seleccionar un archivo.");
        return;
      }

      const formData = new FormData();
      formData.append("archivoRespuesta", archivo);

      const response = await fetch(`${API_BASE}/api/pqrs/${id}/respuesta-archivo`, {
        method: "PUT",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "No se pudo subir el archivo de respuesta");
      }

      alert("Archivo de respuesta guardado correctamente.");
      cargarPqrs();
    } catch (error) {
      console.error("Error al subir archivo de respuesta:", error);
      alert(error.message || "Error al subir el archivo de respuesta.");
    }
  };

  const obtenerEstiloEstado = (estado) => {
    const valor = String(estado || "").toLowerCase();

    if (valor.includes("respondida")) {
      return {
        background: "#dcfce7",
        color: "#166534",
        border: "1px solid #86efac",
      };
    }

    if (valor.includes("radicada")) {
      return {
        background: "#e0f2fe",
        color: "#075985",
        border: "1px solid #7dd3fc",
      };
    }

    if (valor.includes("pendiente")) {
      return {
        background: "#fef3c7",
        color: "#92400e",
        border: "1px solid #fcd34d",
      };
    }

    return {
      background: "#f1f5f9",
      color: "#334155",
      border: "1px solid #cbd5e1",
    };
  };

  const totalPqrs = pqrs.length;
  const respondidas = pqrs.filter((item) =>
    String(item.Estado || "").toLowerCase().includes("respondida")
  ).length;
  const radicadas = pqrs.filter((item) =>
    String(item.Estado || "").toLowerCase().includes("radicada")
  ).length;

  const pqrsFiltradas = [...pqrs]
  .filter((item) => {
    const estado = String(item.Estado || "").toLowerCase();

    if (filtroEstado === "respondidas") {
      return estado.includes("respondida");
    }

    if (filtroEstado === "radicadas") {
      return estado.includes("radicada");
    }

    return true;
  })
  .sort((a, b) => {
    const fechaA = new Date(a.Fecha || 0).getTime();
    const fechaB = new Date(b.Fecha || 0).getTime();

    return ordenFechaAsc ? fechaA - fechaB : fechaB - fechaA;
  });

  return (
    <div
      style={{
        marginTop: "20px",
        padding: "22px",
        background: "#ffffff",
        borderRadius: "18px",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "18px",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "1.55rem",
              color: "#0f172a",
            }}
          >
            Administración de PQRS
          </h2>
          <p
            style={{
              margin: "6px 0 0 0",
              color: "#64748b",
              fontSize: "0.97rem",
            }}
          >
            Revisa solicitudes, redacta respuestas y gestiona archivos adjuntos.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div style={resumenCard}>
            <span style={resumenLabel}>Total</span>
            <strong style={resumenValor}>{totalPqrs}</strong>
          </div>
          <div style={resumenCard}>
            <span style={resumenLabel}>Respondidas</span>
            <strong style={{ ...resumenValor, color: "#166534" }}>{respondidas}</strong>
          </div>
          <div
  style={{
    ...resumenCard,
    border: radicadas > 0 ? "2px solid #0ea5e9" : "1px solid #e2e8f0",
    background: radicadas > 0 ? "#f0f9ff" : "#ffffff",
    boxShadow: radicadas > 0 ? "0 0 0 3px rgba(14,165,233,0.10)" : "none",
  }}
>
  <span style={resumenLabel}>Radicadas</span>
  <strong style={{ ...resumenValor, color: "#075985" }}>{radicadas}</strong>
</div>
        </div>
      </div>

      {cargando && (
        <div style={mensajeCarga}>
          <p style={{ margin: 0 }}>Cargando PQRS...</p>
        </div>
      )}

      {error && (
        <div style={mensajeError}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {!cargando && !error && pqrs.length === 0 && (
        <div style={mensajeVacio}>
          <p style={{ margin: 0, color: "#475569" }}>No hay PQRS registradas.</p>
        </div>
      )}

      {!cargando && !error && pqrs.length > 0 && (
  <>
    <div
      style={{
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
        marginBottom: "16px",
      }}
    >
      <button
        style={{
          ...chipFiltro,
          ...(filtroEstado === "todas" ? chipFiltroActivo : {}),
        }}
        onClick={() => setFiltroEstado("todas")}
      >
        Todas ({pqrs.length})
      </button>

      <button
        style={{
          ...chipFiltro,
          ...(filtroEstado === "respondidas" ? chipFiltroActivoVerde : {}),
        }}
        onClick={() => setFiltroEstado("respondidas")}
      >
        Respondidas ({respondidas})
      </button>

      <button
        style={{
          ...chipFiltro,
          ...(filtroEstado === "radicadas" ? chipFiltroActivoAzul : {}),
        }}
        onClick={() => setFiltroEstado("radicadas")}
      >
        Radicadas ({radicadas})
      </button>
    </div>

    {pqrsFiltradas.length === 0 ? (
      <div style={mensajeVacio}>
        <p style={{ margin: 0, color: "#475569" }}>
          No hay PQRS para el filtro seleccionado.
        </p>
      </div>
    ) : (
      <div
        style={{
          overflowX: "auto",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            minWidth: "1500px",
            background: "#ffffff",
          }}
        >
          <thead>
  <tr style={{ background: "#f8fafc" }}>
    <th
      style={{
        ...th,
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={() => setOrdenFechaAsc((prev) => !prev)}
    >
      Fecha {ordenFechaAsc ? "↑" : "↓"}
    </th>
    <th style={th}>Tipo</th>
    <th style={th}>Asunto</th>
    <th style={th}>Descripción</th>
    <th style={th}>Espacio</th>
    <th style={th}>Fecha reserva</th>
    <th style={th}>Hora reserva</th>
    <th style={th}>Residente</th>
    <th style={th}>Inmueble</th>
    <th style={th}>Documento</th>
    <th style={th}>Estado</th>
    <th style={th}>Adjunto residente</th>
    <th style={th}>Redactar respuesta</th>
    <th style={th}>Fecha respuesta</th>
    <th style={th}>Archivo respuesta</th>
    <th style={th}>Acción</th>
  </tr>
</thead>

<tbody>
  {pqrsFiltradas.map((item, index) => {
    const id = item.ID || index;
    const estado = item.Estado || "-";

    return (
      <tr
        key={id}
        style={{
          backgroundColor: index % 2 === 0 ? "#ffffff" : "#f8fafc",
        }}
      >
        <td style={td}>{item.Fecha || "-"}</td>
        <td style={td}>{item.Tipo || "-"}</td>
        <td style={{ ...td, fontWeight: 600, color: "#0f172a" }}>
          {item.Asunto || "-"}
        </td>
        <td style={{ ...td, maxWidth: 280, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {item.Descripcion || "-"}
        </td>
        <td style={td}>{item.Espacio || "-"}</td>
        <td style={td}>{item.FechaReserva || "-"}</td>
        <td style={td}>{item.HoraReserva || "-"}</td>
        <td style={td}>{item.NombreResidente || "-"}</td>
        <td style={td}>
          {(item.TorreManzana || item["Torre/Manzana"] || "-") + " - " + (item.AptoCasa || item["Apto/Casa"] || "-")}
        </td>
        <td style={td}>{item.DocumentoResidente || "-"}</td>
                  <td style={td}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "6px 12px",
                        borderRadius: "999px",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        ...obtenerEstiloEstado(estado),
                      }}
                    >
                      {estado}
                    </span>
                  </td>

                   <td style={td}>
                    {(
                      item.URL_ArchivoResidente ||
                      item.URL_Adjunto ||
                      item.URL_Archivo ||
                      item.Adjunto ||
                      item.Archivo
                    ) ? (
                      <a
                        href={`http://localhost:4000${
                          item.URL_ArchivoResidente ||
                          item.URL_Adjunto ||
                          item.URL_Archivo ||
                          item.Adjunto ||
                          item.Archivo
                        }`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={linkRespuesta}
                      >
                        Ver adjunto
                      </a>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>Sin adjunto</span>
                    )}
                  </td>

                  <td style={td}>
                    <textarea
                      value={respuestas[id] || ""}
                      onChange={(e) =>
                        setRespuestas((prev) => ({
                          ...prev,
                          [id]: e.target.value,
                        }))
                      }
                      placeholder="Escribe aquí la respuesta para esta PQRS..."
                      style={{
                        width: "100%",
                        minWidth: "260px",
                        minHeight: "90px",
                        resize: "vertical",
                        padding: "10px 12px",
                        borderRadius: "12px",
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#0f172a",
                        fontSize: "0.92rem",
                        outline: "none",
                        fontFamily: "inherit",
                      }}
                    />
                  </td>

                  <td style={td}>{item.FechaRespuesta || "-"}</td>

                  <td style={td}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        minWidth: "220px",
                      }}
                    >
                      <input
                        type="file"
                        onChange={(e) =>
                          setArchivosRespuesta((prev) => ({
                            ...prev,
                            [id]: e.target.files[0],
                          }))
                        }
                        style={{
                          fontSize: "0.88rem",
                          color: "#334155",
                        }}
                      />

                      <button
                        style={botonSecundario}
                        onClick={() => subirArchivoRespuesta(id)}
                      >
                        Subir archivo
                      </button>
                    </div>
                  </td>

                  <td style={td}>
                    <button
                      style={botonPrincipal}
                      onClick={() => guardarRespuestaPqrs(id)}
                    >
                      Guardar respuesta
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
                </table>
      </div>
    )}
  </>
)}
</div>
);
}

const resumenCard = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "10px 14px",
  minWidth: "110px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const resumenLabel = {
  fontSize: "0.8rem",
  color: "#64748b",
  fontWeight: 600,
};

const resumenValor = {
  fontSize: "1.15rem",
  color: "#0f172a",
};

const mensajeCarga = {
  padding: "16px",
  borderRadius: "12px",
  background: "#eff6ff",
  color: "#1d4ed8",
  marginBottom: "12px",
};

const mensajeError = {
  padding: "16px",
  borderRadius: "12px",
  background: "#fef2f2",
  color: "#b91c1c",
  marginBottom: "12px",
};

const mensajeVacio = {
  padding: "18px",
  borderRadius: "12px",
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
};

const th = {
  textAlign: "left",
  padding: "14px 12px",
  fontSize: "0.88rem",
  color: "#334155",
  fontWeight: 700,
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
};

const td = {
  padding: "14px 12px",
  fontSize: "0.92rem",
  color: "#334155",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top",
};

const botonPrincipal = {
  background: "#2563eb",
  color: "#ffffff",
  border: "none",
  borderRadius: "10px",
  padding: "10px 14px",
  fontWeight: 700,
  fontSize: "0.85rem",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const botonSecundario = {
  background: "#e2e8f0",
  color: "#0f172a",
  border: "none",
  borderRadius: "10px",
  padding: "8px 12px",
  fontWeight: 700,
  fontSize: "0.84rem",
  cursor: "pointer",
  width: "fit-content",
};

const linkRespuesta = {
  color: "#2563eb",
  textDecoration: "none",
  fontWeight: 700,
};

const chipFiltro = {
  background: "#f8fafc",
  color: "#334155",
  border: "1px solid #cbd5e1",
  borderRadius: "999px",
  padding: "9px 14px",
  fontWeight: 700,
  fontSize: "0.88rem",
  cursor: "pointer",
};

const chipFiltroActivo = {
  background: "#dbeafe",
  color: "#1d4ed8",
  border: "1px solid #93c5fd",
};

const chipFiltroActivoVerde = {
  background: "#dcfce7",
  color: "#166534",
  border: "1px solid #86efac",
};

const chipFiltroActivoAzul = {
  background: "#e0f2fe",
  color: "#075985",
  border: "1px solid #7dd3fc",
};


export default PQRSAdmin;