const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const datos = [];

// Ruta relativa a tu Notificaciones.csv (ajusta si está en src/data/)
fs.createReadStream('../Notificaciones.csv')  // Ajusta ruta según ubicación
  .pipe(csv())
  .on('data', (fila) => datos.push(fila))
  .on('end', () => {
    // Agrega ID único y normaliza
    const datosConID = datos.map((notif, index) => ({
      id: index + 1,
      ...notif,
      fecha: new Date().toISOString().split('T')[0]  // Normaliza fecha
    }));
    
    fs.writeFileSync(
      path.join(__dirname, '../data/notificacionesData.json'),
      JSON.stringify(datosConID, null, 2),
      'utf8'
    );
    console.log('✅ notificacionesData.json creado en /data/ con', datosConID.length, 'registros');
  });

