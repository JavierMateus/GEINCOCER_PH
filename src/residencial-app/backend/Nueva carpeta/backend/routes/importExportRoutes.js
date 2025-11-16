// backend/routes/importExportRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/importExportController');
const { verifyAdmin } = require('../middlewares/auth');
const upload = require('../middlewares/fileUpload');

// Ruta para importar datos (puedes cambiar 'entity' por el tipo: residentes, pagos, etc.)
router.post('/import/:entity', verifyAdmin, upload.single('file'), controller.importData);

// (Podrás agregar aquí más rutas, por ejemplo para exportar, luego)
// backend/routes/importExportRoutes.js

// Ruta de prueba GET
router.get('/', (req, res) => {
  res.json({ message: 'API operativa' });
});

module.exports = router;


