const express = require('express');
const cors = require('cors');
const importExportRoutes = require('./routes/importExportRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Ruta principal para los módulos de importación/exportación:
app.use('/api', importExportRoutes);

app.listen(4001, () => {
  console.log('Backend activo en puerto 4001');
});


