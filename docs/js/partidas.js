// Lista de últimas partidas: tu mazo y el del rival, con su coste medio.
import { t, LANG } from "./i18n.js?v=5";
import { dia, hora } from "./stats.js?v=5";
import { ICONOS } from "./iconos.js?v=5";

let catalogo = null;
async function cargarCatalogo() {
  if (catalogo) return catalogo;
  catalogo = new Map();
  for (const archivo of ["cards.json", "cards_extra.json"]) {
    try { for (const c of await (await fetch(archivo)).json()) catalogo.set(c.nombre_en, c); } catch (e) { /* el extra puede no existir */ }
  }
  return catalogo;
}

// [icono, nombre ES, nombre EN]
const MODOS = {
  pathOfLegend: ["espadas", "Ranked", "Ranked"],
  trail: ["trofeo", "Escalera", "Ladder"], ladder: ["trofeo", "Escalera", "Ladder"],
  riverRacePvP: ["escudos", "Guerra de clanes", "Clan war"], riverRaceDuel: ["escudos", "Duelo de guerra", "War duel"],
  riverRaceDuelColosseum: ["escudos", "Duelo de guerra", "War duel"], boatBattle: ["escudos", "Batalla de barcos", "Boat battle"],
  tournament: ["laurel", "Torneo", "Tournament"], challenge: ["laurel", "Desafío", "Challenge"],
  grandChallenge: ["laurel", "Gran desafío", "Grand challenge"], classicChallenge: ["laurel", "Desafío clásico", "Classic challenge"],
};
function modo(p) {
  const m = MODOS[p.modo];
  let icono = m ? m[0] : "destello", nombre = m ? t(m[1], m[2]) : (p.evento || p.modo), numero = "";
  // en un desafío, el número es la victoria que llevabas tras esta partida (como la corona de laureles del juego)
  if (p.desafio_victorias_antes !== null && p.desafio_victorias_antes !== undefined) {
    icono = "laurel";
    const n = p.desafio_victorias_antes + (p.victoria ? 1 : 0);
    numero = `<span class="laurel-num">${n}</span>`;
    nombre = `${p.desafio || nombre} · ${t(`${n} ${n === 1 ? "victoria" : "victorias"}`, `${n} ${n === 1 ? "win" : "wins"}`)}`;
  }
  return `<span class="modo" title="${nombre}" aria-label="${nombre}">${ICONOS[icono]}${numero}</span>`;
}

function datosCarta(texto, cat) {
  const m = texto.match(/^(.*?)(?: \((Evo|Héroe)\))?$/);
  const c = cat.get(m[1]);
  const nombre = c ? (LANG === "en" ? c.nombre_en : c.nombre) : m[1];
  const etiqueta = m[2] ? `${nombre} (${m[2] === "Evo" ? "Evo" : t("Héroe", "Hero")})` : nombre;
  const src = (c && (m[2] === "Evo" ? c.icono_evo : m[2] === "Héroe" ? c.icono_heroe : null)) || c?.icono;
  return { etiqueta, src, coste: c?.coste ?? null };
}

function mazoHTML(cartas, cat, quien) {
  const ds = cartas.map((x) => datosCarta(x, cat));
  const costes = ds.map((d) => d.coste).filter((x) => x !== null);
  const medio = costes.length ? (costes.reduce((a, b) => a + b, 0) / costes.length).toFixed(1) : "–";
  const imgs = ds.map((d) => d.src
    ? `<img src="${d.src}" alt="${d.etiqueta}" title="${d.etiqueta}" loading="lazy" width="40" height="48">`
    : `<span class="sin-imagen" title="${d.etiqueta}">${d.etiqueta.slice(0, 3)}</span>`).join("");
  return `<div class="fila-mazo ${quien}">
    <span class="quien">${quien === "yo" ? t("Tú", "You") : t("Rival", "Opp.")}</span>
    <div class="mazo">${imgs}</div>
    <span class="coste" title="${t("Coste medio", "Average cost")}" aria-label="${t("Coste medio", "Average cost")} ${medio}">${ICONOS.ciclo}${medio}</span>
  </div>`;
}

// de 8 en 8: en los duelos de guerra llegan 2 o 3 mazos juntos
const rondas = (xs) => { const r = []; for (let i = 0; i < xs.length; i += 8) r.push(xs.slice(i, i + 8)); return r.length ? r : [[]]; };

function partidaHTML(p, cat) {
  const mias = rondas(p.mi_mazo ?? []), suyas = rondas(p.mazo_rival ?? []);
  const n = Math.max(mias.length, suyas.length);
  const cuerpo = Array.from({ length: n }, (_, i) =>
    (n > 1 ? `<p class="ronda">${t("Ronda", "Round")} ${i + 1}</p>` : "") +
    (mias[i]?.length ? mazoHTML(mias[i], cat, "yo") : "") +
    (suyas[i]?.length ? mazoHTML(suyas[i], cat, "rival") : "")).join("");
  const resultado = p.victoria ? t("Victoria", "Win") : t("Derrota", "Loss");
  const elixir = p.elixir_desperdiciado !== null
    ? `<span class="perdido" title="${t("Elixir perdido", "Elixir leaked")}" aria-label="${t("Elixir perdido", "Elixir leaked")} ${p.elixir_desperdiciado.toFixed(1)}">${ICONOS.gota}${p.elixir_desperdiciado.toFixed(1)}</span>`
    : "";
  return `<li class="partida ${p.victoria ? "gana" : "pierde"}">
    <div class="partida-cabecera">
      <span class="resultado" title="${resultado}" aria-label="${resultado}">${p.victoria ? ICONOS.coronaLlena : ICONOS.coronaVacia}</span>
      <span class="marcador">${p.coronas}</span>
      <span class="rival">${p.rival ?? ""}</span>
      ${modo(p)}
      <span class="cuando">${dia(p.t)} ${hora(p.t)}</span>
    </div>
    ${cuerpo}
    ${elixir ? `<div class="partida-pie">${elixir}</div>` : ""}
  </li>`;
}

export async function partidas(contenedor, boton, ps, cuantas = 10) {
  const cat = await cargarCatalogo();
  const recientes = [...ps].reverse();
  let mostrar = cuantas;
  const dibujar = () => {
    contenedor.innerHTML = recientes.slice(0, mostrar).map((p) => partidaHTML(p, cat)).join("");
    boton.hidden = mostrar >= recientes.length;
  };
  boton.onclick = () => { mostrar += cuantas; dibujar(); };
  dibujar();
}
