import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

const myColors = [
  "#15aabf", // Azul moderno (usado en el ponqué y para la tabla)
  "#f48c06"  // Naranja
];

const GraficosMorosidad = ({ pagos }) => {
  const pagosPorEstado = pagos.reduce((acc, pago) => {
    acc[pago.Estado] = (acc[pago.Estado] || 0) + 1;
    return acc;
  }, {});

  const total = Object.values(pagosPorEstado).reduce((s, n) => s + n, 0);

  const dataPie = {
    labels: Object.keys(pagosPorEstado),
    datasets: [
      {
        data: Object.values(pagosPorEstado),
        backgroundColor: myColors,
        borderWidth: 2,
        borderColor: "#15aabf22"
      }
    ]
  };

  const options = {
    plugins: {
      legend: { display: true, position: "bottom" },
      datalabels: {
        color: "#fff",
        font: { weight: 'bold', size: 22 },
        formatter: (value, ctx) => {
          const percentage = total > 0 ? (value * 100 / total).toFixed(1) : 0;
          return percentage + "%";
        }
      }
    },
    layout: { padding: 8 },
    maintainAspectRatio: false,
    responsive: false
  };

  return (
    <div style={{
      background: "transparent", // fondo transparente
      borderRadius: "0px",
      boxShadow: "none",
      padding: "0",
      width: "370px",
      height: "320px",
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <Pie
        data={dataPie}
        options={options}
        width={320}
        height={260}
        plugins={[ChartDataLabels]}
      />
    </div>
  );
};

export default GraficosMorosidad;



