const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

function crearObligacionesController(baseResidencialDir) {
  const archivoObligacionesCSV = path.join(
    baseResidencialDir,
    'obligaciones_residente.csv'
  );

  function leerObligacionesCSV() {
    if (!fs.existsSync(archivoObligacionesCSV)) {
      throw new Error(
        `No se encontró obligaciones_residente.csv en: ${archivoObligacionesCSV}`
      );
    }

    const contenido = fs.readFileSync(archivoObligacionesCSV, 'utf8').trim();

    if (!contenido) {
      return [];
    }

    const obligaciones = parse(contenido, {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true,
      bom: true,
      trim: true,
    });

    return Array.isArray(obligaciones) ? obligaciones : [];
  }

  function obtenerObligaciones(req, res) {
    try {
      const obligaciones = leerObligacionesCSV();

      return res.json({
        ok: true,
        total: obligaciones.length,
        obligaciones,
      });
    } catch (error) {
      console.error('Error leyendo obligaciones_residente.csv:', error);

      return res.status(500).json({
        ok: false,
        error:
          error.message ||
          'No se pudieron cargar las obligaciones desde BaseResidencial.',
      });
    }
  }

  return {
    obtenerObligaciones,
  };
}

module.exports = crearObligacionesController;