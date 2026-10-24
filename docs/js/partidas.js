// Lista de partidas: cabecera, mazos y un desplegable con la comparación cara a cara.
import { t, LANG } from "./i18n.js?v=17";
import { dia, hora } from "./stats.js?v=17";
import { ICONOS } from "./iconos.js?v=17";

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
  friendly: ["amistosa", "Amistosa", "Friendly"], clanMate: ["amistosa", "Amistosa de clan", "Clan friendly"],
};
// nombres conocidos de eventos; los demás se muestran limpiando el nombre interno
const EVENTOS = { GlobalLightning: ["Tormenta perfecta", "Perfect Storm"] };
const esEvento = (p) => typeof p.evento === "string" && p.evento.startsWith("Event_");
function nombreEvento(ev) {
  const clave = ev.replace(/^Event_/, "").split("_")[0];
  if (EVENTOS[clave]) return t(...EVENTOS[clave]);
  return clave.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function modoHTML(p) {
  if (esEvento(p)) {
    const nombre = nombreEvento(p.evento);
    return `<span class="meta-item" title="${esc(t("Evento", "Event"))}: ${esc(nombre)}">${ICONOS.destello}<span class="meta-texto">${esc(corto(nombre, 18))}</span></span>`;
  }
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

// copas en escalera; en ranked, medallas en las ligas que las usan (y puesto mundial) o la liga en las de escalones
function copasHTML(d, p) {
  if (!d) return "";
  const cambio = d.cambio_copas, signo = cambio > 0 ? "+" : "";
  const chip = (texto, titulo, sube) => `<span class="copas ${sube ? "sube" : "baja"}" title="${titulo}">${texto}</span>`;
  if (esEvento(p) && d.copas_inicio !== null && cambio !== null)
    return chip(`${d.copas_inicio + cambio} ${signo}${cambio}`, t("Progreso en el evento", "Event progress"), cambio >= 0);
  if (p.modo === "trail" && d.copas_inicio !== null && cambio !== null)
    return chip(`${d.copas_inicio + cambio} ${signo}${cambio}`, t("Copas", "Trophies"), cambio >= 0);
  if (p.modo === "pathOfLegend") {
    if (d.copas_inicio !== null && cambio !== null) {
      const puesto = d.puesto_mundial ? chip(`#${d.puesto_mundial}`, t("Puesto mundial", "Global rank"), true) : "";
      return chip(`${d.copas_inicio + cambio} ${signo}${cambio}`, t(`Medallas · liga ${p.liga ?? ""}`, `Medals · league ${p.liga ?? ""}`), cambio >= 0) + puesto;
    }
    if (p.liga) return chip(`${t("Liga", "League")} ${p.liga}`, t("Liga", "League"), p.victoria);
  }
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

// enlace para copiar el mazo al juego (mismo formato que el ranking); null si falta alguna carta en el catálogo
function enlaceMazo(cartas, cat) {
  const ids = cartas.map((x) => {
    const nombre = typeof x === "string" ? x : x.carta;
    const m = String(nombre ?? "").match(/^(.*?)(?: \((Evo|Héroe)\))?$/);
    return cat.get(m[1])?.id ?? null;
  });
  if (!ids.length || ids.includes(null)) return null;
  return `https://link.clashroyale.com/es/?clashroyale://copyDeck?deck=${ids.join(";")}&l=Royale%20Mobile`;
}
function botonCopiar(cartas, cat) {
  const enlace = enlaceMazo(cartas, cat);
  if (!enlace) return `<p class="copiar-nota">${t("Mazo incompleto: no se puede copiar", "Incomplete deck: can’t copy it")}</p>`;
  return `<button type="button" class="copiar-mazo" data-enlace="${esc(enlace)}">${t("Copiar mazo", "Copy deck")}</button>`;
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
      <p class="detalle-quien lado-a">${esc(corto(nombres.jugador, 20))}</p>${mazoDetalle(x.j.cartas, cat)}${botonCopiar(x.j.cartas, cat)}
      ${x.r ? `<p class="detalle-quien lado-b">${esc(corto(p.rival, 20))}</p>${mazoDetalle(x.r.cartas, cat)}${botonCopiar(x.r.cartas, cat)}` : ""}`).join("")}
    ${hayUsadas ? `<p class="detalle-nota">${t("Atenuadas: cartas que no se llegaron a jugar. El número es su nivel.", "Faded: cards that weren’t played. The number is the card level.")}</p>` : ""}
    ${p.rival_tag ? `<button type="button" class="enlace ver-rival" data-tag="${esc(p.rival_tag)}">${t("Ver el perfil de", "See the profile of")} ${esc(p.rival)}</button>` : ""}
  </div>`;
}

// "¿Rival frecuente? 24 amistosas · 1 ranked": el modo cambia el significado
function frecuenteHTML(p) {
  const modos = Object.entries(p.veces_rival_modos ?? {}).sort((a, b) => b[1] - a[1]);
  const partes = modos.map(([m, n]) => {
    const info = MODOS[m]; const nombre = info ? t(info[1], info[2]) : m;
    return `${n} ${info?.[0] === "amistosa" ? t(n === 1 ? "amistosa" : "amistosas", n === 1 ? "friendly" : "friendlies") : nombre.toLowerCase()}`;
  });
  const texto = partes.length ? partes.join(" · ") : `×${p.veces_rival}`;
  return `<span class="meta-item frecuente" title="${t("Os habéis cruzado", "You’ve met")} ${p.veces_rival} ${t("veces", "times")}">${ICONOS.repetido}<span class="meta-texto">${t("¿Rival frecuente?", "Frequent opponent?")} ${esc(texto)}</span></span>`;
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
  const frecuente = p.veces_rival > 1 ? frecuenteHTML(p) : "";
  const elixir = p.elixir_desperdiciado !== null
    ? `<span class="meta-item" title="${t("Elixir perdido", "Elixir leaked")}">${ICONOS.gota}<span class="meta-texto">${p.elixir_desperdiciado.toFixed(1)}</span></span>` : "";
  return `<li class="partida ${p.victoria ? "gana" : "pierde"}">
    <button type="button" class="partida-abrir" aria-expanded="false" aria-controls="det${i}">
      <span class="partida-cabecera">
        <span class="resultado" title="${resultado}">${p.victoria ? ICONOS.coronaLlena : ICONOS.coronaVacia}</span>
        <span class="marcador" title="${p.es_duelo ? `${t("Rondas", "Rounds")} ${p.coronas} · ${t("coronas", "crowns")} ${p.coronas_total}` : ""}">${p.coronas}${p.es_duelo ? `<small>${t(" rondas", " rounds")}</small>` : ""}</span>
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
    contenedor.querySelectorAll(".copiar-mazo").forEach((b) => b.addEventListener("click", async () => {
      const texto = t("Copiar mazo", "Copy deck");
      try {
        await navigator.clipboard.writeText(b.dataset.enlace);
        b.textContent = t("¡Copiado!", "Copied!");
      } catch (e) { b.textContent = t("No se pudo copiar", "Couldn’t copy"); }
      setTimeout(() => (b.textContent = texto), 1500);
    }));
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
