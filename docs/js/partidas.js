// Lista de últimas partidas, con el mazo del rival en imágenes.
import { t, LANG } from "./i18n.js?v=4";
import { dia, hora } from "./stats.js?v=4";

let catalogo = null;
async function cargarCatalogo() {
  if (catalogo) return catalogo;
  try {
    const r = await fetch("cards.json");
    const cartas = await r.json();
    catalogo = new Map(cartas.map((c) => [c.nombre_en, c]));
  } catch (e) { catalogo = new Map(); }
  return catalogo;
}

const MODOS = {
  pathOfLegend: ["Ranked", "Ranked"], trail: ["Escalera", "Ladder"], tournament: ["Torneo", "Tournament"],
  riverRacePvP: ["Guerra", "War"], riverRaceDuel: ["Duelo de guerra", "War duel"], challenge: ["Desafío", "Challenge"],
  friendly: ["Amistosa", "Friendly"], casual: ["Casual", "Casual"],
};
const modo = (m) => (MODOS[m] ? t(...MODOS[m]) : m);

function cartaHTML(texto, cat) {
  const m = texto.match(/^(.*?)(?: \((Evo|Héroe)\))?$/);
  const base = m[1], forma = m[2];
  const c = cat.get(base);
  const nombre = c ? (LANG === "en" ? c.nombre_en : c.nombre) : base;
  const etiqueta = forma ? `${nombre} (${forma === "Evo" ? "Evo" : t("Héroe", "Hero")})` : nombre;
  const src = c && (forma === "Evo" ? c.icono_evo : forma === "Héroe" ? c.icono_heroe : null) || c?.icono;
  return src
    ? `<img src="${src}" alt="${etiqueta}" title="${etiqueta}" loading="lazy" width="40" height="48">`
    : `<span class="sin-imagen" title="${etiqueta}">${nombre.slice(0, 3)}</span>`;
}

export async function partidas(contenedor, boton, ps, cuantas = 10) {
  const cat = await cargarCatalogo();
  const recientes = [...ps].reverse();   // más reciente primero
  let mostrar = cuantas;
  function dibujar() {
    contenedor.innerHTML = recientes.slice(0, mostrar).map((p) => `
      <li class="partida ${p.victoria ? "gana" : "pierde"}">
        <div class="partida-cabecera">
          <span class="marcador">${p.coronas}</span>
          <span class="rival">${p.rival ?? ""}</span>
          <span class="cuando">${dia(p.t)} ${hora(p.t)} · ${modo(p.modo)}</span>
        </div>
        <div class="mazo">${(p.mazo_rival ?? []).map((c) => cartaHTML(c, cat)).join("")}</div>
        ${p.elixir_desperdiciado !== null ? `<div class="partida-pie">${t("Elixir perdido", "Elixir leaked")}: ${p.elixir_desperdiciado.toFixed(2)}</div>` : ""}
      </li>`).join("");
    boton.hidden = mostrar >= recientes.length;
  }
  boton.onclick = () => { mostrar += cuantas; dibujar(); };
  dibujar();
}
