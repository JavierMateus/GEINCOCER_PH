import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useSearchParams, useNavigate } from 'react-router-dom';

const PagosResultado = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [estado, setEstado] = useState('');
  const [preferenciaId, setPreferenciaId] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  
  // ← AÑADE ESTA LÍNEA: una ref para ejecutar solo una vez
  const procesoIniciado = useRef(false);
useEffect(() => {
  const status = searchParams.get('status');
  const preference_id = searchParams.get('preference_id');
  const payment_id =
    searchParams.get('payment_id') || searchParams.get('collection_id');

  console.log('🔍 Query params:', { status, preference_id, payment_id });

  setEstado(status || 'unknown');
  setPreferenciaId(preference_id || '');
  setPaymentId(payment_id || '');

  if (
    (status === 'success' || status === 'approved') &&
    preference_id &&
    !procesoIniciado.current
  ) {
    procesoIniciado.current = true;
    procesarPagoExitoso(preference_id, payment_id);
  }
}, [searchParams]);


  const procesarPagoExitoso = async (preferenceId, paymentId) => {
    setGuardando(true);
    try {
      const response = await axios.post('http://localhost:4000/api/mercadopago/resultado', {
        preferenceId,
        paymentId: paymentId || searchParams.get('payment_id')
      });

      if (response.data.exito) {
        setMensaje('✅ Pago registrado exitosamente en la tabla pagos');
        setTimeout(() => navigate('/'), 3000);
      }
    } catch (error) {
      setMensaje('❌ Error al registrar pago: ' + (error.response?.data?.mensaje || error.message));
    }
    setGuardando(false);
  };

  return (
    <div style={{ padding: '50px', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Resultado del Pago</h2>
      <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '10px', margin: '20px 0' }}>
        <p><strong>Estado:</strong> {estado}</p>
        <p><strong>Preferencia ID:</strong> {preferenciaId}</p>
        <p><strong>Payment ID:</strong> {paymentId}</p>
        {guardando && <p>🔄 Guardando pago en la tabla...</p>}
        {mensaje && <p style={{ color: mensaje.includes('✅') ? 'green' : 'red', fontWeight: 'bold' }}>{mensaje}</p>}
      </div>
      <button 
        onClick={() => navigate('/')} 
        style={{ padding: '12px 30px', fontSize: '16px', background: '#28a745', color: 'white', border: 'none', borderRadius: '5px' }}
      >
        ← Volver al Dashboard
      </button>
    </div>
  );
};

export default PagosResultado;
