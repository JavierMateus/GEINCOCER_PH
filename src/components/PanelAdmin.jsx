import React from "react";
// Asegúrate de importar tus componentes ya creados
import GraficosMorosidad from "./GraficosMorosidad";
import InformeMorosidad from "./InformeMorosidad";

// Tus datos ejemplo
const pagosOriginal = [
  {
    "ID Pago": "PAG001",
    "Nombre": "Carlos Pérez",
    "Valor": 250000,
    "Estado": "Mora",
    "Fecha de pago": "2025-01-31"
  },
  {
    "ID Pago": "PAG002",
    "Nombre": "Ana Gómez",
    "Valor": 180000,
    "Estado": "Pagado",
    "Fecha de pago": "2025-02-15"
  },
  // ...más pagos
];

const PanelAdmin = () => {
  // Estados de los filtros para reactividad
  const [filtroEstado, setFiltroEstado] = React.useState("Mora");
  const [filtroFecha, setFiltroFecha] = React.useState("");

  // Función para filtrar datos
  const pagosFiltrados = React.useMemo(() => {
    return pagosOriginal.filter((pago) => {
      const coincideEstado = filtroEstado === "" || pago.Estado === filtroEstado;
      const coincideFecha =
        filtroFecha === "" ||
        (pago["Fecha de pago"] && pago["Fecha de pago"].startsWith(filtroFecha));
      return coincideEstado && coincideFecha;
    });
  }, [filtroEstado, filtroFecha]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 32 }}>
      <h1>Panel de Administración</h1>
      {/* 1. Filtros arriba */}
      <div style={{ marginBottom: 24 }}>
        <label>
          Estado:
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="Mora">Mora</option>
            <option value="Pagado">Pagado</option>
          </select>
        </label>
        <label style={{ marginLeft: 16 }}>
          Fecha de pago (año-mes):
          <input
            type="month"
            value={filtroFecha}
            onChange={e => setFiltroFecha(e.target.value)}
          />
        </label>
      </div>

      {/* 2. Gráficos - siempre mostrando los pagos filtrados */}
      <GraficosMorosidad pagos={pagosFiltrados} />

      {/* 3. Informe/Tabla - igual, usando los pagos filtrados */}
      <InformeMorosidad pagos={pagosFiltrados} />
    </div>
  );
};

export default PanelAdmin;
