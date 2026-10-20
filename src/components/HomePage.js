import PanelSeguridad from "./PanelSeguridad";
import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
//import logoImg from "../assets/logo.jpg";
import BotonImportacion from "./BotonImportacion";
import axios from "axios";
import NotificacionesTable from "./NotificacionesTable";
import PanelResidente from "./PanelResidente";
import { Link } from "react-router-dom";
import { FaMoneyBillWave } from "react-icons/fa";
import PanelPagosCard from "./PanelPagosCard";
import { API_BASE } from "../config";
import CargaInventario, { descargarPlantillaInventario } from "./CargaInventario";
import PanelMantenimiento from "./PanelMantenimiento";
import { guardarToken, borrarToken } from "../sesion";

// Componentes internos
import PagosMorosidadPanel from "./PagosMorosidadPanel";
import AdminDashboard from "./AdminDashboard";
import TablaImportada from "./TablaImportada";
import PagosPanel from "./PagosPanel";
import GraficosMorosidad from "./GraficosMorosidad";
import InformeMorosidad from "./InformeMorosidad";
import CambiarPin from "./CambiarPin";
import RestablecerPin from "./RestablecerPin";
import CargaHabitantes from "./CargaHabitantes";
import TablaHabitantes from "./TablaHabitantes";
import GenerarCuotas from "./GenerarCuotas";

// Estilo de botón para elegir rol
const roleBtnStyle = {
  width: "170px",
  minHeight: "110px",
  padding: "2em 1.5em",
  margin: "0.5em",
  border: "2px solid #218290",
  borderRadius: "16px",
  background: "transparent",
  color: "#fff",
  fontWeight: "bold",
  fontSize: "1.1em",
  boxShadow: "0 4px 18px #21829020",
  transition: "background 0.15s, box-shadow 0.15s",
  cursor: "pointer",
};

function HomePage() {
  console.log("CARGANDO HomePage CORRECTO");
  // Estados principales (datos y UI)
  const [usuario, setUsuario] = useState(null);
  const [error, setError] = useState("");
  // Ingreso: documento + PIN (o nombre completo en el primer ingreso)
  const [formData, setFormData] = useState({ documento: "", clave: "" });
  const [claveIngreso, setClaveIngreso] = useState("");
  const [ingresando, setIngresando] = useState(false);
  const [mostrarClave, setMostrarClave] = useState(false);
  const [mostrarCambiarPin, setMostrarCambiarPin] = useState(false);
  const [mostrarRestablecerPin, setMostrarRestablecerPin] = useState(false);
  const [archivoHabitantes, setArchivoHabitantes] = useState(null);
  const [archivoInventario, setArchivoInventario] = useState(null);
  const [mostrarGenerarCuotas, setMostrarGenerarCuotas] = useState(false);
  const [habitantes, setHabitantes] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [parqueaderos, setParqueaderos] = useState([]);
  const [incidentes, setIncidentes] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [hoverBtn, setHoverBtn] = useState("");
  const [tablaActiva, setTablaActiva] = useState("");

  // Filtros morosidad
  const [filtroEstadoMorosidad, setFiltroEstadoMorosidad] = useState("Mora");
  const [filtroFechaMorosidad, setFiltroFechaMorosidad] = useState("");

  // Ver solo morosos
  const [verSoloMorosos, setVerSoloMorosos] = useState(false);

  // 🔄 Nueva función: recargar pagos desde backend
  const recargarPagos = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/pagos`);
      setPagos(response.data);
    } catch (error) {
      console.log("Usando pagos locales");
    }
  };
  // 🔄 Cargar notificaciones desde backend
  const recargarNotificaciones = async () => {
    try {
      const resp = await axios.get(
        `${API_BASE}/api/notificaciones`
      );
      setNotificaciones(resp.data);
    } catch (error) {
      console.error(
        "No se pudieron cargar notificaciones desde backend",
        error
      );
    }
  };

  // Llamar a recargarPagos al montar la página
  useEffect(() => {
    recargarPagos();
    recargarNotificaciones();
  }, []);

  // Filtrado memoizado para panel de morosidad
  const pagosFiltradosMorosidad = React.useMemo(() => {
  const listaPagos = Array.isArray(pagos) ? pagos : [];
  return listaPagos.filter((pago) => {
    const coincideEstado =
      filtroEstadoMorosidad === "" || pago.Estado === filtroEstadoMorosidad;
    const coincideFecha =
      filtroFechaMorosidad === "" ||
      (pago["Fecha de pago"] &&
        pago["Fecha de pago"].startsWith(filtroFechaMorosidad));
    return coincideEstado && coincideFecha;
  });
}, [pagos, filtroEstadoMorosidad, filtroFechaMorosidad]);

const pagosMorosos = React.useMemo(() => {
  const listaPagos = Array.isArray(pagos) ? pagos : [];
  return listaPagos.filter((p) =>
    String(p.Estado || p.estado || "").toLowerCase().includes("mora")
  );
}, [pagos]);

  const pagosParaTabla = verSoloMorosos
  ? pagosMorosos
  : Array.isArray(pagos)
    ? pagos
    : [];

      // Si el servidor responde que la sesión no es válida o expiró, se vuelve a la pantalla de ingreso.
  useEffect(() => {
    const alExpirar = () => {
      setUsuario(null);
      alert("Tu sesión expiró. Ingresa de nuevo.");
    };
    window.addEventListener("sesion-expirada", alExpirar);
    return () => window.removeEventListener("sesion-expirada", alExpirar);
  }, []);
  
    // Limpieza única: borra la copia de habitantes que versiones anteriores dejaron en el navegador.
  useEffect(() => {
    localStorage.removeItem("habitantes");
  }, []);

  // ⬇️ desde aquí sigue tu handleInputChange, handleSelectRole, etc.


  // Actualiza formData cuando se escribe en los inputs
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

    // Al cerrar sesion se borra lo escrito en el ingreso.
  useEffect(() => {
    if (!usuario) {
      setFormData({ documento: "", clave: "" });
      setClaveIngreso("");
      setMostrarClave(false);
      setMostrarCambiarPin(false);
      setMostrarRestablecerPin(false);
      setArchivoHabitantes(null);
      setMostrarGenerarCuotas(false);
      setHabitantes([]);
      borrarToken();
    }
  }, [usuario]);

  useEffect(() => {
    // Solo el administrador necesita la lista completa. Los demás roles usan los datos de su ingreso.
    if (!usuario || usuario.rolActivo !== "Administrador") return;
    fetch(`${API_BASE}/api/habitantes`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.habitantes)) setHabitantes(data.habitantes);
      })
      .catch((err) => console.error("No se pudieron cargar los habitantes:", err));
  }, [usuario]);
      
  // Valida el ingreso contra Habitantes.csv (backend /api/auth/ingresar).
  const handleSelectRole = async (roleKey) => {
    const mapaRoles = {
      admin: "Administrador",
      resident: "Residente",
      security: "Seguridad",
      maintenance: "Mantenimiento",
    };

    const rolBuscado = mapaRoles[roleKey];
    const documento = formData.documento.replace(/\D/g, "");
    const clave = formData.clave.trim();

    if (!documento || !clave) {
      setError("Escribe tu documento y tu PIN (o tu nombre completo si es tu primer ingreso).");
      return;
    }

    setIngresando(true);
    try {
      const resp = await fetch(`${API_BASE}/api/auth/ingresar`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ documento, clave, rol: rolBuscado }),
});
      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        setError(data.error || "No se pudo validar el ingreso.");
        return;
      }

      // La clave se guarda solo en memoria, para confirmar la creacion del PIN.
      setClaveIngreso(clave);
      guardarToken(data.token);
      setUsuario(data.usuario);
      setError("");
    } catch (err) {
      console.error("Error de ingreso:", err);
      setError("No hay conexión con el servidor. Revisa que el backend esté encendido.");
    } finally {
      setIngresando(false);
    }
  };

  // NUEVO: exportar solo pagos morosos a Excel
  const exportarPagosMorososExcel = () => {
    if (pagosMorosos.length === 0) {
      alert("No hay pagos en mora para exportar.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(pagosMorosos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PagosMorosos");
    const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    saveAs(
      new Blob([wbout], { type: "application/octet-stream" }),
      "pagos_morosos.xlsx"
    );
  };

  // ---------------------------------------------------------------
  // Lectura de archivos importados (CSV o Excel)
  // - Lee el CSV como texto: no deja que la libreria adivine fechas
  //   en formato de Estados Unidos (mes/dia/año).
  // - Las fechas reales de Excel se convierten sin afectar la hora
  //   de Colombia.
  // - Todas las fechas quedan como 4/03/2026.
  // - Las celdas vacias quedan en blanco para que la tabla no se
  //   descuadre.
  // ---------------------------------------------------------------
  const formatearFechaImportada = (anio, mes, dia) =>
    `${Number(dia)}/${String(mes).padStart(2, "0")}/${anio}`;

  const normalizarTextoFecha = (texto) => {
    const valor = String(texto ?? "").trim();

    // 2026-03-04  ->  4/03/2026
    let partes = valor.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (partes) return formatearFechaImportada(partes[1], partes[2], partes[3]);

    // 4/3/2026 o 04/03/2026  ->  4/03/2026 (dia/mes/año)
    partes = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (partes) return formatearFechaImportada(partes[3], partes[2], partes[1]);

    return valor;
  };

  const leerHojaImportada = (data) => {
    const workbook = XLSX.read(data, {
      type: "array",
      raw: true,
      cellDates: false,
      cellNF: true,
    });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    Object.keys(sheet).forEach((ref) => {
      if (ref.startsWith("!")) return;

      const celda = sheet[ref];

      // Fecha real guardada por Excel (archivo .xlsx)
      if (celda.t === "n" && celda.z && XLSX.SSF.is_date(celda.z)) {
        const fecha = XLSX.SSF.parse_date_code(celda.v);

        if (fecha) {
          sheet[ref] = {
            t: "s",
            v: formatearFechaImportada(fecha.y, fecha.m, fecha.d),
          };
          return;
        }
      }

      // Texto: si parece fecha, se unifica el formato
      if (celda.t === "s") {
        sheet[ref] = { t: "s", v: normalizarTextoFecha(celda.v) };
      }
    });

    return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
  };

  // Maneja la importación de cada tipo de archivo
  function handleImportacion(tipo, archivo) {
    if (!archivo) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const jsonData = leerHojaImportada(data);

      // Según el tipo, actualiza el estado correcto y muestra tabla
      switch (tipo) {
        case "habitantes":
          setHabitantes(jsonData);
          setTablaActiva("habitantes");
          break;
        case "notificaciones":
          // Si quieres que la importación también actualice el backend
          // aquí podrías hacer un POST masivo más adelante
          setNotificaciones(jsonData);
          setTablaActiva("notificaciones");
          break;
        case "parqueaderos":
          setParqueaderos(jsonData);
          setTablaActiva("parqueaderos");
          break;
        case "incidentes":
          setIncidentes(jsonData);
          setTablaActiva("incidentes");
          break;
        case "reservas":
          setReservas(jsonData);
          setTablaActiva("reservas");
          break;
        case "vehiculos":
          setVehiculos(jsonData);
          setTablaActiva("vehiculos");
          break;
        default:
          break;
      }
    };

    reader.readAsArrayBuffer(archivo);
  }
  // Función para normalizar estructura de habitante importado
  const normalizaHabitante = (r) => ({
    "ID_Habitante": r["ID_Habitante"] ?? r["IDHabitante"] ?? r.id,
    "Nombre completo": r["Nombre completo"] ?? r.nombre,
    "Documento": r["Documento"] ?? r.documento,
    "ID_Inmueble": r["ID_Inmueble"] ?? r["IDInmueble"] ?? r.inmueble,
    "Torre/Manzana": r["Torre/Manzana"] ?? r.torre,
    "Apto/Casa": r["Apto/Casa"] ?? r.apto,
    "Tipo": r["Tipo"] ?? r.tipo,
    "Teléfono": r["Teléfono"] ?? r.telefono,
    "Email": r["Email"] ?? r.email,
    "Fecha entrada": r["Fecha entrada"] ?? r.fecha_entrada,
    "Fecha salida": r["Fecha salida"] ?? r.fecha_salida,
  });

  // Exportar datos a Excel (habitantes)
  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(habitantes);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Habitantes");
    const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), "habitantes.xlsx");
  };

  // Exportar datos a PDF con tabla
  const exportarPDFTabla = (datos, nombre) => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Lista de ${nombre} importados`, 10, 15);
    if (datos && datos.length > 0) {
      autoTable(doc, {
        startY: 25,
        head: [Object.keys(datos[0])],
        body: datos.map(fila => Object.values(fila))
      });
    } else {
      doc.text("No hay datos para exportar.", 10, 30);
    }
    doc.save(`${nombre.toLowerCase()}.pdf`);
  };

  // Exportar datos a CSV (habitantes)
  const exportarCSV = (datos) => {
    const keys = Object.keys(datos[0]);
    const csvRows = [];
    csvRows.push(keys.join(","));
    datos.forEach(row => {
      const values = keys.map(key =>
        `"${(row[key] ?? "").toString().replace(/"/g, '""')}"`
      );
      csvRows.push(values.join(","));
    });
    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "habitantes.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Render principal
  return (
    <div style={{ background: 'linear-gradient(135deg, #e3edf7 0%, #f5fafd 100%)', minHeight: '100vh' }}>
      {/* Si NO existe usuario, muestra pantalla de login */}
      {!usuario ? (
        <div style={{ width: "100%", maxWidth: "430px", margin: "0 auto", padding: "1.5em", position: "relative", borderRadius: "18px", boxShadow: "0 4px 18px #c2d6e170", minHeight: "540px", background: "transparent" }}>
          {/* Marca de agua/logo */}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: "0", opacity: 0.2, pointerEvents: "none", width: "330px", height: "330px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="https://via.placeholder.com/150" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain", filter: "brightness(0.6)", userSelect: "none" }} draggable={false} />
          </div>
          <div style={{ position: "relative", zIndex: "10" }}>
            <h1 style={{ fontWeight: "bold", margin: 0, fontSize: "1.6em", color: "#188aac", letterSpacing: ".01em", textAlign: "center" }}>
              CONJUNTO ALBORADA<br />HACIENDA Rosablanca
            </h1>
            <h2 style={{ fontWeight: "600", margin: "0 0 0.2em 0", textAlign: "center", fontSize: "1em", color: "#333" }}>Sistema de Gestión Residencial</h2>
            <p style={{ textAlign: "center", color: "#555", fontSize: "0.95em", marginBottom: "1.5em" }}>Ingresa tus datos y luego selecciona tu rol para continuar</p>
            {/* Ingreso: documento + PIN (o nombre en el primer ingreso) */}
            <label style={{ fontWeight: "bold", color: "#334155", fontSize: "0.9em" }}>Documento</label>
            <input style={{ width: "100%", margin: "0.4em 0 0.9em", padding: "0.8em", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} type="text" inputMode="numeric" name="documento" value={formData.documento} onChange={handleInputChange} placeholder="Ejemplo: 123456789" autoComplete="username" required />
            <label style={{ fontWeight: "bold", color: "#334155", fontSize: "0.9em" }}>PIN</label>
            <div style={{ display: "flex", gap: "0.5em", margin: "0.4em 0 0.3em" }}>
              <input style={{ flex: 1, padding: "0.8em", borderRadius: "8px", border: "1px solid #cbd5e1", minWidth: 0 }} type={mostrarClave ? "text" : "password"} name="clave" value={formData.clave} onChange={handleInputChange} placeholder="PIN de 4 números" autoComplete="current-password" required />
              <button type="button" onClick={() => setMostrarClave((v) => !v)} style={{ padding: "0 0.9em", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", color: "#218290", cursor: "pointer", fontWeight: "bold" }}>{mostrarClave ? "Ocultar" : "Mostrar"}</button>
            </div>
            <p style={{ color: "#64748b", fontSize: "0.8em", margin: "0 0 1em" }}>¿Primer ingreso? Escribe tu <strong>nombre completo</strong> en lugar del PIN. Luego el sistema te pedirá crear tu PIN.</p>
            {ingresando && <div style={{ color: "#218290", textAlign: "center" }}>Validando...</div>}
            {/* Muestra error si el acceso falla */}
            {error && <div style={{ color: "red", marginBottom: "0em", textAlign: "center" }}>{error}</div>}
            {/* Botones para seleccionar rol */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.4em", justifyContent: "center", padding: "1.5em 1em", margin: "0 0 2em", background: "transparent", borderRadius: "18px" }}>
              <button style={{ ...roleBtnStyle, background: hoverBtn === 'admin' ? "#17677f" : "transparent", color: "#218290" }} onClick={() => handleSelectRole('admin')} onMouseOver={() => setHoverBtn('admin')} onMouseOut={() => setHoverBtn('')}>🧑‍💼 Administrador</button>
              <button style={{ ...roleBtnStyle, background: hoverBtn === 'resident' ? "#17677f" : "transparent", color: "#218290" }} onClick={() => handleSelectRole('resident')} onMouseOver={() => setHoverBtn('resident')} onMouseOut={() => setHoverBtn('')}>🏠 Residente</button>
              <button style={{ ...roleBtnStyle, background: hoverBtn === 'security' ? "#17677f" : "transparent", color: "#218290" }} onClick={() => handleSelectRole('security')} onMouseOver={() => setHoverBtn('security')} onMouseOut={() => setHoverBtn('')}>🛡️ Seguridad</button>
              <button style={{ ...roleBtnStyle, background: hoverBtn === 'maintenance' ? "#17677f" : "transparent", color: "#218290" }} onClick={() => handleSelectRole('maintenance')} onMouseOver={() => setHoverBtn('maintenance')} onMouseOut={() => setHoverBtn('')}>🔧 Mantenimiento</button>
            </div>
          </div>
        </div>
     ) : usuario.debeCambiarPin ? (
  <CambiarPin
    usuario={usuario}
    claveActual={claveIngreso}
    obligatorio={true}
    onListo={() => setUsuario(null)}
    onCancelar={() => setUsuario(null)}
  />
     ) : usuario.rolActivo === "Administrador" ? (
  <>
    <AdminDashboard
      usuario={usuario}
      setUsuario={setUsuario}
      habitantes={habitantes}
      pagos={pagos}
      reservas={reservas}
      incidentes={incidentes}
      parqueaderos={parqueaderos}
      vehiculos={vehiculos}
      notificaciones={notificaciones}
      handleImportacion={handleImportacion}
      onAbrirNotificaciones={() => setTablaActiva("notificaciones")}
    />

    <div style={{ maxWidth: "96vw", margin: "18px auto 0" }}>
      <InformeMorosidad pagos={pagos} />
    </div>

    {tablaActiva === "notificaciones" && (
      <NotificacionesTable
        usuario={usuario || { rol: "Administrador", nombre: "Administrador" }}
        habitantes={habitantes}
      />
    )}

    {tablaActiva === "habitantes" && (
      <TablaHabitantes
        habitantes={habitantes}
        onActualizar={(lista) => setHabitantes(lista)}
        onOcultar={() => setTablaActiva("")}
      />
    )}
    
    {tablaActiva === "parqueaderos" && parqueaderos.length > 0 && (
      <TablaImportada
        datos={parqueaderos}
        nombre="parqueaderos"
        mostrar={true}
        onOcultar={() => setTablaActiva("")}
      />
    )}

    {tablaActiva === "incidentes" && incidentes.length > 0 && (
      <TablaImportada
        datos={incidentes}
        nombre="incidentes"
        mostrar={true}
        onOcultar={() => setTablaActiva("")}
      />
    )}

    {tablaActiva === "reservas" && reservas.length > 0 && (
      <TablaImportada
        datos={reservas}
        nombre="reservas"
        mostrar={true}
        onOcultar={() => setTablaActiva("")}
      />
    )}

    {tablaActiva === "vehiculos" && vehiculos.length > 0 && (
      <TablaImportada
        datos={vehiculos}
        nombre="vehiculos"
        mostrar={true}
        onOcultar={() => setTablaActiva("")}
      />
    )}

    <div
  style={{
    maxWidth: "1120px",
    margin: "34px auto 0",
    padding: "20px 22px",
    background: "rgba(255,255,255,0.78)",
    border: "1px solid #dbe7ef",
    borderRadius: "20px",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
    backdropFilter: "blur(4px)",
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
      <h3
        style={{
          margin: "0 0 4px 0",
          color: "#0f766e",
          fontSize: "1.05rem",
          fontWeight: 700,
        }}
      >
        Herramientas administrativas
      </h3>
      <p
        style={{
          margin: 0,
          color: "#64748b",
          fontSize: "0.92rem",
          lineHeight: 1.5,
          maxWidth: "620px",
        }}
      >
        Accesos de soporte para actualizar información operativa del conjunto.
        Se muestran primero las herramientas de uso más frecuente.
      </p>
    </div>

    <div
      style={{
        padding: "6px 10px",
        borderRadius: "999px",
        background: "#ecfeff",
        color: "#0f766e",
        fontSize: "0.8rem",
        fontWeight: 700,
        border: "1px solid #bae6fd",
      }}
    >
      Uso administrativo
    </div>
  </div>

  <div style={{ marginBottom: "14px" }}>
    <div
      style={{
        fontSize: "0.84rem",
        fontWeight: 700,
        color: "#475569",
        marginBottom: "10px",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      Accesos principales
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap: "12px",
      }}
    >
      <BotonImportacion
        tipo="habitantes"
        titulo="Importar Habitantes"
        onFileChange={(e) => {
          const archivo = e.target.files[0];
          e.target.value = "";
          if (archivo) setArchivoHabitantes(archivo);
        }}
      />

      <PanelPagosCard />

      <BotonImportacion
        tipo="incidentes"
        titulo="Importar Incidentes"
        onFileChange={(e) =>
          handleImportacion("incidentes", e.target.files[0])
        }
      />
            <BotonImportacion
        tipo="vehiculos"
        titulo="Cargar Excel (vehículos y parqueaderos)"
        onFileChange={(e) => {
          const archivo = e.target.files[0];
          e.target.value = "";
          if (archivo) setArchivoInventario(archivo);
        }}
      />
    </div>
  </div>

  <div
    style={{
      marginTop: "16px",
      paddingTop: "16px",
      borderTop: "1px dashed #cbd5e1",
    }}
  >
    <div
      style={{
        fontSize: "0.84rem",
        fontWeight: 700,
        color: "#64748b",
        marginBottom: "10px",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      Herramientas secundarias
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap: "12px",
        opacity: 0.92,
      }}
    >
           
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <button
          type="button"
          onClick={descargarPlantillaInventario}
          style={{ padding: "10px 14px", borderRadius: 10, border: "2px solid #218290", background: "#fff", color: "#218290", fontWeight: 700, cursor: "pointer" }}
        >
          Descargar plantilla de Excel
        </button>
      </div>

    </div>
  </div>

  <div style={{ display: "none" }}>
    <BotonImportacion
      tipo="reservas"
      titulo="Importar Reservas"
      onFileChange={(e) =>
        handleImportacion("reservas", e.target.files[0])
      }
    />
  </div>
</div>

    <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginTop: "28px" }}>
      <button type="button" onClick={() => setMostrarGenerarCuotas(true)} style={{ padding: "0.72em 1.4em", background: "#218290", color: "#fff", border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: "bold" }}>
        Generar cuotas del mes
      </button>
      <button type="button" onClick={() => setMostrarCambiarPin(true)} style={{ padding: "0.72em 1.4em", background: "#fff", color: "#218290", border: "2px solid #218290", borderRadius: "10px", cursor: "pointer", fontWeight: "bold" }}>
        Cambiar mi PIN
      </button>
      <button type="button" onClick={() => setMostrarRestablecerPin(true)} style={{ padding: "0.72em 1.4em", background: "#f59e0b", color: "#fff", border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: "bold" }}>
        Restablecer PIN de un habitante
      </button>
    </div>

    <button
  onClick={() => setUsuario(null)}
  style={{
    margin: "16px auto 8px",
    padding: "0.72em 1.8em",
    background: "#218290",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "bold",
    display: "block",
    boxShadow: "0 6px 14px rgba(33, 130, 144, 0.18)",
  }}
>
  Volver a elegir rol
</button>
  </>
) : usuario.rolActivo === "Residente" ? (
  <PanelResidente
  usuario={usuario}
  pagos={pagos}
  habitantes={habitantes}
  reservas={reservas}
  notificaciones={notificaciones}
  setUsuario={setUsuario}
/>

) : usuario.rolActivo === "Seguridad" ? (
  <PanelSeguridad
    usuario={usuario}
    onCambiarPin={() => setMostrarCambiarPin(true)}
    onSalir={() => setUsuario(null)}
    onVolverAdmin={
      usuario.rol === "Administrador"
        ? () => setUsuario({ ...usuario, rolActivo: "Administrador", vistaInicial: undefined })
        : undefined
    }
  />  

  ) : usuario.rolActivo === "Mantenimiento" ? (
  <PanelMantenimiento
    usuario={usuario}
    onCambiarPin={() => setMostrarCambiarPin(true)}
    onSalir={() => setUsuario(null)}
    onVolverAdmin={
      usuario.rol === "Administrador"
        ? () => setUsuario({ ...usuario, rolActivo: "Administrador", vistaInicial: undefined })
        : undefined
    }
  />
) : (
  <div
    style={{
      background: "#fff",
      borderRadius: "20px",
      boxShadow: "0 8px 32px #c2d6e12a",
      padding: "2em",
      maxWidth: "430px",
      margin: "0 auto",
      marginTop: "-10em",
      textAlign: "center",
    }}
  >
    <h3 style={{ color: "#188aac", marginTop: 0 }}>
      Panel de {usuario?.rolActivo || usuario?.rol}
    </h3>
    <p style={{ color: "#475569" }}>
      Este módulo estará disponible próximamente.
    </p>
    <button
      type="button"
      onClick={() => setMostrarCambiarPin(true)}
      style={{ marginTop: "1em", marginRight: "0.6em", padding: "0.7em 1.5em", background: "#fff", color: "#218290", border: "2px solid #218290", borderRadius: "10px", cursor: "pointer", fontWeight: "bold" }}
    >
      Cambiar mi PIN
    </button>
    <button
      onClick={() => setUsuario(null)}
      style={{
        marginTop: "1em",
        padding: "0.7em 1.5em",
        background: "#218290",
        color: "#fff",
        border: "none",
        borderRadius: "10px",
        cursor: "pointer",
        fontWeight: "bold",
      }}
    >
      Volver
    </button>
  </div>
)}

      {/* Carga masiva de habitantes */}
      {usuario && archivoHabitantes && (
        <CargaHabitantes
          archivo={archivoHabitantes}
          onCerrar={() => {
            setArchivoHabitantes(null);
            setTablaActiva("habitantes");
          }}
          onImportado={(lista) => {
            setHabitantes(lista);
            setTablaActiva("habitantes");
          }}
        />
      )}

            {/* Carga de vehículos y parqueaderos (Excel de tres hojas) */}
      {usuario && archivoInventario && (
        <CargaInventario
          archivo={archivoInventario}
          usuario={usuario}
          onCerrar={() => setArchivoInventario(null)}
          onImportado={(lista) => setHabitantes(lista)}
        />
      )}

      {/* Generar cuotas de administracion */}
      {usuario && mostrarGenerarCuotas && (
        <GenerarCuotas usuario={usuario} onCerrar={() => setMostrarGenerarCuotas(false)} />
      )}

      {/* Ventanas de PIN */}
      {usuario && mostrarCambiarPin && (
        <CambiarPin
          usuario={usuario}
          obligatorio={false}
          onListo={() => setMostrarCambiarPin(false)}
          onCancelar={() => setMostrarCambiarPin(false)}
        />
      )}
      {usuario && mostrarRestablecerPin && (
        <RestablecerPin usuario={usuario} onCerrar={() => setMostrarRestablecerPin(false)} />
      )}

    </div>
  );
}

export default HomePage;