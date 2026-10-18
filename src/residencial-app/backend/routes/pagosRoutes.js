// backend/routes/pagosRoutes.js
const express = require("express");
const router = express.Router();
const pagosController = require("../controllers/pagosController");

console.log("Controlador pagos cargado:", pagosController);

router.get("/", pagosController.listarPagos);
//router.post("/", pagosController.crearPago);
//router.put("/:id", pagosController.actualizarPago);
//router.patch("/:id/observacion", pagosController.actualizarObservacionPago);
//router.delete("/:id", pagosController.eliminarPago);
//router.post("/normalizar", pagosController.normalizarPagosCSV);

module.exports = router;