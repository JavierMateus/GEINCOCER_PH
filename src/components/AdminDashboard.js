import React, { useState } from "react";
import * as XLSX from "xlsx";
import NotificacionesPanel from "./NotificacionesPanel";
import TablaImportada from "./TablaImportada";


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
  const [modalNotif, setModalNotif] = useState(false);
  const [archivos, setArchivos] = useState([]);
  const [notificacionesImportadas, setNotificacionesImportadas] = useState([]);

  const pagosEnMora = pagos.filter(
    (p) => ((p.estado || p.Estado) || "").toLowerCase().includes("mora")
  );
  const morosidadPorcentaje =
    pagos.length > 0
      ? ((pagosEnMora.length / pagos.length) * 100).toFixed(1) + "%"
      : "0%";


  function handleImportarNotificaciones(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const reader = new FileReader();
    reader.readAsText(archivo, "UTF-8");
    reader.onload = (evt) => {
      const contenido = evt.target.result;
      const workbook = XLSX.read(contenido, { type: "string" });
      const nombreHoja = workbook.SheetNames[0];
      const hoja = workbook.Sheets[nombreHoja];
      const datos = XLSX.utils.sheet_to_json(hoja, { defval:"" });
      setNotificacionesImportadas(datos);
    };
  }

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #e3edf7 0%, #f5fafd 100%)",
        paddingBottom: 0,
      }}
    >
      {/* Botón Regresar */}
      <div
        style={{
          position: "fixed",
          top: "24px",
          right: "32px",
          zIndex: 100,
        }}
      >
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
          }}
          title="Regresar"
        >
          <span
            style={{
              fontSize: "1.3em",
              display: "inline-block",
              transform: "rotate(180deg)",
            }}
          >
            &#8594;
          </span>
          Regresar
        </button>
      </div>

      {/* Tarjetas resumen */}
      <div
        style={{
          display: "flex",
          gap: "1.2em",
          justifyContent: "center",
          marginBottom: "40px",
          marginTop: "60",
          paddingBottom: "0",
        }}
      >
        <DashboardCard
          icon="📢"
          valor={archivos.length}
          titulo="NOTIFICACIONES"
          onClick={() => setModalNotif(true)}
          clickable
        />
        <DashboardCard
          icon="👤"
          valor={residentes.length}
          titulo="HABITANTES"
          clickable
        />
        <DashboardCard
          icon="⚠️"
          valor={morosidadPorcentaje}
          titulo="MOROSIDAD"
          clickable
        />
        <DashboardCard
          icon="📅"
          valor={reservas.length}
          titulo="RESERVAS DEL MES"
          clickable
        />
        <DashboardCard
          icon="🔧"
          valor={mantenimiento.length}
          titulo="MANTENIMIENTO"
          clickable
        />
        <DashboardCard
          icon="🛡️"
          valor={incidentes.length}
          titulo="INCIDENTES DEL MES"
          clickable
        />
      </div>

      {/* Modal de Notificaciones SOLO bloque #2 */}
      {modalNotif && (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    }}
  >
    <div
      style={{
        background: "#fff",
        borderRadius: "12px",
        padding: "32px 24px",
        minWidth: "340px",
        maxWidth: "90vw",
        boxShadow: "0 4px 32px #0002",
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }}
    >
      <NotificacionesPanel archivos={archivos} setArchivos={setArchivos} onClose={() => setModalNotif(false)} />
    </div>
  </div>
)}


      {/* Tu óptica/modal search y tabla importadas quedan igual */}
      <div
        style={{
          position: "relative",
          height: "28px",
          width: "70%",
          background: "linear-gradient(90deg, #a3d8fc 0%, #e3dfff 50%, #c3fcb8 100%)",
          borderRadius: "28px",
          margin: "38px auto 56px auto",
          boxShadow: "0 8px 28px #60a5fa33",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1.5px solid #93c5fd"
        }}
      >
        <span style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: "1.7em",
          color: "#133275ff",
          background: "#fff",
          borderRadius: "50%",
          padding: "2px 12px",
          boxShadow: "0 2px 12px #7efad233"
        }}>
          🔍
        </span>
      </div>

      {/* Bloque de acciones/botones/tablas etc */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1.2em",
          justifyContent: "center",
          maxWidth: 900,
          margin: "0 auto",
          marginTop: "60",
        }}
      >
        {/* Aquí van tus botones y acciones (importaciones, tablas, etc) */}
      </div>

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
