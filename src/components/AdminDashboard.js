import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import TablaImportada from "./TablaImportada";
import NotificacionesInforme from "./NotificacionesInforme";
import BotonImportacion from "./BotonImportacion";
import PQRSAdmin from "./PQRSAdmin";
import { API_BASE } from "../config";
import ReporteMascotasAdmin from './ReporteMascotasAdmin';

// Componente para las tarjetas del dashboard
function DashboardCard({ icon, valor, titulo, onClick, clickable, resaltado, ancho }) {
  const baseBorder = clickable ? "2px solid #2563eb" : "none";

  return (
    <div
      style={{
        width: "170px",
        background: resaltado ? "#fff7ed" : "#fafbfe",
        borderRadius: "18px",
        boxShadow: resaltado
          ? "0 0 0 2px #f97316, 0 4px 18px #c2d6e130"
          : "0 4px 18px #c2d6e130",
        padding: "0.8em 0.5em",
        textAlign: "center",
        cursor: clickable ? "pointer" : "default",
        border: baseBorder,
        marginBottom: 0,
        transition: "all 0.15s ease-out",
      }}
      onClick={clickable ? onClick : undefined}
    >
      <div
        style={{
          fontSize: "2.1em",
          marginBottom: "0em",
          filter: resaltado ? "drop-shadow(0 0 4px #fb923c)" : "none",
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: String(valor).length > 12 ? "1.6em" : "2.0em",
          whiteSpace: "nowrap",
          fontWeight: "bold",
          color: resaltado ? "#ea580c" : "#111827",
        }}
      >
        {valor}
      </div>
      <div
        style={{
          fontSize: "0.98em",
          color: resaltado ? "#9a3412" : "#334155",
          fontWeight: resaltado ? "700" : "700",
          letterSpacing: "0.4px",
        }}
      >
        {titulo}
      </div>
    </div>
  );
}

// Componente principal del Dashboard de Admin
function AdminDashboard({
  usuario,
  setUsuario,
  habitantes = [],
  inmuebles = [],
  pagos = [],
  reservas = [],
  mantenimiento = [],
  incidentes = [],
  parqueaderos = [],
  vehiculos = [],
  handleImportacion,
  onAbrirNotificaciones,
}) {
  // ===== ESTADOS =====
  const [modalNotif, setModalNotif] = useState(false);
  const [notificacionesDashboard, setNotificacionesDashboard] = useState([]);
  const [moduloActivo, setModuloActivo] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [nuevasNotificaciones, setNuevasNotificaciones] = useState(0);
  const [totalNotificaciones, setTotalNotificaciones] = useState(0);
  const [mostrarPQRS, setMostrarPQRS] = useState(false);
  
  // 🐾 Estado para controlar la vista del Censo / Reporte de Mascotas
  const [vistaActiva, setVistaActiva] = useState('menuPrincipal');

  // ===== useEffect 1: total notificaciones (backend) =====
  useEffect(() => {
    const fetchConteoNotificaciones = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/notificaciones`);
        const data = await resp.json();
        setTotalNotificaciones(Array.isArray(data) ? data.length : 0);
      } catch (err) {
        console.error("Error obteniendo conteo de notificaciones", err);
        setTotalNotificaciones(0);
      }
    };

    fetchConteoNotificaciones();
  }, []);

  // ===== useEffect 2: nuevas notificaciones =====
  useEffect(() => {
    const clave = "ultimaVisitaNotificaciones";
    const ultimaVisita = localStorage.getItem(clave);

    if (!ultimaVisita) {
      localStorage.setItem(clave, Date.now().toString());
      setNuevasNotificaciones(0);
      return;
    }

    const ultima = parseInt(ultimaVisita, 10);
    if (isNaN(ultima)) {
      setNuevasNotificaciones(0);
      return;
    }

    const nuevas = notificacionesDashboard.filter((n) => {
      if (!n.fecha && !n.Fecha) return false;
      const valorFecha = n.fecha || n.Fecha;
      const partes = String(valorFecha).split("-");
      if (partes.length !== 3) return false;
      const fechaNotif = new Date(
        parseInt(partes[0], 10),
        parseInt(partes[1], 10) - 1,
        parseInt(partes[2], 10)
      );
      return fechaNotif.getTime() >= ultima;
    }).length;

    setNuevasNotificaciones(nuevas);
  }, [notificacionesDashboard]);

  // ===== funciones =====
  const abrirNotificaciones = () => {
    const clave = "ultimaVisitaNotificaciones";

    if (!modalNotif) {
      localStorage.setItem(clave, Date.now().toString());
      setNuevasNotificaciones(0);
    }

    setModalNotif((prev) => !prev);
  };

  // ===== Incidentes reales: bitácora de seguridad + incidentes reportados por residentes (PQRS) =====
  const [bitacora, setBitacora] = useState([]);
  const [pqrsIncidentes, setPqrsIncidentes] = useState([]);
  const [pqrsTodas, setPqrsTodas] = useState([]);

  useEffect(() => {
    let vigente = true;
    const cargarIncidentes = async () => {
      try {
        const [datosBitacora, datosPqrs] = await Promise.all([
          fetch(`${API_BASE}/api/bitacora`).then((r) => r.json()).catch(() => ({})),
          fetch(`${API_BASE}/api/pqrs`).then((r) => r.json()).catch(() => []),
        ]);
        if (!vigente) return;
        setBitacora(Array.isArray(datosBitacora.novedades) ? datosBitacora.novedades : []);
        setPqrsTodas(Array.isArray(datosPqrs) ? datosPqrs : []);
        setPqrsIncidentes(
          Array.isArray(datosPqrs) ? datosPqrs.filter((p) => String(p.Tipo || "").trim() === "Incidente") : []
        );
      } catch (err) {
        console.error("Error obteniendo los incidentes", err);
      }
    };
    cargarIncidentes();
    const timer = setInterval(cargarIncidentes, 30000);
    return () => { vigente = false; clearInterval(timer); };
  }, []);

  const mesActual = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).slice(0, 7);
  const enElMes = (fecha) => String(fecha || "").startsWith(mesActual);
  const novedadesDelMes = bitacora.filter((n) => enElMes(n.Fecha)).length;
  const pqrsIncidentesDelMes = pqrsIncidentes.filter((p) => enElMes(p.Fecha)).length;
  const abiertasBitacora = bitacora.filter((n) => n.Estado === "abierta").length;
  const abiertasPqrs = pqrsIncidentes.filter((p) =>
    ["radicada", "en proceso"].includes(String(p.Estado || "").trim().toLowerCase())
  ).length;
  const incidentesAbiertos = abiertasBitacora + abiertasPqrs;
  const pqrsPorResponder = pqrsTodas.filter((p) =>
    ["radicada", "en proceso"].includes(String(p.Estado || "").trim().toLowerCase())
  ).length;
  const totalIncidentes = novedadesDelMes + pqrsIncidentesDelMes + incidentes.length;

  const abrirBitacora = () => setUsuario({ ...usuario, rolActivo: "Seguridad", vistaInicial: "bitacora" });

  // ===== Vehículos y parqueaderos guardados en el servidor =====
  const [resumenInv, setResumenInv] = useState({ vehiculos: 0, parqueaderos: 0, manejaParqueaderos: false });

  useEffect(() => {
    let vigente = true;
    const cargarResumen = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/inventario/resumen`);
        const data = await resp.json();
        if (vigente && resp.ok) setResumenInv(data);
      } catch (err) {
        console.error("Error obteniendo vehículos y parqueaderos", err);
      }
    };
    cargarResumen();
    const timer = setInterval(cargarResumen, 30000);
    window.addEventListener("inventario-actualizado", cargarResumen);
    return () => {
      vigente = false;
      clearInterval(timer);
      window.removeEventListener("inventario-actualizado", cargarResumen);
    };
  }, []);

  // ===== Morosidad real =====
  const [moraResumen, setMoraResumen] = useState(null);
  useEffect(() => {
    let vigente = true;
    const cargarMora = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/pagos-recibidos/resumen-mora`);
        const data = await resp.json();
        if (vigente && resp.ok && data.ok) setMoraResumen(data);
      } catch (err) {
        console.error("Error obteniendo la morosidad", err);
      }
    };
    cargarMora();
    const timer = setInterval(cargarMora, 30000);
    window.addEventListener("cartera-actualizada", cargarMora);
    return () => {
      vigente = false;
      clearInterval(timer);
      window.removeEventListener("cartera-actualizada", cargarMora);
    };
  }, []);

  const claveFechaHab = (valor) => {
    const t = String(valor || "").trim();
    let m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
    m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (m) return Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]);
    return 0;
  };
  const sinTildes = (v) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const claveUbicacion = (torre, apto) => {
    const t = sinTildes(torre).replace(/\s+/g, "").replace(/^(torre)/, "t").replace(/^(manzana|mza|mz)/, "m").replace(/-/g, "");
    const a = sinTildes(apto).replace(/\s+/g, "").replace(/^0+(?=\d)/, "");
    return `${t}|${a}`;
  };
  const hoyHab = claveFechaHab(new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }));
  const listaResidentes = (Array.isArray(habitantes) ? habitantes : []).filter((h) => {
    if (String(h.Rol || h.rol || "").trim().toLowerCase() !== "residente") return false;
    const salida = claveFechaHab(h.FechaSalida || h.fechaSalida);
    return !salida || salida > hoyHab;
  });
  const residentesActivos = listaResidentes.length;
  const inmueblesActivos = new Set(
    listaResidentes.filter((h) => h.TorreManzana && h.AptoCasa).map((h) => claveUbicacion(h.TorreManzana, h.AptoCasa))
  ).size;

  // ===== Mantenimiento real =====
  const [mantResumen, setMantResumen] = useState(null);
  useEffect(() => {
    let vigente = true;
    const cargarMant = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/mantenimiento/resumen`);
        const data = await resp.json();
        if (vigente && resp.ok && data.ok) setMantResumen(data);
      } catch (err) {
        console.error("Error obteniendo el mantenimiento", err);
      }
    };
    cargarMant();
    const timer = setInterval(cargarMant, 30000);
    return () => { vigente = false; clearInterval(timer); };
  }, []);

  // 🐾 Condición para mostrar el reporte de mascotas cuando el admin hace clic en la tarjeta
  if (vistaActiva === 'reporteMascotas') {
    return <ReporteMascotasAdmin onBack={() => setVistaActiva('menuPrincipal')} />;
  }

  // ===== return ÚNICO DEL COMPONENTE =====
  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* Tarjetas resumen arriba - CENTRADAS */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          alignItems: "stretch",
          marginBottom: "24px",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <DashboardCard
          icon="📢"
          valor={modalNotif ? "Abierto" : "Ver"}
          titulo={
            nuevasNotificaciones > 0
              ? `NOTIFICACIONES (${nuevasNotificaciones} nuevas)`
              : `NOTIFICACIONES (${totalNotificaciones})`
          }
          onClick={abrirNotificaciones}
          clickable
          resaltado={modalNotif}
        />

        <DashboardCard
          icon="🔔"
          valor={mostrarPQRS ? "Abierto" : "Ver"}
          titulo={pqrsPorResponder > 0 ? `PQRS (${pqrsPorResponder} por responder)` : "PQRS"}
          onClick={() => setMostrarPQRS((prev) => !prev)}
          clickable
          resaltado={mostrarPQRS}
        />
        
          <DashboardCard
          icon="👥"
          valor={residentesActivos}
          titulo="HABITANTES"
        />

        <DashboardCard
          icon="🏢"
          valor={inmueblesActivos}
          titulo="INMUEBLES"
        />

        <DashboardCard icon="🚗" valor={resumenInv.vehiculos} titulo="VEHÍCULOS" />

        {resumenInv.manejaParqueaderos && (
          <DashboardCard icon="🅿️" valor={resumenInv.parqueaderos} titulo="PARQUEADEROS" />
        )}

        <DashboardCard
          icon="📊"
          ancho="240px"
          valor={moraResumen ? `$${Number(moraResumen.totalMora || 0).toLocaleString("es-CO")}` : "..."}
          titulo={
            moraResumen
              ? `CARTERA EN MORA (${moraResumen.inmueblesEnMora} ${moraResumen.inmueblesEnMora === 1 ? "inmueble" : "inmuebles"})`
              : "CARTERA EN MORA"
          }
        />
        
        <DashboardCard
          icon="🛠️"
          valor={mantResumen ? mantResumen.abiertas : "..."}
          titulo={mantResumen && mantResumen.urgentes > 0 ? `MANTENIMIENTO (${mantResumen.urgentes} urgentes)` : "MANTENIMIENTO"}
          resaltado={Boolean(mantResumen && mantResumen.urgentes > 0)}
          onClick={() => setUsuario({ ...usuario, rolActivo: "Mantenimiento" })}
          clickable
        />

        <DashboardCard
          icon="⚠️"
          valor={totalIncidentes}
          titulo={incidentesAbiertos > 0 ? `INCIDENTES DEL MES (${incidentesAbiertos} abiertos)` : "INCIDENTES DEL MES"}
          onClick={abrirBitacora}
          clickable
        />

        {/* 🐾 Botón de acceso rápido al Censo / Reporte de Mascotas en forma de tarjeta */}
        <DashboardCard
          icon="🐾"
          valor="Ver"
          titulo="CENSO MASCOTAS"
          onClick={() => setVistaActiva('reporteMascotas')}
          clickable
        />
      </div>

      {/* Tablas importadas */}
      <div style={{ marginBottom: "24px" }}>
        {moduloActivo && (
          <TablaImportada
            datos={
              moduloActivo === "habitantes" ? habitantes :
              moduloActivo === "inmuebles" ? inmuebles :
              moduloActivo === "pagos" ? pagos :
              moduloActivo === "reservas" ? reservas :
              moduloActivo === "mantenimiento" ? mantenimiento :
              moduloActivo === "incidentes" ? incidentes :
              moduloActivo === "parqueaderos" ? parqueaderos :
              moduloActivo === "vehiculos" ? vehiculos :
              []
            }
            nombre={moduloActivo}
            mostrar={moduloActivo !== null}
            onOcultar={() => setModuloActivo(null)}
          />
        )}

        <div
          style={{
            width: "170px",
            background: "#1076a6ff",
            borderRadius: "18px",
            boxShadow: "0 4px 18px #c2d6e130",
            padding: "0.8em 0.5em",
            textAlign: "center",
            cursor: "pointer",
            border: "none",
            marginBottom: 0,
            transition: "all 0.15s ease-out",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "10px",
          }}
          onClick={() => setUsuario(null)}
        >
          <div
            style={{
              fontSize: "1.1em",
              fontWeight: "bold",
              color: "#eff3f3f9",
            }}
          >
            REGRESAR
          </div>
        </div>
      </div>

      {/* Panel de notificaciones */}
      {modalNotif && (
        <div
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            boxShadow: "0 8px 24px rgba(30, 41, 59, 0.08)",
            padding: "1.2em",
            marginTop: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: "12px",
            }}
          >
            <button
              onClick={() => setModalNotif(false)}
              style={{
                padding: "0.65em 1.2em",
                background: "#e2e8f0",
                color: "#0f172a",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Ocultar
            </button>
          </div>

          <NotificacionesInforme
            usuario={usuario}
            onClose={() => setModalNotif(false)}
          />
        </div>
      )}

      {/* Panel de PQRS */}
      {mostrarPQRS && (
        <div
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            boxShadow: "0 8px 24px rgba(30, 41, 59, 0.08)",
            padding: "1.2em",
            marginTop: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: "12px",
            }}
          >
            <button
              onClick={() => setMostrarPQRS(false)}
              style={{
                padding: "0.65em 1.2em",
                background: "#e2e8f0",
                color: "#0f172a",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Ocultar
            </button>
          </div>

          <PQRSAdmin />
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;