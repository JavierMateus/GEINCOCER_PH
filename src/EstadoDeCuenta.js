import React from 'react';

// Puedes pasar "residente" (solo uno) o "lista" para admin (todos)
function EstadoDeCuenta({ modo = 'residente', cuentas = [] }) {
  // Datos simulados
  const ejemplos = [
    {
      nombre: "Carlos López", torre: "3", apto: "201", cuota: 0, sanciones: 0, interes: 0, otros: 0
    },
    {
      nombre: "Ana Torres", torre: "1", apto: "101", cuota: 150000, sanciones: 0, interes: 3000, otros: 0
    },
    {
      nombre: "Manuel Ríos", torre: "2", apto: "303", cuota: 0, sanciones: 20000, interes: 0, otros: 10000
    },
  ];

  const lista = cuentas.length > 0 ? cuentas : ejemplos;

  // Vista para administrador
  if (modo === 'admin') {
    return (
      <div>
        <h3>Estado de cuenta de todos los residentes</h3>
        <table border="1">
          <thead>
            <tr>
              <th>Nombre</th><th>Torre</th><th>Apto</th>
              <th>Cuota</th><th>Sanciones</th><th>Interés</th><th>Otros</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((r, i) => {
              const total = r.cuota + r.sanciones + r.interes + r.otros;
              return (
                <tr key={i} style={total === 0 ? {background: '#d7ffd7'} : {background: '#ffe1e1'}}>
                  <td>{r.nombre}</td><td>{r.torre}</td><td>{r.apto}</td>
                  <td>{r.cuota}</td><td>{r.sanciones}</td><td>{r.interes}</td><td>{r.otros}</td>
                  <td>
                    {total === 0 ? "Al día" : `Pendiente: $${total} `}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p style={{color:'#d32f2f', fontWeight:'bold'}}>Resaltado en rojo los residentes con saldo pendiente.</p>
        <p style={{color:'#2e7d32', fontWeight:'bold'}}>Resaltado en verde los residentes al día.</p>
      </div>
    );
  }

  // Vista para residente (solo uno, primer ejemplo)
  const r = lista[0];
  const total = r.cuota + r.sanciones + r.interes + r.otros;
  return (
    <div>
      <h3>Mi estado de cuenta</h3>
      <table border="1">
        <thead>
          <tr>
            <th>Cuota</th><th>Sanciones</th><th>Interés</th><th>Otros</th><th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr style={total === 0 ? {background:'#d7ffd7'} : {background:'#ffe1e1'}}>
            <td>{r.cuota}</td>
            <td>{r.sanciones}</td>
            <td>{r.interes}</td>
            <td>{r.otros}</td>
            <td>{total === 0 ? "Al día" : `Pendiente: $${total}`}</td>
          </tr>
        </tbody>
      </table>
      {total > 0 && <p style={{color:'#d32f2f', fontWeight:'bold'}}>¡Tienes valores pendientes por pago!</p>}
      {total === 0 && <p style={{color:'#2e7d32', fontWeight:'bold'}}>¡Felicitaciones, tu estado está al día!</p>}
    </div>
  );
}

export default EstadoDeCuenta;
