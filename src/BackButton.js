import React from 'react';

function BackButton({ onBack }) {
  return (
    <div style={{
      position: 'absolute',
      top: 160,         // Ajusta la altura a tu gusto
      right: 48,
      zIndex: 99,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <button
        onClick={onBack}
        style={{
          background: 'linear-gradient(135deg, #23b4b7 0%, #218291 100%)',
          color: '#fff',
          border: 'none',
          borderRadius: '60px',
          width: '72px',
          height: '72px',
          fontSize: '2.8rem',
          boxShadow: '0 8px 28px rgba(32, 122, 144, 0.23), 0 2px 8px #9fbbc4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'box-shadow 0.18s, transform 0.18s'
        }}
        aria-label="Regresar"
        onMouseOver={e => {
          e.currentTarget.style.boxShadow = "0 10px 36px 4px #23b4b766, 0 2px 24px #23b4b733";
          e.currentTarget.style.transform = "scale(1.06)";
        }}
        onMouseOut={e => {
          e.currentTarget.style.boxShadow = "0 8px 28px rgba(32, 122, 144, 0.23), 0 2px 8px #9fbbc4";
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        {/* SVG flecha premium */}
        <svg width="44" height="44" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span style={{
        color: "#218290",
        fontSize: "1.14rem",
        marginTop: "0.75em",
        fontWeight: "bold",
        letterSpacing: '.5px'
      }}>
        Regresar
      </span>
    </div>
  );
}

export default BackButton;
