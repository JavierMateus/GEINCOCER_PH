import React from 'react';

const liStyle = {
  cursor: "pointer",
  padding: "0.47em 0.35em",
  borderRadius: "7px",
  marginBottom: "2px",
  transition: "background 0.14s",
  fontSize: "1.015em"
};

const iconStyle = {
  fontSize: '1.15em',
  marginRight: '0.32em',
  verticalAlign: 'middle'
};

function Sidebar({ onSelectSection }) {
  return (
    <aside style={{
      width: '230px',
      background: '#f1f5f7',
      padding: '1.5rem 1rem 1rem 1rem',
      minHeight: '100vh'
    }}>
      <nav>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={liStyle} onClick={() => onSelectSection('dashboard')}>
            <span style={iconStyle}>📊</span> Dashboard principal
          </li>
          <li style={liStyle} onClick={() => onSelectSection('residents')}>
            <span style={iconStyle}>👥</span> Residentes
          </li>
          <li style={liStyle} onClick={() => onSelectSection('billing')}>
            <span style={iconStyle}>💵</span> Facturación y Pagos
          </li>
          <li style={liStyle} onClick={() => onSelectSection('reservations')}>
            <span style={iconStyle}>📅</span> Reservas y Espacios
          </li>
          <li style={liStyle} onClick={() => onSelectSection('visitors')}>
            <span style={iconStyle}>🚪</span> Visitantes
          </li>
          <li style={liStyle} onClick={() => onSelectSection('maintenance')}>
            <span style={iconStyle}>🛠️</span> Mantenimiento e Incidentes
          </li>
          <li style={liStyle} onClick={() => onSelectSection('comms')}>
            <span style={iconStyle}>💬</span> Comunicados
          </li>
          <li style={liStyle} onClick={() => onSelectSection('surveys')}>
            <span style={iconStyle}>📝</span> Encuestas y Sugerencias
          </li>
          <li style={liStyle} onClick={() => onSelectSection('reports')}>
            <span style={iconStyle}>📈</span> Reportes y Estadísticas
          </li>
          <li style={liStyle} onClick={() => onSelectSection('providers')}>
            <span style={iconStyle}>📦</span> Proveedores y Contratos
          </li>
          <li style={liStyle} onClick={() => onSelectSection('users')}>
            <span style={iconStyle}>🧑‍💻</span> Usuarios y Roles
          </li>
          <li style={liStyle} onClick={() => onSelectSection('help')}>
            <span style={iconStyle}>❓</span> Ayuda y Soporte
          </li>
        </ul>
      </nav>
    </aside>
  );
}

export default Sidebar;
