// Lista de partidas: cabecera, mazos y un desplegable con la comparación cara a cara.
import { t, LANG } from "./i18n.js?v=6";
import { dia, hora } from "./stats.js?v=6";
import { ICONOS } from "./iconos.js?v=6";

let catalogo = null;
async function cargarCatalogo() {
  if (catalogo) return catalogo;
  catalogo = new Map();
  for (const archivo of ["cards.json", "cards_extra.json"]) {
    try { for (const c of await (await fetch(archivo)).json()) catalogo.set(c.nombre_en, c); } catch (e) { /* el extra puede no existir */ }
  }
  return catalogo;
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const corto = (s, n = 12) => { const a = [...String(s ?? "")]; return a.length > n ? a.slice(0, n - 1).join("") + "…" : a.join(""); };

// [icono, nombre ES, nombre EN]
const MODOS = {
  pathOfLegend: ["espadas", "Ranked", "Ranked"],
  trail: ["trofeo", "Escalera", "Ladder"], ladder: ["trofeo", "Escalera", "Ladder"],
  riverRacePvP: ["escudos", "Guerra", "War"], riverRaceDuel: ["escudos", "Duelo de guerra", "War duel"],
  riverRaceDuelColosseum: ["escudos", "Duelo de guerra", "War duel"], boatBattle: ["escudos", "Barcos", "Boat battle"],
  tournament: ["laurel", "Torneo", "Tournament"], challenge: ["laurel", "Desafío", "Challenge"],
  grandChallenge: ["laurel", "Gran desafío", "Grand challenge"], classicChallenge: ["laurel", "Desafío clásico", "Classic challenge"],
};
function modoHTML(p) {
  const m = MODOS[p.modo];
  let icono = m ? m[0] : "destello", nombre = m ? t(m[1], m[2]) : (p.evento || p.modo), numero = "";
  if (p.desafio_victorias_antes !== null && p.desafio_victorias_antes !== undefined) {
    icono = "laurel";
    const n = p.desafio_victorias_antes + (p.victoria ? 1 : 0);
    numero = ` ${n}`;
    nombre = p.desafio || nombre;
  }
  return `<span class="meta-item" title="${esc(nombre)}">${ICONOS[icono]}<span class="meta-texto">${esc(corto(nombre, 16))}${numero}</span></span>`;
}

// copas en escalera; liga (y cambio de medallas en la liga más alta) en ranked
function copasHTML(d, p) {
  if (!d) return "";
  const cambio = d.cambio_copas;
  const signo = cambio > 0 ? "+" : "";
  if (p.modo === "trail" && d.copas_inicio !== null && cambio !== null)
    return `<span class="copas ${cambio >= 0 ? "sube" : "baja"}" title="${t("Copas", "Trophies")}">${d.copas_inicio + cambio} ${signo}${cambio}</span>`;
  if (p.modo === "pathOfLegend" && p.liga)
    return `<span class="copas ${p.victoria ? "sube" : "baja"}" title="${t("Liga", "League")}">${t("Liga", "League")} ${p.liga}</span>`;
  return "";
}

function datosCarta(texto, cat) {
  const m = texto.match(/^(.*?)(?: \((Evo|Héroe)\))?$/);
  const c = cat.get(m[1]);
  const nombre = c ? (LANG === "en" ? c.nombre_en : c.nombre) : m[1];
  const etiqueta = m[2] ? `${nombre} (${m[2] === "Evo" ? "Evo" : t("Héroe", "Hero")})` : nombre;
  const src = (c && (m[2] === "Evo" ? c.icono_evo : m[2] === "Héroe" ? c.icono_heroe : null)) || c?.icono;
  return { etiqueta, src, coste: c?.coste ?? null };
}
const media = (xs) => { const v = xs.filter((x) => x !== null && x !== undefined); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const costeMedio = (cartas, cat) => media(cartas.map((x) => datosCarta(x, cat).coste));

function imgCarta(d, extra = "") {
  return d.src
    ? `<img src="${d.src}" alt="${esc(d.etiqueta)}" title="${esc(d.etiqueta)}" loading="lazy" width="40" height="48"${extra}>`
    : `<span class="sin-imagen" title="${esc(d.etiqueta)}">${esc(d.etiqueta.slice(0, 3))}</span>`;
}

// fila de un mazo en la lista: imágenes y coste medio
function filaMazo(cartas, cat, etiqueta, clase) {
  const medio = costeMedio(cartas, cat);
  return `<div class="fila-mazo ${clase}">
    <span class="quien" title="${esc(etiqueta)}">${esc(corto(etiqueta, 7))}</span>
    <div class="mazo">${cartas.map((x) => imgCarta(datosCarta(x, cat))).join("")}</div>
    <span class="coste" title="${t("Coste medio", "Average cost")}">${ICONOS.ciclo}${medio !== null ? medio.toFixed(1) : "–"}</span>
  </div>`;
}

// mazo del desplegable: con nivel bajo cada carta y las no usadas atenuadas
function mazoDetalle(cartasP, cat) {
  return `<div class="mazo detalle-mazo">${cartasP.map((c) => {
    const d = datosCarta(c.carta, cat), sinUsar = c.usada === false;
    return `<figure class="${sinUsar ? "sin-usar" : ""}">${imgCarta(d)}<figcaption>${c.nivel ?? "–"}</figcaption></figure>`;
  }).join("")}</div>`;
}

// barra enfrentada: jugador a la izquierda (violeta), rival a la derecha (gris)
function barra(nombre, a, b, fmt = (x) => x) {
  if (a === null && b === null) return "";
  const max = Math.max(a ?? 0, b ?? 0) || 1;
  return `<div class="cmp">
    <span class="cmp-val">${a === null ? "–" : fmt(a)}</span>
    <div class="cmp-barras"><span class="cmp-a" style="width:${((a ?? 0) / max) * 100}%"></span></div>
    <span class="cmp-nombre">${nombre}</span>
    <div class="cmp-barras"><span class="cmp-b" style="width:${((b ?? 0) / max) * 100}%"></span></div>
    <span class="cmp-val">${b === null ? "–" : fmt(b)}</span>
  </div>`;
}
const torresEnPie = (l) => (l.torre_rey ? 1 : 0) + (l.torres_princesa?.length ?? 0);

function detalleHTML(p, cat, nombres) {
  const d = p.detalle;
  if (!d) return "";
  const J = d.jugador, R = d.rival;
  const nivelJ = media(J.cartas.map((c) => c.nivel)), nivelR = media(R.cartas.map((c) => c.nivel));
  const sinUsarJ = J.cartas.filter((c) => c.usada === false).length, sinUsarR = R.cartas.filter((c) => c.usada === false).length;
  const hayUsadas = J.cartas.some((c) => c.usada !== null);
  const rondas = J.rondas?.length ? J.rondas.map((r, i) => ({ j: r, r: R.rondas?.[i] })) : [{ j: J, r: R }];

  return `<div class="detalle-partida">
    <div class="cmp-cabecera"><span class="lado-a">${esc(corto(nombres.jugador, 14))}</span><span class="lado-b">${esc(corto(p.rival, 14))}</span></div>
    ${barra(t("Nivel medio", "Avg. level"), nivelJ, nivelR, (x) => x.toFixed(1))}
    ${barra(t("Coste medio", "Avg. cost"), costeMedio(p.mi_mazo.slice(0, 8), cat), costeMedio(p.mazo_rival.slice(0, 8), cat), (x) => x.toFixed(1))}
    ${barra(t("Elixir perdido", "Elixir leaked"), J.elixir_perdido, R.elixir_perdido, (x) => x.toFixed(1))}
    ${J.torre_rey !== null || R.torre_rey !== null ? barra(t("Torres en pie", "Towers left"), torresEnPie(J), torresEnPie(R)) : ""}
    ${hayUsadas ? barra(t("Cartas sin usar", "Cards not played"), sinUsarJ, sinUsarR) : ""}
    ${rondas.map((x, i) => `
      ${rondas.length > 1 ? `<p class="ronda">${t("Ronda", "Round")} ${i + 1} · ${x.j.coronas}-${x.r?.coronas ?? "–"}</p>` : ""}
      <p class="detalle-quien lado-a">${esc(corto(nombres.jugador, 20))}</p>${mazoDetalle(x.j.cartas, cat)}
      ${x.r ? `<p class="detalle-quien lado-b">${esc(corto(p.rival, 20))}</p>${mazoDetalle(x.r.cartas, cat)}` : ""}`).join("")}
    ${hayUsadas ? `<p class="detalle-nota">${t("Atenuadas: cartas que no se llegaron a jugar. El número es su nivel.", "Faded: cards that weren’t played. The number is the card level.")}</p>` : ""}
    ${p.rival_tag ? `<button type="button" class="enlace ver-rival" data-tag="${esc(p.rival_tag)}">${t("Ver el perfil de", "See the profile of")} ${esc(p.rival)}</button>` : ""}
  </div>`;
}

function partidaHTML(p, cat, nombres, i) {
  const r8 = (xs) => { const r = []; for (let k = 0; k < xs.length; k += 8) r.push(xs.slice(k, k + 8)); return r.length ? r : [[]]; };
  const mias = r8(p.mi_mazo ?? []), suyas = r8(p.mazo_rival ?? []);
  const n = Math.max(mias.length, suyas.length);
  const mazos = Array.from({ length: n }, (_, k) =>
    (n > 1 ? `<p class="ronda">${t("Ronda", "Round")} ${k + 1}</p>` : "") +
    (mias[k]?.length ? filaMazo(mias[k], cat, nombres.yo, "yo") : "") +
    (suyas[k]?.length ? filaMazo(suyas[k], cat, p.rival ?? t("Rival", "Opp."), "rival") : "")).join("");
  const resultado = p.victoria ? t("Victoria", "Win") : t("Derrota", "Loss");
  const frecuente = p.veces_rival > 1
    ? `<span class="meta-item frecuente" title="${t("Os habéis cruzado", "You’ve met")} ${p.veces_rival} ${t("veces", "times")}">${ICONOS.repetido}<span class="meta-texto">${t("¿Rival frecuente?", "Frequent opponent?")} ×${p.veces_rival}</span></span>` : "";
  const elixir = p.elixir_desperdiciado !== null
    ? `<span class="meta-item" title="${t("Elixir perdido", "Elixir leaked")}">${ICONOS.gota}<span class="meta-texto">${p.elixir_desperdiciado.toFixed(1)}</span></span>` : "";
  return `<li class="partida ${p.victoria ? "gana" : "pierde"}">
    <button type="button" class="partida-abrir" aria-expanded="false" aria-controls="det${i}">
      <span class="partida-cabecera">
        <span class="resultado" title="${resultado}">${p.victoria ? ICONOS.coronaLlena : ICONOS.coronaVacia}</span>
        <span class="marcador">${p.coronas}</span>
        <span class="rival">${esc(p.rival ?? "")}</span>
        <span class="cuando">${dia(p.t)} ${hora(p.t)}</span>
        <span class="flecha">${ICONOS.flecha}</span>
      </span>
      <span class="partida-meta">${modoHTML(p)}${copasHTML(p.detalle?.jugador, p)}${elixir}${frecuente}</span>
    </button>
    ${mazos}
    <div id="det${i}" class="partida-detalle" hidden>${detalleHTML(p, cat, nombres)}</div>
  </li>`;
}

// nombres: { yo: "Tú" o el nombre del jugador, jugador: su nombre }; alVerRival(tag): abrir otro perfil
export async function partidas(contenedor, boton, ps, nombres, alVerRival, cuantas = 10) {
  const cat = await cargarCatalogo();
  const recientes = [...ps].reverse();
  let mostrar = cuantas;
  const dibujar = () => {
    contenedor.innerHTML = recientes.slice(0, mostrar).map((p, i) => partidaHTML(p, cat, nombres, i)).join("");
    boton.hidden = mostrar >= recientes.length;
    contenedor.querySelectorAll(".partida-abrir").forEach((b) => b.addEventListener("click", () => {
      const abierto = b.getAttribute("aria-expanded") === "true";
      b.setAttribute("aria-expanded", !abierto);
      document.getElementById(b.getAttribute("aria-controls")).hidden = abierto;
      b.closest(".partida").classList.toggle("abierta", !abierto);
    }));
    contenedor.querySelectorAll(".ver-rival").forEach((b) => b.addEventListener("click", () => alVerRival(b.dataset.tag)));
  };
  boton.onclick = () => { mostrar += cuantas; dibujar(); };
  dibujar();
}
