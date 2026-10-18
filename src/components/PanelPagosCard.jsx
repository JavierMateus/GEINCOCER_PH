import React from "react";
import { Link } from "react-router-dom";
import BotonImportacion from "./BotonImportacion";

export default function PanelPagosCard() {
  return (
    <Link to="/admin/pagos" style={{ textDecoration: "none" }}>
      {/* Reutiliza exactamente el mismo botón de pagos */}
      <BotonImportacion
        tipo="pagos"              // mismo tipo ⇒ mismo icono y colores
        titulo="Panel Pagos Online"
        onFileChange={() => {}}   // no usaremos input aquí
      />
    </Link>
  );
}
