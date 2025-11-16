import React, { useState } from "react";
import { generarComprobantePago } from "../utils/generarComprobantePago";
import FormularioPago from "./FormularioPago";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import Papa from "papaparse";


function PagosPanel({ pagosData: inicial, onOcultar, exportarExcel, exportarPDF }) {
  const [mostrarMorosos, setMostrarMorosos] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [pagos, setPagos] = useState(inicial); // <<--- aquí

  // Función para convertir número de Excel a fecha
  function excelDateToJSDate(excelDate) {
    return new Date((excelDate - 25569) * 86400 * 1000);
  }

  // Función para formatear fechas correctamente (VERSIÓN FINAL)
  function formatoFecha(valor) {
    if (!valor || valor === "-" || valor === "") return "-";
    
    const valorStr = String(valor).trim();
    
    // Si es número Excel tipo 45657.99981481815 (CONVERTIR PRIMERO)
    if (/^\d{4,}\.\d+$/.test(valorStr) || /^\d{5}$/.test(valorStr)) {
      try {
        const excelNum = parseFloat(valorStr);
        if (!isNaN(excelNum) && excelNum > 1) {
          const fecha = excelDateToJSDate(excelNum);
          const dia = String(fecha.getDate()).padStart(2, "0");
          const mes = String(fecha.getMonth() + 1).padStart(2, "0");
          const anio = fecha.getFullYear();
          return `${dia}/${mes}/${anio}`;
        }
      } catch (e) {
        return "-";
      }
    }

    // Si ya viene como string dd/mm/aaaa o d/m/aa
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(valorStr)) {
      const partes = valorStr.split("/");
      const dia = partes[0].padStart(2, "0");
      const mes = partes[1].padStart(2, "0");
      const anio = partes[2].length === 2 ? "20" + partes[2] : partes[2];
      return `${dia}/${mes}/${anio}`;
    }

    // Si viene como "ene-00", "dic-24", etc.
    const meses = {
      "ene": "01", "feb": "02", "mar": "03", "abr": "04",
      "may": "05", "jun": "06", "jul": "07", "ago": "08",
      "sep": "09", "oct": "10", "nov": "11", "dic": "12"
    };
    
    const valorLower = valorStr.toLowerCase();
    const partes = valorLower.split("-");
    
    if (partes.length === 2 && meses[partes[0]]) {
      const mes = meses[partes[0]];
      const anio = partes[1].length === 2 ? "20" + partes[1] : partes[1];
      return `01/${mes}/${anio}`;
    }

    return valorStr;
  }

  // Función para formatear valores numéricos
  function formatoValor(valor) {
    if (!valor || valor === "-" || valor === "") return "-";
    const num = parseFloat(String(valor).replace(/[^0-9.-]/g, ""));
    if (isNaN(num)) return "-";
    return num.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

    // Exportar TODO el estado 'pagos' a Excel
function exportarExcelLocal() {
  const ws = XLSX.utils.json_to_sheet(pagos);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pagos");
  XLSX.writeFile(wb, "Pagos.xlsx");
}
function exportarMorososConTotales() {
  // Definir columnas en el orden correcto
  const cols = [
    "ID_Pago", "ID_Inmueble", "Torre/Manzana", "Apto/Casa", "Nombre", "Telefono", "Periodo", "Valor",
    "Estado", "Fecha de pago", "Método Pago", "Referencia/Transacción", "Intereses", "Cobro Especial", "Total a Cobrar",
    "Observaciones", "Registrado por", "Fecha Registro"
  ];

  // Solo los morosos
  const morosos = pagos.filter(
    p => String(p.Estado || "").toLowerCase() === "mora"
  );

  const datosConTotal = morosos.map(p => {
    let interes = p.Intereses;
    let especial = p["Cobro Especial"];
    if (!interes || interes === "-" || interes === 0) {
      interes = Math.round((Number(p.Valor) || 0) * 0.02);
    }
    if (!especial || especial === "-" || especial === 0) {
      especial = 0;
    }
    const totalCobrar =
      (Number(p.Valor) || 0) +
      (Number(interes) || 0) +
      (Number(especial) || 0);

    return {
      ...p,
      "Intereses": interes,
      "Cobro Especial": especial,
      "Total a Cobrar": totalCobrar
    };
  });

  // Exportar a Excel
  const ws = XLSX.utils.json_to_sheet(datosConTotal, { header: cols });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Morosos");
  XLSX.writeFile(wb, "Morosos_con_total.xlsx");

  // También a CSV (opcional)
  const csv = Papa.unparse(datosConTotal, { columns: cols, delimiter: ";" });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "Morosos_con_total.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Exportar tabla 'pagos' a PDF
function exportarPDFLocal() {
  const doc = new jsPDF('l');
  doc.setFontSize(15);
  doc.text("Gestión de Pagos", 14, 18);
  const cols = [
    "ID_Pago", "ID_Inmueble", "Torre/Manzana", "Apto/Casa", "Nombre", "Telefono",
    "Periodo", "Valor", "Estado", "Fecha de pago", "Método Pago", "Referencia/Transacción",
    "Intereses", "Cobro Especial", "Observaciones", "Registrado por", "Fecha Registro"
  ];
  const rows = pagos.map(p => cols.map(k => p[k] ?? "-"));
  autoTable(doc, { head: [cols], body: rows, startY: 24, fontSize: 8 });
  doc.save("Pagos.pdf");
}

// Exportar lista de morosos actual a CSV
function exportarMorososLocal() {
  const csv = Papa.unparse(morosos, { delimiter: ";" });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "morosos.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Oculte: si la función onOcultar NO depende de pagos, solo déjala igual.
// Si es necesario, puedes poner tu lógica aquí.


  // Filtra solo morosos
  
  const morosos = pagos.filter(
    p => {
      const estado = String(p.Estado || "").toLowerCase();
      return estado === "mora";
    }
  );

  // Exportador solo morosos
  function exportarMorosos() {
    const csv = Papa.unparse(morosos, { delimiter: ";" });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "morosos.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
function calcularInteresYExtra(p) {
  // Solo si es "Mora" y campos vacíos
  let interes = p.Intereses;
  let especial = p["Cobro Especial"];

  if ((p.Estado+"").toLowerCase() === "mora") {
    if (!interes || interes === "-") {
      interes = Math.round((Number(p.Valor) || 0) * 0.02); // 2% de interés sugerido
    }
    if (!especial || especial === "-") {
      especial = 0; // O pon otro cálculo si deseas
    }
  }
  return { interes, especial };
}
  return (

        <div style={{ padding: "2em" }}>
      <h2>Gestión de Pagos / Exportar Morosos</h2>
      {/* --- TABLA PRINCIPAL --- */}

      <button
  style={{
    background: "#15aabf", color: "#fff", border: "none", borderRadius: 8,
    padding: "8px 20px", fontWeight: "bold", marginBottom: 16, cursor: "pointer"
  }}
  onClick={() => setShowPagoModal(true)}
>
  + Registrar Pago Manual
</button>

{showPagoModal && (
  <FormularioPago
    onGuardar={nuevoPago => { setPagos([...pagos, nuevoPago]); setShowPagoModal(false); }}
    onClose={() => setShowPagoModal(false)}
  />
)}

      <table border={1} cellPadding={3} style={{ width: "100%", fontSize: ".95em" }}>
        <thead>
          <tr>
            <th>ID Pago</th>
            <th>Inmueble</th>
            <th>Torre/Manzana</th>
            <th>Apto/Casa</th>
            <th>Nombre</th>
            <th>Teléfono</th>
            <th>Periodo</th>
            <th>Valor</th>
            <th>Estado</th>
            <th>Fecha de pago</th>
            <th>Método Pago</th>
            <th>Referencia</th>
            <th>Intereses</th>
            <th>Cobro Especial</th>
            <th>Total a Cobrar</th>
            <th>Observaciones</th>
            <th>Registrado por</th>
            <th>Fecha Registro</th>
            <th>Comprobante</th>
            </tr>
        </thead>
        <tbody>
          {(mostrarMorosos ? morosos : pagos).map((p, i) => (
            <tr key={p.ID_Pago || i}>
  <td>{p.ID_Pago || "-"}</td>
  <td>{p.ID_Inmueble || "-"}</td>
  <td>{p["Torre/Manzana"] || "-"}</td>
  <td>{p["Apto/Casa"] || "-"}</td>
  <td>{p.Nombre || "-"}</td>
  <td>{p.Telefono || "-"}</td>
  <td>{formatoFecha(p.Periodo)}</td>
  <td style={{ textAlign: "right" }}>{formatoValor(p.Valor)}</td>
  <td>{p.Estado || "-"}</td>
  <td>{formatoFecha(p["Fecha de pago"])}</td>
  <td>{p["Método Pago"] || "-"}</td>
  <td>{p["Referencia/Transacción"] || "-"}</td>
  {/* Celdas interés/extra/total */}
  {(() => {
    const { interes, especial } = calcularInteresYExtra(p);
    const totalCobrar = (Number(p.Valor) || 0) + (Number(interes) || 0) + (Number(especial) || 0);
    return (
      <>
        <td style={{ textAlign: "right" }}>{formatoValor(interes)}</td>
        <td style={{ textAlign: "right" }}>{formatoValor(especial)}</td>
        <td style={{ textAlign: "right", fontWeight: "bold", background: "#ffe8b6" }}>
          {formatoValor(totalCobrar)}
        </td>
      </>
    );
  })()}
  <td>{p.Observaciones || "-"}</td>
  <td>{p["Registrado por"] || "-"}</td>
  <td>{formatoFecha(p["Fecha Registro"])}</td>
  {/* Comprobante al FINAL */}
  <td>
    {p.Estado && p.Estado.toLowerCase() === "pagado" ? (
      <button
        onClick={() => {
          generarComprobantePago(p);
        }}
        style={{
          background: "#31980c", color: "#fff", padding: "6px 12px",
          border: "none", borderRadius: "6px", cursor: "pointer",
          fontWeight: "bold", fontSize: "0.9em"
        }}>
        📥 Descargar
      </button>
    ) : (
      <span style={{ color: "#999" }}>-</span>
    )}
  </td>
</tr>

          ))}
        </tbody>
      </table>
      {/* --- BOTONES DE ACCIONES INFERIORES --- */}
      <div style={{ margin: "1.5em 0", display: "flex", gap: "1em", flexWrap: "wrap" }}>
  <button
    onClick={onOcultar}
    style={{
      background: "#188aac",
      color: "#fff", padding: "8px 18px",
      borderRadius: "10px", border: "none",
      fontWeight: "bold", fontSize: "1em", cursor: "pointer"
    }}>
    Ocultar ahora
  </button>
  <button
    onClick={exportarExcelLocal}
    style={{
      background: "#31980c",
      color: "#fff", padding: "8px 18px",
      borderRadius: "10px", border: "none",
      fontWeight: "bold", fontSize: "1em", cursor: "pointer"
    }}>
      
    Exportar Excel
  </button>
  <button
    onClick={exportarPDFLocal}
    style={{
      background: "#e43c38",
      color: "#fff", padding: "8px 18px",
      borderRadius: "10px", border: "none",
      fontWeight: "bold", fontSize: "1em", cursor: "pointer"
    }}>
    Exportar PDF
  </button>
  <button
    onClick={() => setMostrarMorosos(m => !m)}
    style={{
      background: mostrarMorosos ? "#d98332" : "#188aac",
      color: "#fff", padding: "8px 18px",
      borderRadius: "10px", border: "none",
      fontWeight: "bold", fontSize: "1em", cursor: "pointer"
    }}>
    {mostrarMorosos ? "Ver Todos" : "Ver Solo Morosos"}
  </button>
  <button
    onClick={exportarMorososLocal}
    style={{
      background: "#31980c",
      color: "#fff", padding: "8px 18px",
      borderRadius: "10px", border: "none",
      fontWeight: "bold", fontSize: "1em", cursor: "pointer"
    }}>
    Exportar Morosos
  </button>
  <button
  onClick={exportarMorososConTotales}
  style={{
    background: "#e48b0d",
    color: "#fff", padding: "8px 18px",
    borderRadius: "10px", border: "none",
    fontWeight: "bold", fontSize: "1em", cursor: "pointer"
  }}>
  Exportar Morosos con Total
</button>

</div>
</div>
  );
}

export default PagosPanel;

