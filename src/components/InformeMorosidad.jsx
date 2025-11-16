import React, { useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { useReactToPrint } from "react-to-print";

const azul = "#15aabf";

const InformeMorosidad = ({ pagos }) => {
  const [filtroEstado, setFiltroEstado] = useState("Mora");
  const [filtroFecha, setFiltroFecha] = useState("");
  const refTabla = useRef();

  const pagosFiltrados = useMemo(() => {
    return pagos.filter((pago) => {
      const cumpleEstado = filtroEstado === "" || pago.Estado === filtroEstado;
      const cumpleFecha =
        filtroFecha === "" ||
        (pago["Fecha de pago"] && pago["Fecha de pago"].startsWith(filtroFecha));
      return cumpleEstado && cumpleFecha;
    });
  }, [pagos, filtroEstado, filtroFecha]);

  const totalMorosos = pagosFiltrados.length;
  const sumaCartera = pagosFiltrados.reduce((sum, pago) => sum + Number(pago.Valor), 0);

  // Exportar funciones...
  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(pagosFiltrados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Morosidad");
    XLSX.writeFile(wb, "InformeMorosidad.xlsx");
  };

  const exportarCSV = () => {
    const ws = XLSX.utils.json_to_sheet(pagosFiltrados);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv" });
    saveAs(blob, "InformeMorosidad.csv");
  };

  const exportarPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Informe de Morosidad", 14, 14);
    doc.setFontSize(12);
    doc.text(
      `Total morosos: ${totalMorosos}   Suma total cartera: $${sumaCartera.toLocaleString("es-CO")}`,
      14,
      22
    );
    const columns = ["ID_Pago", "Nombre", "Valor", "Fecha de pago"];
    const rows = pagosFiltrados.map((p) => [
      p["ID_Pago"] || p["ID Pago"],
      p.Nombre,
      p.Valor,
      p["Fecha de pago"]
    ]);
    doc.autoTable({
      startY: 28,
      head: [columns],
      body: rows
    });
    doc.save("InformeMorosidad.pdf");
  };

  const handlePrint = useReactToPrint({
    content: () => refTabla.current,
    documentTitle: "Informe de Morosidad"
  });

  return (
    <div style={{
      background: "transparent",
      padding: "0",
      boxShadow: "none",
      borderRadius: "0"
    }}>
      <h2 style={{ marginBottom: 10 }}>Informe de Morosidad</h2>
      <div style={{ marginBottom: 16 }}>
        <label>
          Estado:{" "}
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="Mora">Mora</option>
            <option value="Pagado">Pagado</option>
          </select>
        </label>
        <label style={{ marginLeft: 16 }}>
          Fecha de pago (año-mes):{" "}
          <input
            type="month"
            value={filtroFecha}
            onChange={e => setFiltroFecha(e.target.value)}
          />
        </label>
      </div>
      <div ref={refTabla}>
        <table
          style={{
            width: "100%",
            marginBottom: 16,
            borderCollapse: "collapse",
            background: "transparent",
            boxShadow: "none"
          }}
        >
          <thead>
            <tr>
              <th style={{
                background: azul,
                color: "#fff",
                fontWeight: "bold",
                fontSize: "1em",
                border: "none"
              }}>ID Pago</th>
              <th style={{
                background: azul,
                color: "#fff",
                fontWeight: "bold",
                fontSize: "1em",
                border: "none"
              }}>Nombre</th>
              <th style={{
                background: azul,
                color: "#fff",
                fontWeight: "bold",
                fontSize: "1em",
                border: "none"
              }}>Valor</th>
              <th style={{
                background: azul,
                color: "#fff",
                fontWeight: "bold",
                fontSize: "1em",
                border: "none"
              }}>Fecha de pago</th>
            </tr>
          </thead>
          <tbody>
            {pagosFiltrados.map((pago, idx) => (
              <tr key={idx}>
                <td style={{
                  background: "#fff",
                  color: "#222",
                  border: "none"
                }}>{pago["ID_Pago"] || pago["ID Pago"]}</td>
                <td style={{
                  background: "#fff",
                  color: "#222",
                  border: "none"
                }}>{pago.Nombre}</td>
                <td style={{
                  background: "#fff",
                  color: "#222",
                  border: "none"
                }}>${Number(pago.Valor).toLocaleString("es-CO")}</td>
                <td style={{
                  background: "#fff",
                  color: "#222",
                  border: "none"
                }}>{pago["Fecha de pago"]}</td>
              </tr>
            ))}
            {pagosFiltrados.length === 0 && (
              <tr>
                <td colSpan={4} style={{
                  textAlign: "center",
                  background: "#fff",
                  color: "#222",
                  border: "none"
                }}>
                  No hay registros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ marginBottom: 16 }}>
        <strong>Total morosos:</strong> {totalMorosos} &nbsp;
        <strong>Suma total cartera:</strong> ${sumaCartera.toLocaleString("es-CO")}
      </div>
      <div>
        <button onClick={exportarExcel}>Exportar a Excel</button>
        <button onClick={exportarCSV} style={{ marginLeft: 8 }}>Exportar a CSV</button>
        <button onClick={exportarPDF} style={{ marginLeft: 8 }}>Exportar a PDF</button>
        <button onClick={handlePrint} style={{ marginLeft: 8 }}>Imprimir</button>
      </div>
    </div>
  );
};

export default InformeMorosidad;
