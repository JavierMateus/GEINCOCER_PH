import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function TablaImportada({ datos, nombre, mostrar, onOcultar }) {
  const [visible, setVisible] = useState(mostrar);

  // Ocultado automático en 5 minutos
  useEffect(() => {
    if (mostrar) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onOcultar();
      }, 300000);
      return () => clearTimeout(timer);
    }
  }, [mostrar, onOcultar]);

  // Exportar Excel
  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, nombre);
    XLSX.writeFile(wb, `${nombre}.xlsx`);
  };

  // Exportar PDF
  const exportarPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Tabla ${nombre}`, 12, 15);
    if (datos.length > 0) {
      autoTable(doc, {
        startY: 25,
        head: [Object.keys(datos[0])],
        body: datos.map(fila => Object.values(fila)),
      });
    } else {
      doc.text("No hay datos para exportar.", 12, 30);
    }
    doc.save(`${nombre}.pdf`);
  };

  if (!visible || !mostrar || datos.length === 0) return null;

  return (
    <div style={{
      margin: "1.5em auto",
      background: "#fff",
      borderRadius: "10px",
      boxShadow: "0 2px 16px #c2d6e116",
      padding: "1em",
      maxWidth: "98%",
    }}>
      <h3 style={{ marginBottom: "0.7em" }}>Tabla de {nombre}</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1em" }}>
        <thead>
          <tr>
            {Object.keys(datos[0]).map((col, idx) => (
              <th key={idx} style={{ border: "1px solid #ddd", padding: "0.55em", background: "#f0f7fa" }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {datos.map((row, i) => (
            <tr key={i}>
              {Object.values(row).map((v, idx) => (
                <td key={idx} style={{ border: "1px solid #ddd", padding: "0.55em" }}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: "1em", marginTop: "1em", alignItems: "center" }}>
        <button
          style={{ padding: "0.6em 1.5em", background: "#218290", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
          onClick={() => { setVisible(false); onOcultar(); }}
        >Ocultar ahora</button>
        <button
          style={{ padding: "0.6em 1.5em", background: "#24a05a", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
          onClick={exportarExcel}
        >Exportar Excel</button>
        <button
          style={{ padding: "0.6em 1.5em", background: "#d1424a", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
          onClick={exportarPDF}
        >Exportar PDF</button>
      </div>
      <div style={{ marginTop: "0.8em", color: "#888", fontSize: "0.95em" }}>
        Esta tabla se ocultará automáticamente en 5 minutos.
      </div>
    </div>
  );
}
