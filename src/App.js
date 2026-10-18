import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./components/HomePage";
import PagosAdmin from "./components/PagosAdmin";
import CapturaPagoMercadoPago from "./components/CapturaPagoMercadoPago";
import PagoOnline from "./components/PagoOnline";
import ConfirmarPagoMp from "./ConfirmarPagoMp";
import PagosResultado from "./pages/PagosResultado";
import ListadoPagosAdmin from './components/ListadoPagosAdmin';
import InformeMorosidad from "./components/InformeMorosidad"; // <--- NUEVO

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin/pagos" element={<PagosAdmin />} />
        <Route path="/residente/pagos" element={<PagoOnline />} />
        <Route path="/admin/confirmar-pago-mp" element={<ConfirmarPagoMp />} />
        <Route path="/pagos/resultado" element={<PagosResultado />} />
        <Route path="/admin/pagos/listado" element={<ListadoPagosAdmin />} />
        {/* NUEVA RUTA DEL INFORME */}
        <Route path="/admin/informe-morosidad" element={<InformeMorosidad />}
        />
      </Routes>
    </Router>
  );
}

export default App;
