import React, { useState, useEffect } from "react";
import AdminDashboard from './components/AdminDashboard';
import ImportarCSV from "./ImportarCSV";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import TablaImportada from "./components/TablaImportada";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import VinculacionParqueaderosInmuebles from "./components/VinculacionParqueaderosInmuebles";
import BotonImportacion from './components/BotonImportacion';
import NotificacionesTable from "./components/NotificacionesTable";
import DemoFirmas from "./components/DemoFirmas";
import CardFirmas from "./components/CardFirmas";
import ArchivosGenericos from "./components/ArchivosGenericos"; 
import PagosPanel from "./components/PagosPanel";
import logoImg from "./assets/logo.jpg";
import PagosMorosidadPanel from './components/PagosMorosidadPanel';
import InformeMorosidad from './components/InformeMorosidad';
import GraficosMorosidad from './components/GraficosMorosidad';

// ...otros imports

// Ajusta la ruta si la carpeta/components cambia según tu proyecto
const usuariosFake = [
  { nombre: "Juan Pérez", documento: "123456789", rol: "resident" },
  { nombre: "Ana Gómez", documento: "987654321", rol: "admin", rolesPermitidos: ["admin", "resident", "security", "maintenance"] },
  { nombre: "Carlos Torres", documento: "567890123", rol: "security" },
  { nombre: "Maria Lopez", documento: "345678901", rol: "maintenance" }
];

const roleBtnStyle = {
  width: "170px",
  minHeight: "110px",
  padding: "2em 1.5em",
  margin: "0.5em",
  border: "2px solid #218290",
  borderRadius: "16px",
  background: "transparent", // aquí el cambio
  color: "#fff",
  fontWeight: "bold",
  fontSize: "1.1em",
  boxShadow: "0 4px 18px #21829020",
  transition: "background 0.15s, box-shadow 0.15s",
  cursor: "pointer"
};


const iconStyle = { fontSize: '2em', marginBottom: '0em' };

function HomePage(props) {
  
  const [usuario, setUsuario] = useState(null);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({ nombre: "", documento: "" });
  const [habitantes, setHabitantes] = useState(() => {
    const datosGuardados = localStorage.getItem("habitantes");
    return datosGuardados ? JSON.parse(datosGuardados) : [];
  });
  const [filtroEstadoMorosidad, setFiltroEstadoMorosidad] = useState("Mora");
const [filtroFechaMorosidad, setFiltroFechaMorosidad] = useState("");
  const [inmuebles, setInmuebles] = useState([]);
  const [parqueaderos, setParqueaderos] = useState([]);
  const [incidentes, setIncidentes] = useState([]);
  const [pagos, setPagos] = React.useState([]);
  // Filtrado para Informe y Gráficos (morosidad)
const pagosFiltradosMorosidad = React.useMemo(() => {
  return pagos.filter((pago) => {
    const coincideEstado = filtroEstadoMorosidad === "" || pago.Estado === filtroEstadoMorosidad;
    const coincideFecha =
      filtroFechaMorosidad === "" ||
      (pago["Fecha de pago"] && pago["Fecha de pago"].startsWith(filtroFechaMorosidad));
    return coincideEstado && coincideFecha;
  });
}, [pagos, filtroEstadoMorosidad, filtroFechaMorosidad]);

  const [reservas, setReservas] = useState([]);
  const [mantenimiento, setMantenimiento] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [hoverBtn, setHoverBtn] = useState("");
  const [tablaActiva, setTablaActiva] = useState("");
  const [notificaciones, setNotificaciones] = React.useState([]);
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

const totalPagos = pagos.length;
const totalMorosos = pagos.filter(p => p.Estado === "Mora").length;
const porcentajeMorosidad = totalPagos > 0 ? ((totalMorosos / totalPagos) * 100).toFixed(1) : 0;


  useEffect(() => {
    localStorage.setItem("habitantes", JSON.stringify(habitantes));
  }, [habitantes]);

  const usuarioActual = {
    nombre: "Juan Pérez",
    rol: "Administrador"
  };

  const styleBotonImport = {
    minWidth: 175,
    width: "100%",
    borderRadius: "16px",
    fontWeight: "bold",
    fontSize: "1em"
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSelectRole = (role) => {
    const usuarioEncontrado = usuariosFake.find(
      u =>
        u.nombre.trim().toLowerCase() === formData.nombre.trim().toLowerCase() &&
        u.documento === formData.documento &&
        (u.rol === role || (u.rolesPermitidos && u.rolesPermitidos.includes(role)))
    );
    if (usuarioEncontrado) {
      setUsuario({ ...usuarioEncontrado, rolActivo: role });
      setError("");
    } else {
      setError("Usuario NO autorizado para este rol.");
    }
  };

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(habitantes);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Habitantes");
    const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), "habitantes.xlsx");
  };

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

  const exportarCSV = (datos) => {
  // Convierte el array de objetos en CSV
  const keys = Object.keys(datos[0]);
  const csvRows = [];

  // Encabezado
  csvRows.push(keys.join(","));

  // Filas
  datos.forEach(row => {
    const values = keys.map(key => 
      `"${(row[key] ?? "").toString().replace(/"/g, '""')}"`
    );
    csvRows.push(values.join(","));
  });
<div>
  <h2>TEST - Informe de Morosidad</h2>
  <PagosMorosidadPanel pagos={pagos} />
</div>
  
  // Construye archivo CSV y dispara descarga
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

  return (
  <div style={{ background: 'linear-gradient(135deg, #e3edf7 0%, #f5fafd 100%)', minHeight: '100vh' }}>
    {!usuario ? (
      <div
        style={{
          width: "100%",
            maxWidth: "430px",
            margin: "0 auto",
            padding: "1.5em",
            position: "relative",
            borderRadius: "18px",
            boxShadow: "0 4px 18px #c2d6e170",
            minHeight: "540px",
            background: "transparent"
        }}
      >
        {/* Marca de agua: Logo centrado, semi-transparente */}
        <div
          style={{
            position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: "0",
              opacity: 0.2,
              pointerEvents: "none",
              width: "330px",
              height: "330px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
          }}
        >
          <img
            src={logoImg}
            alt="logo"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              filter: "brightness(0.6)",
              userSelect: "none"
            }}
            draggable={false}
          />
        </div>

          {/* CONTENIDO PRINCIPAL */}
          
            {/* NOMBRE DEL CONJUNTO */}

      <div style={{ position: "relative", zIndex: "10" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "18px",
              marginBottom: "0.5em"
            }}>
              <h1 style={{
                fontWeight: "bold",
                margin: 0,
                fontSize: "1.6em",
                color: "#188aac",
                letterSpacing: ".01em"
              }}>

    CONJUNTO RESIDENCIAL<br />
    CERRADO ALTOS DE MANARE PH
  </h1>
              <img
                src={logoImg}
                alt="Logo"
                style={{
                  height: "120px",
                  maxWidth: "140px",
                  objectFit: "contain",
                  borderRadius: "10px",
                  marginLeft: "10px",
                  boxShadow: "0 2px 12px #0001"
                }}
              />
            </div>
            <h2 style={{
              fontWeight: "600",
              margin: "0 0 0.2em 0",
              textAlign: "center",
              fontSize: "1em",
              color: "#333"
            }}>

              Sistema de Gestión Residencial
            </h2>

            <p style={{ 
              textAlign: "center", 
              color: "#555", 
              fontSize: "0.95em",
              marginBottom: "1.5em"
            }}>
              Ingresa tus datos y luego selecciona tu rol para continuar
            </p>

            {/* INPUTS */}
            <input
              style={{width: "100%", margin: "0.7em 0", padding: "0.8em", borderRadius: "8px", border: "1px solid #cbd5e1"}}
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleInputChange}
              placeholder="Ej: Juan Pérez"
              required
            />
            <input
              style={{width: "100%", margin: "0.7em 0 1.2em", padding: "0.8em", borderRadius: "8px", border: "1px solid #cbd5e1"}}
              type="text"
              name="documento"
              value={formData.documento}
              onChange={handleInputChange}
              placeholder="Ejemplo: 123456789"
              required
            />
            {error && <div style={{ color: "red", marginBottom: "0em", textAlign: "center" }}>{error}</div>}
            
                  {/* Botones SIN fondo */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1.4em",
              justifyContent: "center",
              padding: "1.5em 1em",
              margin: "0 0 2em",
              background: "transparent",
              borderRadius: "18px"
            }}>
              <button style={{
  ...roleBtnStyle,
  background: hoverBtn === 'admin' ? "#17677f" : "transparent",
  color: "#218290"
}}
  onClick={() => handleSelectRole('admin')}
  onMouseOver={() => setHoverBtn('admin')}
  onMouseOut={() => setHoverBtn('')}
>
  <span style={{ fontSize: "2em", marginBottom: "0.2em", display: "block" }}>🧑‍💼</span>
  Administrador
</button>

              <button style={{
                ...roleBtnStyle,
                background: hoverBtn === 'resident' ? "#17677f" : "transparent",
                color: "#218290"
              }}
                onClick={() => handleSelectRole('resident')}
                onMouseOver={() => setHoverBtn('resident')}
                onMouseOut={() => setHoverBtn('')}
              ><span style={iconStyle}>🏠</span>Residente</button>
              <button style={{
                ...roleBtnStyle,
                background: hoverBtn === 'security' ? "#17677f" : "transparent",
                color: "#218290"
              }}
                onClick={() => handleSelectRole('security')}
                onMouseOver={() => setHoverBtn('security')}
                onMouseOut={() => setHoverBtn('')}
              ><span style={iconStyle}>🛡️</span>Seguridad</button>
              <button style={{
                ...roleBtnStyle,
                background: hoverBtn === 'maintenance' ? "#17677f" : "transparent",
                color: "#218290"
              }}
                onClick={() => handleSelectRole('maintenance')}
                onMouseOver={() => setHoverBtn('maintenance')}
                onMouseOut={() => setHoverBtn('')}
              ><span style={iconStyle}>🔧</span>Mantenimiento</button>
            </div>
          </div>
        </div>
      ) : usuario.rol === 'admin' ? (
        <>
          {usuario.rol === 'admin' && (
  <button
    onClick={() => setTablaActiva("agregarHabitante")}
    style={{
      position: "fixed",
      left: "38px",
      top: "160px", // ajusta la altura según tu header/menu
      zIndex: 1200,
      background: "linear-gradient(90deg,#18bd6f 0%,#009b79 100%)",
      color: "#fff",
      border: "none",
      borderRadius: "50px",
      padding: "1em 2.2em",
      fontWeight: "bold",
      fontSize: "1.15em",
      boxShadow: "0 4px 22px #009b7950",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      cursor: "pointer"
    }}
  >
    <span style={{ fontSize: "1.8em" }}>🧑‍💼</span>
    Agregar
  </button>
)}
   
          <div style={{
            position: "fixed",
            top: "24px",
            right: "32px",
            zIndex: 100,
          }}>
            <button
              onClick={() => setUsuario(null)}
              style={{
                background: "#218290",
                color: "#fff",
                padding: "10px 18px 10px 14px",
                borderRadius: "16px",
                border: "none",
                fontWeight: "bold",
                fontSize: "1em",
                boxShadow: "0 2px 10px #c2d6e1",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
              title="Regresar"
            >
              <span style={{
                fontSize: "1.3em",
                display: "inline-block",
                transform: "rotate(180deg)"
              }}>&#8594;</span>
              Regresar
            </button>
          </div>
          <AdminDashboard
            usuario={usuario}
            setUsuario={setUsuario}
            residentes={habitantes}
            apartamentos={inmuebles}
            pagos={pagos}
            reservas={reservas}
            mantenimiento={mantenimiento}
            incidentes={incidentes}
            parqueaderos={parqueaderos}
            vehiculos={vehiculos}
            notificaciones={notificaciones}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "1.2em",
              justifyContent: "center",
              maxWidth: 900,
              margin: "0 auto"
            }}
          >
              <BotonImportacion
              tipo="notificaciones"
              titulo={
                <>
                  <span style={{ fontSize: "1.5em", marginRight: "7px" }}></span>
                  Importar Notificaciones
                </>
              }
              style={{
                background: "linear-gradient(99deg, #49eb25ff 0%, #d8f73bff 100%)",
                color:"#f1f50cff",    
                fontWeight: "bold",
                border: "none",
                borderRadius: "18px",
                padding: "16px 10px",
                boxShadow: "0 2px 9px #21829033",
                cursor: "pointer",
                marginBottom: "0.6em",
                display: "flex",
                alignItems: "center",
                gap: "11px",
                justifyContent: "center",
                transition: "filter 0.2s",
                filter: "drop-shadow(0 1px 5px #2563eb22)"
              }}
              onFileChange={e => {
                const archivo = e.target.files[0];
                if (!archivo) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                  const bstr = evt.target.result;
                  const workbook = XLSX.read(bstr, { type: "binary" });
                  const nombreHoja = workbook.SheetNames[0];
                  const hoja = workbook.Sheets[nombreHoja];
                  const datos = XLSX.utils.sheet_to_json(hoja, { defval:"" });
                  setNotificaciones(datos);
                  setTablaActiva("notificaciones");
                };
                reader.readAsBinaryString(archivo);
              }}
            />

            <BotonImportacion
  tipo="habitantes"
  titulo="Importar Habitantes"
  onFileChange={e => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const workbook = XLSX.read(bstr, { type: "binary" });
      const nombreHoja = workbook.SheetNames[0];
      const hoja = workbook.Sheets[nombreHoja];
      const datos = XLSX.utils.sheet_to_json(hoja, { defval: "" });
      // Normaliza los registros al formato estándar
      setHabitantes(habs => [...habs, ...datos.map(normalizaHabitante)]);
      setTablaActiva("habitantes");
    };
    reader.readAsBinaryString(archivo);
  }}
/>
            <BotonImportacion tipo="inmuebles" titulo="Importar Inmuebles" onFileChange={e => {
              const archivo = e.target.files[0];
              if (!archivo) return;
              const reader = new FileReader();
              reader.onload = (evt) => {
                const bstr = evt.target.result;
                const workbook = XLSX.read(bstr, { type: "binary" });
                const nombreHoja = workbook.SheetNames[0];
                const hoja = workbook.Sheets[nombreHoja];
                const datos = XLSX.utils.sheet_to_json(hoja, { defval:"" });
                setInmuebles(datos);
                setTablaActiva("inmuebles");
              };
              reader.readAsBinaryString(archivo);
            }} />

            <BotonImportacion tipo="parqueaderos" titulo="Importar Parqueaderos" onFileChange={e => {
              const archivo = e.target.files[0];
              if (!archivo) return;
              const reader = new FileReader();
              reader.onload = (evt) => {
                const bstr = evt.target.result;
                const workbook = XLSX.read(bstr, { type: "binary" });
                const nombreHoja = workbook.SheetNames[0];
                const hoja = workbook.Sheets[nombreHoja];
                const datos = XLSX.utils.sheet_to_json(hoja, { defval:"" });
                setParqueaderos(datos);
                setTablaActiva("parqueaderos");
              };
              reader.readAsBinaryString(archivo);
            }} />

            <BotonImportacion tipo="incidentes" titulo="Importar Incidentes" onFileChange={e => {
              const archivo = e.target.files[0];
              if (!archivo) return;
              const reader = new FileReader();
              reader.onload = (evt) => {
                const bstr = evt.target.result;
                const workbook = XLSX.read(bstr, { type: "binary" });
                const nombreHoja = workbook.SheetNames[0];
                const hoja = workbook.Sheets[nombreHoja];
                const datos = XLSX.utils.sheet_to_json(hoja, { defval:"" });
                setIncidentes(datos);
                setTablaActiva("incidentes");
              };
              reader.readAsBinaryString(archivo);
            }} />

            <BotonImportacion tipo="pagos" titulo="Importar Pagos" onFileChange={e => {
              const archivo = e.target.files[0];
              if (!archivo) return;
              const reader = new FileReader();
              reader.onload = (evt) => {
                const bstr = evt.target.result;
                const workbook = XLSX.read(bstr, { type: "binary" });
                const nombreHoja = workbook.SheetNames[0];
                const hoja = workbook.Sheets[nombreHoja];
                const datos = XLSX.utils.sheet_to_json(hoja, { defval:"" });
                setPagos(datos);
                setTablaActiva("pagos");
              };
              reader.readAsBinaryString(archivo);
            }} />

            <BotonImportacion tipo="reservas" titulo="Importar Reservas" onFileChange={e => {
              const archivo = e.target.files[0];
              if (!archivo) return;
              const reader = new FileReader();
              reader.onload = (evt) => {
                const bstr = evt.target.result;
                const workbook = XLSX.read(bstr, { type: "binary" });
                const nombreHoja = workbook.SheetNames[0];
                const hoja = workbook.Sheets[nombreHoja];
                const datos = XLSX.utils.sheet_to_json(hoja, { defval:"" });
                setReservas(datos);
                setTablaActiva("reservas");
              };
              reader.readAsBinaryString(archivo);
            }} />

            <BotonImportacion
              tipo="mantenimiento"
              titulo="ImportarMantenimiento"
              style={{
                background: "linear-gradient(90deg, #f8e7d9 0%, #e8772e 100%)",
                color: "#212a37",
                fontWeight: "bold",
                borderRadius: "15px",
                border: "none",
                margin: "0.7em 0",
                padding: "1em 2em",
                boxShadow: "0 4px 12px #e96e2e36",
                fontSize: "1.1em",
                cursor: "pointer"
              }}
              onFileChange={e => {
                const archivo = e.target.files[0];
                if (!archivo) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                  const bstr = evt.target.result;
                  const workbook = XLSX.read(bstr, { type: "binary" });
                  const nombreHoja = workbook.SheetNames[0];
                  const hoja = workbook.Sheets[nombreHoja];
                  const datos = XLSX.utils.sheet_to_json(hoja, { defval:"" });
                  setMantenimiento(datos);
                  setTablaActiva("mantenimiento");
                };
                reader.readAsBinaryString(archivo);
              }}
            />

            <BotonImportacion tipo="vehiculos" titulo="Importar Vehiculos" onFileChange={e => {
              const archivo = e.target.files[0];
              if (!archivo) return;
              const reader = new FileReader();
              reader.onload = (evt) => {
                const bstr = evt.target.result;
                const workbook = XLSX.read(bstr, { type: "binary" });
                const nombreHoja = workbook.SheetNames[0];
                const hoja = workbook.Sheets[nombreHoja];
                const datos = XLSX.utils.sheet_to_json(hoja, { defval:"" });
                setVehiculos(datos);
                setTablaActiva("vehiculos");
              };
              reader.readAsBinaryString(archivo);
            }} />
          </div>

          
<div
  style={{
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    gap: "32px",
    width: "100%",
    marginBottom: "32px",
    marginTop: "12px"
  }}
>
  
<div
  style={{
    display: "flex",
    justifyContent: "center",
    alignItems: "stretch",
    gap: "32px",
    width: "100%",
    marginBottom: "28px",
    marginTop: "10px"
  }}
>
  {/* Panel central: Gráfico rectangular */}
  <div
    style={{
      background: "transparent",         // Cambia aquí, antes era "#fff"
      borderRadius: 0,                   // Sin borde redondeado
      boxShadow: "none",                 // Sin sombra
      padding: "10px 10px",
      maxWidth: "520px",
      minWidth: "410px",
      width: "40vw",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center"
    }}
  >
    <div style={{
      width: "100%",
      height: "200px",
      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    }}>
      {/* --- Solo gráfico, adaptado tamaño --- */}
      <GraficosMorosidad pagos={pagos} />
    </div>
  </div>

  

  {/* Panel derecho: informe tabla morosos */}
  {/*<div
    style={{
      background: "transparent",         // Cambia aquí, antes era "#fff"
      borderRadius: 0,                   // Sin borde redondeado
      boxShadow: "none",                 // Sin sombra
      padding: "16px 10px",
      minWidth: "230px",
      maxWidth: "320px",
      alignSelf: "center",
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-start"
    }}
  >
    <InformeMorosidad pagos={pagos.filter(p => p.Estado === "Mora")} />
  </div>*/}
</div>
  </div>

          {/* Mostrar la tabla general SIEMPRE que haya habitantes */}
{habitantes.length > 0 && (
  <TablaImportada datos={habitantes} nombre="habitantes" mostrar={true} onOcultar={() => setHabitantes([])}
  />
)}
          {/* Bloques de tablas condicionales */}
          {tablaActiva === "notificaciones" && (
            <TablaImportada datos={notificaciones} nombre="notificaciones" mostrar={notificaciones.length > 0} onOcultar={() => setNotificaciones([])} />
          )}
          {/*{tablaActiva === "habitantes" && (
            <TablaImportada datos={habitantes} nombre="habitantes" mostrar={habitantes.length > 0} onOcultar={() => setHabitantes([])} />
          )}*/}
          {tablaActiva === "inmuebles" && (
            <TablaImportada datos={inmuebles} nombre="inmuebles" mostrar={inmuebles.length > 0} onOcultar={() => setInmuebles([])} />
          )}
          {tablaActiva === "incidentes" && (
            <TablaImportada datos={incidentes} nombre="incidentes" mostrar={incidentes.length > 0} onOcultar={() => setIncidentes([])} />
          )}
          {tablaActiva === "parqueaderos" && (
            <TablaImportada datos={parqueaderos} nombre="parqueaderos" mostrar={parqueaderos.length > 0} onOcultar={() => setParqueaderos([])} />
          )}
          {/*{tablaActiva === "pagos" && (
            <TablaImportada datos={pagos} nombre="pagos" mostrar={pagos.length > 0} onOcultar={() => setPagos([])} />
          )}*/}
          
          {tablaActiva === "pagos" && (
  <PagosPanel
    pagosData={pagos}
    onOcultar={() => setTablaActiva("")}
  />
)}
          {tablaActiva === "reservas" && (
            <TablaImportada datos={reservas} nombre="reservas" mostrar={reservas.length > 0} onOcultar={() => setReservas([])} />
          )}
          {tablaActiva === "mantenimiento" && (
            <TablaImportada datos={mantenimiento} nombre="mantenimiento" mostrar={mantenimiento.length > 0} onOcultar={() => setMantenimiento([])} />
          )}
          {tablaActiva === "vehiculos" && (
            <TablaImportada datos={vehiculos} nombre="vehiculos" mostrar={vehiculos.length > 0} onOcultar={() => setVehiculos([])} />
          )}
          
          {/* Botón para volver a seleccionar rol */}
          <button
            onClick={() => setUsuario(null)}
            style={{
              margin: "2em auto",
              padding: "0.7em 2em",
              background: "#218290",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: "bold",
              display: "block"
            }}>
            Volver a elegir rol
          </button>
        </>
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
          }}
        >
          {/* Dashboards para otros roles según corresponda */}
        </div>
      )}
      {tablaActiva === "agregarHabitante" && (
  <div style={{
    position: "fixed",
    top: 0, left: 0, width: "100vw", height: "100vh",
    background: "#0008", zIndex: 2000,
    display: "flex", justifyContent: "center", alignItems: "center"
  }}>
    <div style={{
      background: "#fff", borderRadius: "18px",
      boxShadow: "0 8px 24px #0005", padding: "2em 2.7em", minWidth: "340px"
    }}>
      <h3 style={{ fontWeight: "bold", marginBottom: 20 }}>Agregar nuevo habitante</h3>

      <form onSubmit={e => {
  e.preventDefault();
  setHabitantes([
    ...habitantes,
    {
      "ID_Habitante": e.target.id.value,
      "Nombre completo": e.target.nombre.value,
      "Documento": e.target.documento.value,
      "ID_Inmueble": e.target.inmueble.value,
      "Torre/Manzana": e.target.torre.value,
      "Apto/Casa": e.target.apto.value,
      "Tipo": e.target.tipo.value,
      "Teléfono": e.target.telefono.value,
      "Email": e.target.email.value,
      "Fecha entrada": e.target.fecha_entrada.value,
      "Fecha salida": e.target.fecha_salida.value
    }
  ]);
  setTablaActiva("");
}}>
  <input name="id" required placeholder="ID Habitante" />
  <input name="nombre" required placeholder="Nombre completo" />
  <input name="documento" required placeholder="Documento" />
  <input name="inmueble" required placeholder="ID Inmueble" />
  <input name="torre" placeholder="Torre/Manzana" />
  <input name="apto" placeholder="Apto/Casa" />
  <input name="tipo" placeholder="Tipo" />
  <input name="telefono" placeholder="Teléfono" />
  <input name="email" placeholder="Email" />
  <input name="fecha_entrada" placeholder="Fecha entrada" />
  <input name="fecha_salida" placeholder="Fecha salida" />
  <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
    <button type="submit">Guardar</button>
    <button type="button" onClick={() => setTablaActiva("")}>Cancelar</button>
  </div>
</form>

    </div>
  </div>
)}

    </div>
  );
}

export default HomePage;

