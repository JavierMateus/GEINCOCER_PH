import React, { useState } from 'react';

const inputStyle = {
  width: '100%',
  padding: '0.8em',
  margin: '0.5em 0 1.2em 0',
  border: '1px solid #b5b5b5',
  borderRadius: '8px',
  fontSize: '1em',
  background: '#f8fafd'
};

const labelStyle = {
  fontWeight: 'bold',
  marginBottom: '0.4em',
  color: '#218290',
  display: 'block',
  letterSpacing: '0.03em'
};

const formContainerStyle = {
  background: 'none',
  padding: '0.2em 0.5em',
  borderRadius: '10px',
};

const buttonStyle = {
  padding: '0.6em 2em',
  background: '#218290',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontWeight: 'bold',
  fontSize: '1.1em',
  cursor: 'pointer',
  boxShadow: '0 2px 10px #cce4eb90'
};

const Formulario = () => {
  const [form, setForm] = useState({ nombre: '', documento: '' });
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    setMensaje('');

    try {
      // Simulación de envío (puedes reemplazar con tu API real)
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setMensaje(`Formulario enviado correctamente. ¡Hola, ${form.nombre}!`);
    } catch (error) {
      setMensaje('Error en el envío. Intenta nuevamente.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <form style={formContainerStyle} onSubmit={handleSubmit}>
      <label style={labelStyle} htmlFor="nombre">Nombre completo</label>
      <input
        style={inputStyle}
        type="text"
        name="nombre"
        id="nombre"
        placeholder="Ej: Juan Pérez"
        value={form.nombre}
        onChange={handleChange}
        required
      />
      <label style={labelStyle} htmlFor="documento"># de Documento de Identidad</label>
      <input
        style={inputStyle}
        type="text"
        name="documento"
        id="documento"
        placeholder="Ej: 123456789"
        value={form.documento}
        onChange={handleChange}
        required
      />
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <button style={buttonStyle} type="submit" disabled={cargando}>
          {cargando ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
      {mensaje && (
        <p style={{ marginTop: '1em', color: '#218290', fontWeight: 'bold' }}>
          {mensaje}
        </p>
      )}
    </form>
  );
};

export default Formulario;
