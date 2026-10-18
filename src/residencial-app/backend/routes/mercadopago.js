const express = require('express');
const router = express.Router();

const mercadopagoController = require('../controllers/mercadopagoController');

router.post('/crear-preferencia', mercadopagoController.crearPreferencia);
router.post('/resultado', mercadopagoController.procesarResultadoPago);
router.post('/webhook', mercadopagoController.manejarWebhook);
router.post('/confirmar', mercadopagoController.confirmarPagoMp);
//router.post('/', mercadopagoController.registrarPagoManual);

module.exports = router;