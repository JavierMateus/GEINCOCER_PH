// src/components/comprobantePago.js
// Genera el comprobante de pago en PDF.
// Uso:  import { descargarComprobante } from "./comprobantePago";
//       await descargarComprobante("TR-1788469517744-OBL-0010");
// Si el pago se repartio en varias obligaciones, el comprobante las muestra todas.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { API_BASE } from "../config";

// Datos del encabezado. Cambia aqui el nombre y el NIT del conjunto.
export const CONJUNTO = {
  nombre: "GEINCOCER - Administración Residencial",
  nit: "",
  ciudad: "Villavicencio, Meta",
};

const pesos = (n) => `$${Number(n || 0).toLocaleString("es-CO")}`;

// "2026-09-01" o "1/09/2026" -> "1/09/2026"
const fecha = (v) => {
  const t = String(v || "").trim();
  const p = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (p) return `${Number(p[3])}/${p[2].padStart(2, "0")}/${p[1]}`;
  return t;
};

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const periodoTexto = (p) => {
  const m = String(p || "").match(/^(\d{4})-(\d{2})$/);
  return m ? `${MESES[Number(m[2]) - 1]} ${m[1]}` : p || "-";
};

const textoConcepto = (c, s) => {
  const limpio = (v) => String(v || "").replace(/_/g, " ").trim();
  const base = limpio(c);
  const sub = limpio(s);
  if (!sub || sub === base) return base.charAt(0).toUpperCase() + base.slice(1);
  return `${base.charAt(0).toUpperCase() + base.slice(1)} - ${sub}`;
};

export async function descargarComprobante(idPago) {
  if (!idPago) throw new Error("Este pago no tiene ID.");

  const resp = await fetch(`${API_BASE}/api/pagos-recibidos/comprobante/${encodeURIComponent(idPago)}`, { cache: "no-store" });
  const c = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(c.error || "No se pudo generar el comprobante.");

  const doc = new jsPDF("p", "pt", "letter");
  const ancho = doc.internal.pageSize.getWidth();
  const margen = 48;
  const verde = [33, 130, 144];

  // Encabezado
  doc.setFillColor(...verde);
  doc.rect(0, 0, ancho, 78, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(CONJUNTO.nombre, margen, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text([CONJUNTO.nit ? `NIT ${CONJUNTO.nit}` : "", CONJUNTO.ciudad].filter(Boolean).join("  ·  "), margen, 54);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("COMPROBANTE DE PAGO", ancho - margen, 34, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`N° ${c.numero}`, ancho - margen, 54, { align: "right" });

  // Datos del pago y del residente
  doc.setTextColor(30, 41, 59);
  const filaDato = (etiqueta, valor, x, y) => {
    doc.setFont("helvetica", "bold");
    doc.text(etiqueta, x, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(valor || "-"), x + 92, y);
  };

  let y = 112;
  doc.setFontSize(10);
  const inmueble = [c.residente.torreManzana, c.residente.aptoCasa].filter(Boolean).join(" - ");
  filaDato("Residente:", c.residente.nombre, margen, y);
  filaDato("Fecha de pago:", fecha(c.fechaPago), ancho / 2 + 10, y);
  y += 18;
  filaDato("Documento:", c.residente.documento, margen, y);
  filaDato("Método:", c.metodoPago, ancho / 2 + 10, y);
  y += 18;
  filaDato("Inmueble:", inmueble, margen, y);
  filaDato("Referencia:", c.referencia || "-", ancho / 2 + 10, y);
  y += 18;
  filaDato("Registrado por:", c.registradoPor, margen, y);
  filaDato("Estado:", String(c.estado || "").toUpperCase(), ancho / 2 + 10, y);

  // Detalle
  autoTable(doc, {
    startY: y + 22,
    margin: { left: margen, right: margen },
    head: [["Obligación", "Periodo", "Concepto", "Capital", "Intereses", "Total aplicado", "Saldo después"]],
    body: c.detalle.map((d) => [
      d.idObligacion,
      periodoTexto(d.periodo),
      textoConcepto(d.concepto, d.subconcepto),
      pesos(d.capital + d.otros),
      pesos(d.intereses),
      pesos(d.aplicado),
      d.saldoDespues === null ? "-" : d.saldoDespues > 0 ? pesos(d.saldoDespues) : "Pagada",
    ]),
    foot: [["", "", "", "", { content: "TOTAL", styles: { halign: "right" } }, { content: pesos(c.total), styles: { halign: "right" } }, ""]],
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: verde, textColor: 255 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
  });

  let yFinal = doc.lastAutoTable.finalY + 24;

  if (c.detalle.some((d) => d.intereses > 0)) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("El pago se aplicó primero a intereses de mora y luego a capital (art. 1653 del Código Civil).", margen, yFinal);
    yFinal += 16;
  }

  if (c.observaciones) {
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const lineas = doc.splitTextToSize(`Observaciones: ${c.observaciones}`, ancho - margen * 2);
    doc.text(lineas, margen, yFinal);
    yFinal += lineas.length * 12 + 6;
  }

  // Pie
  const alto = doc.internal.pageSize.getHeight();
  const ahora = new Date();
  doc.setDrawColor(203, 213, 225);
  doc.line(margen, alto - 60, ancho - margen, alto - 60);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Generado el ${ahora.toLocaleDateString("es-CO")} a las ${ahora.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} · Este comprobante se genera desde los registros de la administración.`,
    margen,
    alto - 44
  );

  doc.save(`Comprobante_${c.numero}.pdf`);
}

export default descargarComprobante;