// CardFirmas.jsx
import React, { useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { PDFDocument, rgb } from "pdf-lib";

const ejemploDocumento = {
  titulo: "Circular 001 Convivencia",
  archivo: "/reglamento_2025.pdf", // Cambia esto por la ruta real de tu PDF, puede ser variable
  firmantesRequeridos: [
    { nombre: "Juan Pérez", rol: "Administrador" },
    { nombre: "Carlos Ruiz", rol: "Revisor Fiscal" },
    { nombre: "Maria Suarez", rol: "Presidente Consejo" }
  ],
  estadoFirmas: [
    { nombre: "Juan Pérez", rol: "Administrador", firmado: true, fecha: "2/11/2025" },
    { nombre: "Carlos Ruiz", rol: "Revisor Fiscal", firmado: false },
    { nombre: "Maria Suarez", rol: "Presidente Consejo", firmado: true, fecha: "2/11/2025" }
  ]
};

function CardFirmas({ usuario }) {
  const [pdfFinal, setPdfFinal] = useState(null);
  const [firmando, setFirmando] = useState(false);
  const sigRef = React.useRef();

  // Solo permite firmar si el usuario está asignado y no ha firmado
  const miFirma = ejemploDocumento.estadoFirmas.find(f => f.nombre === usuario.nombre);
  const puedeFirmar = miFirma && !miFirma.firmado;

  const firmarDocumento = async () => {
    setFirmando(true);
    const firmaImg = sigRef.current.getTrimmedCanvas().toDataURL("image/png");
    const res = await fetch(ejemploDocumento.archivo);
    const pdfBytes = await res.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const page = pdfDoc.getPage(0);
    const firmaImage = await pdfDoc.embedPng(firmaImg);
    page.drawImage(firmaImage, { x: 50, y: 60, width: 150, height: 50 });
    page.drawText(`Firmado por: ${usuario.nombre} | Rol: ${usuario.rol} | Fecha: ${new Date().toLocaleDateString()}`, {
      x: 50,
      y: 30,
      size: 10,
      color: rgb(0, 0.5, 0.5)
    });
    const newPdfBytes = await pdfDoc.save();
    setPdfFinal(URL.createObjectURL(new Blob([newPdfBytes])));
    setFirmando(false);
    // Puedes aquí actualizar el estatus en backend/base de datos si lo necesitas
  };

  return (
    <div style={{ 
      maxWidth: 480, 
      margin: "2em auto", 
      background: "#fff", 
      borderRadius: 16, 
      boxShadow: "0 6px 32px #d4edf29a", 
      padding: "2em 1em" 
    }}>
      <h2 style={{ color: "#227" }}>Firmas Digitales</h2>
      <p><strong>Documento:</strong> {ejemploDocumento.titulo}</p>
      <ul style={{ padding: 0, margin: "1em 0" }}>
        {ejemploDocumento.firmantesRequeridos.map((f, i) => (
          <li key={i} style={{ 
            listStyle: "none", marginBottom: "0.5em", 
            color: ejemploDocumento.estadoFirmas[i]?.firmado ? "#089b3b" : "#d9324f"
          }}>
            <strong>{f.rol}:</strong> {f.nombre}
            {" "}
            {ejemploDocumento.estadoFirmas[i]?.firmado && "✔️"}
            {!ejemploDocumento.estadoFirmas[i]?.firmado && "Pendiente"}
          </li>
        ))}
      </ul>
      {puedeFirmar && (
        <div style={{ margin: "1em 0" }}>
          <h4>Tu firma manuscrita:</h4>
          <SignatureCanvas ref={sigRef} backgroundColor="#fff" penColor="#218290" canvasProps={{ width: 300, height: 70, style: { borderRadius: 10, border: "1px solid #ccc" } }} />
          <button
            style={{ marginTop: "1em", padding: "10px 22px", borderRadius: "12px", background: "#218290", color: "#fff", fontWeight: "bold" }}
            onClick={firmarDocumento} disabled={firmando}
          >
            {firmando ? "Firmando..." : "Firmar y Adjuntar al PDF"}
          </button>
        </div>
      )}
      {pdfFinal && (
        <a href={pdfFinal} download={`Documento_${usuario.nombre}_Firmado.pdf`} style={{ display: "block", marginTop: "1em", color: "#17677f", fontWeight: "bold", textAlign: "center" }}>
          Descargar documento firmado
        </a>
      )}
    </div>
  );
}

export default CardFirmas;

// USO: En tu dashboard principal importándolo así:
// <CardFirmas usuario={usuario} />
