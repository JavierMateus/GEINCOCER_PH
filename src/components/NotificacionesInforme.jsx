// src/components/NotificacionesInforme.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";

// 🔹 Formato de fechas
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

// 🔹 Normalizar registro
function normalizarRegistro(r, usuario) {
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
    "Link_Referencia",
  ];

  const registro = {};
  campos.forEach((c) => {
    registro[c] = r[c] || "-";
  });

  if (!registro.Autor || registro.Autor === "-") {
    registro.Autor = usuario?.nombre || "-";
  }

  return registro;
}

function NotificacionesInforme({ usuario, onClose }) {
  const [ordenFecha, setOrdenFecha] = useState("desc");
  const toggleOrdenFecha = () =>{setOrdenFecha ((prev) => (prev === "desc" ? "asc" : "desc"));};
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  
    const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [visibleTabla, setVisibleTabla] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const [nuevo, setNuevo] = useState({
    Título: "",
    Tipo: "",
    Autor: "",
    Descripción: "",
    Adjunto: "",
    URL_Archivo: "",
  });

  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);

  useEffect(() => {
    if (!onClose) return;

    const avisoMs = 4.5 * 60 * 1000;
    const cierreMs = 5 * 60 * 1000;

    const avisoTimer = setTimeout(() => {
      alert("El informe de notificaciones se cerrará automáticamente en 30 segundos.");
    }, avisoMs);

    const cierreTimer = setTimeout(() => {
      onClose();
    }, cierreMs);

    return () => {
      clearTimeout(avisoTimer);
      clearTimeout(cierreTimer);
    };
  }, [onClose]);

  useEffect(() => {
  const fetchData = async () => {
    try {
      setCargando(true);
      setError(null);
      const resp = await axios.get("http://localhost:4000/api/notificaciones");
      const data = Array.isArray(resp.data) ? resp.data : [];
      
      // Asignar ID temporal a notificaciones sin ID
      const dataNormalizada = data.map((r, index) => {
        const normalizada = normalizarRegistro(r, usuario);
        
        // Si no tiene ID válido, crear uno temporal
        if (!normalizada.ID_Archivo || normalizada.ID_Archivo === "-") {
          normalizada.ID_Archivo = `temp-${Date.now()}-${index}`;
        }
        if (!normalizada.id || normalizada.id === "-") {
          normalizada.id = normalizada.ID_Archivo;
        }
        
        return normalizada;
      });
      
      setNotificaciones(dataNormalizada);
    } catch (err) {
      console.error("Error cargando notificaciones", err);
      setError("No se pudieron cargar las notificaciones");
      setNotificaciones([]);
    } finally {
      setCargando(false);
    }
  };

  fetchData();
}, [usuario]);
  function obtenerEstado(notif) {
    return notif.Estado || "Sin estado";
  }

  function estaDentroDeRango(notif) {
    if (!filtroDesde && !filtroHasta) return true;

    const base =
      formatoFecha(notif.Vigente_Desde) !== "-"
        ? formatoFecha(notif.Vigente_Desde)
        : formatoFecha(notif.Fecha_Publicación);

    if (base === "-") return true;

    const [d, m, a] = base.split("/");
    const fechaNotif = new Date(parseInt(a), parseInt(m) - 1, parseInt(d));
    fechaNotif.setHours(0, 0, 0, 0);

    if (filtroDesde) {
      const d1 = new Date(filtroDesde);
      d1.setHours(0, 0, 0, 0);
      if (fechaNotif < d1) return false;
    }

    if (filtroHasta) {
      const d2 = new Date(filtroHasta);
      d2.setHours(0, 0, 0, 0);
      if (fechaNotif > d2) return false;
    }

    return true;
  }

  function cumpleFiltroEstado(notif) {
    if (filtroEstado === "todos") return true;
    const estado = (obtenerEstado(notif) || "").toLowerCase();

    if (filtroEstado === "pendiente") {
      return estado.includes("pend") || estado === "";
    }

    if (filtroEstado === "publicado") {
      return estado.includes("public") || estado.includes("vigente");
    }

    return true;
  }

 const convertirFechaAOrden = (valor) => {
  const fecha = formatoFecha(valor);
  if (!fecha || fecha === "-") return 0;

  const partes = fecha.split("/");
  if (partes.length !== 3) return 0;

  const [d, m, a] = partes;
  return new Date(Number(a), Number(m) - 1, Number(d)).getTime();
};

const notificacionesFiltradas = (Array.isArray(notificaciones) ? notificaciones : [])
  .filter((n) => {
    const textoBusqueda = busqueda.toLowerCase().trim();

    const coincideBusqueda =
      !textoBusqueda ||
      String(n.Título || "").toLowerCase().includes(textoBusqueda) ||
      String(n.Autor || "").toLowerCase().includes(textoBusqueda) ||
      String(n.Descripción || "").toLowerCase().includes(textoBusqueda);

    return cumpleFiltroEstado(n) && estaDentroDeRango(n) && coincideBusqueda;
  })
  .sort((a, b) => {
    const fechaA = convertirFechaAOrden(a.Vigente_Desde || a.Fecha_Publicación);
    const fechaB = convertirFechaAOrden(b.Vigente_Desde || b.Fecha_Publicación);
    return fechaB - fechaA;
  });

  const totalNotificaciones = notificaciones.length;
const publicadas = notificaciones.filter((n) =>
  (obtenerEstado(n) || "").toLowerCase().includes("public")
).length;

const pendientes = notificaciones.filter((n) =>
  (obtenerEstado(n) || "").toLowerCase().includes("pend")
).length;

  function handleAdjuntoForm(e) {
    const file = e.target.files[0];
    if (file) {
      setArchivoSeleccionado(file);
      setNuevo((n) => ({
        ...n,
        Adjunto: file.name,
      }));
    }
  }

  async function handleAgregarNotificacion() {
    if (!nuevo.Título || !nuevo.Tipo) {
      alert("Título y Tipo son obligatorios");
      return;
    }

    try {
      let nombreAdjunto = nuevo.Adjunto;
      let urlArchivo = nuevo.URL_Archivo;

      if (archivoSeleccionado) {
        const formData = new FormData();
        formData.append("file", archivoSeleccionado);

        try {
          const uploadResp = await axios.post(
            "http://localhost:4000/api/notificaciones/upload",
            formData,
            { headers: { "Content-Type": "multipart/form-data" } }
          );

          nombreAdjunto = uploadResp.data.nombreArchivo || archivoSeleccionado.name;
          urlArchivo = uploadResp.data.url || `/Notificaciones/${nombreAdjunto}`;
        } catch (errUpload) {
          console.warn("No se pudo subir el archivo, se usará solo el nombre local", errUpload);
          nombreAdjunto = archivoSeleccionado.name;
          urlArchivo = `/Notificaciones/${nombreAdjunto}`;
        }
      }

      const hoy = new Date().toLocaleDateString("es-CO");

      const nuevaNotif = {
        ID_Archivo: Date.now().toString(),
        Título: nuevo.Título,
        Tipo: nuevo.Tipo,
        Fecha_Publicación: hoy,
        Autor: nuevo.Autor || usuario?.nombre || "-",
        Descripción: nuevo.Descripción || "-",
        Adjunto: nombreAdjunto || "-",
        URL_Archivo: urlArchivo || "-",
        Destinatarios: "-",
        Vigente_Desde: hoy,
        Vigente_Hasta: "-",
        Prioridad: "-",
        Estado: "Publicado",
        Firma_Digital: "-",
        Visualizado_Por: "-",
        Fecha_Actualización: "-",
        Versión: "-",
        Confirmación_Recibido: "-",
        Link_Referencia: "-",
      };

      const resp = await axios.post(
        "http://localhost:4000/api/notificaciones",
        nuevaNotif
      );

      const guardada = normalizarRegistro(resp.data?.notificacion || nuevaNotif, usuario);

      setNotificaciones((prev) => [...prev, guardada]);

      setNuevo({
        Título: "",
        Tipo: "",
        Autor: "",
        Descripción: "",
        Adjunto: "",
        URL_Archivo: "",
      });

      setArchivoSeleccionado(null);

      const fileInput = document.getElementById("input-adjunto-notif");
      if (fileInput) fileInput.value = "";

      alert("Notificación creada correctamente");
    } catch (error) {
      console.error("Error creando notificación:", error);
      alert("No se pudo crear la notificación");
    }
  }

  async function handleEliminarNotificacion(id) {
  const confirmar = window.confirm("¿Deseas eliminar esta notificación?");
  if (!confirmar) return;

  const esTemporal = String(id).startsWith("temp-");

  try {
    if (!esTemporal) {
      await axios.delete(`http://localhost:4000/api/notificaciones/${id}`);
    }

    setNotificaciones((prev) =>
      prev.filter((n) => String(n.ID_Archivo || n.id) !== String(id))
    );

    alert("Notificación eliminada correctamente");
  } catch (error) {
    console.error("Error eliminando notificación:", error);

    if (error?.response?.status === 404) {
      setNotificaciones((prev) =>
        prev.filter((n) => String(n.ID_Archivo || n.id) !== String(id))
      );
      alert("La notificación no existía en backend, pero se eliminó de la vista.");
      return;
    }

    alert("No se pudo eliminar la notificación");
  }
}
  const handleExportarExcel = () => {
    if (!notificacionesFiltradas.length) {
      alert("No hay datos para exportar");
      return;
    }

    const datosPlano = notificacionesFiltradas.map((n) => ({
      ID_Archivo: n.ID_Archivo || "",
      Título: n.Título || "",
      Tipo: n.Tipo || "",
      Fecha_Publicación: formatoFecha(n.Fecha_Publicición || n.Fecha_Publicación),
      Autor: n.Autor || "",
      Descripción: n.Descripción || "",
      Adjunto: n.Adjunto || "",
      Destinatarios: n.Destinatarios || "",
      Vigente_Desde: formatoFecha(n.Vigente_Desde),
      Vigente_Hasta: formatoFecha(n.Vigente_Hasta),
      Prioridad: n.Prioridad || "",
      Estado: obtenerEstado(n),
    }));

    const ws = XLSX.utils.json_to_sheet(datosPlano);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Notificaciones");
    XLSX.writeFile(wb, "Informe_Notificaciones.xlsx");
  };

  const handleExportarPDF = () => {
    alert("Exportar a PDF: pendiente de implementar (jsPDF o similar).");
  };

  const parseFecha = (valor) => {
  if (!valor) return new Date(0);

  const texto = String(valor).trim();
  const partes = texto.split("/");

  if (partes.length === 3) {
    const [dia, mes, anio] = partes;
    return new Date(Number(anio), Number(mes) - 1, Number(dia));
  }

  return new Date(texto);
};

const obtenerFechaPublicacion = (n) =>
  n.Fecha_Publicación || n["Fecha publicación"] || n.fecha || "";

const notificacionesOrdenadas = [...notificacionesFiltradas].sort((a, b) => {
  const fechaA = parseFecha(obtenerFechaPublicacion(a));
  const fechaB = parseFecha(obtenerFechaPublicacion(b));

  return ordenFecha === "desc"
    ? fechaB - fechaA
    : fechaA - fechaB;
});

  return (
    <div style={{ padding: "2em" }}>
     <div style={{ marginBottom: "1.2em" }}>
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

  <div
  style={{
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "1.5em",
  }}
>
  <div
    onClick={() => setFiltroEstado("todos")}
    style={{
      background: filtroEstado === "todos" ? "#dbeafe" : "#f8fafc",
      border: filtroEstado === "todos" ? "1px solid #93c5fd" : "1px solid #e2e8f0",
      borderRadius: "14px",
      padding: "12px 14px",
      minWidth: "120px",
      cursor: "pointer",
      transition: "all 0.2s ease",
    }}
  >
    <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>
      Total
    </div>
    <div style={{ fontSize: "1.2rem", color: "#0f172a", fontWeight: 800 }}>
      {totalNotificaciones}
    </div>
  </div>

  <div
    onClick={() => setFiltroEstado("publicado")}
    style={{
      background: filtroEstado === "publicado" ? "#dcfce7" : "#f8fafc",
      border: filtroEstado === "publicado" ? "1px solid #86efac" : "1px solid #e2e8f0",
      borderRadius: "14px",
      padding: "12px 14px",
      minWidth: "120px",
      cursor: "pointer",
      transition: "all 0.2s ease",
    }}
  >
    <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>
      Publicadas
    </div>
    <div style={{ fontSize: "1.2rem", color: "#166534", fontWeight: 800 }}>
      {publicadas}
    </div>
  </div>

  <div
    onClick={() => setFiltroEstado("pendiente")}
    style={{
      background: filtroEstado === "pendiente" ? "#ffedd5" : "#f8fafc",
      border: filtroEstado === "pendiente" ? "1px solid #fdba74" : "1px solid #e2e8f0",
      borderRadius: "14px",
      padding: "12px 14px",
      minWidth: "120px",
      cursor: "pointer",
      transition: "all 0.2s ease",
    }}
  >
    <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>
      Pendientes
    </div>
    <div style={{ fontSize: "1.2rem", color: "#b45309", fontWeight: 800 }}>
      {pendientes}
    </div>
  </div>
</div>
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

  {usuario?.rol === "Administrador" && (
  <div
    style={{
      background: "#f5fbff",
      borderRadius: "12px",
      padding: "1.2em",
      marginBottom: "1.5em",
    }}
  >
          <h3 style={{ margin: 0, marginBottom: "0.7em" }}>
            Crear nueva notificación
          </h3>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.7em" }}>
            <input
              placeholder="Título"
              value={nuevo.Título}
              onChange={(e) => setNuevo((n) => ({ ...n, Título: e.target.value }))}
              style={{
                padding: "0.4em",
                borderRadius: "7px",
                border: "1px solid #ccc",
                minWidth: "180px",
              }}
            />

            <input
              placeholder="Tipo (Circular, Aviso, etc.)"
              value={nuevo.Tipo}
              onChange={(e) => setNuevo((n) => ({ ...n, Tipo: e.target.value }))}
              style={{
                padding: "0.4em",
                borderRadius: "7px",
                border: "1px solid #ccc",
                minWidth: "160px",
              }}
            />

            <input
              placeholder="Autor (opcional)"
              value={nuevo.Autor}
              onChange={(e) => setNuevo((n) => ({ ...n, Autor: e.target.value }))}
              style={{
                padding: "0.4em",
                borderRadius: "7px",
                border: "1px solid #ccc",
                minWidth: "160px",
              }}
            />

            <input
              placeholder="Descripción (opcional)"
              value={nuevo.Descripción}
              onChange={(e) =>
                setNuevo((n) => ({ ...n, Descripción: e.target.value }))
              }
              style={{
                padding: "0.4em",
                borderRadius: "7px",
                border: "1px solid #ccc",
                minWidth: "220px",
              }}
            />

            <input
              id="input-adjunto-notif"
              type="file"
              onChange={handleAdjuntoForm}
              style={{ padding: "0.2em" }}
              accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.pptx,.rar,.zip,.txt"
            />

            <button
              type="button"
              onClick={handleAgregarNotificacion}
              style={{
                background: "#218290",
                color: "#fff",
                padding: "0.5em 1.2em",
                borderRadius: "10px",
                fontWeight: "bold",
                border: "none",
                cursor: "pointer",
                alignSelf: "center",
              }}
            >
              Agregar
            </button>
          </div>
        </div>
      )}

      <div
  style={{
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "14px 16px",
    marginBottom: "1.2em",
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    alignItems: "center",
  }}
>
        <div>
          <label style={{ fontWeight: "bold", marginRight: "0.4em" }}>
            Estado:
          </label>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            style={{
              padding: "0.4em",
              borderRadius: "7px",
              border: "1px solid #ccc",
              minWidth: "140px",
            }}
          >
            <option value="todos">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="publicado">Publicados/Vigentes</option>
          </select>
        </div>

        <div>
          <label style={{ fontWeight: "bold", marginRight: "0.4em" }}>
            Desde:
          </label>
          <input
            type="date"
            value={filtroDesde}
            onChange={(e) => setFiltroDesde(e.target.value)}
            style={{
              padding: "0.4em",
              borderRadius: "7px",
              border: "1px solid #ccc",
            }}
          />
        </div>

        <div>
          <label style={{ fontWeight: "bold", marginRight: "0.4em" }}>
            Hasta:
          </label>
          <input
            type="date"
            value={filtroHasta}
            onChange={(e) => setFiltroHasta(e.target.value)}
            style={{
              padding: "0.4em",
              borderRadius: "7px",
              border: "1px solid #ccc",
            }}
          />
        </div>

        <input
  type="text"
  placeholder="Buscar por título, autor o descripción"
  value={busqueda}
  onChange={(e) => setBusqueda(e.target.value)}
  style={{
    padding: "0.45em 0.75em",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    minWidth: "260px",
    background: "#fff",
    color: "#0f172a",
  }}
/>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.6em" }}>
          <button
            onClick={() => setVisibleTabla((v) => !v)}
            style={{
              background: "#218290",
              color: "#fff",
              padding: "0.45em 1.1em",
              borderRadius: "10px",
              border: "none",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            {visibleTabla ? "Ocultar tabla" : "Mostrar tabla"}
          </button>

          <button
            onClick={handleExportarExcel}
            style={{
              background: "#1f7e4d",
              color: "#fff",
              padding: "0.45em 1.1em",
              borderRadius: "10px",
              border: "none",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Exportar Excel
          </button>

          <button
            onClick={handleExportarPDF}
            style={{
              background: "#b5243a",
              color: "#fff",
              padding: "0.45em 1.1em",
              borderRadius: "10px",
              border: "none",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Exportar PDF
          </button>
        </div>
      </div>

      {cargando && <p>Cargando notificaciones...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!cargando && !error && visibleTabla && (
  <>
    <div
      style={{
        marginBottom: "10px",
        color: "#475569",
        fontSize: "0.92rem",
        fontWeight: 600,
      }}
    >
      Mostrando {notificacionesFiltradas.length} notificacion
      {notificacionesFiltradas.length === 1 ? "" : "es"}
    </div>

    <div
      style={{
        overflowX: "auto",
        maxHeight: "520px",
        overflowY: "auto",
        borderRadius: "14px",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: "0",
          fontSize: "0.92em",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          overflow: "hidden",
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        }}
      >
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            <th
              style={{
                borderBottom: "1px solid #e2e8f0",
                padding: "10px 8px",
                textAlign: "left",
                fontSize: "0.78rem",
                color: "#475569",
                fontWeight: 700,
                whiteSpace: "nowrap",
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: "#f8fafc",
              }}
            >
              ID
            </th>
            <th
              style={{
                borderBottom: "1px solid #e2e8f0",
                padding: "10px 8px",
                textAlign: "left",
                fontSize: "0.78rem",
                color: "#475569",
                fontWeight: 700,
                whiteSpace: "nowrap",
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: "#f8fafc",
              }}
            >
              Título
            </th>
            <th
              style={{
                borderBottom: "1px solid #e2e8f0",
                padding: "10px 8px",
                textAlign: "left",
                fontSize: "0.78rem",
                color: "#475569",
                fontWeight: 700,
                whiteSpace: "nowrap",
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: "#f8fafc",
              }}
            >
              Tipo
            </th>
           <th
  style={{
    borderBottom: "1px solid #e2e8f0",
    padding: "10px 8px",
    textAlign: "left",
    fontSize: "0.78rem",
    color: "#475569",
    fontWeight: 700,
    whiteSpace: "nowrap",
    position: "sticky",
    top: 0,
    zIndex: 2,
    background: "#f8fafc",
  }}
>
  Tipo
</th>

<th
  aria-sort={ordenFecha === "desc" ? "descending" : "ascending"}
  style={{
    borderBottom: "2px solid #cbd5e1",
    padding: "10px 8px",
    textAlign: "left",
    fontSize: "0.78rem",
    color: "#475569",
    fontWeight: 700,
    whiteSpace: "nowrap",
    position: "sticky",
    top: 0,
    zIndex: 2,
    background: "#f8fafc",
  }}
>
  <button
    type="button"
    onClick={toggleOrdenFecha}
    title="Ordenar por fecha"
    style={{
      background: "none",
      border: "none",
      cursor: "pointer",
      fontWeight: 700,
      color: "#0f172a",
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: 0,
      whiteSpace: "nowrap",
    }}
  >
    <span>Fecha publicación</span>
    <span
      aria-hidden="true"
      style={{
        color: "#0f766e",
        fontWeight: 800,
        fontSize: "0.9rem",
      }}
    >
      {ordenFecha === "desc" ? "↓" : "↑"}
    </span>
  </button>
</th>

<th
  style={{
    borderBottom: "1px solid #e2e8f0",
    padding: "10px 8px",
    textAlign: "left",
    fontSize: "0.78rem",
    color: "#475569",
    fontWeight: 700,
    whiteSpace: "nowrap",
    position: "sticky",
    top: 0,
    zIndex: 2,
    background: "#f8fafc",
  }}
>
  Autor
</th>

<th
  style={{
    borderBottom: "1px solid #e2e8f0",
    padding: "10px 8px",
    textAlign: "left",
    fontSize: "0.78rem",
    color: "#475569",
    fontWeight: 700,
    whiteSpace: "nowrap",
    position: "sticky",
    top: 0,
    zIndex: 2,
    background: "#f8fafc",
  }}
>
  Descripción
</th>
            <th
              style={{
                borderBottom: "1px solid #e2e8f0",
                padding: "10px 8px",
                textAlign: "left",
                fontSize: "0.78rem",
                color: "#475569",
                fontWeight: 700,
                whiteSpace: "nowrap",
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: "#f8fafc",
              }}
            >
              Adjunto
            </th>
            <th
              style={{
                borderBottom: "1px solid #e2e8f0",
                padding: "10px 8px",
                textAlign: "left",
                fontSize: "0.78rem",
                color: "#475569",
                fontWeight: 700,
                whiteSpace: "nowrap",
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: "#f8fafc",
              }}
            >
              Estado
            </th>
            <th
              style={{
                borderBottom: "1px solid #e2e8f0",
                padding: "10px 8px",
                textAlign: "left",
                fontSize: "0.78rem",
                color: "#475569",
                fontWeight: 700,
                whiteSpace: "nowrap",
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: "#f8fafc",
              }}
            >
              Vigente desde
            </th>
            <th
              style={{
                borderBottom: "1px solid #e2e8f0",
                padding: "10px 8px",
                textAlign: "left",
                fontSize: "0.78rem",
                color: "#475569",
                fontWeight: 700,
                whiteSpace: "nowrap",
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: "#f8fafc",
              }}
            >
              Vigente hasta
            </th>
            <th
              style={{
                borderBottom: "1px solid #e2e8f0",
                padding: "10px 8px",
                textAlign: "left",
                fontSize: "0.78rem",
                color: "#475569",
                fontWeight: 700,
                whiteSpace: "nowrap",
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: "#f8fafc",
              }}
            >
              Acciones
            </th>
          </tr>
        </thead>

        <tbody>
          {notificacionesOrdenadas.length > 0 ? (
           notificacionesOrdenadas.map((n, index) => (
              <tr key={index}>
                <td
                  style={{
                    borderBottom: "1px solid #eef2f7",
                    padding: "10px 8px",
                    verticalAlign: "top",
                    color: "#0f172a",
                  }}
                >
                  {n.ID || n.Id || n.id || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #eef2f7",
                    padding: "10px 8px",
                    verticalAlign: "top",
                    color: "#0f172a",
                  }}
                >
                  {n.Título || n.Titulo || "Sin título"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #eef2f7",
                    padding: "10px 8px",
                    verticalAlign: "top",
                    color: "#0f172a",
                  }}
                >
                  {n.Tipo || "No disponible"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #eef2f7",
                    padding: "10px 8px",
                    verticalAlign: "top",
                    color: "#0f172a",
                  }}
                >
                  {formatoFecha(obtenerFechaPublicacion(n))}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #eef2f7",
                    padding: "10px 8px",
                    verticalAlign: "top",
                    color: "#0f172a",
                  }}
                >
                  {n.Autor || "No disponible"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #eef2f7",
                    padding: "10px 8px",
                    verticalAlign: "top",
                    color: "#0f172a",
                  }}
                >
                  {n.Descripción || n.Descripcion || "Sin descripción"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #eef2f7",
                    padding: "10px 8px",
                    verticalAlign: "top",
                    color: "#0f172a",
                  }}
                >
                  {n.Adjunto ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        lineHeight: 1.2,
                      }}
                    >
                      <a
                        href={
                          n.URL_Archivo && n.URL_Archivo !== "-"
                            ? `http://localhost:4000${n.URL_Archivo}`
                            : `http://localhost:4000/Notificaciones/${encodeURIComponent(n.Adjunto)}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "#2563eb",
                          textDecoration: "none",
                          fontWeight: 600,
                          fontSize: "0.84rem",
                        }}
                      >
                        Ver archivo
                      </a>

                      <a
                        href={
                          n.URL_Archivo && n.URL_Archivo !== "-"
                            ? `http://localhost:4000${n.URL_Archivo}`
                            : `http://localhost:4000/Notificaciones/${encodeURIComponent(n.Adjunto)}`
                        }
                        download={n.Adjunto}
                        style={{
                          color: "#16a34a",
                          textDecoration: "none",
                          fontWeight: 600,
                          fontSize: "0.84rem",
                        }}
                      >
                        Descargar
                      </a>
                    </div>
                  ) : (
                    <span style={{ color: "#64748b" }}>Sin adjunto</span>
                  )}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #eef2f7",
                    padding: "10px 8px",
                    verticalAlign: "top",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      padding: "4px 10px",
                      borderRadius: "999px",
                      background:
                        obtenerEstado(n).toLowerCase().includes("public") ? "#dcfce7" : "#ffedd5",
                      color:
                        obtenerEstado(n).toLowerCase().includes("public") ? "#166534" : "#b45309",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {obtenerEstado(n)}
                  </span>
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #eef2f7",
                    padding: "10px 8px",
                    verticalAlign: "top",
                    color: "#0f172a",
                  }}
                >
                  {formatoFecha(n.Vigente_Desde || n["Vigente desde"])}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #eef2f7",
                    padding: "10px 8px",
                    verticalAlign: "top",
                    color: "#0f172a",
                  }}
                >
                  {formatoFecha(n.Vigente_Hasta || n["Vigente hasta"])}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #eef2f7",
                    padding: "10px 8px",
                    verticalAlign: "top",
                    color: "#0f172a",
                  }}
                >
                  <button
  onClick={() => handleEliminarNotificacion(n.ID_Archivo || n.id)}
  style={{
    background: "#dc2626",
    color: "#fff",
    padding: "0.35em 0.8em",
    borderRadius: "999px",
    border: "none",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "0.82rem",
    boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
  }}
>
  Eliminar
</button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
  colSpan="11"
  style={{
    padding: "14px",
    color: "#64748b",
    textAlign: "center",
  }}
>
  No hay notificaciones que coincidan con los filtros seleccionados.
</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </>
)}

  </div>
);
}          
    
export default NotificacionesInforme;