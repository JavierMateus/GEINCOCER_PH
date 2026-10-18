import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import SignatureCanvas from "react-signature-canvas";
import axios from "axios";

import { API_BASE } from "../config";

function formatoFecha(valor) {
  if (!valor || valor === "-") return "-";
  if (/^\d{5,}$/.test(valor)) {
    const dias = parseInt(valor, 10);
    if (isNaN(dias)) return valor;
    const fecha = new Date(1899, 11, 30 + dias);
    const dia = String(fecha.getDate()).padStart(2, "0");
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(valor)) {
    const partes = valor.split("/");
    const dia = partes[0].padStart(2, "0");
    const mes = partes[1].padStart(2, "0");
    const anio = partes[2].length === 2 ? "20" + partes[2] : partes[2];
    return `${dia}/${mes}/${anio}`;
  }
  return valor;
}

const FIRMANTES_POR_TIPO = {
  Circular: ["Administrador", "Presidente Consejo"],
  Manual: ["Administrador", "Presidente Consejo", "Abogado"],
  Evento: ["Administrador", "Presidente Consejo"],
  Convocatoria: [
    "Administrador",
    "Revisor Fiscal",
    "Presidente Consejo",
    "Secretario Consejo"
  ],
  Aviso: ["Administrador", "Personal Mantenimiento"],
  Resolución: ["Administrador", "Presidente Consejo", "Abogado"],
  Queja: ["Administrador", "Seguridad"],
  Daño: ["Administrador", "Mantenimiento"],
  Solicitud: ["Administrador"]
};

function esFirmante(n, usuario) {
  const firmantes = FIRMANTES_POR_TIPO[n.Tipo?.trim()] || [];
  return firmantes.includes(usuario.rol);
}

function esPublicado(fechaVigenteDesde) {
  if (!fechaVigenteDesde || fechaVigenteDesde === "-") return true;
  const partes = fechaVigenteDesde.split("/");
  if (partes.length !== 3) return true;
  const fecha = new Date(+partes[2], partes[1] - 1, +partes[0]);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return fecha <= hoy;
}

function esPendiente(fechaVigenteDesde) {
  if (!fechaVigenteDesde || fechaVigenteDesde === "-") return false;
  const partes = fechaVigenteDesde.split("/");
  if (partes.length !== 3) return false;
  const fecha = new Date(+partes[2], partes[1] - 1, +partes[0]);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return fecha > hoy;
}

function NotificacionesTable({ usuario, habitantes = [], datosIniciales = [] }) {
  console.log("CARGANDO NotificacionesTable CORRECTO");
  const [notificaciones, setNotificaciones] = useState([]);
  const [firmaModal, setFirmaModal] = useState(null);
  const [visible, setVisible] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("todas");

  useEffect(() => {
    const fetchNotificaciones = async () => {
      try {
        const resp = await axios.get(`${API_BASE}/api/notificaciones`);
        setNotificaciones(Array.isArray(resp.data) ? resp.data : []);
      } catch (error) {
        console.error("Error cargando notificaciones:", error);
        setNotificaciones([]);
      }
    };

    fetchNotificaciones();
  }, []);

  const [nuevo, setNuevo] = useState({
    Título: "",
    Tipo: "",
    Autor: "",
    Descripción: "",
    Destinatarios: "Todos",
    Adjunto: "",
    URL_Archivo: ""
  });

  const handleAgregarNotificacion = async () => {
    try {
      let nombreArchivo = "-";
      let urlArchivo = "-";

      if (nuevo.archivoFile) {
        const formData = new FormData();
        formData.append("file", nuevo.archivoFile);

        const uploadResp = await axios.post(
          `${API_BASE}/api/notificaciones/upload`,
          formData
        );

        nombreArchivo = uploadResp.data.nombreArchivo || "-";
        urlArchivo = uploadResp.data.url || "-";
      }

      const nuevaNotif = {
        Título: nuevo.Título,
        Tipo: nuevo.Tipo,
        Autor: nuevo.Autor || usuario?.nombre || "-",
        Descripción: nuevo.Descripción || "-",
        Destinatarios: nuevo.Destinatarios,
        Adjunto: nombreArchivo,
        URL_Archivo: urlArchivo
      };

      const resp = await axios.post(
        `${API_BASE}/api/notificaciones`,
        nuevaNotif
      );

      setNotificaciones((prev) => [...prev, resp.data.notificacion]);

      setNuevo({
        Título: "",
        Tipo: "",
        Autor: "",
        Descripción: "",
        Destinatarios: "Todos",
        Adjunto: "",
        URL_Archivo: "",
        archivoFile: null
      });

      const fileInput = document.querySelector(
        'input[type="file"][accept=".pdf,.jpg,.jpeg,.png"]'
      );
      if (fileInput) fileInput.value = "";
    } catch (error) {
      console.error("Error creando notificación:", error);
      alert("No se pudo crear la notificación");
    }
  };

  const eliminarNotificacion = async (id) => {
    const confirmar = window.confirm("¿Deseas eliminar esta notificación?");
    if (!confirmar) return;

    try {
      await axios.delete(`${API_BASE}/api/notificaciones/${id}`);
      setNotificaciones((prev) =>
        prev.filter((n) => String(n.ID_Archivo || n.id) !== String(id))
      );
    } catch (error) {
      console.error("Error eliminando notificación:", error);
      alert("No se pudo eliminar la notificación");
    }
  };

  function normalizarRegistro(r) {
    const campos = [
      "ID_Archivo",
      "Título",
      "Tipo",
      "Fecha_Publicación",
      "Autor",
      "Descripción",
      "Adjunto",
      "URL_Archivo",
      "Destinatarios",
      "Vigente_Desde",
      "Vigente_Hasta",
      "Prioridad",
      "Estado",
      "Firma_Digital",
      "Visualizado_Por",
      "Fecha_Actualización",
      "Versión",
      "Confirmación_Recibido",
      "Link_Referencia"
    ];
    const registro = {};
    campos.forEach((c) => {
      registro[c] = r[c] || "-";
    });
    return registro;
  }

  const handleImport = (e) => {
    const file = e.target.files[0];
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) =>
        setNotificaciones(results.data.map(normalizarRegistro))
    });
  };

  function handleAdjuntoForm(e) {
    const file = e.target.files[0];
    if (!file) return;

    const extensionesPermitidas = [".pdf", ".jpg", ".jpeg", ".png"];
    const nombre = file.name.toLowerCase();
    const extensionValida = extensionesPermitidas.some((ext) =>
      nombre.endsWith(ext)
    );

    if (!extensionValida) {
      alert("Solo se permiten archivos PDF, JPG, JPEG o PNG.");
      e.target.value = "";
      return;
    }

    setNuevo((n) => ({
      ...n,
      Adjunto: file.name,
      archivoFile: file
    }));
  }

  const notificacionesPublicadas = (
    Array.isArray(notificaciones) ? notificaciones : []
  ).filter((n) => esPublicado(n.Vigente_Desde));

  const notificacionesPendientes = (
    Array.isArray(notificaciones) ? notificaciones : []
  ).filter((n) => esPendiente(n.Vigente_Desde));

  const totalNotificaciones = Array.isArray(notificaciones) ? notificaciones.length : 0;
const publicadas = notificacionesPublicadas.length;
const pendientes = notificacionesPendientes.length;

const notificacionesFiltradas =
  filtroEstado === "publicadas"
    ? notificacionesPublicadas
    : filtroEstado === "pendientes"
    ? notificacionesPendientes
    : Array.isArray(notificaciones)
    ? notificaciones
    : [];

  return (
  <div style={contenedor}>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "16px",
        flexWrap: "wrap",
        marginBottom: "20px",
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: "1.9rem",
            color: "#0f172a",
            fontWeight: 800,
          }}
        >
          Administración de Notificaciones
        </h2>
        <p
          style={{
            margin: "6px 0 0 0",
            color: "#64748b",
            fontSize: "0.97rem",
          }}
        >
          Crea, publica y consulta avisos, circulares y novedades del sistema.
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
          <strong style={resumenValor}>{totalNotificaciones}</strong>
        </div>

        <div style={resumenCard}>
          <span style={resumenLabel}>Publicadas</span>
          <strong style={{ ...resumenValor, color: "#166534" }}>{publicadas}</strong>
        </div>

        <div style={resumenCard}>
          <span style={resumenLabel}>Pendientes</span>
          <strong style={{ ...resumenValor, color: "#b45309" }}>{pendientes}</strong>
        </div>
      </div>
    </div>

    <div
      style={{
        background: "#f8fbff",
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        padding: "18px",
        marginBottom: "18px",
      }}
    >
      <h3
        style={{
          margin: "0 0 14px 0",
          color: "#0f172a",
          fontSize: "1.05rem",
        }}
      >
        Crear nueva notificación
      </h3>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          alignItems: "center",
        }}
      >
        <input
          placeholder="Título"
          value={nuevo.Título}
          onChange={(e) => setNuevo((n) => ({ ...n, Título: e.target.value }))}
          style={inputNotificacion}
        />

        <input
          placeholder="Tipo"
          value={nuevo.Tipo}
          onChange={(e) => setNuevo((n) => ({ ...n, Tipo: e.target.value }))}
          style={inputNotificacion}
        />

        <input
          placeholder="Autor"
          value={nuevo.Autor}
          onChange={(e) => setNuevo((n) => ({ ...n, Autor: e.target.value }))}
          style={{ ...inputNotificacion, minWidth: "180px" }}
        />

        <input
          placeholder="Descripción"
          value={nuevo.Descripción}
          onChange={(e) =>
            setNuevo((n) => ({ ...n, Descripción: e.target.value }))
          }
          style={{ ...inputNotificacion, minWidth: "260px" }}
        />

        <select
          value={nuevo.Destinatarios}
          onChange={(e) =>
            setNuevo((n) => ({ ...n, Destinatarios: e.target.value }))
          }
          style={{ ...inputNotificacion, minWidth: "220px" }}
        >
          <option value="Todos">Todos los propietarios</option>
          {habitantes.map((h, i) => {
            const nombre = h["Nombre completo"] || h.nombre || "Sin nombre";
            const documento = h["Documento"] || h.documento || "Sin documento";
            return (
              <option key={i} value={`${nombre} - ${documento}`}>
                {nombre} - {documento}
              </option>
            );
          })}
        </select>

        <input
          type="file"
          onChange={handleAdjuntoForm}
          style={{ fontSize: "0.9rem", color: "#334155" }}
          accept=".pdf,.jpg,.jpeg,.png"
        />

        <button
          type="button"
          onClick={handleAgregarNotificacion}
          style={botonPrincipal}
        >
          Agregar
        </button>

        <input
          type="file"
          accept=".csv"
          onChange={handleImport}
          style={{ fontSize: "0.9rem", color: "#334155" }}
        />

        <button
          onClick={() => setVisible((v) => !v)}
          style={botonSecundario}
        >
          {visible ? "Ocultar tabla" : "Mostrar tabla"}
        </button>
      </div>
    </div>

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
        Todas ({totalNotificaciones})
      </button>

      <button
        style={{
          ...chipFiltro,
          ...(filtroEstado === "publicadas" ? chipFiltroActivoVerde : {}),
        }}
        onClick={() => setFiltroEstado("publicadas")}
      >
        Publicadas ({publicadas})
      </button>

      <button
        style={{
          ...chipFiltro,
          ...(filtroEstado === "pendientes" ? chipFiltroActivoNaranja : {}),
        }}
        onClick={() => setFiltroEstado("pendientes")}
      >
        Pendientes ({pendientes})
      </button>
    </div>

      {usuario?.rol === "Administrador" && notificacionesPendientes.length > 0 && (
        <div
          style={{
            background: "#fffbe7",
            borderRadius: "10px",
            border: "1.5px solid #ffd37c",
            margin: "22px 0",
            padding: "1.1em"
          }}
        >
          <h3 style={{ color: "#ee8a18" }}>
            Notificaciones pendientes de publicación
          </h3>
          <table border={1} cellPadding={3} style={{ width: "100%", fontSize: ".93em" }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Título</th>
                <th>Tipo</th>
                <th>Vigente Desde</th>
                <th>Vigente Hasta</th>
                <th>Autor</th>
                <th>Gestión</th>
              </tr>
            </thead>
            <tbody>
              {notificacionesPendientes.map((n, i) => (
                <tr key={i}>
                  <td>{n.ID_Archivo || n.id}</td>
                  <td>{n.Título}</td>
                  <td>{n.Tipo}</td>
                  <td>{n.Vigente_Desde}</td>
                  <td>{n.Vigente_Hasta}</td>
                  <td>{n.Autor}</td>
                  <td>
                    <span style={{ color: "#ee8a18", fontWeight: "bold" }}>
                      Pendiente
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: ".96em", color: "#aa9002", marginTop: "1em" }}>
            Estas notificaciones están programadas para mostrarse el día asignado en
            "Vigente Desde". Antes de esa fecha solo tú como administrador puedes
            verlas y gestionarlas.
          </p>
        </div>
      )}

      {visible && (
        <table
          border={1}
          cellPadding={3}
          style={{ marginTop: "1em", width: "100%", fontSize: ".93em" }}
        >
          <thead>
            <tr>
              <th>ID</th>
              <th>Título</th>
              <th>Tipo</th>
              <th>Fecha Publicación</th>
              <th>Autor</th>
              <th>Descripción</th>
              <th>Adjunto</th>
              <th>Destinatarios</th>
              <th>Vigente Desde</th>
              <th>Vigente Hasta</th>
              <th>Prioridad</th>
              <th>Estado</th>
              <th>Firma Digital</th>
              <th>Visualizado Por</th>
              <th>Fecha Actualización</th>
              <th>Versión</th>
              <th>Confirmación Recibido</th>
              <th>Link Referencia</th>
              <th>Gestión Firmas</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {notificacionesPublicadas.map((n, i) => {
              const firmantes = FIRMANTES_POR_TIPO[n.Tipo?.trim()] || [];
              n.firmasEstado = n.firmasEstado || {};

              return (
                <tr key={i}>
                  <td>{n.ID_Archivo || n.id}</td>
                  <td>{n.Título}</td>
                  <td>{n.Tipo}</td>
                  <td>{formatoFecha(n.Fecha_Publicación || n.fecha)}</td>
                  <td>{n.Autor}</td>
                  <td>{n.Descripción}</td>
                  <td>
                    {n.Adjunto && n.Adjunto !== "-" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <a
                          href={`${API_BASE}/Notificaciones/${encodeURIComponent(n.Adjunto)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#007bff", textDecoration: "underline" }}
                        >
                          Ver archivo
                        </a>
                        <a
                          href={`${API_BASE}/Notificaciones/${encodeURIComponent(n.Adjunto)}`}
                          download={n.Adjunto}
                          style={{ color: "#28a745", textDecoration: "underline" }}
                        >
                          Descargar
                        </a>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td>{n.Destinatarios || "-"}</td>
                  <td>{formatoFecha(n.Vigente_Desde || "-")}</td>
                  <td>{formatoFecha(n.Vigente_Hasta || "-")}</td>
                  <td>{n.Prioridad || "-"}</td>
                  <td>{n.Estado || "-"}</td>
                  <td>{n.Firma_Digital || "-"}</td>
                  <td>{n.Visualizado_Por || "-"}</td>
                  <td>{formatoFecha(n.Fecha_Actualización || "-")}</td>
                  <td>{n.Versión || "-"}</td>
                  <td>{n.Confirmación_Recibido || "-"}</td>
                  <td>
                    {n.Link_Referencia && n.Link_Referencia !== "-" ? (
                      <a href={n.Link_Referencia} target="_blank" rel="noopener noreferrer">
                        Ver Enlace
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {firmantes.map((rol) => (
                      <span
                        key={rol}
                        style={{
                          display: "block",
                          color: n.firmasEstado[rol] ? "#089b3b" : "#d9324f",
                          fontWeight: n.firmasEstado[rol] ? "bold" : "normal",
                          marginBottom: 2
                        }}
                      >
                        {rol}: {n.firmasEstado[rol] ? "Firmado ✔️" : "Pendiente 🔶"}
                      </span>
                    ))}
                    {esFirmante(n, usuario) && !n.firmasEstado[usuario.rol] && (
                      <button
                        onClick={() => setFirmaModal({ notif: n, row: i })}
                        style={{
                          marginTop: "3px",
                          padding: "4px 14px",
                          borderRadius: "12px",
                          border: "none",
                          background: "#218290",
                          color: "#fff",
                          fontWeight: "bold"
                        }}
                      >
                        Firmar
                      </button>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => eliminarNotificacion(n.ID_Archivo || n.id)}
                      style={{
                        background: "#d1424a",
                        color: "#fff",
                        padding: "0.4em 0.9em",
                        borderRadius: "8px",
                        border: "none",
                        fontWeight: "bold",
                        cursor: "pointer"
                      }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
const contenedor = {
  padding: "24px",
};

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

const inputNotificacion = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  minWidth: "160px",
  fontSize: "0.92rem",
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
  padding: "10px 14px",
  fontWeight: 700,
  fontSize: "0.84rem",
  cursor: "pointer",
  whiteSpace: "nowrap",
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

const chipFiltroActivoNaranja = {
  background: "#ffedd5",
  color: "#c2410c",
  border: "1px solid #fdba74",
};

export default NotificacionesTable;