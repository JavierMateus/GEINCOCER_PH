import React, { useState } from "react";

// Usuarios y sus claves
const usuarios = [
  { nombre: "Juan Pérez", rol: "Administrador", clave: "1234" },
  { nombre: "Carlos Ruiz", rol: "Revisor Fiscal", clave: "4567" },
  { nombre: "Maria Suarez", rol: "Presidente Consejo", clave: "abcd" }
];

export default function FirmaDemo() {
  const [doc, setDoc] = useState({
    id: 1,
    titulo: "Reglamento de Convivencia 2025",
    archivo: "reglamento_2025.pdf",
    firmantesRequeridos: usuarios.map(u => u.rol),
    firmantesEfectivos: []
  });

  // Para el input pin/local, usamos el estado referenciado a cada rol
  const [mostrarCampoClave, setMostrarCampoClave] = useState(null); // null o string (rol)
  const [claveIngresada, setClaveIngresada] = useState("");
  const [errorClave, setErrorClave] = useState("");
  const totalFirmantes = doc.firmantesRequeridos.length;
  const totalFirmantesHechos = doc.firmantesEfectivos.length;
  const firmadoCompleto = totalFirmantesHechos === totalFirmantes;

  return (
    <div>
      {/* ---- TARJETA DE FIRMAS ---- */}
      <div style={{
        maxWidth: 450,
        margin: "0 auto 1.5em auto",
        borderRadius: "16px",
        background: "linear-gradient(135deg, #f4f7fb 50%, #e8edfa 100%)",
        boxShadow: "0 8px 36px #b7c7e240, 0 2px 8px #2563eb0f",
        border: "1.5px solid #e1e9fa",
        padding: "1.9em 2.2em 1.2em 2.2em",
        position: "relative"
      }}>
        {/* Icono lápiz */}
        <div style={{
          position: "absolute", right: 16, top: 14, fontSize: 28, color: "#3474e0bb"
        }}>
          🖊️
        </div>
        {/* Estado global de firmas */}
        <div style={{
          position: "absolute",
          top: 12,
          right: 52,
          padding: "2.5px 12px 3px 12px",
          borderRadius: "8px",
          fontWeight: "bold",
          fontSize: ".98em",
          color: firmadoCompleto ? "#0f9034" : "#ba661f",
          background: firmadoCompleto ? "#e2f9e7" : "#fbeee6",
          border: firmadoCompleto ? "1px solid #80e6a6" : "1px solid #f9cda4",
          boxShadow: "0 1px 6px #b7c7e220",
          letterSpacing: ".04em"
        }}>
          {firmadoCompleto ? "FIRMAS COMPLETAS ✔️" : "PENDIENTE FIRMAS ⚠️"}
        </div>

        {/* Título y datos */}
        <div style={{ fontWeight: "bold", fontSize: "1.2em", color: "#212155", marginBottom: 4 }}>
          {doc.titulo}
        </div>
        <div style={{ color: "#4f5874", marginBottom: 7 }}>
          <span style={{ fontWeight: 500, color: "#2654a0" }}>Archivo:</span> {doc.archivo}
        </div>
        <div style={{ marginBottom: 2 }}>
          <b style={{color:"#2654a0"}}>Firmantes requeridos:</b>
          <span style={{ marginLeft: 4, color: "#3d445c" }}>{doc.firmantesRequeridos.join(", ")}</span>
        </div>
        {/* Estado visual de cada firmante y botón de firma */}
        <div>
          <b style={{color:"#298273"}}>Estado de firmas:</b>
          <ul style={{
            margin: "7px 0 8px 0",
            paddingLeft: 20,
            fontWeight: 500
          }}>
            {doc.firmantesRequeridos.map((rol, idx) => {
              const firma = doc.firmantesEfectivos.find(f => f.rol === rol);
              return (
                <li key={rol} style={{
                  color: firma ? "#188246" : "#b53a19",
                  display: "flex", alignItems: "center", gap: 8
                }}>
                  {firma
                    ? <>
                        <span style={{color:"#3376e6"}}>{rol}:</span>
                        <b style={{marginLeft:4}}>{firma.nombre}</b>
                        <span style={{fontSize: ".96em", color:"#8892be",marginLeft:6}}>({firma.fecha})</span>
                        <span style={{fontSize:"1.0em", color:"#27c04c"}}>✔️</span>
                      </>
                    : <>
                        <span style={{color:"#444"}}>{rol}:</span>
                        <span style={{color:"#b53a19",fontWeight:600,marginLeft:4}}>Pendiente</span>
                        <span style={{fontSize:"1.0em", color:"#e56a3e"}}>⚠️</span>
                        <button
                          style={{
                            background: "linear-gradient(90deg,#2563eb 60%,#82d0fa 120%)",
                            color: "#fff",
                            borderRadius: 8,
                            border: "none",
                            fontWeight: "bold",
                            padding: "4px 11px",
                            fontSize: ".93em",
                            marginLeft: 12,
                            cursor: "pointer"
                          }}
                          onClick={() => {
                            setMostrarCampoClave(rol);
                            setClaveIngresada("");
                            setErrorClave("");
                          }}
                        >
                          Firmar
                        </button>
                        {mostrarCampoClave === rol && (
                          <span style={{marginLeft:8}}>
                            <input
                              type="password"
                              placeholder="PIN"
                              value={claveIngresada}
                              onChange={e => setClaveIngresada(e.target.value)}
                              style={{
                                padding: "3px 8px",
                                borderRadius: 6,
                                border: "1px solid #9eb6e3",
                                fontSize: ".93em",
                                marginRight: 5
                              }}
                            />
                            <button
                              onClick={() => {
                                const user = usuarios.find(u => u.rol === rol && u.clave === claveIngresada);
                                if (user) {
                                  const nuevaFirma = {
                                    rol: user.rol,
                                    nombre: user.nombre,
                                    fecha: new Date().toLocaleDateString("es-CO")
                                  };
                                  setDoc(prev => ({
                                    ...prev,
                                    firmantesEfectivos: [...prev.firmantesEfectivos, nuevaFirma]
                                  }));
                                  setMostrarCampoClave(null);
                                  setErrorClave("");
                                } else {
                                  setErrorClave("PIN incorrecto.");
                                }
                              }}
                              style={{
                                background: "linear-gradient(90deg,#2563eb 60%,#82d0fa 120%)",
                                color: "#fff",
                                borderRadius: 7,
                                border: "none",
                                fontWeight: "bold",
                                padding: "3px 10px"
                              }}
                            >OK</button>
                          </span>
                        )}
                      </>
                  }
                  {mostrarCampoClave === rol && errorClave &&
                    <span style={{color:"#b42229", fontWeight:"bold",marginLeft:6,fontSize:".94em"}}>{errorClave}</span>
                  }
                </li>
              );
            })}
          </ul>
        </div>
        {/* Mensaje si ya TODOS firmaron */}
        {firmadoCompleto && (
          <div style={{
            marginTop: "1.2em",
            fontWeight: "bold",
            color: "#0f9034",
            fontSize: "1.08em",
            background: "#e0faeb",
            borderRadius: "8px",
            padding: "0.55em 1em"
          }}>
            ¡El documento ya cuenta con todas las firmas requeridas!
          </div>
        )}
      </div>
    </div>
  );
}
