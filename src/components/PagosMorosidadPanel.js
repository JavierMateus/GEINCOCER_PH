import React, { useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Supón que el array "pagos" proviene de tu estado global/principal

function PagosMorosidadPanel({ pagos }) {
  const [filtroInicio, setFiltroInicio] = useState("");
  const [filtroFin, setFiltroFin] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("Mora"); // Por defecto solo morosos

  // Aplica los filtros a pagos
  const pagosFiltrados = pagos.filter(p => {
    // Filtrado por fecha
    let fechaPago = p["Fecha de pago"] || p.fecha_pago || "";
    if (fechaPago && filtroInicio && fechaPago < filtroInicio) return false;
    if (fechaPago && filtroFin && fechaPago > filtroFin) return false;
    // Estado
    if (estadoFiltro && p.Estado !== estadoFiltro) return false;
    return true;
  });

  // Resúmenes ejecutivos
  const totalMorosos = pagosFiltrados.length;
  const totalCartera = pagosFiltrados
    .reduce((suma, p) => suma + (parseFloat(p.Valor || 0) || 0), 0)
    .toLocaleString("es-CO", { style: "currency", currency: "COP" });

  // EXPORTADORES
  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(pagosFiltrados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PagosMorosos");
    const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), "informe_morosidad.xlsx");
  };

  const exportarCSV = () => {
    const keys = Object.keys(pagosFiltrados[0] || {});
    let csvRows = [];
    csvRows.push(keys.join(","));
    pagosFiltrados.forEach(row => {
      const values = keys.map(key => 
        `"${(row[key] ?? "").toString().replace(/"/g, '""')}"`
      );
      csvRows.push(values.join(","));
    });
    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv" });
    saveAs(blob, "informe_morosidad.csv");
  };

  const exportarPDF = () => {
    const doc = new jsPDF();
    doc.text("Informe de Morosidad", 10, 10);
    if (pagosFiltrados.length > 0) {
      autoTable(doc, {
        head: [Object.keys(pagosFiltrados[0])],
        body: pagosFiltrados.map(row => Object.values(row))
      });
    } else {
      doc.text("Sin datos.", 10, 20);
    }
    doc.text(`Total morosos: ${totalMorosos}`, 10, doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 30);
    doc.text(`Total cartera: ${totalCartera}`, 10, doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : 40);
    doc.save("informe_morosidad.pdf");
  };

  // IMPRIMIR sólo informe
  const imprimir = () => {
    const printContent = document.getElementById("reporte-morosidad-imprimible").innerHTML;
    const printWindow = window.open('', '', 'width=900,height=700');
    printWindow.document.write('<html><head><title>Informe Morosidad</title></head><body>');
    printWindow.document.write(printContent);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 28, margin: "2em auto", maxWidth: 1300 }}>
      <h3 style={{ marginTop: 0 }}>Informe de Morosidad</h3>
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <span>Entre:</span>
        <input type="date" value={filtroInicio} onChange={e => setFiltroInicio(e.target.value)} />
        <span>y</span>
        <input type="date" value={filtroFin} onChange={e => setFiltroFin(e.target.value)} />
        <span>Estado:</span>
        <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}>
          <option value="">Todos</option>
          <option value="Pagado">Pagado</option>
          <option value="Mora">Mora</option>
        </select>
        <button onClick={imprimir}>Imprimir</button>
        <button onClick={exportarExcel}>Exportar Excel</button>
        <button onClick={exportarCSV}>Exportar CSV</button>
        <button onClick={exportarPDF}>Exportar PDF</button>
      </div>

      <div id="reporte-morosidad-imprimible" style={{ marginTop: 22 }}>
        <table border={1} cellPadding={8} cellSpacing={0} style={{ width: "100%", fontSize: "1em" }}>
          <thead style={{ background: "#f1f5fa" }}>
            <tr>
              <th>ID Pago</th>
              <th>Inmueble</th>
              <th>Torre/Manzana</th>
              <th>Apto/Casa</th>
              <th>Nombre</th>
              <th>Documento</th>
              <th>Periodo</th>
              <th>Valor</th>
              <th>Estado</th>
              <th>Fecha de pago</th>
              <th>Metodo Pago</th>
              <th>Intereses</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {pagosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={13} style={{ textAlign: "center", color: "#b00" }}>No hay datos para este filtro</td>
              </tr>
            ) : (
              pagosFiltrados.map((p, idx) =>
                <tr key={idx}>
                  <td>{p["ID Pago"]}</td>
                  <td>{p["Inmueble"]}</td>
                  <td>{p["Torre/Manzana"]}</td>
                  <td>{p["Apto/Casa"]}</td>
                  <td>{p["Nombre"]}</td>
                  <td>{p["Documento"]}</td>
                  <td>{p["Periodo"]}</td>
                  <td>{p["Valor"]}</td>
                  <td>{p["Estado"]}</td>
                  <td>{p["Fecha de pago"]}</td>
                  <td>{p["Método Pago"]}</td>
                  <td>{p["Intereses"]}</td>
                  <td>{p["Observaciones"]}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
        {/* Resumen ejecutivo */}
        <div style={{ marginTop: 22, borderTop: "2px solid #cce", paddingTop: 12 }}>
          <strong>Total morosos:</strong> {totalMorosos}<br />
          <strong>Total cartera:</strong> {totalCartera}
        </div>
      </div>
    </div>
  );
}

export default PagosMorosidadPanel;
