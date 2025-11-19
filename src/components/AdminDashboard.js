import React, { useState } from "react";
import * as XLSX from "xlsx";
import NotificacionesPanel from "./NotificacionesPanel";
import TablaImportada from "./TablaImportada";

// Componente para las tarjetas del dashboard
function DashboardCard({ icon, valor, titulo, onClick, clickable }) {
  return (
    <div
      style={{
        width: "170px",
        background: "#fafbfe",
        borderRadius: "18px",
        boxShadow: "0 4px 18px #c2d6e130",
        padding: "0.8em 0.5em",
        textAlign: "center",
        cursor: clickable ? "pointer" : "default",
        border: clickable ? "2px solid #2563eb" : "none",
        marginBottom: 0,
      }}
      onClick={clickable ? onClick : undefined}
    >
      <div style={{ fontSize: "2.1em", marginBottom: "0em" }}>{icon}</div>
      <div style={{ fontSize: "2.0em", fontWeight: "bold" }}>{valor}</div>
      <div style={{ fontSize: "0.97em", color: "#888" }}>{titulo}</div>
    </div>
  );
}

// Componente principal del Dashboard de Admin
function AdminDashboard({
  usuario,
  setUsuario,
  residentes = [],
  apartamentos = [],
  pagos = [],
  reservas = [],
  mantenimiento = [],
  incidentes = [],
  parqueaderos = [],
  vehiculos = [],
}) {
  // Estados
  const [modalNotif, setModalNotif] = useState(false);
  const [datosImportados, setDatosImportados] = useState({
    residentes: residentes,
    apartamentos: apartamentos,
    pagos: pagos,
    reservas: reservas,
    mantenimiento: mantenimiento,
    incidentes: incidentes,
    parqueaderos: parqueaderos,
  });
  const [notificacionesImportadas, setNotificacionesImportadas] = useState([]);
  const [moduloActivo, setModuloActivo] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Calcular morosidad
  const pagosEnMora = datosImportados.pagos.filter(
    (p) => ((p.estado || p.Estado) || "").toLowerCase().includes("mora")
  );
  const morosidadPorcentaje =
    datosImportados.pagos.length > 0
      ? ((pagosEnMora.length / datosImportados.pagos.length) * 100).toFixed(1) +
        "%"
      : "0%";

  // Función para importar archivos CSV
  const handleImportarCSV = (tipoModulo) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.xlsx";
    input.onchange = (e) => {
      const archivo = e.target.files[0];
      if (!archivo) return;

      const reader = new FileReader();
      reader.readAsText(archivo, "UTF-8");
      reader.onload = (evt) => {
        try {
          const contenido = evt.target.result;
          const workbook = XLSX.read(contenido, { type: "string" });
          const nombreHoja = workbook.SheetNames[0];
          const hoja = workbook.Sheets[nombreHoja];
          const datos = XLSX.utils.sheet_to_json(hoja, { defval: "" });

          setDatosImportados((prev) => ({
            ...prev,
            [tipoModulo]: datos,
          }));
          alert(`✅ ${tipoModulo} importados correctamente: ${datos.length} registros`);
        } catch (error) {
          alert(`❌ Error al importar: ${error.message}`);
        }
      };
    };
    input.click();
  };

  // Función para importar notificaciones
  const handleImportarNotificaciones = (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    const reader = new FileReader();
    reader.readAsText(archivo, "UTF-8");
    reader.onload = (evt) => {
      try {
        const contenido = evt.target.result;
        const workbook = XLSX.read(contenido, { type: "string" });
        const nombreHoja = workbook.SheetNames[0];
        const hoja = workbook.Sheets[nombreHoja];
        const datos = XLSX.utils.sheet_to_json(hoja, { defval: "" });
        setNotificacionesImportadas(datos);
        alert(`✅ Notificaciones importadas: ${datos.length} registros`);
      } catch (error) {
        alert(`❌ Error al importar: ${error.message}`);
      }
    };
  };

  // Datos ficticios para DEMO
  const datosDemo = {
    residentes: [
      { "ID Habitante": 1, Nombre: "Juan Pérez", Apartamento: "101", Telefono: "3001234567" },
      { "ID Habitante": 2, Nombre: "María García", Apartamento: "102", Telefono: "3007654321" },
      { "ID Habitante": 3, Nombre: "Carlos López", Apartamento: "103", Telefono: "3009876543" },
    ],
    apartamentos: [
      { ID: "101", Torre: "A", Bloque: "1", Piso: 1, Area: "95m²" },
      { ID: "102", Torre: "B", Bloque: "1", Piso: 1, Area: "110m²" },
      { ID: "103", Torre: "A", Bloque: "2", Piso: 2, Area: "120m²" },
    ],
    pagos: [
      { ID: 1, Habitante: "Juan Pérez", Monto: "$500.000", Estado: "Pagado", Fecha: "2025-01-15" },
      { ID: 2, Habitante: "María García", Monto: "$500.000", Estado: "Mora", Fecha: "2025-01-20" },
      { ID: 3, Habitante: "Carlos López", Monto: "$500.000", Estado: "Pagado", Fecha: "2025-01-18" },
    ],
    reservas: [
      { ID: 1, Solicitante: "Juan Pérez", Salon: "Sala Comunal", Fecha: "2025-02-10", Hora: "14:00" },
      { ID: 2, Solicitante: "María García", Salon: "Cancha", Fecha: "2025-02-12", Hora: "10:00" },
    ],
    mantenimiento: [
      { ID: 1, Tipo: "Reparación", Ubicación: "Piscina", Estado: "En Progreso", Fecha: "2025-01-22" },
      { ID: 2, Tipo: "Limpieza", Ubicación: "Pasillos", Estado: "Completado", Fecha: "2025-01-25" },
    ],
    incidentes: [
      { ID: 1, Tipo: "Ruido", Apartamento: "101", Reportado: "2025-01-20", Estado: "Resuelto" },
      { ID: 2, Tipo: "Mascota", Apartamento: "102", Reportado: "2025-01-22", Estado: "Pendiente" },
    ],
    parqueaderos: [
      { ID: "P-01", Estado: "Ocupado", Residente: "Juan Pérez", Placa: "ABC123" },
      { ID: "P-02", Estado: "Disponible", Residente: "-", Placa: "-" },
      { ID: "P-03", Estado: "Ocupado", Residente: "María García", Placa: "XYZ789" },
    ],
  };

  // Función para cargar datos de DEMO
  const cargarDatosDemo = () => {
    setDatosImportados(datosDemo);
    alert("✅ Datos de DEMO cargados correctamente");
  };

  // Filtrar datos según búsqueda
  const datosModuloActivo = moduloActivo
    ? datosImportados[moduloActivo]?.filter((item) =>
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
      ) || []
    : [];

  return (
    <div style={{ padding: "20px", backgroundColor: "#f5f7fa", minHeight: "100vh" }}>
      {/* Botón Regresar */}
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
          gap: "8px",
          marginBottom: "20px",
        }}
        title="Regresar"
      >
        ← Regresar
      </button>

      {/* Tarjetas resumen */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "30px", flexWrap: "wrap" }}>
        <DashboardCard
          icon="📢"
          valor={notificacionesImportadas.length}
          titulo="NOTIFICACIONES"
          onClick={() => setModalNotif(true)}
          clickable
        />
        <DashboardCard
          icon="👥"
          valor={datosImportados.residentes.length}
          titulo="HABITANTES"
          onClick={() => setModuloActivo("residentes")}
          clickable
        />
        <DashboardCard
          icon="⚠️"
          valor={morosidadPorcentaje}
          titulo="MOROSIDAD"
          onClick={() => setModuloActivo("morosidad")}
          clickable
        />
        <DashboardCard
          icon="🗓️"
          valor={datosImportados.reservas.length}
          titulo="RESERVAS"
          onClick={() => setModuloActivo("reservas")}
          clickable
        />
        <DashboardCard
          icon="🔧"
          valor={datosImportados.mantenimiento.length}
          titulo="MANTENIMIENTO"
          onClick={() => setModuloActivo("mantenimiento")}
          clickable
        />
        <DashboardCard
          icon="🚨"
          valor={datosImportados.incidentes.length}
          titulo="INCIDENTES DEL MES"
          onClick={() => setModuloActivo("incidentes")}
          clickable
        />
        <DashboardCard
          icon="💳"
          valor={datosImportados.pagos.length}
          titulo="PAGOS"
          onClick={() => setModuloActivo("pagos")}
          clickable
          />
          <DashboardCard
          icon="🅿️"
          valor={datosImportados.parqueaderos.length}
          titulo="PARQUEADEROS"
          onClick={() => setModuloActivo("parqueaderos")}
          clickable
          />
      </div>

      {/* Modal de Notificaciones */}
      {modalNotif && (
        <NotificacionesPanel
          datos={notificacionesImportadas}
          onClose={() => setModalNotif(false)}
        />
      )}

      {/* Barra de búsqueda */}
      <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
        <input
          type="text"
          placeholder="🔍 Buscar en los datos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: "10px 15px",
            borderRadius: "8px",
            border: "1px solid #ddd",
            width: "300px",
            fontSize: "1em",
          }}
        />
      </div>

      {/* Bloque de botones de importación */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1.2em",
          justifyContent: "center",
          maxWidth: "900",
          margin: "0 auto",
          marginTop: "60",
        }}
      >
        {/* Botón Cargar Demo */}
        <button
          onClick={cargarDatosDemo}
          style={{
            padding: "20px",
            borderRadius: "12px",
            border: "none",
            backgroundColor: "#10b981",
            color: "white",
            fontSize: "1.1em",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 4px 15px #10b98133",
            transition: "transform 0.2s",
          }}
          onMouseOver={(e) => (e.target.style.transform = "scale(1.05)")}
          onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
        >
          ⭐ Cargar DEMO
        </button>

        {/* Botón Importar Habitantes */}
        <button
          onClick={() => handleImportarCSV("residentes")}
          style={{
            padding: "20px",
            borderRadius: "12px",
            border: "none",
            backgroundColor: "#3b82f6",
            color: "white",
            fontSize: "1.1em",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 4px 15px #3b82f633",
            transition: "transform 0.2s",
          }}
          onMouseOver={(e) => (e.target.style.transform = "scale(1.05)")}
          onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
        >
          👥 Importar Habitantes
        </button>

        {/* Botón Importar Inmuebles */}
        <button
          onClick={() => handleImportarCSV("apartamentos")}
          style={{
            padding: "20px",
            borderRadius: "12px",
            border: "none",
            backgroundColor: "#8b5cf6",
            color: "white",
            fontSize: "1.1em",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 4px 15px #8b5cf633",
            transition: "transform 0.2s",
          }}
          onMouseOver={(e) => (e.target.style.transform = "scale(1.05)")}
          onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
        >
          🏠 Importar Inmuebles
        </button>

        {/* Botón Importar Pagos */}
        <button
          onClick={() => handleImportarCSV("pagos")}
          style={{
            padding: "20px",
            borderRadius: "12px",
            border: "none",
            backgroundColor: "#ec4899",
            color: "white",
            fontSize: "1.1em",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 4px 15px #ec489933",
                      }}
          onMouseOver={(e) => (e.target.style.transform = "scale(1.05)")}
          onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
        >
          💳 Importar Pagos
        </button>

        {/* Botón Importar Reservas */}
        <button
          onClick={() => handleImportarCSV("reservas del mes")}
          style={{
            padding: "20px",
            borderRadius: "12px",
            border: "none",
            backgroundColor: "#06b6d4",
            color: "white",
            fontSize: "1.1em",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 4px 15px #06b6d433",
            transition: "transform 0.2s",
          }}
          onMouseOver={(e) => (e.target.style.transform = "scale(1.05)")}
          onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
        >
          🗓️ Importar Reservas del mes
        </button>

        {/* Botón Importar Mantenimiento */}
        <button
          onClick={() => handleImportarCSV("mantenimiento")}
          style={{
            padding: "20px",
            borderRadius: "12px",
            border: "none",
            backgroundColor: "#f59e0b",
            color: "white",
            fontSize: "1.1em",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 4px 15px #f59e0b33",
            transition: "transform 0.2s",
          }}
          onMouseOver={(e) => (e.target.style.transform = "scale(1.05)")}
          onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
        >
          🔧 Importar Mantenimiento
        </button>

        {/* Botón Importar Incidentes */}
        <button
          onClick={() => handleImportarCSV("incidentes")}
          style={{
            padding: "20px",
            borderRadius: "12px",
            border: "none",
            backgroundColor: "#ef4444",
            color: "white",
            fontSize: "1.1em",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 4px 15px #ef444433",
            transition: "transform 0.2s",
          }}
          onMouseOver={(e) => (e.target.style.transform = "scale(1.05)")}
          onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
        >
          🚨 Importar Incidentes
        </button>

        {/* Botón Importar Parqueaderos */}
        <button
          onClick={() => handleImportarCSV("parqueaderos")}
          style={{
            padding: "20px",
            borderRadius: "12px",
            border: "none",
            backgroundColor: "#8b5cf6",
            color: "white",
            fontSize: "1.1em",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 4px 15px #8b5cf633",
            transition: "transform 0.2s",
          }}
          onMouseOver={(e) => (e.target.style.transform = "scale(1.05)")}
          onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
        >
          🅿️ Importar Parqueaderos
        </button>

        {/* Botón Importar Notificaciones */}
        <label
          style={{
            padding: "20px",
            borderRadius: "12px",
            border: "none",
            backgroundColor: "#14b8a6",
            color: "white",
            fontSize: "1.1em",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 4px 15px #14b8a633",
            transition: "transform 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseOver={(e) => (e.parentElement.style.transform = "scale(1.05)")}
          onMouseOut={(e) => (e.parentElement.style.transform = "scale(1)")}
        >
          📢 Importar Notificaciones
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={handleImportarNotificaciones}
            style={{ display: "none" }}
          />
        </label>
      </div>

      {/* Tabla de datos importados */}
      <div style={{ marginTop: "40px" }}>
        {moduloActivo && (
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "20px",
              boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
            }}
          >
            <h2 style={{ marginTop: 0, color: "#333" }}>
              Datos de {moduloActivo.toUpperCase()}
              <button
                onClick={() => setModuloActivo(null)}
                style={{
                  marginLeft: "10px",
                  padding: "5px 10px",
                  background: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                Cerrar
              </button>
            </h2>

            {datosModuloActivo.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.95em",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f3f4f6", borderBottom: "2px solid #e5e7eb" }}>
                      {Object.keys(datosModuloActivo[0]).map((key) => (
                        <th
                          key={key}
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontWeight: "bold",
                            color: "#374151",
                          }}
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {datosModuloActivo.map((fila, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid #e5e7eb",
                          backgroundColor: idx % 2 === 0 ? "#f9fafb" : "white",
                        }}
                      >
                        {Object.values(fila).map((valor, i) => (
                          <td
                            key={i}
                            style={{
                              padding: "12px",
                              color: "#555",
                            }}
                          >
                            {String(valor)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: "#999", textAlign: "center" }}>
                No hay datos para mostrar. Importa un archivo CSV.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Mostrar tabla de notificaciones si hay datos */}
      {notificacionesImportadas.length > 0 && (
        <TablaImportada
          datos={notificacionesImportadas}
          nombre="notificaciones"
          mostrar={notificacionesImportadas.length > 0}
          onOcultar={() => setNotificacionesImportadas([])}
        />
      )}
    </div>
  );
}

export default AdminDashboard;

