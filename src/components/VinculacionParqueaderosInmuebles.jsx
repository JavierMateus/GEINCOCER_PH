import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function VinculacionParqueaderosInmuebles({ parqueaderos, inmuebles }) {
  const [visible, setVisible] = useState(true);

  // Ocultar automáticamente después de 5 minutos (300 000 ms)
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 300000);
    return () => clearTimeout(timer);
  }, []);

  // Simulación: función para unir/vincular los datos
  // Sustituye por tu lógica real si ya tienes arreglo de datos directo
  function combinarDatos(parqueaderos, inmuebles) {
    return [
      { Parqueadero: "101A, 101B", Inmueble: "101 (Torre 1)", Propietario: "Carlos Torres", Telefono: "987654321" },
      { Parqueadero: "102B", Inmueble: "102 (Torre 1)", Propietario: "Ana Gómez", Telefono: "987654320" },
      { Parqueadero: "S1", Inmueble: "103 (Torre 1)", Propietario: "Laura Gómez", Telefono: "223344556" },
      { Parqueadero: "PH2, PH3", Inmueble: "104 (Torre 1)", Propietario: "María López", Telefono: "444555666" }
    ];
  }

  // Exportar Excel
  const exportarExcel = () => {
    const datos = combinarDatos(parqueaderos, inmuebles);
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vinculaciones");
    const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "vinculacion_inmuebles_parqueaderos.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Exportar PDF
  const exportarPDF = () => {
    const datos = combinarDatos(parqueaderos, inmuebles);
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Vinculación Inmuebles - Parqueaderos", 12, 15);
    if (datos.length > 0) {
      autoTable(doc, {
        startY: 25,
        head: [Object.keys(datos[0])],
        body: datos.map(fila => Object.values(fila))
      });
    } else {
      doc.text("No hay datos para exportar.", 12, 30);
    }
    doc.save("vinculacion_inmuebles_parqueaderos.pdf");
  };

  if (!visible) return null;

  return (
    <div style={{
      marginBottom: "2em",
      background: "#fff",
      borderRadius: "10px",
      boxShadow: "0 2px 16px #c2d6e116",
      padding: "1em"
    }}>
      <h3 style={{ marginBottom: "0.7em" }}>Vinculación Inmuebles - Parqueaderos</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1em" }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #ddd", padding: "0.55em" }}>Parqueadero(s)</th>
            <th style={{ border: "1px solid #ddd", padding: "0.55em" }}>Inmueble</th>
            <th style={{ border: "1px solid #ddd", padding: "0.55em" }}>Propietario</th>
            <th style={{ border: "1px solid #ddd", padding: "0.55em" }}>Teléfono</th>
          </tr>
        </thead>
        <tbody>
          {combinarDatos(parqueaderos, inmuebles).map((row, i) => (
            <tr key={i}>
              <td style={{ border: "1px solid #ddd", padding: "0.55em" }}>{row.Parqueadero}</td>
              <td style={{ border: "1px solid #ddd", padding: "0.55em" }}>{row.Inmueble}</td>
              <td style={{ border: "1px solid #ddd", padding: "0.55em" }}>{row.Propietario}</td>
              <td style={{ border: "1px solid #ddd", padding: "0.55em" }}>{row.Telefono}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ---- Botones y texto de auto-ocultado ---- */}
      <div style={{ display: "flex", gap: "1em", marginTop: "1em", alignItems: "center" }}>
        <button
          style={{ padding: "0.6em 1.5em", background: "#218290", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
          onClick={() => setVisible(false)}
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
