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
  const [form, setForm] = useState({
    nombre: '',
    documento: '',
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Endpoint POST - reemplaza por tu URL
    const endpoint = 'https://tuservidor.com/api/endpoint';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      console.log('Respuesta:', data);
    } catch (error) {
      console.error('Error en el envío:', error);
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
        <button style={buttonStyle} type="submit">Enviar</button>
      </div>
    </form>
  );
}; // <- así se cierra el componente correctamente

export default Formulario;
