// backend/routes/importExportRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/importExportController');
const { verifyAdmin } = require('../middlewares/auth');
const upload = require('../middlewares/fileUpload');

// Importar datos desde archivo subido
router.post('/import/:entity', verifyAdmin, upload.single('file'), controller.importData);

// NUEVO: obtener pagos desde backend/data/Pagos.csv
router.get('/pagos-csv', verifyAdmin, controller.obtenerPagosCSV);

// Ruta de prueba GET
router.get('/', (req, res) => {
  res.json({ message: 'API operativa' });
});

module.exports = router;
