// backend/controllers/importExportController.js
const fileParser = require('../services/fileParser');
const dataValidator = require('../services/dataValidator');
const fs = require('fs');

exports.importData = async (req, res) => {
  try {
    const { entity } = req.params;
    const filePath = req.file.path;
    const rawData = fileParser.parse(filePath);
    const { validRows, errorRows } = dataValidator.validate(entity, rawData);
    // Simulando la carga, aquí podrías guardar en BD
    fs.unlinkSync(filePath); // Borra archivo temporal
    res.json({ inserted: validRows, errors: errorRows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
