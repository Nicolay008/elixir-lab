import { t } from "./i18n.js?v=13";
// Cronómetro AM / PM: cada sector es una hora; largo = partidas, color = winrate.
const NS = "http://www.w3.org/2000/svg";
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const fmt = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "am" : "pm"}`;

function colorWinrate(wr) {
  const medio = hex(css("--neutro")), malo = hex(css("--ref")), bueno = hex(css("--dato"));
  const k = Math.min(1, Math.abs(wr - 50) / 40), fin = wr >= 50 ? bueno : malo;
  return `rgb(${medio.map((m, i) => Math.round(m + (fin[i] - m) * k)).join(",")})`;
}

export function reloj({ svg, botonAM, botonPM, detalle }, horas) {
  const { porHora, mejor } = horas;
  const cx = 160, cy = 185, r0 = 34, rmax = 102, R = 128;
  const maxN = Math.max(1, ...Object.values(porHora).map((x) => x.n));
  const pt = (a, r) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const sector = (i, r) => {
    const a0 = (i * Math.PI) / 6 - Math.PI / 12 + 0.03, a1 = a0 + Math.PI / 6 - 0.06;
    const [x0, y0] = pt(a0, r0), [x1, y1] = pt(a0, r), [x2, y2] = pt(a1, r), [x3, y3] = pt(a1, r0);
    return `M${x0},${y0}L${x1},${y1}A${r},${r} 0 0 1 ${x2},${y2}L${x3},${y3}A${r0},${r0} 0 0 0 ${x0},${y0}Z`;
  };
  const el = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; };

  // brillo en la mitad del día donde está tu mejor hora
  botonAM.classList.toggle("brillo", mejor !== null && mejor < 12);
  botonPM.classList.toggle("brillo", mejor !== null && mejor >= 12);

  let pm = mejor === null ? true : mejor >= 12, sectores = {}, aguja, c1, c2;

  function elegir(h) {
    const x = porHora[h]; if (!x) return;
    for (const k in sectores) sectores[k].setAttribute("opacity", +k === h ? 1 : 0.5);
    const [hx, hy] = pt(((h % 12) * Math.PI) / 6, rmax - 6);
    aguja.setAttribute("x2", hx); aguja.setAttribute("y2", hy);
    c1.textContent = `${x.wr} %`; c2.textContent = fmt(h);
    const nota = x.n < 5 ? ` · ${t("pocos datos", "little data")}` : h === mejor ? ` · ${t("tu mejor hora", "your best hour")}` : "";
    detalle.innerHTML = `<strong>${t("De", "From")} ${fmt(h)} ${t("a", "to")} ${fmt(h + 1)}</strong><span class="nota">${nota}</span><br>` +
      t(`${x.v} victorias de ${x.n} partidas (${x.wr} %)`, `${x.v} wins out of ${x.n} matches (${x.wr} %)`) + (x.elixir !== null ? ` · ${t("elixir perdido medio", "average elixir leaked")} ${x.elixir.toFixed(1)}` : "");
  }

  function dibujar() {
    svg.innerHTML = ""; sectores = {};
    botonAM.setAttribute("aria-pressed", !pm); botonPM.setAttribute("aria-pressed", pm);
    const bisel = css("--bisel"), cara = css("--superficie"), tinta = css("--texto"), marca = css("--texto-suave");
    el("rect", { x: cx - 12, y: cy - R - 30, width: 24, height: 14, rx: 3, fill: bisel });
    el("rect", { x: cx - 6, y: cy - R - 18, width: 12, height: 10, fill: bisel });
    const [bx, by] = pt(Math.PI / 4, R + 6);
    el("rect", { x: bx - 7, y: by - 7, width: 14, height: 10, rx: 2, fill: bisel, transform: `rotate(45 ${bx} ${by})` });
    el("circle", { cx, cy, r: R + 4, fill: cara, stroke: bisel, "stroke-width": 7 });
    for (let k = 0; k < 60; k++) {
      const a = (k * Math.PI) / 30, mayor = k % 5 === 0;
      const [x1, y1] = pt(a, R - 2), [x2, y2] = pt(a, R - (mayor ? 12 : 6));
      el("line", { x1, y1, x2, y2, stroke: marca, "stroke-width": mayor ? 2 : 1, "stroke-linecap": "round" });
    }
    for (let i = 0; i < 12; i++) {
      const h = (pm ? 12 : 0) + i, x = porHora[h];
      if (!x) el("path", { d: sector(i, r0 + 8), fill: css("--vacio") });
      else {
        const r = r0 + (rmax - r0) * Math.sqrt(x.n / maxN), pocos = x.n < 5;
        const p = el("path", {
          d: sector(i, r), fill: pocos ? css("--vacio") : colorWinrate(x.wr),
          stroke: pocos ? marca : "none", "stroke-dasharray": pocos ? "3 3" : "", class: "sector",
        });
        p.addEventListener("click", () => elegir(h));
        sectores[h] = p;
      }
      const [lx, ly] = pt((i * Math.PI) / 6, R - 22);
      const num = el("text", { x: lx, y: ly + 4, "text-anchor": "middle", "font-size": 11, "font-weight": 600, fill: tinta });
      num.textContent = i === 0 ? 12 : i;
    }
    aguja = el("line", { x1: cx, y1: cy, x2: cx, y2: cy - rmax, stroke: tinta, "stroke-width": 2.5, "stroke-linecap": "round" });
    el("circle", { cx, cy, r: r0 - 6, fill: cara, stroke: bisel, "stroke-width": 1 });
    c1 = el("text", { x: cx, y: cy + 2, "text-anchor": "middle", "font-size": 15, "font-weight": 700, fill: tinta });
    c2 = el("text", { x: cx, y: cy + 15, "text-anchor": "middle", "font-size": 9, fill: marca });
    const mitad = Object.keys(porHora).map(Number).filter((h) => (h >= 12) === pm);
    const inicial = mejor !== null && (mejor >= 12) === pm ? mejor : mitad.sort((a, b) => porHora[b].n - porHora[a].n)[0];
    if (inicial !== undefined) elegir(inicial);
    else { c1.textContent = "–"; c2.textContent = pm ? "pm" : "am"; detalle.textContent = t(`No jugaste en estas horas (${pm ? "pm" : "am"}).`, `No matches in these hours (${pm ? "pm" : "am"}).`); }
  }

  botonAM.onclick = () => { pm = false; dibujar(); };
  botonPM.onclick = () => { pm = true; dibujar(); };
  dibujar();
}
