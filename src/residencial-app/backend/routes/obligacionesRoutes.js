const express = require('express');

function crearObligacionesRoutes(obligacionesController) {
  const router = express.Router();

  router.get('/', obligacionesController.obtenerObligaciones);

  return router;
}

module.exports = crearObligacionesRoutes;