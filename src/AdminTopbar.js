import React, { useState } from 'react';

function AdminTopbar({ userName = "Carlos Rodriguez", notifications = 3 }) {
  const [showAlerts, setShowAlerts] = useState(false);

  // Simulación de alertas, puedes reemplazar por props/estado real:
  const alerts = [
    { id: 1, text: "Nueva reserva registrada en el salón comunal." },
    { id: 2, text: "Pago recibido de apartamento 301." },
    { id: 3, text: "Mantenimiento pendiente en ascensor Torre B." }
  ];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: '#fff',
      padding: '0.8rem 2rem',
      borderBottom: '1px solid #f2f2f2',
      marginBottom: '0.5rem',
      position: 'relative'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* ... Menú hamburguesa y nombre de conjunto ... */}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', position: 'relative' }}>
        {/* Botón campana */}
        <button
  style={{
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    width: 38,
    height: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    transition: 'background 0.15s'
  }}
  onClick={() => setShowAlerts((prev) => !prev)}
  aria-label="Notificaciones"
  onMouseOver={e => e.currentTarget.style.background = '#e6fafd'}
  onMouseOut={e => e.currentTarget.style.background = 'none'}
>
  {/* ICONO CAMPANA SVG */}
  <svg width="26" height="26" fill="none" stroke="#218290" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
  <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
  <path d="M13.73 21a2 2 0 01-3.46 0"/>
</svg>

  {notifications > 0 &&
    <span style={{
      position: 'absolute',
      top: -2,
      right: -2,
      background: '#D63C35',
      color: '#fff',
      borderRadius: '60%',
      fontSize: '0.9rem',
      minWidth: '22px',
      height: '22px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'bold',
      boxShadow: '0 2px 8px #bbb'
    }}>{notifications}</span>
  }
</button>
{showAlerts && (
  <div style={{
    position: 'absolute',
    right: 0,
    top: '48px',
    width: '340px',
    background: '#fff',
    boxShadow: '0 16px 36px 4px #21829022',
    borderRadius: '14px',
    zIndex: 200,
    padding: '1.2rem 1.1rem 1.1rem 1.1rem',
    animation: 'fadein 0.25s',
    minHeight: '72px',
    overflow: 'hidden'
  }}>
    <h4 style={{
      margin: '0 0 1.09em 0',
      color: '#16a2b2',
      fontWeight: 800,
      letterSpacing: '.04em',
      fontSize: '1.04em'
    }}>Novedades y alertas</h4>
    <ul style={{
      margin: 0,
      padding: 0,
      listStyle: 'none',
      maxHeight: '184px',
      overflowY: 'auto',
    }}>
      {alerts.length > 0 ? alerts.map(alert =>
        <li key={alert.id} style={{
          fontSize: '1.025em',
          color: '#173237',
          marginBottom: '0.6em',
          display: 'flex',
          alignItems: 'start',
          gap: '.6em'
        }}>
          <svg width="16" height="16" fill="#16a2b2" style={{ minWidth: 16, marginTop: 3 }}>
            <circle cx="8" cy="8" r="7" />
          </svg>
          <span>{alert.text}</span>
        </li>
      ) : (
        <li style={{ color: '#999' }}>Sin novedades por el momento.</li>
      )}
    </ul>
  </div>
)}

        {/* PANEL DE NOVEDADES (pop-up bonito y compacto) */}
        {showAlerts && (
          <div style={{
            position: 'absolute',
            right: 0,
            top: '48px',
            width: '340px',
            background: '#fff',
            boxShadow: '0 12px 36px #bbb',
            borderRadius: '11px',
            zIndex: 200,
            padding: '1rem',
            animation: 'fadein 0.24s',
            minHeight: '66px'
          }}>
            <h4 style={{ margin: '0 0 1em 0', color: '#218290', fontWeight: 700 }}>Novedades y alertas</h4>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {alerts.length > 0 ? alerts.map(alert =>
                <li key={alert.id} style={{
                  fontSize: '1.04em',
                  color: '#173237',
                  marginBottom: '0.64em',
                  paddingLeft: '1em',
                  borderLeft: '4px solid #86e2e2'
                }}>
                  • {alert.text}
                </li>
              ) : (
                <li style={{ color: '#999' }}>Sin novedades por el momento.</li>
              )}
            </ul>
          </div>
        )}
        {/* ... resto de topbar ... */}
        <span style={{ color: '#222', fontWeight: 'bold', fontSize: '1.07rem' }}>{userName}</span>
        {/* ...etc */}
      </div>
      <style>
        {`
        @keyframes fadein {
          from { opacity: 0; transform: translateY(14px);}
          to   { opacity: 1; transform: translateY(0);}
        }
        `}
      </style>
    </div>
  );
}

export default AdminTopbar;
