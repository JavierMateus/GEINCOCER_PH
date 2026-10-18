// backend/controllers/importExportController.js
const fileParser = require('../services/fileParser');
const dataValidator = require('../services/dataValidator');
const fs = require('fs');
const path = require('path');

// Importar datos desde archivo subido
exports.importData = async (req, res) => {
  try {
    const { entity } = req.params;
    const filePath = req.file.path;
    const rawData = fileParser.parse(filePath);
    const { validRows, errorRows } = dataValidator.validate(entity, rawData);
    fs.unlinkSync(filePath); // Borra archivo temporal
    res.json({ inserted: validRows, errors: errorRows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Leer Pagos.csv (mismo archivo que usa Mercado Pago)
const rutaPagosCSV = path.join(__dirname, '../data/Pagos.csv');

const parseFechaPago = (valor) => {
  if (!valor) return 0;

  const texto = String(valor).trim();

  if (!texto) return 0;

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(texto)) {
    const [yyyy, mm, dd] = texto.split('-').map(Number);
    const fecha = new Date(yyyy, mm - 1, dd);
    return Number.isNaN(fecha.getTime()) ? 0 : fecha.getTime();
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(texto)) {
    let [dd, mm, yyyy] = texto.split('/').map((v) => v.trim());
    let year = Number(yyyy);

    if (yyyy.length === 2) {
      year += year >= 70 ? 1900 : 2000;
    }

    const fecha = new Date(year, Number(mm) - 1, Number(dd));
    return Number.isNaN(fecha.getTime()) ? 0 : fecha.getTime();
  }

  if (/^\d{1,2}\/\d{4,6}$/.test(texto)) {
    const [dd, resto] = texto.split('/');
    let mm = resto.slice(0, 2);
    let yyyy = resto.slice(2);

    let year = Number(yyyy);
    if (yyyy.length === 2) {
      year += year >= 70 ? 1900 : 2000;
    }

    const fecha = new Date(year, Number(mm) - 1, Number(dd));
    return Number.isNaN(fecha.getTime()) ? 0 : fecha.getTime();
  }

  return 0;
};

const obtenerTimestampPago = (pago) => {
  return (
    parseFechaPago(pago['Fecha de pago']) ||
    parseFechaPago(pago.FechaPago) ||
    parseFechaPago(pago['Fecha Registro']) ||
    parseFechaPago(pago.FechaRegistro) ||
    0
  );
};

exports.obtenerPagosCSV = (req, res) => {
  try {
    if (!fs.existsSync(rutaPagosCSV)) {
      return res.json({ pagos: [] });
    }

    const contenido = fs.readFileSync(rutaPagosCSV, 'utf8');

    const lineas = contenido
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lineas.length <= 1) {
      return res.json({ pagos: [] });
    }

    const encabezados = lineas[0].split(';');

    const pagos = lineas
      .slice(1)
      .map((linea) => {
        const columnas = linea.split(';');
        const obj = {};

        encabezados.forEach((header, idx) => {
          obj[header] = columnas[idx] ?? '';
        });

        return obj;
      })
      .sort((a, b) => {
        const fechaB = obtenerTimestampPago(b);
        const fechaA = obtenerTimestampPago(a);

        if (fechaB !== fechaA) {
          return fechaB - fechaA;
        }

        const idA = String(a.ID_Pago || '').trim();
        const idB = String(b.ID_Pago || '').trim();
        return idB.localeCompare(idA);
      });

    return res.json({ pagos });
  } catch (error) {
    console.error('Error al leer Pagos.csv desde informe:', error);
    return res.status(500).json({ mensaje: 'Error al leer Pagos.csv' });
  }
};

  

