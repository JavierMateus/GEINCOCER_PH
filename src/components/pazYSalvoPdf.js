// src/components/pazYSalvoPdf.js
// Expide el paz y salvo de un inmueble y descarga el PDF.
// Uso:  import { expedirPazYSalvo } from "./pazYSalvoPdf";
//       await expedirPazYSalvo({ torre: "T-1", apto: "104", solicitadoPor: "Ana Gómez" });
// Si el inmueble tiene deudas en mora, lanza un error con el detalle (err.enMora).

import jsPDF from "jspdf";
import { API_BASE } from "../config";
import { CONJUNTO } from "./comprobantePago";

const pesos = (n) => `$${Number(n || 0).toLocaleString("es-CO")}`;
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const periodoTexto = (p) => {
  const m = String(p || "").match(/^(\d{4})-(\d{2})$/);
  return m ? `${MESES[Number(m[2]) - 1]} ${m[1]}` : p || "";
};
const conceptoTexto = (c) => {
  const t = String(c || "").replace(/_/g, " ").trim();
  if (t === "administracion") return "cuota de administración";
  if (t === "interes mora") return "intereses de mora";
  return t;
};

export async function expedirPazYSalvo({ torre, apto, solicitadoPor }) {
  const resp = await fetch(`${API_BASE}/api/pagos-recibidos/paz-y-salvo/expedir`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ torre, apto, solicitadoPor }),
  });
  const d = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(d.error || "No se pudo expedir el paz y salvo.");
    err.enMora = d.enMora || [];
    throw err;
  }

  const doc = new jsPDF("p", "pt", "letter");
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const margen = 64;
  const verde = [33, 130, 144];
  const inmueble = `${d.torreManzana} - ${d.aptoCasa}`;
  const nombre = (d.titular?.nombre || "").toUpperCase();

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
  doc.text(`N° ${d.numero}`, ancho - margen, 54, { align: "right" });

  // Titulo
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("PAZ Y SALVO", ancho / 2, 140, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Certificado de expensas comunes (Ley 675 de 2001, art. 29)", ancho / 2, 160, { align: "center" });

  // Cuerpo
  const parrafo = (texto, y, opciones = {}) => {
    doc.setFont("helvetica", opciones.negrita ? "bold" : "normal");
    doc.setFontSize(opciones.tamano || 12);
    const lineas = doc.splitTextToSize(texto, ancho - margen * 2);
    doc.text(lineas, margen, y, { align: "justify", maxWidth: ancho - margen * 2, lineHeightFactor: 1.5 });
    return y + lineas.length * (opciones.tamano || 12) * 1.5 + 14;
  };

  let y = 210;
  y = parrafo(`La Administración de ${CONJUNTO.nombre} certifica que el inmueble ${inmueble}, cuyo titular registrado es ${nombre}${d.titular?.documento ? `, identificado(a) con documento No. ${d.titular.documento}` : ""}, se encuentra a PAZ Y SALVO por concepto de expensas comunes: cuotas de administración, cuotas extraordinarias, intereses de mora, multas y demás obligaciones vencidas a la fecha.`, y);

  if (d.porVencer?.length) {
    const total = d.porVencer.reduce((s, o) => s + o.saldo, 0);
    const lista = d.porVencer.map((o) => `${conceptoTexto(o.concepto)} de ${periodoTexto(o.periodo)} (${pesos(o.saldo)}, vence el ${o.vence})`).join("; ");
    y = parrafo(`Nota: a la fecha el inmueble tiene ${pesos(total)} en obligaciones cuyo plazo de pago aún no ha vencido: ${lista}.`, y, { tamano: 10.5 });
  }

  y = parrafo(`Se expide en ${CONJUNTO.ciudad} el ${d.fechaExpedicion}${d.solicitadoPor ? `, a solicitud de ${d.solicitadoPor}` : ""}.`, y);

  // Vigencia destacada
  doc.setFillColor(236, 254, 255);
  doc.setDrawColor(...verde);
  doc.roundedRect(margen, y, ancho - margen * 2, 40, 6, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...verde);
  doc.text(`Válido hasta el ${d.validoHasta}`, ancho / 2, y + 25, { align: "center" });

  // Firma
  const yFirma = Math.max(y + 140, 560);
  doc.setDrawColor(100, 116, 139);
  doc.line(ancho / 2 - 120, yFirma, ancho / 2 + 120, yFirma);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Administración", ancho / 2, yFirma + 16, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(CONJUNTO.nombre, ancho / 2, yFirma + 30, { align: "center" });

  // Pie
  doc.setDrawColor(203, 213, 225);
  doc.line(margen, alto - 60, ancho - margen, alto - 60);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Certificado N° ${d.numero}. Para verificarlo, comuníquese con la administración e indique este número.`, margen, alto - 44);

  doc.save(`PazYSalvo_${d.torreManzana}_${d.aptoCasa}_${d.numero}.pdf`.replace(/\s+/g, ""));
  return d;
}

export default expedirPazYSalvo;