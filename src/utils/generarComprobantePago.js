import jsPDF from "jspdf";

// Datos de la propiedad
const DATOS_PROPIEDAD = {
  nombre: "CONJUNTO RESIDENCIAL CERRADO ALTOS DE MANARE PH",
  nit: "900123456-7", // Opcional: agrega tu NIT
  telefono: "601-1234567", // Opcional: teléfono
  email: "contacto@altosdemanare.com" // Opcional: email
};

export function generarComprobantePago(datoPago) {
  if (!datoPago || !datoPago.ID_Pago) {
    alert("No hay datos de pago para generar el comprobante");
    return;
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 10;

  // --- ENCABEZADO CON NOMBRE DEL CONJUNTO ---
  doc.setFillColor(24, 138, 160);
  doc.rect(0, 0, pageWidth, 35, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(DATOS_PROPIEDAD.nombre, pageWidth / 2, 10, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  if (DATOS_PROPIEDAD.nit) {
    doc.text(`NIT: ${DATOS_PROPIEDAD.nit}`, pageWidth / 2, 17, { align: "center" });
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("COMPROBANTE DE PAGO", pageWidth / 2, 27, { align: "center" });

  doc.setTextColor(0, 0, 0);
  yPosition = 42;

  // --- INFORMACIÓN DEL RECIBO ---
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Información del Recibo", 10, yPosition);
  yPosition += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Número de Recibo: ${datoPago.ID_Pago || "-"}`, 10, yPosition);
  yPosition += 6;
  doc.text(
    `Fecha de Emisión: ${new Date().toLocaleDateString("es-CO")}`,
    10,
    yPosition
  );
  yPosition += 6;
  doc.text(
    `Estado: ${datoPago.Estado || "-"}`,
    10,
    yPosition
  );
  yPosition += 12;

  // --- DATOS DEL RESIDENTE ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Datos del Residente / Propietario", 10, yPosition);
  yPosition += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Nombre: ${datoPago.Nombre || "-"}`, 10, yPosition);
  yPosition += 6;
  doc.text(`Teléfono: ${datoPago.Telefono || "-"}`, 10, yPosition);
  yPosition += 6;
  doc.text(`ID Habitante: ${datoPago.ID_Habitante || "-"}`, 10, yPosition);
  yPosition += 12;

  // --- DATOS DEL INMUEBLE ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Datos del Inmueble", 10, yPosition);
  yPosition += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`ID Inmueble: ${datoPago.ID_Inmueble || "-"}`, 10, yPosition);
  yPosition += 6;
  doc.text(
    `Torre/Manzana: ${datoPago["Torre/Manzana"] || "-"}`,
    10,
    yPosition
  );
  yPosition += 6;
  doc.text(`Apto/Casa: ${datoPago["Apto/Casa"] || "-"}`, 10, yPosition);
  yPosition += 12;

  // --- DETALLES DEL PAGO ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Detalles del Pago", 10, yPosition);
  yPosition += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Periodo: ${datoPago.Periodo || "-"}`, 10, yPosition);
  yPosition += 6;
  doc.text(
    `Valor Pagado: $ ${formatoValor(datoPago.Valor)}`,
    10,
    yPosition
  );
  yPosition += 6;

  if (datoPago.Intereses && datoPago.Intereses !== "0" && datoPago.Intereses !== "") {
    doc.text(
      `Intereses: $ ${formatoValor(datoPago.Intereses)}`,
      10,
      yPosition
    );
    yPosition += 6;
  }

  if (datoPago["Cobro Especial"] && datoPago["Cobro Especial"] !== "0" && datoPago["Cobro Especial"] !== "") {
    doc.text(
      `Cobro Especial: $ ${formatoValor(datoPago["Cobro Especial"])}`,
      10,
      yPosition
    );
    yPosition += 6;
  }

  // Total
  const total =
    (parseFloat(datoPago.Valor) || 0) +
    (parseFloat(datoPago.Intereses) || 0) +
    (parseFloat(datoPago["Cobro Especial"]) || 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(24, 138, 160);
  doc.text(`TOTAL: $ ${formatoValor(total)}`, 10, yPosition + 3);
  doc.setTextColor(0, 0, 0);
  yPosition += 12;

  // --- MÉTODO DE PAGO ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Método de Pago", 10, yPosition);
  yPosition += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Método: ${datoPago["Método Pago"] || "-"}`, 10, yPosition);
  yPosition += 6;

  if (datoPago["Referencia/Transacción"]) {
    doc.text(
      `Referencia: ${datoPago["Referencia/Transacción"]}`,
      10,
      yPosition
    );
    yPosition += 6;
  }

  doc.text(`Fecha de Pago: ${datoPago["Fecha de pago"] || "-"}`, 10, yPosition);
  yPosition += 12;

  // --- INFORMACIÓN ADMINISTRATIVA ---
  if (yPosition < pageHeight - 40) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Información Administrativa", 10, yPosition);
    yPosition += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Registrado por: ${datoPago["Registrado por"] || "-"}`, 10, yPosition);
    yPosition += 6;
    doc.text(
      `Fecha Registro: ${datoPago["Fecha Registro"] || "-"}`,
      10,
      yPosition
    );
    yPosition += 6;

    if (datoPago.Observaciones) {
      doc.text(`Observaciones:`, 10, yPosition);
      yPosition += 6;
      const lineas = doc.splitTextToSize(datoPago.Observaciones, 180);
      doc.text(lineas, 10, yPosition);
      yPosition += lineas.length * 5 + 3;
    }
  }

  // --- PIE DE PÁGINA ---
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(
    "Este documento es un comprobante oficial de pago. Guárdelo para su referencia.",
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );

  // --- DESCARGAR ---
  doc.save(`Comprobante_${datoPago.ID_Pago}.pdf`);
}

function formatoValor(valor) {
  if (!valor || valor === "-" || valor === "") return "0";
  const num = parseFloat(String(valor).replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return "0";
  return num.toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
