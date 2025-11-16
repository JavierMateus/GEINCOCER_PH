import React, { useState } from "react";

function AdminResidentes({ residentes, setResidentes }) {
  const [busqueda, setBusqueda] = useState("");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [form, setForm] = useState({
    id: "",
    nombre: "",
    documento: "",
    inmueble: "",
    torre: "",
    apto: "",
    tipo: "",
    telefono: "",
    email: "",
    fecha_entrada: "",
    fecha_salida: ""
  });

  // Filtrado de búsqueda
  const residentesFiltrados = residentes.filter((r) => {
    const term = busqueda.toLowerCase();
    return (
      (r["Nombre completo"]?.toLowerCase() || "").includes(term) ||
      (r.Documento?.toLowerCase() || "").includes(term) ||
      (r.IDInmueble?.toLowerCase() || "").includes(term)
    );
  });

  // Abrir modal para agregar
  const handleAgregarResidente = () => {
    setForm({
      id: residentes.length + 1,
      nombre: "",
      documento: "",
      inmueble: "",
      torre: "",
      apto: "",
      tipo: "",
      telefono: "",
      email: "",
      fecha_entrada: "",
      fecha_salida: ""
    });
    setMostrarModal(true);
  };

  // Guardar nuevo residente
  const handleGuardarResidente = (e) => {
    e.preventDefault();
    setResidentes([
      ...residentes,
      {
        IDHabitante: form.id,
        "Nombre completo": form.nombre,
        Documento: form.documento,
        IDInmueble: form.inmueble,
        "Torre/Manzana": form.torre,
        "Apto/Casa": form.apto,
        Tipo: form.tipo,
        Teléfono: form.telefono,
        Email: form.email,
        "Fecha entrada": form.fecha_entrada,
        "Fecha salida": form.fecha_salida
      }
    ]);
    setMostrarModal(false);
  };

  // Eliminar residente
  const handleEliminarResidente = (idx) => {
    if (window.confirm("¿Seguro que quieres eliminar este residente?")) {
      const nuevos = residentes.slice();
      nuevos.splice(idx, 1);
      setResidentes(nuevos);
    }
  };

  return (
    <section style={{
      background: "#fff",
      borderRadius: "14px",
      boxShadow: "0 2px 11px #0002",
      padding: "2.7em 2.3em",
      maxWidth: "950px",
      margin: "3em auto"
    }}>
      {/* Header y botón AGREGAR */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "1.6em"
      }}>
        <h2 style={{
          fontWeight: "bold",
          margin: 0,
          fontSize: "1.5em"
        }}>Habitantes</h2>
        <button
          onClick={handleAgregarResidente}
          style={{
            background: "linear-gradient(90deg,#18bd6f 0%,#009b79 100%)",
            color: "#fff",
            border: "none",
            borderRadius: "40px",
            padding: "0.8em 2.2em",
            fontWeight: "bold",
            fontSize: "1.07em",
            boxShadow: "0 3px 14px #009b7950",
            display: "flex",
            alignItems: "center",
            gap: "10px"
          }}>
          <span style={{ fontSize: "1.7em" }}>🧑‍💼</span>Agregar
        </button>
      </div>
      {/* Barra de búsqueda */}
      <input
        type="text"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre, documento, inmueble..."
        style={{
          padding: "0.7em 1em",
          width: "75%",
          borderRadius: "8px",
          border: "1px solid #bbc6d2",
          fontSize: "1em",
          marginBottom: "1.5em"
        }}
      />
      {/* Tabla principal */}
      <table style={{
        width: "100%",
        borderCollapse: "collapse",
        background: "#fff",
        fontSize: "1em"
      }}>
        <thead>
          <tr style={{ background: "#f1f5fa" }}>
            <th>ID Habitante</th>
            <th>Nombre completo</th>
            <th>Documento</th>
            <th>ID Inmueble</th>
            <th>Torre/Manzana</th>
            <th>Apto/Casa</th>
            <th>Tipo</th>
            <th>Teléfono</th>
            <th>Email</th>
            <th>Fecha entrada</th>
            <th>Fecha salida</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {residentesFiltrados.length > 0 ? (
            residentesFiltrados.map((r, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td>{r.IDHabitante}</td>
                <td>{r["Nombre completo"]}</td>
                <td>{r.Documento}</td>
                <td>{r.IDInmueble}</td>
                <td>{r["Torre/Manzana"]}</td>
                <td>{r["Apto/Casa"]}</td>
                <td>{r.Tipo}</td>
                <td>{r.Teléfono}</td>
                <td>{r.Email}</td>
                <td>{r["Fecha entrada"]}</td>
                <td>{r["Fecha salida"]}</td>
                <td>
                  <button
                    onClick={() => handleEliminarResidente(idx)}
                    style={{
                      background: "#de2345",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "0.2em 0.7em",
                      cursor: "pointer"
                    }}>🗑️</button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={12} style={{ textAlign: "center", color: "#888", padding: "2.5em 0" }}>
                No hay habitantes que coincidan con la búsqueda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {/* Modal para agregar */}
      {mostrarModal && (
        <div style={{
          position: "fixed",
          top: 0, left: 0,
          width: "100vw", height: "100vh",
          background: "#0008",
          zIndex: 1000,
          display: "flex", justifyContent: "center", alignItems: "center"
        }}>
          <div style={{
            background: "#fff",
            padding: "2em 2.5em",
            borderRadius: "18px",
            boxShadow: "0 6px 21px #1e222944",
            minWidth: "350px",
            maxWidth: "96vw"
          }}>
            <h3 style={{ margin: "0 0 1em 0", fontWeight: "bold" }}>Agregar nuevo habitante</h3>
            <form onSubmit={handleGuardarResidente}>
              <div style={{ marginBottom: "1em" }}>
                <label>ID Habitante:<br />
                  <input type="number" value={form.id}
                    onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
                    style={{ width: "100%", padding: "0.7em", borderRadius: "6px", border: "1px solid #bbc6d2", marginTop: "0.2em" }} required />
                </label>
              </div>
              <div style={{ marginBottom: "1em" }}>
                <label>Nombre completo:<br />
                  <input type="text" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} style={{ width: "100%", padding: "0.7em", borderRadius: "6px", border: "1px solid #bbc6d2", marginTop: "0.2em" }} required />
                </label>
              </div>
              <div style={{ marginBottom: "1em" }}>
                <label>Documento:<br />
                  <input type="text" value={form.documento} onChange={e => setForm(f => ({ ...f, documento: e.target.value }))} style={{ width: "100%", padding: "0.7em", borderRadius: "6px", border: "1px solid #bbc6d2", marginTop: "0.2em" }} required />
                </label>
              </div>
              <div style={{ marginBottom: "1em" }}>
                <label>ID Inmueble:<br />
                  <input type="text" value={form.inmueble} onChange={e => setForm(f => ({ ...f, inmueble: e.target.value }))} style={{ width: "100%", padding: "0.7em", borderRadius: "6px", border: "1px solid #bbc6d2", marginTop: "0.2em" }} required />
                </label>
              </div>
              <div style={{ marginBottom: "1em" }}>
                <label>Torre/Manzana:<br />
                  <input type="text" value={form.torre} onChange={e => setForm(f => ({ ...f, torre: e.target.value }))} style={{ width: "100%", padding: "0.7em", borderRadius: "6px", border: "1px solid #bbc6d2", marginTop: "0.2em" }} />
                </label>
              </div>
              <div style={{ marginBottom: "1em" }}>
                <label>Apto/Casa:<br />
                  <input type="text" value={form.apto} onChange={e => setForm(f => ({ ...f, apto: e.target.value }))} style={{ width: "100%", padding: "0.7em", borderRadius: "6px", border: "1px solid #bbc6d2", marginTop: "0.2em" }} />
                </label>
              </div>
              <div style={{ marginBottom: "1em" }}>
                <label>Tipo:<br />
                  <input type="text" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} style={{ width: "100%", padding: "0.7em", borderRadius: "6px", border: "1px solid #bbc6d2", marginTop: "0.2em" }} />
                </label>
              </div>
              <div style={{ marginBottom: "1em" }}>
                <label>Teléfono:<br />
                  <input type="text" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} style={{ width: "100%", padding: "0.7em", borderRadius: "6px", border: "1px solid #bbc6d2", marginTop: "0.2em" }} />
                </label>
              </div>
              <div style={{ marginBottom: "1em" }}>
                <label>Email:<br />
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={{ width: "100%", padding: "0.7em", borderRadius: "6px", border: "1px solid #bbc6d2", marginTop: "0.2em" }} />
                </label>
              </div>
              <div style={{ marginBottom: "1em" }}>
                <label>Fecha entrada:<br />
                  <input type="text" value={form.fecha_entrada} onChange={e => setForm(f => ({ ...f, fecha_entrada: e.target.value }))} style={{ width: "100%", padding: "0.7em", borderRadius: "6px", border: "1px solid #bbc6d2", marginTop: "0.2em" }} />
                </label>
              </div>
              <div style={{ marginBottom: "1em" }}>
                <label>Fecha salida:<br />
                  <input type="text" value={form.fecha_salida} onChange={e => setForm(f => ({ ...f, fecha_salida: e.target.value }))} style={{ width: "100%", padding: "0.7em", borderRadius: "6px", border: "1px solid #bbc6d2", marginTop: "0.2em" }} />
                </label>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "1.5em" }}>
                <button type="submit" style={{
                  background: "#11ad63",
                  color: "#fff",
                  border: "none",
                  borderRadius: "7px",
                  padding: "0.6em 2em",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}>
                  Guardar
                </button>
                <button type="button" onClick={() => setMostrarModal(false)} style={{
                  background: "#aaa",
                  color: "#fff",
                  border: "none",
                  borderRadius: "7px",
                  padding: "0.6em 2em",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default AdminResidentes;
