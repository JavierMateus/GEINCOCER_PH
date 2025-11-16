import React, { useState } from "react";
import Papa from "papaparse";
import SignatureCanvas from "react-signature-canvas";

// Pega aquí
function formatoFecha(valor) {
  if (!valor || valor === "-") return "-";

  // Si es número Excel tipo 45968 (días desde 1899-12-31)
  if (/^\d{5,}$/.test(valor)) {
    const dias = parseInt(valor, 10);
    if (isNaN(dias)) return valor;
    // Excel usa 1899-12-31 como base, pero hay un desfase de +1 día
    const fecha = new Date(1899, 11, 30 + dias); // 31 Dic 1899 + días
    const dia = String(fecha.getDate()).padStart(2, "0");
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  }

  // Si ya viene como string dd/mm/aaaa o d/m/aa
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(valor)) {
    const partes = valor.split("/");
    const dia = partes[0].padStart(2, "0");
    const mes = partes[1].padStart(2, "0");
    const anio = partes[2].length === 2 ? "20" + partes[2] : partes[2];
    return `${dia}/${mes}/${anio}`;
  }

  return valor;
}

// Define los firmantes por tipo fuera o importa si lo tienes
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
  Solicitud: ["Administrador"],
};

function esFirmante(n, usuario) {
  const firmantes = FIRMANTES_POR_TIPO[n.Tipo?.trim()] || [];
  return firmantes.includes(usuario.rol);
}

// ✅ FUNCIÓN DE FILTRO POR FECHA
function esPublicado(fechaVigenteDesde) {
  if (!fechaVigenteDesde || fechaVigenteDesde === "-") return true;
  const partes = fechaVigenteDesde.split("/");
  if (partes.length !== 3) return true;
  const fecha = new Date(+partes[2], partes[1] - 1, +partes[0]);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return fecha <= hoy;
}

// ✅ FILTRO DE PENDIENTES (solo futuras)
function esPendiente(fechaVigenteDesde) {
  if (!fechaVigenteDesde || fechaVigenteDesde === "-") return false;
  const partes = fechaVigenteDesde.split("/");
  if (partes.length !== 3) return false;
  const fecha = new Date(+partes[2], partes[1] - 1, +partes[0]);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return fecha > hoy;
}

function NotificacionesTable({ usuario }) {
  const [notificaciones, setNotificaciones] = useState([]);
  const [firmaModal, setFirmaModal] = useState(null);
  const [visible, setVisible] = useState(true);

  // Estado del formulario rápido
  const [nuevo, setNuevo] = useState({
    Título: "",
    Tipo: "",
    Adjunto: "",
    URL_Archivo: ""
  });

  function normalizarRegistro(r) {
    const campos = [
      "ID_Archivo","Título","Tipo","Fecha_Publicación","Autor","Descripción","Adjunto","URL_Archivo",
      "Destinatarios","Vigente_Desde","Vigente_Hasta","Prioridad","Estado","Firma_Digital",
      "Visualizado_Por","Fecha_Actualización","Versión","Confirmación_Recibido","Link_Referencia"
    ];
    const registro = {};
    campos.forEach(c => { registro[c] = r[c] || "-"; });
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
    if (file) {
      setNuevo(n => ({
        ...n,
        Adjunto: file.name,
        URL_Archivo: URL.createObjectURL(file)
      }));
    }
  }

  function agregarNotificacion() {
    if (!nuevo.Título || !nuevo.Tipo) return;
    setNotificaciones([
      {
        ID_Archivo: (notificaciones.length + 1).toString(),
        Título: nuevo.Título,
        Tipo: nuevo.Tipo,
        Fecha_Publicación: new Date().toLocaleDateString(),
        Autor: usuario?.nombre || "-",
        Descripción: "-",
        Adjunto: nuevo.Adjunto,
        URL_Archivo: nuevo.URL_Archivo,
        Destinatarios: "-",
        Vigente_Desde: new Date().toLocaleDateString(),
        Vigente_Hasta: "-",
        Prioridad: "-",
        Estado: "Pendiente",
        Firma_Digital: "-",
        Visualizado_Por: "-",
        Fecha_Actualización: "-",
        Versión: "-",
        Confirmación_Recibido: "-",
        Link_Referencia: "-"
      },
      ...notificaciones,
    ]);
    setNuevo({ Título: "", Tipo: "", Adjunto: "", URL_Archivo: "" });
  }

  // 🎯 FILTRADO PRINCIPAL
  const notificacionesPublicadas = notificaciones.filter(n =>
    esPublicado(n.Vigente_Desde)
  );
  const notificacionesPendientes = notificaciones.filter(n =>
    esPendiente(n.Vigente_Desde)
  );

  return (
    <div style={{ padding: "2em" }}>
      <h2>Gestión de Notificaciones / Circulares</h2>
      {/* Formulario rápida */}
      <div style={{
        background: "#f5fbff",
        borderRadius: "12px",
        padding: "1.2em",
        marginBottom: "2em"
      }}>
        <h3 style={{ margin: 0, marginBottom: "0.7em" }}>Agregar Nueva Notificación</h3>
        <input
          placeholder="Título"
          value={nuevo.Título}
          onChange={e => setNuevo(n => ({ ...n, Título: e.target.value }))}
          style={{ marginRight: "0.7em", padding: "0.4em", borderRadius: "7px", border: "1px solid #ccc" }}
        />
        <input
          placeholder="Tipo"
          value={nuevo.Tipo}
          onChange={e => setNuevo(n => ({ ...n, Tipo: e.target.value }))}
          style={{ marginRight: "0.7em", padding: "0.4em", borderRadius: "7px", border: "1px solid #ccc" }}
        />
        <input
          type="file"
          onChange={handleAdjuntoForm}
          style={{ marginRight: "0.7em" }}
          accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.pptx,.rar,.zip,.txt"
        />
        <button
          onClick={agregarNotificacion}
          style={{
            background: "#218290",
            color: "#fff",
            padding: "0.5em 1.2em",
            borderRadius: "10px",
            fontWeight: "bold", border: "none"
          }}>
          Agregar
        </button>
      </div>

      <input type="file" accept=".csv" onChange={handleImport} />
      <div style={{ display: "flex", justifyContent: "flex-end", margin: "0.7em 0 0 0" }}>
        <button
          onClick={() => setVisible(v => !v)}
          style={{
            background: "#218290",
            color: "#fff",
            padding: "8px 18px",
            borderRadius: "14px",
            border: "none",
            fontWeight: "bold",
            fontSize: "1em",
            cursor: "pointer",
            boxShadow: "0 2px 8px #c2d6e171"
          }}>
          {visible ? "Ocultar Tabla" : "Mostrar Tabla"}
        </button>
      </div>

      {/* PANEL DE PENDIENTES SOLO PARA ADMIN */}
      {usuario?.rol === "Administrador" && notificacionesPendientes.length > 0 && (
        <div style={{
          background: "#fffbe7",
          borderRadius: "10px",
          border: "1.5px solid #ffd37c",
          margin: "22px 0",
          padding: "1.1em"
        }}>
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
                  <td>{n.ID_Archivo}</td>
                  <td>{n.Título}</td>
                  <td>{n.Tipo}</td>
                  <td>{n.Vigente_Desde}</td>
                  <td>{n.Vigente_Hasta}</td>
                  <td>{n.Autor}</td>
                  <td>
                    <span style={{ color: "#ee8a18", fontWeight: "bold" }}>Pendiente</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: ".96em", color: "#aa9002", marginTop: "1em" }}>
            Estas notificaciones están programadas para mostrarse el día asignado en "Vigente Desde".
            Antes de esa fecha solo tú como administrador puedes verlas y gestionarlas.
          </p>
        </div>
      )}

      {visible && (
        <table border={1} cellPadding={3} style={{ marginTop: "1em", width: "100%", fontSize: ".93em" }}>
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
            </tr>
          </thead>
          <tbody>
            {notificacionesPublicadas.map((n, i) => {
              const firmantes = FIRMANTES_POR_TIPO[n.Tipo?.trim()] || [];
              n.firmasEstado = n.firmasEstado || {};
              return (
                <tr key={i}>
                  <td>{n.ID_Archivo}</td>
                  <td>{n.Título}</td>
                  <td>{n.Tipo}</td>
                  <td>{formatoFecha(n.Fecha_Publicación)}</td>
                  <td>{n.Autor}</td>
                  <td>{n.Descripción}</td>
                  <td>
                    {n.Adjunto && n.URL_Archivo !== "-" ? (
                      <a href={n.URL_Archivo} target="_blank" rel="noopener noreferrer">{n.Adjunto}</a>
                    ) : (n.Adjunto !== "-" ? n.Adjunto : "-")}
                  </td>
                  <td>{n.Destinatarios}</td>
                  <td>{formatoFecha(n.Vigente_Desde)}</td>
                  <td>{formatoFecha(n.Vigente_Hasta)}</td>
                  <td>{n.Prioridad}</td>
                  <td>{n.Estado}</td>
                  <td>{n.Firma_Digital}</td>
                  <td>{n.Visualizado_Por}</td>
                  <td>{formatoFecha(n.Fecha_Actualización)}</td>
                  <td>{n.Versión}</td>
                  <td>{n.Confirmación_Recibido}</td>
                  <td>{n.Link_Referencia !== "-" ? (<a href={n.Link_Referencia} target="_blank" rel="noopener noreferrer">Ver Enlace</a>) : "-"}</td>
                  <td>
                    {firmantes.map((rol) => (
                      <span key={rol}
                        style={{
                          display: "block",
                          color: n.firmasEstado[rol] ? "#089b3b" : "#d9324f",
                          fontWeight: n.firmasEstado[rol] ? "bold" : "normal",
                          marginBottom: 2
                        }}>
                        {rol}: {n.firmasEstado[rol] ? "Firmado ✔️" : "Pendiente 🔶"}
                      </span>
                    ))}
                    {esFirmante(n, usuario) && !n.firmasEstado[usuario.rol] && (
                      <button onClick={() => setFirmaModal({ notif: n, row: i })}
                        style={{
                          marginTop: "3px", padding: "4px 14px",
                          borderRadius: "12px", border: "none",
                          background: "#218290", color: "#fff", fontWeight: "bold"
                        }}>
                        Firmar
                      </button>
                    )}
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

export default NotificacionesTable;
