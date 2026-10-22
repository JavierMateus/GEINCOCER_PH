import React, { useEffect, useMemo, useState } from "react";
import PagoOnline from "./PagoOnline";
import CambiarPin from "./CambiarPin";
import PazYSalvo from "./PazYSalvo";
import MisDatosContacto from "./MisDatosContacto";
import { descargarComprobante } from "./comprobantePago";
import { API_BASE } from "../config";

function PanelResidente({
  usuario,
  pagos = [],
  habitantes = [],
  reservas = [],
  notificaciones = [],
  setUsuario
}) {
  const nombreUsuario = usuario?.nombre || "Residente";
  const documentoUsuario = usuario?.documento || "";
  
const habitantesArray = Array.isArray(habitantes) ? habitantes : [];

// Se busca por documento en Habitantes.csv; si no aparece, se usan los datos del ingreso.
const soloDigitosDoc = (v) => String(v ?? "").replace(/\D/g, "");
const habitanteCsv = habitantesArray.find(
  (h) =>
    soloDigitosDoc(h.DocumentoResidente || h["Documento"] || h.documento || h["Número de documento"]) ===
    soloDigitosDoc(documentoUsuario)
);

const habitanteEncontrado = {
  ID_Inmueble: usuario?.idInmueble || usuario?.ID_Inmueble || "",
  TorreManzana: usuario?.torreManzana || "",
  AptoCasa: usuario?.aptoCasa || "",
  Telefono: usuario?.telefono || "",
  Email: usuario?.email || "",
  ...(habitanteCsv || {}),
};

const torreManzana =
  habitanteEncontrado?.["Torre/Manzana"] ||
  habitanteEncontrado?.TorreManzana ||
  "";

const aptoCasa =
  habitanteEncontrado?.["Apto/Casa"] ||
  habitanteEncontrado?.AptoCasa ||
  "";

  const [vistaActiva, setVistaActiva] = useState("inicio");
  const [pqrs, setPqrs] = useState([]);
  const [cargandoPqrs, setCargandoPqrs] = useState(false);
  const [tipoPqrs, setTipoPqrs] = useState("Petición");
  const [torreManzanaManual, setTorreManzanaManual] = useState("");
  const [aptoCasaManual, setAptoCasaManual] = useState("");
  const [asuntoPqrs, setAsuntoPqrs] = useState("");
  const [descripcionPqrs, setDescripcionPqrs] = useState("");
  const [archivoPqrs, setArchivoPqrs] = useState(null);
  const [guardandoPqrs, setGuardandoPqrs] = useState(false);

  const [espacioReserva, setEspacioReserva] = useState("");
  const [fechaReserva, setFechaReserva] = useState("");
  const [horaReserva, setHoraReserva] = useState("");

  const cargarPqrs = async () => {
  if (vistaActiva !== "pqrs") return;

  try {
    setCargandoPqrs(true);

    const response = await fetch(`${API_BASE}/api/pqrs`);
    const data = await response.json();

    const pqrsFiltradas = Array.isArray(data)
      ? data.filter(
          (item) =>
            String(item.DocumentoResidente || "").trim() ===
            String(documentoUsuario || "").trim()
        )
      : [];

    setPqrs(pqrsFiltradas);
  } catch (error) {
    console.error("Error al cargar PQRS:", error);
    setPqrs([]);
  } finally {
    setCargandoPqrs(false);
  }
};

const documentoResidenteActual = String(
  usuario?.documento ||
  usuario?.Documento ||
  usuario?.DocumentoResidente ||
  ""
).trim();

// ⬇️ CORREGIDO: Usamos la variable correcta 'documentoResidenteActual'
useEffect(() => {
  cargarPqrs();
}, [vistaActiva, documentoResidenteActual]);

const [pagosBackend, setPagosBackend] = useState([]);

const pagosFallback = Array.isArray(pagos)
  ? pagos
  : Array.isArray(pagos?.data)
  ? pagos.data
  : Array.isArray(pagos?.pagos)
  ? pagos.pagos
  : [];

const aNumero = (valor) =>
  Number(String(valor ?? 0).replace(/[^\d.-]/g, "")) || 0;

const esPagoAnulado = (p) =>
  String(p?.EstadoPago ?? p?.Estado ?? "").toLowerCase().includes("anul");

const montoAplicadoPago = (p) => {
  const total = aNumero(p?.TotalAplicado ?? p?.TotalPagado);
  if (total > 0) return total;

  return (
    aNumero(p?.ValorPagado ?? p?.Valor ?? p?.valor ?? p?.Monto ?? p?.monto) +
    aNumero(p?.InteresesPagados ?? p?.Intereses) +
    aNumero(p?.OtrosCobros ?? p?.OtrosCobrosPagados)
  );
};

const docDe = (fila) =>
  String(
    fila?.DocumentoResidente ||
    fila?.Documento ||
    fila?.documento ||
    ""
  ).trim();

const reservasArray = Array.isArray(reservas) ? reservas : [];

const listaPagosBase = pagosBackend.length > 0 ? pagosBackend : pagosFallback;

const pagosDelResidente = listaPagosBase.filter(
  (p) => docDe(p) === documentoResidenteActual && !esPagoAnulado(p)
);

const [datosPagoOnline, setDatosPagoOnline] = useState({
  nombreCompleto: "",
  documento: "",
  correo: "",
  telefono: "",
  torreManzana: "",
  aptoCasa: "",
});

const [obligacionesResidente, setObligacionesResidente] = useState([]);
const [mostrarCambiarPin, setMostrarCambiarPin] = useState(false);
const [mostrarPazYSalvo, setMostrarPazYSalvo] = useState(false);

const reservasDelResidente = reservasArray.filter((r) => {
  const documentoReserva = String(
    r.Documento ||
    r.documento ||
    r.DocumentoResidente ||
    ""
  ).trim();

  return documentoReserva === documentoResidenteActual;
});

// ==========================================
  // ESTADOS Y FUNCIONES PARA MÚLTIPLES MASCOTAS
  // ==========================================
  // ==========================================
  // ESTADOS Y FUNCIONES PARA MÚLTIPLES MASCOTAS
  // ==========================================
  const [mostrarModalMascotas, setMostrarModalMascotas] = useState(false);
  const [tieneMascotas, setTieneMascotas] = useState('No');
  const [listaMascotasTemp, setListaMascotasTemp] = useState([]);
  const [enviandoMascota, setEnviandoMascota] = useState(false);

  const [tempPet, setTempPet] = useState({
    tipo: 'Perro',
    nombre: '',
    raza: '',
    vacunasAlDia: 'Sí'
  });

  // Ejecutamos SIEMPRE al cargar el componente
  useEffect(() => {
    verificarRegistroMascota();
  }, [usuario, torreManzana, aptoCasa]);

  async function verificarRegistroMascota() {
    try {
      // Obtener Torre y Apto buscando en todas las propiedades posibles
      const tUser = String(
        torreManzana ||
        usuario?.TorreManzana ||
        usuario?.['Torre/Manzana'] ||
        usuario?.torreManzana ||
        usuario?.torre ||
        ''
      ).trim();

      const aUser = String(
        aptoCasa ||
        usuario?.AptoCasa ||
        usuario?.['Apto/Casa'] ||
        usuario?.aptoCasa ||
        usuario?.apto ||
        ''
      ).trim();

      // Si aún no se han cargado los datos del usuario, no evaluamos todavía
      if (!tUser && !aUser) return;

      const resp = await fetch(`${API_BASE}/api/mascotas`);
      const data = await resp.json();
      const lista = Array.isArray(data.mascotas) ? data.mascotas : [];

      // Verificar si existe registro previo para ESTE inmueble
      const registrado = lista.some(
        m => String(m.torre).trim().toLowerCase() === tUser.toLowerCase() &&
             String(m.apto).trim().toLowerCase() === aUser.toLowerCase()
      );

      if (!registrado) {
        setMostrarModalMascotas(true);
      }
    } catch (err) {
      console.error("Error verificando mascotas:", err);
    }
  }

  function agregarMascotaALista(e) {
    e.preventDefault();
    if (!tempPet.nombre || !tempPet.raza) {
      alert("Por favor completa el nombre y la raza de la mascota.");
      return;
    }
    setListaMascotasTemp([...listaMascotasTemp, tempPet]);
    setTempPet({ tipo: 'Perro', nombre: '', raza: '', vacunasAlDia: 'Sí' });
  }

  function quitarMascotaTemp(index) {
    const nuevaLista = listaMascotasTemp.filter((_, i) => i !== index);
    setListaMascotasTemp(nuevaLista);
  }

  async function guardarTodasLasMascotas(e) {
    e.preventDefault();
    try {
      setEnviandoMascota(true);

      const tUser = String(
        torreManzana ||
        usuario?.TorreManzana ||
        usuario?.['Torre/Manzana'] ||
        usuario?.torreManzana ||
        usuario?.torre ||
        ''
      ).trim();

      const aUser = String(
        aptoCasa ||
        usuario?.AptoCasa ||
        usuario?.['Apto/Casa'] ||
        usuario?.aptoCasa ||
        usuario?.apto ||
        ''
      ).trim();

      const bodyData = {
        torre: tUser,
        apto: aUser,
        tieneMascota: tieneMascotas,
        mascotas: tieneMascotas === 'Sí' ? listaMascotasTemp : []
      };

      const resp = await fetch(`${API_BASE}/api/mascotas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      if (!resp.ok) throw new Error("Error al guardar la información");

      alert("Registro de mascotas guardado correctamente.");
      setMostrarModalMascotas(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setEnviandoMascota(false);
    }
  }

// Función para agregar una mascota a la lista temporal antes de guardar
function agregarMascotaALista(e) {
  e.preventDefault();
  if (!tempPet.nombre || !tempPet.raza) {
    alert("Por favor completa el nombre y la raza de la mascota.");
    return;
  }
  setListaMascotasTemp([...listaMascotasTemp, tempPet]);
  setTempPet({ tipo: 'Perro', nombre: '', raza: '', vacunasAlDia: 'Sí' });
}

// Función para eliminar de la lista temporal si se equivocaron
function quitarMascotaTemp(index) {
  const nuevaLista = listaMascotasTemp.filter((_, i) => i !== index);
  setListaMascotasTemp(nuevaLista);
}

const parseFechaCSV = (valor) => {
  if (!valor || String(valor).trim() === "") return null;

  const texto = String(valor).trim();

  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(texto)) {
    const [dia, mes, anio] = texto.split("/");
    const anioFinal =
      anio.length === 2 ? Number(`20${anio}`) : Number(anio);

    return new Date(anioFinal, Number(mes) - 1, Number(dia));
  }

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(texto)) {
    const [anio, mes, dia] = texto.split("-");
    return new Date(Number(anio), Number(mes) - 1, Number(dia));
  }

  const fecha = new Date(texto);
  return isNaN(fecha.getTime()) ? null : fecha;
};

// Formato visual unico de la aplicacion: 4/03/2026.
// Si el valor no es una fecha, devuelve vacio.
const formatearFechaVisual = (valor) => {
  const texto = String(valor || "").trim();

  if (!/^(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{1,2}-\d{1,2})$/.test(texto)) {
    return "";
  }

  const fecha = parseFechaCSV(texto);

  if (!fecha) return "";

  const mes = String(fecha.getMonth() + 1).padStart(2, "0");

  return `${fecha.getDate()}/${mes}/${fecha.getFullYear()}`;
};


const DIA_VENCIMIENTO = 10;


const obtenerFechaVencimiento = (periodo) => {
  const periodoStr = String(periodo || "").trim();

  if (!periodoStr) return null;

  if (/^\d{4}-\d{1,2}$/.test(periodoStr)) {
    const [anio, mes] = periodoStr.split("-");
    return new Date(Number(anio), Number(mes) - 1, DIA_VENCIMIENTO);
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(periodoStr)) {
    const partes = periodoStr.split("/");
    const mes = parseInt(partes[1], 10) - 1;
    const anio =
      partes[2].length === 2 ? parseInt("20" + partes[2], 10) : parseInt(partes[2], 10);

    return new Date(anio, mes, DIA_VENCIMIENTO);
  }

  return null;
};


useEffect(() => {
  const cargarCartera = async () => {
    try {
      const [respObl, respPagos] = await Promise.all([
        fetch(`${API_BASE}/api/obligaciones`, { cache: "no-store" }),
        fetch(`${API_BASE}/api/pagos`, { cache: "no-store" }),
      ]);

      const dataObl = await respObl.json();
      const dataPagos = await respPagos.json();

      const obligaciones = Array.isArray(dataObl?.obligaciones)
        ? dataObl.obligaciones
        : Array.isArray(dataObl)
        ? dataObl
        : [];

      const listaPagos = Array.isArray(dataPagos?.pagos)
        ? dataPagos.pagos
        : Array.isArray(dataPagos)
        ? dataPagos
        : [];

      setPagosBackend(listaPagos);

      const pagadoPorObligacion = {};

            listaPagos.forEach((p) => {
        if (esPagoAnulado(p)) return;

        const idObl = String(
          p.ID_Obligacion || p.IDObligacion || p.idObligacion || ""
        ).trim();

        if (!idObl) return;

        const valor = montoAplicadoPago(p);

        pagadoPorObligacion[idObl] = (pagadoPorObligacion[idObl] || 0) + valor;
      });

      const filas = obligaciones
        .filter((o) => docDe(o) === documentoResidenteActual)
        .map((o) => {
          const valorBase = aNumero(o.ValorBase);
          const intereses = aNumero(o.Intereses);
          const otrosCobros = aNumero(o.OtrosCobros);

          const totalDeclarado = aNumero(o.TotalObligacion);
          const total =
            totalDeclarado > 0
              ? totalDeclarado
              : valorBase + intereses + otrosCobros;

          const idObl = String(o.ID_Obligacion || "").trim();
          const pagado = pagadoPorObligacion[idObl] || 0;
          const saldo = Math.max(total - pagado, 0);

          let estado = "pendiente";

          if (saldo <= 0) {
            estado = "pagado";
          } else {
            const vencimiento =
              parseFechaCSV(o.FechaVencimiento) ||
              obtenerFechaVencimiento(o.Periodo);

            if (vencimiento) {
              const hoy = new Date();
              hoy.setHours(0, 0, 0, 0);
              vencimiento.setHours(0, 0, 0, 0);
              estado = hoy > vencimiento ? "mora" : "pendiente";
            }
          }

          return {
            ...o,
            ValorBase: valorBase,
            Intereses: intereses,
            OtrosCobros: otrosCobros,
            Total: total,
            TotalPagado: pagado,
            SaldoPendiente: saldo,
            EstadoCalculado: estado,
          };
        });

      setObligacionesResidente(filas);
    } catch (error) {
      console.error("Error cargando cartera del residente:", error);
      setObligacionesResidente([]);
      setPagosBackend([]);
    }
  };

  if (documentoResidenteActual) {
    cargarCartera();
  } else {
    setObligacionesResidente([]);
    setPagosBackend([]);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [documentoResidenteActual]);

const obligacionesPendientesArray = obligacionesResidente.filter(
  (o) => o.EstadoCalculado === "pendiente"
);

const obligacionesEnMoraArray = obligacionesResidente.filter(
  (o) => o.EstadoCalculado === "mora"
);

const obligacionesPagadasArray = obligacionesResidente.filter(
  (o) => o.EstadoCalculado === "pagado"
);

const totalPagos = pagosDelResidente.length;
const totalReservas = reservasDelResidente.length;
const pagosPendientes = obligacionesPendientesArray.length;
const pagosEnMora = obligacionesEnMoraArray.length;

const valorTotalPendiente = obligacionesPendientesArray.reduce(
  (total, item) => total + (Number(item.SaldoPendiente) || 0),
  0
);

const valorTotalEnMora = obligacionesEnMoraArray.reduce(
  (total, item) => total + (Number(item.SaldoPendiente) || 0),
  0
);

  const formatearMoneda = (valor) => {
  const numero = Number(String(valor ?? 0).replace(/[^\d.-]/g, "")) || 0;

  return `$ ${numero.toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true,
  })}`;
};
 
const obtenerInmueble = (item) => {
  const torre =
    item["Torre/Manzana"] ||
    item.TorreManzana ||
    item.torreManzana ||
    item.Torre ||
    item.torre ||
    "";

  const unidad =
    item["Apto/Casa"] ||
    item.AptoCasa ||
    item.aptoCasa ||
    item.Apartamento ||
    item.apartamento ||
    item.Casa ||
    item.casa ||
    "";

  const textoTorre = String(torre).trim();
  const textoUnidad = String(unidad).trim();

  if (textoTorre && textoUnidad) return `${textoTorre} - ${textoUnidad}`;
  if (textoTorre) return textoTorre;
  if (textoUnidad) return textoUnidad;
  return "No disponible";
};

const crearPqrs = async (e) => {
  e.preventDefault();

  if (!asuntoPqrs.trim() || !descripcionPqrs.trim()) {
    alert("Debes completar el asunto y la descripción.");
    return;
  }

  try {
    setGuardandoPqrs(true);

    const formData = new FormData();
    formData.append("DocumentoResidente", documentoUsuario);
    formData.append("NombreResidente", nombreUsuario);
    formData.append("TorreManzana", torreManzanaManual.trim());
    formData.append("AptoCasa", aptoCasaManual.trim());
    formData.append("Tipo", tipoPqrs);
    formData.append("Asunto", asuntoPqrs);
    formData.append("Descripcion", descripcionPqrs);
    if (tipoPqrs === "Reserva") {
  formData.append("Espacio", espacioReserva);
  formData.append("FechaReserva", fechaReserva);
  formData.append("HoraReserva", horaReserva);
}

    if (archivoPqrs) {
      formData.append("archivo", archivoPqrs);
    }

    const response = await fetch(`${API_BASE}/api/pqrs`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "No se pudo registrar la PQRS");
    }

    setTipoPqrs("Petición");
    setAsuntoPqrs("");
    setDescripcionPqrs("");
    setArchivoPqrs(null);
    setTorreManzanaManual("");
    setAptoCasaManual("");
    setEspacioReserva("");
    setFechaReserva("");
    setHoraReserva("");

    await cargarPqrs();
    alert("PQRS registrada correctamente.");
  } catch (error) {
    console.error("Error al crear PQRS:", error);
    alert(error?.message || "Ocurrió un error al registrar la PQRS.");
  } finally {
    setGuardandoPqrs(false);
  }
};

const eliminarPqrs = async (id) => {
  const confirmar = window.confirm("¿Seguro que deseas eliminar esta PQRS?");
  if (!confirmar) return;

  try {
    const response = await fetch(`${API_BASE}/api/pqrs/${id}`, {
      method: "DELETE",
    });

    const contentType = response.headers.get("content-type") || "";
    let data;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const texto = await response.text();
      console.error("Respuesta no JSON al eliminar PQRS:", texto);
      throw new Error("El servidor no devolvió JSON. Revisa la ruta DELETE en el backend.");
    }

    if (!response.ok) {
      throw new Error(data?.message || "No se pudo eliminar la PQRS");
    }

    await cargarPqrs();
    alert("PQRS eliminada correctamente.");
  } catch (error) {
    console.error("Error al eliminar PQRS:", error);
    alert(error.message || "Ocurrió un error al eliminar la PQRS.");
  }
};
 const notificacionesArray = Array.isArray(notificaciones) ? notificaciones : [];

const notificacionesResidente = notificacionesArray.filter((n) => {
  const estado = String(n.Estado || n.estado || "Publicado")
    .trim()
    .toLowerCase();

  return (
    estado.includes("publicado") ||
    estado.includes("publicada") ||
    estado === "" ||
    estado === "-"
  );
});

const totalPqrs = pqrs.length;
const pqrsEnProceso = pqrs.filter(
  (item) => item.Estado === "En proceso"
).length;
const pqrsCerradas = pqrs.filter(
  (item) => item.Estado === "Cerrada"
).length;

const ultimoPago =
  pagosDelResidente.length > 0 ? pagosDelResidente[pagosDelResidente.length - 1] : null;

const saldoPendiente = obligacionesResidente.reduce(
  (acc, o) => acc + (Number(o.SaldoPendiente) || 0),
  0
);

const historialEstadoCuenta = obligacionesResidente.map((o) => ({
  fecha:
    o.EstadoCalculado === "pagado"
      ? formatearFechaVisual(o.FechaPago) || "Pagado"
      : "No pagado",
  inmueble:
    [
      String(o.TorreManzana || o["Torre/Manzana"] || "").trim(),
      String(o.AptoCasa || o["Apto/Casa"] || "").trim(),
    ]
      .filter(Boolean)
      .join(" - ") || "No disponible",
  periodo: o.Periodo || "No disponible",
  concepto: o.Concepto || o.Subconcepto || "No disponible",
  subconcepto:
    o.Subconcepto && o.Subconcepto !== o.Concepto ? o.Subconcepto : "",
  valor: formatearMoneda(o.Total),
  pagado: formatearMoneda(o.TotalPagado),
  saldo: formatearMoneda(o.SaldoPendiente),
  estado:
    o.EstadoCalculado === "mora"
      ? "En mora"
      : o.EstadoCalculado === "pendiente"
      ? "Pendiente"
      : "Pagado",
  color:
    o.EstadoCalculado === "mora"
      ? "#ef4444"
      : o.EstadoCalculado === "pendiente"
      ? "#f59e0b"
      : "#10b981",
}));

const inputPagoStyle = {
  width: "100%",
  padding: "0.85em 0.95em",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  outline: "none",
  fontSize: "0.96em",
  color: "#0f172a",
  background: "#fff",
  boxSizing: "border-box",
};

const cardStyle = {
  background: "#ffffff",
  borderRadius: "18px",
  boxShadow: "0 8px 24px rgba(30, 41, 59, 0.08)",
  padding: "1.2em",
};

const quickBtnStyle = {
  border: "none",
  borderRadius: "16px",
  padding: "1.1em",
  fontWeight: "bold",
  fontSize: "1em",
  cursor: "pointer",
  background: "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)",
  color: "#fff",
  boxShadow: "0 6px 18px rgba(14,165,233,0.25)",
};
const valorHeaderStyle = {
  padding: "10px",
  textAlign: "center",
  verticalAlign: "middle",
  width: "140px",
};

const valorCellStyle = {
  padding: "10px",
  textAlign: "center",
  verticalAlign: "middle",
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: '"tnum" 1',
  whiteSpace: "nowrap",
  width: "140px",
};

const estadoHeaderStyle = {
  padding: "10px",
  verticalAlign: "middle",
  width: "110px",
};

const estadoCellStyle = {
  padding: "10px",
  verticalAlign: "middle",
  fontWeight: "bold",
  width: "110px",
};

const notificacionesResidenteOrdenadas = [...notificacionesResidente].sort((a, b) => {
  const obtenerTiempo = (item) => {
    const fecha =
      item?.Fecha_Publicación ||
      item?.["Fecha publicación"] ||
      item?.fecha ||
      "";

    if (!fecha) return 0;

    const partes = String(fecha).split("/");
    if (partes.length !== 3) return 0;

    const [d, m, y] = partes;
    return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
  };

  return obtenerTiempo(b) - obtenerTiempo(a);

});

return (
    <div style={{ maxWidth: "1150px", margin: "0 auto", padding: "1.5em" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "1.2em",
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: "#188aac", fontSize: "1.8em" }}>
            Panel del Residente
          </h2>
          <p style={{ margin: "0.3em 0 0", color: "#475569" }}>
            Bienvenido, <strong>{nombreUsuario}</strong>
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setMostrarPazYSalvo(true)}
            disabled={!torreManzana || !aptoCasa}
            title={torreManzana && aptoCasa ? "" : "No se encontró tu inmueble"}
            style={{
              background: "#fff",
              color: "#16a34a",
              border: "2px solid #16a34a",
              borderRadius: "10px",
              padding: "0.8em 1.2em",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Paz y salvo
          </button>

          <button
            type="button"
            onClick={() => setMostrarCambiarPin(true)}
            style={{
              background: "#fff",
              color: "#188aac",
              border: "2px solid #188aac",
              borderRadius: "10px",
              padding: "0.8em 1.2em",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Cambiar mi PIN
          </button>

          <button
            onClick={() => setUsuario(null)}
            style={{
              background: "#188aac",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              padding: "0.8em 1.2em",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Volver a elegir rol
          </button>
        </div>
      </div>

      {mostrarPazYSalvo && (
        <PazYSalvo
          usuario={{ nombre: nombreUsuario }}
          inmuebleFijo={{ torre: torreManzana, apto: aptoCasa }}
          onCerrar={() => setMostrarPazYSalvo(false)}
        />
      )}

      {mostrarCambiarPin && (
        <CambiarPin
          usuario={usuario}
          obligatorio={false}
          onListo={() => setMostrarCambiarPin(false)}
          onCancelar={() => setMostrarCambiarPin(false)}
        />
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1em",
          marginBottom: "1.4em",
        }}
      >
        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: "0.92em", marginBottom: "0.4em" }}>
            Total pagos registrados
          </div>
          <div style={{ fontSize: "2em", fontWeight: "bold", color: "#0f172a" }}>
            {totalPagos}
          </div>
        </div>

        <div
  style={{
    ...cardStyle,
    cursor: "pointer",
    border: vistaActiva === "pagosPendientes" ? "2px solid #f59e0b" : "2px solid transparent",
  }}
  onClick={() => setVistaActiva("pagosPendientes")}
>
  <div style={{ color: "#64748b", fontSize: "0.92em", marginBottom: "0.4em" }}>
    Pagos pendientes
  </div>
  <div style={{ fontSize: "2em", fontWeight: "bold", color: "#f59e0b" }}>
   <p>{pagosPendientes}</p>
   <p style={{ margin: "6px 0 0 0", fontSize: "0.9rem", color: "#64748b" }}>
  Valor: ${valorTotalPendiente.toLocaleString("es-CO")}
</p>
   </div>
</div>

<div
  style={{
    ...cardStyle,
    cursor: "pointer",
    border: vistaActiva === "pagosEnMora" ? "2px solid #ef4444" : "2px solid transparent",
  }}
  onClick={() => setVistaActiva("pagosEnMora")}
>
  <div style={{ color: "#64748b", fontSize: "0.92em", marginBottom: "0.4em" }}>
    Pagos en mora
  </div>
  <div style={{ fontSize: "2em", fontWeight: "bold", color: "#ef4444" }}>
   <p>{pagosEnMora}</p>
   <p style={{ margin: "6px 0 0 0", fontSize: "0.9rem", color: "#64748b" }}>
  Valor: ${valorTotalEnMora.toLocaleString("es-CO")}
</p>
  </div>
</div>

<div
  style={{
    ...cardStyle,
    cursor: "pointer",
    border: vistaActiva === "reservas" ? "2px solid #10b981" : "2px solid transparent",
  }}
  onClick={() => setVistaActiva("reservas")}
>
  <div style={{ color: "#64748b", fontSize: "0.92em", marginBottom: "0.4em" }}>
    Reservas registradas
  </div>
  <div style={{ fontSize: "2em", fontWeight: "bold", color: "#10b981" }}>
   <p>{totalReservas}</p>
  </div>
</div>
      </div>
  <div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "1em",
    marginBottom: "1.5em",
  }}
>
  <button
    style={{
      ...quickBtnStyle,
      transform: "scale(1.03)",
      boxShadow:
        vistaActiva === "pagosOnline"
          ? "0 10px 24px rgba(22, 163, 74, 0.35)"
          : "0 8px 18px rgba(34, 197, 94, 0.28)",
      background:
        vistaActiva === "pagosOnline"
          ? "linear-gradient(135deg, #15803d 0%, #16a34a 55%, #22c55e 100%)"
          : "linear-gradient(135deg, #16a34a 0%, #22c55e 55%, #4ade80 100%)",
      border: "2px solid rgba(255,255,255,0.35)",
      fontSize: "1.02em",
      fontWeight: "800",
      letterSpacing: "0.2px",
    }}
    onClick={() => setVistaActiva("pagosOnline")}
  >
    💳 Pagos Online
  </button>

  <button
    style={{
      ...quickBtnStyle,
      background:
        vistaActiva === "estadoCuenta"
          ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
          : "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)",
    }}
    onClick={() => setVistaActiva("estadoCuenta")}
  >
    💼 Mi estado de cuenta
  </button>

  <button
    style={{
      ...quickBtnStyle,
      background:
        vistaActiva === "misPagos"
          ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
          : "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)",
    }}
    onClick={() => setVistaActiva("misPagos")}
  >
    📄 Mis pagos
  </button>

  <button
    style={{
      ...quickBtnStyle,
      background:
        vistaActiva === "comunicados"
          ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
          : "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)",
    }}
    onClick={() => setVistaActiva("comunicados")}
  >
    📢 Comunicados
  </button>

  <button
    style={{
      ...quickBtnStyle,
      background:
        vistaActiva === "pqrs"
          ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
          : "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)",
    }}
    onClick={() => setVistaActiva("pqrs")}
  >
    🛠️ Solicitudes / PQRS
  </button>
</div>

  {vistaActiva === "pagosOnline" && (
  <div
    style={{
      ...cardStyle,
      marginBottom: "1.4em",
      border: "2px solid #bbf7d0",
      boxShadow: "0 14px 30px rgba(34, 197, 94, 0.14)",
      background: "linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%)",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "10px",
        marginBottom: "1em",
      }}
    >
      <div>
        <h3 style={{ margin: "0 0 6px 0", color: "#166534" }}>
          Pagos Online
        </h3>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Accede al formulario de pago con tus datos base. Allí podrás confirmar o
          modificar la información del inmueble antes de continuar.
        </p>
      </div>

      <button
        onClick={() => setVistaActiva("inicio")}
        style={{
          padding: "0.6em 1.2em",
          background: "#e2e8f0",
          color: "#0f172a",
          border: "none",
          borderRadius: "10px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        Cerrar
      </button>
    </div>

    <div
      style={{
        background: "#ecfdf5",
        border: "1px solid #bbf7d0",
        borderRadius: "14px",
        padding: "1em",
        marginBottom: "1.2em",
      }}
    >
      <p style={{ margin: 0, color: "#166534", fontWeight: "600" }}>
        Puedes usar los datos precargados o editarlos si vas a pagar un inmueble
        diferente.
      </p>
    </div>

    <button
      onClick={() => setVistaActiva("formularioPago")}
      style={{
        padding: "0.95em 1.6em",
        background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
        color: "#fff",
        border: "none",
        borderRadius: "14px",
        cursor: "pointer",
        fontWeight: "800",
        fontSize: "1em",
        boxShadow: "0 10px 24px rgba(34, 197, 94, 0.30)",
      }}
    >
      Ir al Formulario de Pago
    </button>
  </div>
)}

{vistaActiva === "formularioPago" && (
  <PagoOnline
    embebido={true}
    onBack={() => setVistaActiva("pagosOnline")}
    obligaciones={obligacionesResidente}
    initialData={{
      nombre:
        obligacionesResidente[0]?.NombreResidente || usuario?.nombre || "",
      documento: documentoResidenteActual || "",
      email: "",
      telefono: "",
      torre_manzana: obligacionesResidente[0]?.TorreManzana || "",
      apto_casa: obligacionesResidente[0]?.AptoCasa || "",
    }}
  />
)}

      {vistaActiva === "estadoCuenta" && (
        <div
          style={{
            ...cardStyle,
            marginBottom: "1.4em",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 6px 0", color: "#0f172a" }}>
                Mi estado de cuenta
              </h3>
              <p style={{ margin: 0, color: "#64748b" }}>
                Consulta tu saldo, periodos y movimientos registrados.
              </p>
            </div>

            <button
              onClick={() => setVistaActiva("inicio")}
              style={{
                padding: "0.6em 1.2em",
                background: "#e2e8f0",
                color: "#0f172a",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Cerrar
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1em",
              marginTop: "1.2em",
              marginBottom: "1.2em",
            }}
          >
            <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "1em" }}>
              <div style={{ color: "#64748b", fontSize: "0.92em" }}>
                Saldo pendiente
              </div>
              <div
                style={{
                  fontSize: "1.8em",
                  fontWeight: "bold",
                  color: saldoPendiente > 0 ? "#ef4444" : "#10b981",
                }}
              >
                ${saldoPendiente.toLocaleString("es-CO")}
              </div>
            </div>

            <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "1em" }}>
              <div style={{ color: "#64748b", fontSize: "0.92em" }}>
                Pagos relacionados
              </div>
              <div style={{ fontSize: "1.8em", fontWeight: "bold", color: "#0f172a" }}>
               <p>{totalPagos}</p>
              </div>
            </div>

            <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "1em" }}>
              <div style={{ color: "#64748b", fontSize: "0.92em" }}>
                Pagos pendientes o en mora
              </div>
              <div style={{ fontSize: "1.8em", fontWeight: "bold", color: "#f59e0b" }}>
                {pagosPendientes + pagosEnMora}
              </div>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
  <table
    style={{
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "0.95em",
      tableLayout: "fixed",
    }}
  >
    <thead>
      <tr style={{ background: "#eaf4fb", textAlign: "left" }}>
        <th style={{ padding: "10px", verticalAlign: "middle" }}>Fecha</th>
        <th style={{ padding: "10px", verticalAlign: "middle" }}>Inmueble</th>
        <th style={{ padding: "10px", verticalAlign: "middle" }}>Periodo</th>
        <th style={{ padding: "10px", verticalAlign: "middle" }}>Concepto</th>
        <th style={valorHeaderStyle}>Valor</th>
        <th style={valorHeaderStyle}>Pagado</th>
        <th style={valorHeaderStyle}>Saldo</th>
        <th style={estadoHeaderStyle}>Estado</th>
      </tr>
    </thead>
    <tbody>
      {historialEstadoCuenta.length > 0 ? (
        historialEstadoCuenta.map((item, index) => (
          <tr key={index} style={{ borderBottom: "1px solid #e2e8f0" }}>
            <td style={{ padding: "10px", verticalAlign: "middle" }}>
              {item.fecha}
            </td>
            <td style={{ padding: "10px", verticalAlign: "middle" }}>
              {item.inmueble}
            </td>
            <td style={{ padding: "10px", verticalAlign: "middle" }}>
              {item.periodo}
            </td>
            <td style={{ padding: "10px", verticalAlign: "middle" }}>
              <div>{item.concepto}</div>
              {item.subconcepto && (
                <div style={{ fontSize: "0.85em", color: "#64748b" }}>
                  {item.subconcepto}
                </div>
              )}
            </td>
            <td style={valorCellStyle}>{item.valor}</td>
            <td style={valorCellStyle}>{item.pagado}</td>
            <td style={valorCellStyle}>{item.saldo}</td>
            <td style={{ ...estadoCellStyle, color: item.color }}>
              {item.estado}
            </td>
          </tr>
        ))
      ) : (
        <tr>
          <td
            colSpan="9"
            style={{ padding: "14px", color: "#64748b", textAlign: "center" }}
          >
            No hay movimientos registrados para este residente.
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>
        </div>
      )}

{vistaActiva === "misPagos" && (
  <div style={{ ...cardStyle, marginBottom: "1.2em" }}>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "0.8em",
        gap: "10px",
        flexWrap: "wrap",
      }}
    >
      <div>
        <h3 style={{ margin: 0, color: "#1e293b" }}>Mis pagos</h3>
        <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "0.95em" }}>
          Revisa el historial de pagos asociados a tu cuenta.
        </p>
      </div>

      <button
        onClick={() => setVistaActiva("inicio")}
        style={{
          border: "none",
          borderRadius: "10px",
          padding: "8px 14px",
          cursor: "pointer",
          background: "#e2e8f0",
          color: "#1e293b",
          fontWeight: "bold",
        }}
      >
        Cerrar
      </button>
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "12px",
        marginBottom: "1em",
      }}
    >
      <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "1em" }}>
        <div style={{ color: "#64748b", fontSize: "0.9em" }}>Total registros</div>
        <div style={{ fontSize: "2em", fontWeight: "bold", color: "#0f172a" }}>
          {pagosDelResidente.length}
        </div>
      </div>

      <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "1em" }}>
        <div style={{ color: "#64748b", fontSize: "0.9em" }}>Valor total pagado</div>
        <div style={{ fontSize: "1.6em", fontWeight: "bold", color: "#10b981" }}>
          {formatearMoneda(
            pagosDelResidente.reduce(
              (acc, p) => acc + montoAplicadoPago(p),
              0
            )
          )}
        </div>
      </div>

      <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "1em" }}>
        <div style={{ color: "#64748b", fontSize: "0.9em" }}>Obligaciones cubiertas</div>
        <div style={{ fontSize: "2em", fontWeight: "bold", color: "#0284c7" }}>
          {obligacionesPagadasArray.length}
        </div>
      </div>
    </div>

    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.95em",
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr style={{ background: "#eaf4fb", textAlign: "left" }}>
            <th style={{ padding: "10px", verticalAlign: "middle" }}>ID Pago</th>
            <th style={{ padding: "10px", verticalAlign: "middle" }}>Obligación</th>
            <th style={{ padding: "10px", verticalAlign: "middle" }}>Fecha pago</th>
            <th style={{ padding: "10px", verticalAlign: "middle" }}>Periodo</th>
            <th style={{ padding: "10px", verticalAlign: "middle" }}>Concepto</th>
            <th style={valorHeaderStyle}>Valor</th>
            <th style={estadoHeaderStyle}>Estado</th>
            <th style={{ padding: "10px", verticalAlign: "middle", textAlign: "center" }}>Comprobante</th>
          </tr>
        </thead>
        <tbody>
          {pagosDelResidente.length > 0 ? (
            pagosDelResidente.map((pago, index) => (
              <tr key={index} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "10px", verticalAlign: "middle" }}>
                  {pago.ID_Pago || pago.IDPago || pago["ID Pago"] || "Sin ID"}
                </td>
                <td style={{ padding: "10px", verticalAlign: "middle" }}>
                  {pago.ID_Obligacion || pago.IDObligacion || "-"}
                </td>
                <td style={{ padding: "10px", verticalAlign: "middle" }}>
                  {formatearFechaVisual(pago.FechaPago || pago["Fecha de pago"]) || "No disponible"}
                </td>
                <td style={{ padding: "10px", verticalAlign: "middle" }}>
                  {pago.Periodo || pago.periodo || "No disponible"}
                </td>
                <td style={{ padding: "10px", verticalAlign: "middle" }}>
                  <div>
                    {pago.ConceptoPago ||
                      pago.Concepto ||
                      pago.concepto ||
                      "No disponible"}
                  </div>
                  {pago.Subconcepto &&
                    pago.Subconcepto !==
                      (pago.ConceptoPago || pago.Concepto) && (
                      <div style={{ fontSize: "0.85em", color: "#64748b" }}>
                        {pago.Subconcepto}
                      </div>
                    )}
                </td>
                <td style={valorCellStyle}>
                  {formatearMoneda(montoAplicadoPago(pago))}
                </td>
                <td style={{ ...estadoCellStyle, color: "#10b981" }}>
                  {pago.EstadoPago || pago.Estado || pago.estado || "Pagado"}
                </td>
                <td style={{ padding: "10px", verticalAlign: "middle", textAlign: "center" }}>
                  {pago.ID_Pago ? (
                    <button
                      type="button"
                      onClick={() =>
                        descargarComprobante(pago.ID_Pago).catch((err) => alert(err.message))
                      }
                      style={{
                        background: "#fff",
                        color: "#188aac",
                        border: "1px solid #188aac",
                        borderRadius: "6px",
                        padding: "4px 10px",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      PDF
                    </button>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan="8"
                style={{ padding: "14px", color: "#64748b", textAlign: "center" }}
              >
                Aún no hay pagos registrados para este residente.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
)}
      {vistaActiva === "pagosPendientes" && (
  <div
    style={{
      ...cardStyle,
      marginBottom: "1.4em",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "10px",
      }}
    >
      <div>
        <h3 style={{ margin: "0 0 6px 0", color: "#0f172a" }}>
          Pagos pendientes
        </h3>
        <p style={{ margin: 0, color: "#64748b" }}>
          Consulta los pagos que aún están pendientes por cancelar.
        </p>
      </div>

      <button
        onClick={() => setVistaActiva("inicio")}
        style={{
          padding: "0.6em 1.2em",
          background: "#e2e8f0",
          color: "#0f172a",
          border: "none",
          borderRadius: "10px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        Cerrar
      </button>
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "1em",
        marginTop: "1.2em",
        marginBottom: "1.2em",
      }}
    >
      <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "1em" }}>
        <div style={{ color: "#64748b", fontSize: "0.92em" }}>Total pendientes</div>
        <div style={{ fontSize: "1.8em", fontWeight: "bold", color: "#f59e0b" }}>
          {pagosPendientes}
        </div>
        <div style={{ marginTop: "6px", fontSize: "0.9em", color: "#64748b" }}>
          Valor: {formatearMoneda(valorTotalPendiente)}
        </div>
      </div>
    </div>

    <div style={{ overflowX: "auto" }}>
  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95em" }}>
    <thead>
      <tr style={{ background: "#eaf4fb", textAlign: "left" }}>
        <th style={{ padding: "10px", verticalAlign: "middle" }}>ID Pago</th>
        <th style={{ padding: "10px", verticalAlign: "middle" }}>Fecha</th>
        <th style={{ padding: "10px", verticalAlign: "middle" }}>Periodo</th>
        <th style={{ padding: "10px", verticalAlign: "middle" }}>Concepto</th>
        <th style={{ padding: "10px", textAlign: "right", verticalAlign: "middle" }}>Valor</th>
        <th style={{ padding: "10px", verticalAlign: "middle" }}>Estado</th>
      </tr>
    </thead>
    <tbody>
      {obligacionesPendientesArray.length > 0 ? (
        obligacionesPendientesArray.map((pago, index) => (
          <tr key={index} style={{ borderBottom: "1px solid #e2e8f0" }}>
  <td style={{ padding: "10px", verticalAlign: "middle" }}>
    {pago.ID_Obligacion || "Sin ID"}
  </td>
  <td style={{ padding: "10px", verticalAlign: "middle" }}>
    {formatearFechaVisual(pago.FechaPago) || "No pagado"}
  </td>
  <td style={{ padding: "10px", verticalAlign: "middle" }}>
    {pago.Periodo || "No disponible"}
  </td>
  <td style={{ padding: "10px", verticalAlign: "middle" }}>
    <div>{pago.Concepto || pago.Subconcepto || "No disponible"}</div>
    {pago.Subconcepto && pago.Subconcepto !== pago.Concepto && (
      <div style={{ fontSize: "0.85em", color: "#64748b" }}>
        {pago.Subconcepto}
      </div>
    )}
  </td>
  <td
    style={{
      padding: "10px",
      textAlign: "right",
      verticalAlign: "middle",
      fontVariantNumeric: "tabular-nums",
      whiteSpace: "nowrap",
    }}
  >
    {formatearMoneda(pago.SaldoPendiente)}
  </td>
  <td style={{ padding: "10px", verticalAlign: "middle", fontWeight: "bold", color: "#f59e0b" }}>
    Pendiente
  </td>
</tr>
        ))
      ) : (
        <tr>
          <td
            colSpan="6"
            style={{ padding: "14px", color: "#64748b", textAlign: "center" }}
          >
            No hay pagos pendientes para este residente.
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>
  </div>
)}

{vistaActiva === "pagosEnMora" && (
  <div
    style={{
      ...cardStyle,
      marginBottom: "1.4em",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "10px",
      }}
    >
      <div>
        <h3 style={{ margin: "0 0 6px 0", color: "#0f172a" }}>
          Pagos en mora
        </h3>
        <p style={{ margin: 0, color: "#64748b" }}>
          Consulta los pagos vencidos o marcados en mora.
        </p>
      </div>

      <button
        onClick={() => setVistaActiva("inicio")}
        style={{
          padding: "0.6em 1.2em",
          background: "#e2e8f0",
          color: "#0f172a",
          border: "none",
          borderRadius: "10px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        Cerrar
      </button>
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "1em",
        marginTop: "1.2em",
        marginBottom: "1.2em",
      }}
    >
      <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "1em" }}>
        <div style={{ color: "#64748b", fontSize: "0.92em" }}>Total en mora</div>
        <div style={{ fontSize: "1.8em", fontWeight: "bold", color: "#ef4444" }}>
          {pagosEnMora}
        </div>
        <div style={{ marginTop: "6px", fontSize: "0.9em", color: "#64748b" }}>
          Valor: {formatearMoneda(valorTotalEnMora)}
        </div>
      </div>
    </div>

  <div style={{ overflowX: "auto" }}>
  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95em" }}>
    <thead>
      <tr style={{ background: "#eaf4fb", textAlign: "left" }}>
        <th style={{ padding: "10px", verticalAlign: "middle" }}>ID Pago</th>
        <th style={{ padding: "10px", verticalAlign: "middle" }}>Fecha</th>
        <th style={{ padding: "10px", verticalAlign: "middle" }}>Periodo</th>
        <th style={{ padding: "10px", verticalAlign: "middle" }}>Concepto</th>
        <th style={{ padding: "10px", textAlign: "right", verticalAlign: "middle" }}>Valor</th>
        <th style={{ padding: "10px", verticalAlign: "middle" }}>Estado</th>
      </tr>
    </thead>
    <tbody>
      {obligacionesEnMoraArray.length > 0 ? (
        obligacionesEnMoraArray.map((pago, index) => (
          <tr key={index} style={{ borderBottom: "1px solid #e2e8f0" }}>
  <td style={{ padding: "10px", verticalAlign: "middle" }}>
    {pago.ID_Obligacion || "Sin ID"}
  </td>
  <td style={{ padding: "10px", verticalAlign: "middle" }}>
    {formatearFechaVisual(pago.FechaPago) || "No pagado"}
  </td>
  <td style={{ padding: "10px", verticalAlign: "middle" }}>
    {pago.Periodo || "No disponible"}
  </td>
  <td style={{ padding: "10px", verticalAlign: "middle" }}>
    <div>{pago.Concepto || pago.Subconcepto || "No disponible"}</div>
    {pago.Subconcepto && pago.Subconcepto !== pago.Concepto && (
      <div style={{ fontSize: "0.85em", color: "#64748b" }}>
        {pago.Subconcepto}
      </div>
    )}
  </td>
  <td
    style={{
      padding: "10px",
      textAlign: "right",
      verticalAlign: "middle",
      fontVariantNumeric: "tabular-nums",
      whiteSpace: "nowrap",
    }}
  >
    {formatearMoneda(pago.SaldoPendiente)}
  </td>
  <td style={{ padding: "10px", verticalAlign: "middle", fontWeight: "bold", color: "#ef4444" }}>
    En mora
  </td>
</tr>
        ))
      ) : (
        <tr>
          <td
            colSpan="6"
            style={{ padding: "14px", color: "#64748b", textAlign: "center" }}
          >
            No hay pagos en mora para este residente.
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>
  </div>
)}

      {vistaActiva === "comunicados" && (
        <div
          style={{
            ...cardStyle,
            marginBottom: "1.4em",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 6px 0", color: "#0f172a" }}>
                Comunicados
              </h3>
              <p style={{ margin: 0, color: "#64748b" }}>
                Consulta avisos, recordatorios y mensajes importantes para residentes.
              </p>
            </div>

            <button
              onClick={() => setVistaActiva("inicio")}
              style={{
                padding: "0.6em 1.2em",
                background: "#e2e8f0",
                color: "#0f172a",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Cerrar
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1em",
              marginTop: "1.2em",
              marginBottom: "1.2em",
            }}
          >
            <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "1em" }}>
  <div style={{ color: "#64748b", fontSize: "0.92em" }}>Total comunicados</div>
  <div style={{ fontSize: "1.8em", fontWeight: "bold", color: "#0f172a" }}>
    {notificacionesResidente.length}
  </div>
</div>

<div style={{ background: "#f8fafc", borderRadius: "14px", padding: "1em" }}>
  <div style={{ color: "#64748b", fontSize: "0.92em" }}>No leídos</div>
  <div style={{ fontSize: "1.8em", fontWeight: "bold", color: "#0284c7" }}>
    {notificacionesResidente.length}
  </div>
</div>

<div style={{ background: "#f8fafc", borderRadius: "14px", padding: "1em" }}>
  <div style={{ color: "#64748b", fontSize: "0.92em" }}>Último aviso</div>
  <div style={{ fontSize: "1em", fontWeight: "bold", color: "#0f172a" }}>
    {notificacionesResidente.length > 0
  ? notificacionesResidente[notificacionesResidente.length - 1].Título || "Sin título"
  : "Sin registros"}
  </div>
</div>
</div>

<div style={{ overflowX: "auto" }}>
  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95em" }}>
    <thead>
      <tr style={{ background: "#eaf4fb", textAlign: "left" }}>
        <th style={{ padding: "10px" }}>Fecha</th>
        <th style={{ padding: "10px" }}>Asunto</th>
        <th style={{ padding: "10px" }}>Descripción</th>
        <th style={{ padding: "10px" }}>Tipo</th>
        <th style={{ padding: "10px" }}>Descripción</th>
        <th style={{ padding: "10px" }}>Adjunto</th>
        <th style={{ padding: "10px" }}>Estado</th>
      </tr>
    </thead>
    <tbody>


 {notificacionesResidenteOrdenadas.length > 0 ? (
  notificacionesResidenteOrdenadas.map((n, index) => {
    console.log("Adjunto residente:", n.Adjunto, n);

    return (
      <tr key={index} style={{ borderBottom: "1px solid #e2e8f0" }}>
        <td style={{ padding: "10px" }}>
          {n.Fecha_Publicación || n["Fecha publicación"] || n.fecha || "No disponible"}
        </td>
        <td style={{ padding: "10px" }}>
          {n.Título || n.Titulo || "Sin asunto"}
        </td>
        <td style={{ padding: "10px" }}>
          {n.Tipo || "No disponible"}
        </td>
        <td style={{ padding: "10px" }}>
          {n.Descripción || n.Descripcion || n.descripcion || "Sin descripción"}
        </td>
        <td style={{ padding: "10px" }}>
          {n.Adjunto ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <a
                href={`${API_BASE}/uploads/${n.Adjunto}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#0284c7", textDecoration: "none", fontWeight: "bold" }}
              >
                Ver archivo
              </a>
              <a
                href={`${API_BASE}/uploads/${n.Adjunto}`}
                download
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#16a34a", textDecoration: "none", fontWeight: "bold" }}
              >
                Descargar
              </a>
            </div>
          ) : (
            <span style={{ color: "#64748b" }}>Sin adjunto</span>
          )}
        </td>
        <td style={{ padding: "10px", fontWeight: "bold" }}>
          {n.Estado || n.estado || "Publicado"}
        </td>
      </tr>
    );
  })
) : (
  <tr>
    <td
      colSpan="7"
      style={{ padding: "14px", color: "#64748b", textAlign: "center" }}
    >
      Aún no hay comunicados disponibles para este residente.
    </td>
  </tr>
)}
</tbody>
  </table>
</div>
      </div>
    )}

    {vistaActiva === "reservas" && (
  <div
    style={{
      ...cardStyle,
      marginBottom: "1.4em",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "10px",
      }}
    >
      <div>
        <h3 style={{ margin: "0 0 6px 0", color: "#0f172a" }}>
          Reservas registradas
        </h3>
        <p style={{ margin: 0, color: "#64748b" }}>
          Consulta las reservas asociadas a tu cuenta.
        </p>
      </div>

      <button
        onClick={() => setVistaActiva("inicio")}
        style={{
          padding: "0.6em 1.2em",
          background: "#e2e8f0",
          color: "#0f172a",
          border: "none",
          borderRadius: "10px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        Cerrar
      </button>
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "1em",
        marginTop: "1.2em",
        marginBottom: "1.2em",
      }}
    >
      <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "1em" }}>
        <div style={{ color: "#64748b", fontSize: "0.92em" }}>Total reservas</div>
        <div style={{ fontSize: "1.8em", fontWeight: "bold", color: "#10b981" }}>
          {totalReservas}
        </div>
      </div>
    </div>

    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95em" }}>
        <thead>
          <tr style={{ background: "#eaf4fb", textAlign: "left" }}>
  <th style={{ padding: "10px" }}>Fecha</th>
  <th style={{ padding: "10px" }}>Inmueble</th>
  <th style={{ padding: "10px" }}>Espacio</th>
  <th style={{ padding: "10px" }}>Hora</th>
  <th style={{ padding: "10px" }}>Estado</th>
</tr>
        </thead>
<tbody>
  {reservasDelResidente.length > 0 ? (
    reservasDelResidente.map((reserva, index) => (
      <tr key={index} style={{ borderBottom: "1px solid #e2e8f0" }}>
        <td style={{ padding: "10px" }}>
          {reserva.Fecha || reserva.fecha || "No disponible"}
        </td>
        <td style={{ padding: "10px" }}>
          {obtenerInmueble(reserva)}
        </td>
        <td style={{ padding: "10px" }}>
          {reserva.Espacio || reserva.espacio || reserva.ZonaComun || "No disponible"}
        </td>
        <td style={{ padding: "10px" }}>
          {reserva.FechaReserva || reserva.fechaReserva || "No disponible"}
        </td>
        <td style={{ padding: "10px" }}>
          {reserva.HoraReserva || reserva.horaReserva || reserva.Hora || reserva.hora || "No disponible"}
        </td>
        <td style={{ padding: "10px", fontWeight: "bold", color: "#10b981" }}>
          {reserva.Estado || reserva.estado || "Registrada"}
        </td>
      </tr>
    ))
  ) : (
            <tr>
              <td colSpan="5" style={{ padding: "14px", color: "#64748b", textAlign: "center" }}>
                Aún no hay reservas registradas para este residente.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
)}
           {vistaActiva === "pqrs" && (
  <div
    style={{
      ...cardStyle,
      marginBottom: "1.4em",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "10px",
      }}
    >
      <div>
        <h3 style={{ margin: "0 0 6px 0", color: "#0f172a" }}>
          Solicitudes / PQRS
        </h3>
        <p style={{ margin: 0, color: "#64748b" }}>
          Consulta el estado de tus peticiones, quejas, reclamos o solicitudes.
        </p>
      </div>

      <button
        onClick={() => setVistaActiva("inicio")}
        style={{
          padding: "0.6em 1.2em",
          background: "#e2e8f0",
          color: "#0f172a",
          border: "none",
          borderRadius: "10px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        Cerrar
      </button>
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "1em",
        marginTop: "1.2em",
        marginBottom: "1.2em",
      }}
    >
      <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "1em" }}>
        <div style={{ color: "#64748b", fontSize: "0.92em" }}>Total solicitudes</div>
        <div style={{ fontSize: "1.8em", fontWeight: "bold", color: "#0f172a" }}>
          {totalPqrs}
        </div>
      </div>

      <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "1em" }}>
        <div style={{ color: "#64748b", fontSize: "0.92em" }}>En proceso</div>
        <div style={{ fontSize: "1.8em", fontWeight: "bold", color: "#f59e0b" }}>
          {pqrsEnProceso}
        </div>
      </div>

      <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "1em" }}>
        <div style={{ color: "#64748b", fontSize: "0.92em" }}>Cerradas</div>
        <div style={{ fontSize: "1.8em", fontWeight: "bold", color: "#10b981" }}>
          {pqrsCerradas}
        </div>
      </div>
    </div>

    <form
  onSubmit={crearPqrs}
  style={{
    background: "#f8fafc",
    borderRadius: "14px",
    padding: "1.2em",
    marginBottom: "1.2em",
    border: "1px solid #e2e8f0",
  }}
>
  <h4 style={{ margin: "0 0 12px 0", color: "#0f172a" }}>
  Registrar nueva solicitud
</h4>

<div
  style={{
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "16px",
    marginBottom: "16px",
  }}
>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: "12px",
      marginBottom: "14px",
    }}
  >
    <div>
      <label
        style={{
          display: "block",
          marginBottom: "6px",
          fontWeight: "600",
          color: "#334155",
          fontSize: "14px",
        }}
      >
        Tipo
      </label>
      <select
        value={tipoPqrs}
        onChange={(e) => {
  const nuevoTipo = e.target.value;
  setTipoPqrs(nuevoTipo);

  if (nuevoTipo !== "Reserva") {
    setEspacioReserva("");
    setFechaReserva("");
    setHoraReserva("");
  }
}}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          background: "#fff",
          boxSizing: "border-box",
          outline: "none",
          fontSize: "14px",
          color: "#0f172a",
        }}
      >
        <option value="Petición">Petición</option>
        <option value="Queja">Queja</option>
        <option value="Reclamo">Reclamo</option>
        <option value="Incidente">Incidente</option>
        <option value="Solicitud">Solicitud</option>
        <option value="Sugerencia">Sugerencia</option>
        <option value="Reserva">Reserva</option>
      </select>
    </div>

    <div>
      <label
        style={{
          display: "block",
          marginBottom: "6px",
          fontWeight: "600",
          color: "#334155",
          fontSize: "14px",
        }}
      >
        Torre/Manzana
      </label>
      <input
        type="text"
        value={torreManzanaManual}
        onChange={(e) => setTorreManzanaManual(e.target.value)}
        required
        placeholder="Ej: Torre 2 o Manzana B"
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          background: "#fff",
          boxSizing: "border-box",
          outline: "none",
          fontSize: "14px",
          color: "#0f172a",
        }}
      />
    </div>

    <div>
      <label
        style={{
          display: "block",
          marginBottom: "6px",
          fontWeight: "600",
          color: "#334155",
          fontSize: "14px",
        }}
      >
        Apto/Casa
      </label>
      <input
        type="text"
        value={aptoCasaManual}
        onChange={(e) => setAptoCasaManual(e.target.value)}
        required
        placeholder="Ej: Apto 302 o Casa 18"
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          background: "#fff",
          boxSizing: "border-box",
          outline: "none",
          fontSize: "14px",
          color: "#0f172a",
        }}
      />
    </div>

    <div>
      <label
        style={{
          display: "block",
          marginBottom: "6px",
          fontWeight: "600",
          color: "#334155",
          fontSize: "14px",
        }}
      >
        Asunto
      </label>
      <input
        type="text"
        value={asuntoPqrs}
        onChange={(e) => setAsuntoPqrs(e.target.value)}
        placeholder="Escribe el asunto"
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          background: "#fff",
          boxSizing: "border-box",
          outline: "none",
          fontSize: "14px",
          color: "#0f172a",
        }}
      />
       </div>
  </div>

  {tipoPqrs === "Reserva" && (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "12px",
        marginBottom: "14px",
      }}
    >
      <div>
        <label
          style={{
            display: "block",
            marginBottom: "6px",
            fontWeight: "600",
            color: "#334155",
            fontSize: "14px",
          }}
        >
          Espacio
        </label>
        <input
          type="text"
          value={espacioReserva}
          onChange={(e) => setEspacioReserva(e.target.value)}
          placeholder="Ej: Salón social, BBQ, Cancha"
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            background: "#fff",
            boxSizing: "border-box",
            outline: "none",
            fontSize: "14px",
            color: "#0f172a",
          }}
        />
      </div>

      <div>
        <label
          style={{
            display: "block",
            marginBottom: "6px",
            fontWeight: "600",
            color: "#334155",
            fontSize: "14px",
          }}
        >
          Fecha de reserva
        </label>
        <input
          type="date"
          value={fechaReserva}
          onChange={(e) => setFechaReserva(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            background: "#fff",
            boxSizing: "border-box",
            outline: "none",
            fontSize: "14px",
            color: "#0f172a",
          }}
        />
      </div>

      <div>
        <label
          style={{
            display: "block",
            marginBottom: "6px",
            fontWeight: "600",
            color: "#334155",
            fontSize: "14px",
          }}
        >
          Hora
        </label>
        <input
          type="time"
          value={horaReserva}
          onChange={(e) => setHoraReserva(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            background: "#fff",
            boxSizing: "border-box",
            outline: "none",
            fontSize: "14px",
            color: "#0f172a",
          }}
        />
      </div>
    </div>
  )}

  <div style={{ marginBottom: "14px" }}>
    <label
      style={{
        display: "block",
        marginBottom: "6px",
        fontWeight: "600",
        color: "#334155",
        fontSize: "14px",
      }}
    >
      Descripción
    </label>
    <textarea
      value={descripcionPqrs}
      onChange={(e) => setDescripcionPqrs(e.target.value)}
      placeholder="Describe tu solicitud"
      rows={4}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: "8px",
        border: "1px solid #d1d5db",
        background: "#fff",
        boxSizing: "border-box",
        outline: "none",
        fontSize: "14px",
        color: "#0f172a",
        resize: "vertical",
        minHeight: "110px",
      }}
    />
  </div>

  <div style={{ marginBottom: "14px" }}>
    <label
      style={{
        display: "block",
        marginBottom: "6px",
        fontWeight: "600",
        color: "#334155",
        fontSize: "14px",
      }}
    >
      Adjunto opcional
    </label>
    <input
      type="file"
      onChange={(e) => setArchivoPqrs(e.target.files?.[0] || null)}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: "8px",
        border: "1px solid #d1d5db",
        background: "#fff",
        boxSizing: "border-box",
        outline: "none",
        fontSize: "14px",
        color: "#0f172a",
      }}
    />
  </div>

  <button
    type="submit"
    disabled={guardandoPqrs}
    style={{
      padding: "10px 16px",
      background: guardandoPqrs ? "#94a3b8" : "#0ea5e9",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      cursor: guardandoPqrs ? "not-allowed" : "pointer",
      fontWeight: "600",
      boxShadow: guardandoPqrs ? "none" : "0 2px 8px rgba(14, 165, 233, 0.20)",
    }}
  >
    {guardandoPqrs ? "Guardando..." : "Enviar PQRS"}
  </button>
</div>
</form>

    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1em" }}>
  <thead>
    <tr style={{ background: "#eaf4fb", textAlign: "left" }}>
  <th style={{ padding: "10px" }}>Fecha</th>
  <th style={{ padding: "10px" }}>Tipo</th>
  <th style={{ padding: "10px" }}>Asunto</th>
  <th style={{ padding: "10px" }}>Sitio</th>
  <th style={{ padding: "10px" }}>Fecha reserva</th>
  <th style={{ padding: "10px" }}>Hora</th>
  <th style={{ padding: "10px" }}>Estado</th>
  <th style={{ padding: "10px" }}>Mi adjunto</th>
  <th style={{ padding: "10px" }}>Respuesta</th>
  <th style={{ padding: "10px" }}>Fecha respuesta</th>
  <th style={{ padding: "10px" }}>Acciones</th>
</tr>
  </thead>

  <tbody>
    {pqrs.length === 0 ? (
      <tr>
        <td
          colSpan="11"
          style={{ padding: "14px", color: "#64748b", textAlign: "center" }}
        >
          Aún no hay solicitudes o PQRS registradas para este residente.
        </td>
      </tr>
    ) : (
      pqrs.map((item) => (
        <tr key={item.ID} style={{ borderBottom: "1px solid #e2e8f0" }}>
          <td style={{ padding: "10px" }}>{item.Fecha || "-"}</td>
<td style={{ padding: "10px" }}>{item.Tipo || "-"}</td>
<td style={{ padding: "10px" }}>{item.Asunto || "-"}</td>
<td style={{ padding: "10px", maxWidth: 280, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
  {item.Descripcion || item.descripcion || "-"}
</td>
<td style={{ padding: "10px" }}>
  {item.Espacio || item.espacio || item.Sitio || item.sitio || "-"}
</td>
<td style={{ padding: "10px" }}>
  {item.FechaReserva || item.fechaReserva || item.Fecha_Reserva || item.fecha_reserva || "-"}
</td>
<td style={{ padding: "10px" }}>
  {item.HoraReserva || item.horaReserva || item.Hora || item.hora || "-"}
</td>
<td style={{ padding: "10px", fontWeight: "bold" }}>
  {item.Estado || "-"}
</td>

<td style={{ padding: "10px" }}>
  {item.URL_Adjunto && item.URL_Adjunto !== "-" ? (
    <a
      href={`${API_BASE}${item.URL_Adjunto}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: "#0d6efd", textDecoration: "underline" }}
    >
      Ver adjunto
    </a>
  ) : (
    <span style={{ color: "#94a3b8" }}>Sin adjunto</span>
  )}
</td>
          <td style={{ padding: "10px" }}>
  {item.URL_RespuestaAdmin && item.URL_RespuestaAdmin !== "-" ? (
    <a
      href={`${API_BASE}${item.URL_RespuestaAdmin}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: "#0d6efd", textDecoration: "underline" }}
    >
      Ver respuesta
    </a>
  ) : (
    item.RespuestaAdmin || "Sin respuesta"
  )}
</td>
          <td style={{ padding: "10px" }}>
            {item.FechaRespuesta || "-"}
          </td>
          <td style={{ padding: "10px" }}>
            {String(item.Estado || "").trim().toLowerCase() === "radicada" ? (
  <button
    onClick={() => eliminarPqrs(item.ID)}
    style={{
      background: "#ef4444",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      padding: "6px 10px",
      cursor: "pointer",
      fontWeight: "bold",
    }}
  >
    Eliminar
  </button>
) : (
  <span style={{ color: "#64748b", fontSize: "0.85em" }}>Conservada</span>
)}
          </td>
        </tr>
      ))
    )}
  </tbody>
</table>
    </div>
  </div>
)}
      
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, color: "#0f172a" }}>Mis datos</h3>
          <p><strong>Nombre:</strong> {nombreUsuario}</p>
          <p><strong>Documento:</strong> {documentoUsuario}</p>
          <p><strong>Rol:</strong> {usuario?.rolActivo || usuario?.rol}</p>
          <p><strong>ID Inmueble:</strong> {habitanteEncontrado?.["ID_Inmueble"] || habitanteEncontrado?.["ID Inmueble"] || "No disponible"}</p>
<p><strong>Torre/Manzana:</strong> {habitanteEncontrado?.["Torre/Manzana"] || habitanteEncontrado?.["TorreManzana"] || "No disponible"}</p>
<p><strong>Apto/Casa:</strong> {habitanteEncontrado?.["Apto/Casa"] || habitanteEncontrado?.["AptoCasa"] || "No disponible"}</p>
<MisDatosContacto
  documento={documentoUsuario}
  telefono={habitanteEncontrado?.["Teléfono"] || habitanteEncontrado?.["Telefono"] || ""}
  email={habitanteEncontrado?.["Email"] || habitanteEncontrado?.["Correo"] || ""}
/>
        </div>

        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, color: "#0f172a" }}>Último movimiento</h3>
          {ultimoPago ? (
            <>
              <p><strong>ID pago:</strong> {ultimoPago.ID_Pago || ultimoPago.IDPago || "No disponible"}</p>
              <p><strong>Periodo:</strong> {ultimoPago.Periodo || "No disponible"}</p>
              <p><strong>Concepto:</strong> {ultimoPago.Subconcepto || ultimoPago.ConceptoPago || ultimoPago.Concepto || "No disponible"}</p>
              <p><strong>Valor:</strong> {formatearMoneda(montoAplicadoPago(ultimoPago))}</p>
              <p><strong>Fecha de pago:</strong> {formatearFechaVisual(ultimoPago.FechaPago || ultimoPago["Fecha de pago"]) || "No disponible"}</p>
            </>
          ) : (
            <p style={{ color: "#64748b" }}>
              Aún no hay pagos asociados a este residente.
            </p>
          )}
        </div>
        
      {/* ================= MODAL OBLIGATORIO DE MASCOTAS ================= */}
      {mostrarModalMascotas && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 9999
        }}>
          <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', maxWidth: '500px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, color: '#1a237e' }}>🐾 Declaración Obligatoria de Mascotas</h3>
            <p style={{ fontSize: '13px', color: '#555' }}>
              Por disposición de la administración, registra todas las mascotas que posees en tu inmueble.
            </p>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                ¿Tiene mascotas en el inmueble?
              </label>
              <select
                value={tieneMascotas}
                onChange={(e) => setTieneMascotas(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px' }}
              >
                <option value="No">No</option>
                <option value="Sí">Sí</option>
              </select>
            </div>

            {tieneMascotas === 'Sí' && (
              <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #ddd' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#333' }}>Agregar Mascota:</h4>
                
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '12px' }}>Tipo:</label>
                  <select
                    value={tempPet.tipo}
                    onChange={(e) => setTempPet({ ...tempPet, tipo: e.target.value })}
                    style={{ width: '100%', padding: '6px', borderRadius: '6px' }}
                  >
                    <option value="Perro">Perro</option>
                    <option value="Gato">Gato</option>
                    <option value="Ave">Ave</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '12px' }}>Nombre:</label>
                  <input
                    type="text"
                    value={tempPet.nombre}
                    onChange={(e) => setTempPet({ ...tempPet, nombre: e.target.value })}
                    placeholder="Ej. Firulais"
                    style={{ width: '100%', padding: '6px', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '12px' }}>Raza:</label>
                  <input
                    type="text"
                    value={tempPet.raza}
                    onChange={(e) => setTempPet({ ...tempPet, raza: e.target.value })}
                    placeholder="Ej. Criollo"
                    style={{ width: '100%', padding: '6px', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '12px' }}>¿Vacunas al día?</label>
                  <select
                    value={tempPet.vacunasAlDia}
                    onChange={(e) => setTempPet({ ...tempPet, vacunasAlDia: e.target.value })}
                    style={{ width: '100%', padding: '6px', borderRadius: '6px' }}
                  >
                    <option value="Sí">Sí</option>
                    <option value="No">No</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={agregarMascotaALista}
                  style={{ width: '100%', padding: '8px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  + Añadir esta mascota a la lista
                </button>

                {listaMascotasTemp.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 5px 0' }}>Mascotas agregadas ({listaMascotasTemp.length}):</p>
                    {listaMascotasTemp.map((m, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '6px 10px', marginBottom: '4px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '12px' }}>
                        <span><strong>{m.tipo}:</strong> {m.nombre} ({m.raza})</span>
                        <button type="button" onClick={() => quitarMascotaTemp(idx)} style={{ background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px' }}>X</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              disabled={enviandoMascota || (tieneMascotas === 'Sí' && listaMascotasTemp.length === 0)}
              onClick={guardarTodasLasMascotas}
              style={{
                width: '100%', padding: '10px', backgroundColor: (tieneMascotas === 'Sí' && listaMascotasTemp.length === 0) ? '#ccc' : '#2e7d32',
                color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
              }}
            >
              {enviandoMascota ? "Guardando..." : "Guardar y Continuar"}
            </button>
          </div>
        </div>
      )}
    </div> // <-- Este es el </div> final que cierra el componente PanelResidente
  );
}
 
    
export default PanelResidente;