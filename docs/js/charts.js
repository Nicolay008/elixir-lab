// Gráficas de Racha, Elixir y Coronas (Chart.js, cargado como script global).
import { dia, hora } from "./stats.js?v=51";
import { t } from "./i18n.js?v=51";

const MOSTRAR = 25; // partidas por página

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const colores = () => ({
  dato: css("--dato"), ref: css("--ref"), fondo: css("--superficie"), texto: css("--texto-suave"),
  rejilla: css("--rejilla"), sep: css("--separador"),
  tilt: css("--franja-tilt"), tiltTinta: css("--tinta-tilt"),
  buena: css("--franja-buena"), buenaTinta: css("--tinta-buena"),
  mala: css("--franja-mala"), malaTinta: css("--tinta-mala"),
});

// paginación: 0 = más recientes, 1 = anteriores, etc.
let _pag = 0;
export function setPagina(p) { _pag = p; }
export function getPagina() { return _pag; }
export function totalPaginas(m) { return Math.max(1, Math.ceil(m.ps.length / MOSTRAR)); }

function ventana(m) {
  const total = m.ps.length, pags = totalPaginas(m);
  const pag = Math.min(_pag, pags - 1);
  const fin = total - pag * MOSTRAR;
  const ini = Math.max(0, fin - MOSTRAR);
  const ps = m.ps.slice(ini, fin);
  const franjas = m.franjas
    .filter((f) => f.hasta >= ini && f.desde < fin)
    .map((f) => ({ ...f, desde: Math.max(0, f.desde - ini), hasta: Math.min(f.hasta - ini, ps.length - 1) }));
  const etiquetas = ps.map((p, i) => (i === 0 || dia(p.t) !== dia(ps[i - 1].t) ? dia(p.t) : ""));
  return { ini, ps, franjas, etiquetas };
}

// separadores de día y franjas de racha, dibujados detrás de los datos
function decoracion(v, c) {
  return {
    id: "decoracion",
    beforeDatasetsDraw(ch) {
      const { ctx, chartArea: a, scales: { x } } = ch;
      const w = v.ps.length > 1 ? x.getPixelForValue(1) - x.getPixelForValue(0) : 20;
      ctx.save();
      ctx.strokeStyle = c.sep; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
      v.ps.forEach((p, i) => {
        if (i > 0 && dia(p.t) !== dia(v.ps[i - 1].t)) {
          const px = x.getPixelForValue(i) - w / 2;
          ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
        }
      });
      ctx.setLineDash([]);
      for (const f of v.franjas) {
        const x0 = x.getPixelForValue(f.desde) - w / 2, x1 = x.getPixelForValue(f.hasta) + w / 2;
        ctx.fillStyle = c[f.tipo === "tilt" ? "tilt" : f.tipo]; ctx.fillRect(x0, a.top, x1 - x0, a.bottom - a.top);
      }
      ctx.restore();
    },
  };
}

function base(c, ymin, ymax, fmt) {
  return {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { type: "category", ticks: { color: c.texto, font: { size: 11 }, autoSkip: false, maxRotation: 0 }, grid: { display: false } },
      y: { min: ymin, max: ymax, ticks: { color: c.texto, font: { size: 11 }, callback: fmt }, grid: { color: c.rejilla } },
    },
  };
}

// franjas visibles con su texto, para mostrarlas como chips bajo la gráfica
export function franjasVisibles(m) {
  const v = ventana(m), nombre = { tilt: t("Posible tilt", "Possible tilt"), buena: t("Buena racha", "Good streak"), mala: t("Mala racha", "Bad streak") };
  return v.franjas.slice(-6).map((f) => {
    const a = v.ps[f.desde], b = v.ps[f.hasta], n = f.hasta - f.desde + 1;
    const cuando = dia(a.t) === dia(b.t) ? `${dia(a.t)}, ${hora(a.t)} ${t("a","to")} ${hora(b.t)}` : `${dia(a.t)} ${t("a","to")} ${dia(b.t)}`;
    return { tipo: f.tipo, texto: `${nombre[f.tipo]} · ${cuando} · ${n} ${f.tipo === "buena" ? t("victorias seguidas", "wins in a row") : t("derrotas seguidas", "losses in a row")}` };
  });
}

// vista: "racha" o "elixir"
export function tendencia(canvas, m, vista, previo) {
  previo?.destroy();
  const c = colores(), v = ventana(m), R = vista === "racha";
  const linea = (R ? m.winrate : m.elixir).slice(v.ini);
  const puntos = v.ps.map((p) => (R ? linea[v.ps.indexOf(p)] : p.desconexion ? null : p.elixir_desperdiciado));
  const ref = R ? 50 : m.limite;
  const opt = base(c, 0, R ? 112 : Math.max(8.5, ...puntos.filter((x) => x !== null)) + 0.5,
    (val) => (R ? (val <= 100 && val % 25 === 0 ? `${val} %` : "") : val % 2 === 0 ? val : ""));
  opt.plugins.tooltip = {
    filter: (tt) => tt.datasetIndex === 1,
    callbacks: {
      title: (tt) => { const p = v.ps[tt[0].dataIndex]; return `${dia(p.t)} ${hora(p.t)}`; },
      label: (tt) => {
        const p = v.ps[tt.dataIndex];
        const base = `${p.victoria ? t("Victoria", "Win") : t("Derrota", "Loss")} ${p.coronas}`;
        if (p.desconexion) return `${base} · ${t("posible desconexión", "possible disconnection")}`;
        return R ? `${base} · ${t("tendencia", "trend")} ${Math.round(linea[tt.dataIndex])} %` : `${base} · ${p.elixir_desperdiciado?.toFixed(2) ?? "–"} ${t("de elixir perdido", "elixir leaked")}`;
      },
    },
  };
  return new Chart(canvas, {
    data: {
      labels: v.etiquetas,
      datasets: [
        { type: "line", data: linea, borderColor: c.dato, borderWidth: 2, pointRadius: 0, tension: 0.3, spanGaps: true },
        {
          type: "scatter", data: puntos.map((y, i) => ({ x: i, y })),
          pointBorderColor: c.dato, pointBorderWidth: 2,
          pointBackgroundColor: v.ps.map((p) => (p.victoria ? c.dato : c.fondo)),
          pointRadius: R ? 5 : v.ps.map((p) => (m.limite !== null && p.elixir_desperdiciado > m.limite ? 7 : 4)),
        },
        ...(ref !== null ? [{ type: "line", data: v.ps.map(() => ref), borderColor: c.ref, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0 }] : []),
      ],
    },
    options: opt,
    plugins: [decoracion(v, c)],
  });
}

export function coronas(canvas, m, previo) {
  previo?.destroy();
  const c = colores(), v = ventana(m);
  const opt = base(c, -3.4, 3.4, (val) => (Number.isInteger(val) ? (val > 0 ? `+${val}` : val) : ""));
  opt.plugins.tooltip = {
    filter: (tt) => tt.datasetIndex === 0,
    callbacks: {
      title: (tt) => { const p = v.ps[tt[0].dataIndex]; return `${dia(p.t)} ${hora(p.t)}`; },
      label: (tt) => v.ps[tt.dataIndex].coronas,
    },
  };
  return new Chart(canvas, {
    data: {
      labels: v.etiquetas,
      datasets: [
        {
          type: "line", data: v.ps.map((p) => p.dif), borderColor: c.dato, borderWidth: 2, tension: 0.25,
          pointRadius: 5, pointBorderWidth: 2, pointBorderColor: c.dato,
          pointBackgroundColor: v.ps.map((p) => (p.victoria ? c.dato : c.fondo)),
        },
        { type: "line", data: v.ps.map(() => 0), borderColor: c.ref, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0 },
      ],
    },
    options: opt,
    plugins: [decoracion({ ...v, franjas: [] }, c)],
  });
}
