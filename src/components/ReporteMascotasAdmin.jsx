import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';

export default function ReporteMascotasAdmin({ onBack }) {
  const [mascotas, setMascotas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroTorre, setFiltroTorre] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  useEffect(() => {
    cargarMascotas();
  }, []);

  async function cargarMascotas() {
    try {
      setCargando(true);
      const resp = await fetch(`${API_BASE}/api/mascotas`);
      const data = await resp.json();
      setMascotas(Array.isArray(data.mascotas) ? data.mascotas : []);
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  }

  // Filtrado de registros
  const mascotasFiltradas = mascotas.filter(m => {
    const coincideTorre = filtroTorre === '' || m.torre.toLowerCase().includes(filtroTorre.toLowerCase());
    const coincideTipo = filtroTipo === '' || m.tipo.toLowerCase() === filtroTipo.toLowerCase();
    return coincideTorre && coincideTipo;
  });

  // Métricas para el Administrador
  const totalInmueblesConMascota = mascotas.filter(m => m.tieneMascota === 'Sí' || m.tieneMascota === 'true').length;
  const totalPerros = mascotas.filter(m => m.tipo.toLowerCase() === 'perro').length;
  const totalGatos = mascotas.filter(m => m.tipo.toLowerCase() === 'gato').length;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <button onClick={onBack} style={{ padding: '8px 16px', marginBottom: '20px', cursor: 'pointer' }}>
        ← Regresar
      </button>

      <h2>🐾 Reporte General de Mascotas (Administración)</h2>

      {/* Cards de Métricas */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
        <div style={{ padding: '15px', background: '#e3f2fd', borderRadius: '8px', flex: 1 }}>
          <h3>{totalInmueblesConMascota}</h3>
          <p>Inmuebles con Mascota</p>
        </div>
        <div style={{ padding: '15px', background: '#fff3e0', borderRadius: '8px', flex: 1 }}>
          <h3>{totalPerros}</h3>
          <p>Perros Registrados</p>
        </div>
        <div style={{ padding: '15px', background: '#e8f5e9', borderRadius: '8px', flex: 1 }}>
          <h3>{totalGatos}</h3>
          <p>Gatos Registrados</p>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <input
          type="text"
          placeholder="Filtrar por Torre/Manzana..."
          value={filtroTorre}
          onChange={(e) => setFiltroTorre(e.target.value)}
          style={{ padding: '8px', width: '200px' }}
        />
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={{ padding: '8px' }}>
          <option value="">-- Todos los tipos --</option>
          <option value="Perro">Perros</option>
          <option value="Gato">Gatos</option>
          <option value="Ave">Aves</option>
          <option value="Otro">Otros</option>
        </select>
      </div>

      {/* Tabla de Resultados */}
      {cargando ? (
        <p>Cargando reporte...</p>
      ) : (
        <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: '#f5f5f5' }}>
            <tr>
              <th>Torre</th>
              <th>Apto/Casa</th>
              <th>¿Tiene Mascota?</th>
              <th>Tipo</th>
              <th>Nombre</th>
              <th>Raza</th>
              <th>Vacunas al día</th>
              <th>Fecha Registro</th>
            </tr>
          </thead>
          <tbody>
            {mascotasFiltradas.length > 0 ? (
              mascotasFiltradas.map((m, i) => (
                <tr key={i}>
                  <td>{m.torre}</td>
                  <td>{m.apto}</td>
                  <td><strong>{m.tieneMascota}</strong></td>
                  <td>{m.tipo}</td>
                  <td>{m.nombre}</td>
                  <td>{m.raza}</td>
                  <td>{m.vacunasAlDia}</td>
                  <td>{m.fechaRegistro}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center' }}>No hay datos que coincidan con el filtro.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}