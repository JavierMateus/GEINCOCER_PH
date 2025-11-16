import React from "react";

function NotificacionesButton({ onClick, count, badge }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: "2.1em",
        minWidth: 140,
        minHeight: 140,
        borderRadius: "25px",
        background: "#f5fbff",
        boxShadow: "0 2px 20px #daeaf0",
        position: "relative",
        fontWeight: "bold",
        fontSize: "1.0em"
      }}
    >
      <span style={{ fontSize: "2.3em"}}>🔔</span>
      <div style={{ margin: ".4em 0 .1em" }}>Notificaciones</div>
      <span style={{fontWeight: "bold", color: "#218290", fontSize: "2em"}}>
        {count}
      </span>
      {badge > 0 && (
        <span style={{
          position: "absolute",
          top: 11,
          right: 18,
          background: "#eb4242",
          color: "#fff",
          borderRadius: "50%",
          padding: "2px 10px",
          fontWeight: "bold",
          fontSize: "0.99em"
        }}>{badge}</span>
      )}
    </div>
  );
}

export default NotificacionesButton;
