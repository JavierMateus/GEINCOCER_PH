import React, { useState } from 'react';

function ImportResidentes() {
  const [file, setFile] = useState(null);
  const [dataPreview, setDataPreview] = useState([]);
  const [message, setMessage] = useState('');

  // Función para procesar el archivo CSV/Excel que suba el usuario
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMessage('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      // Separar por líneas y por comas, muy básico para CSV
      const rows = text.split('\n').map(row => row.split(','));
      setDataPreview(rows.slice(0, 5)); // Muestra las primeras 5 filas como ejemplo
    };
    reader.readAsText(e.target.files[0]);
  };

  const handleImport = () => {
    setMessage('Importación exitosa (simulación).');
  };

  return (
    <div>
      <h3>Importar residentes desde Excel/CSV</h3>
      <input type="file" accept=".csv" onChange={handleFileChange} />
      <button disabled={!file} onClick={handleImport}>Importar</button>
      {message && <p style={{color: "green"}}>{message}</p>}
      {dataPreview.length > 0 && (
        <div>
          <h4>Vista previa (primeras filas del archivo):</h4>
          <table border="1">
            <tbody>
              {
                dataPreview.map((row, idx) => (
                  <tr key={idx}>
                    {row.map((cell, cidx) => <td key={cidx}>{cell}</td>)}
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
      <p style={{fontSize:'small'}}>Sube un archivo CSV con este formato:</p>
      <pre style={{background:'#eee', padding:'8px'}}>Nombre,Torre,Apto/Manzana,Email,Telefono</pre>
    </div>
  );
}

export default ImportResidentes;
