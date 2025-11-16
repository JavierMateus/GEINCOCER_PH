import React, { useState } from "react";
import Papa from "papaparse";

function ImportarHabitantes() {
  const [data, setData] = useState([]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        setData(results.data);
      }
    });
  };

  return (
    <div style={{padding: '2em'}}>
      <h2>Importar Habitantes</h2>
      <input type="file" accept=".csv" onChange={handleFileUpload} />

      {data.length > 0 && (
        <table border={1} cellPadding={5} style={{marginTop: '1em'}}>
          <thead>
            <tr>
              {Object.keys(data[0]).map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx}>
                {Object.values(row).map((val, key) => (
                  <td key={key}>{val}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default ImportarHabitantes;
