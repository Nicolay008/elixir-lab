// Sección Meta (solo perfil propio). La API manda la liga; dentro de la liga el escalón se cuenta
// con tus partidas ranked desde una referencia guardada en este navegador, y se puede corregir a mano.
import { t, LANG } from "./i18n.js?v=60";
import { preparar, filtrarModo } from "./stats.js?v=60";

const LIGA_META = 7;                                        // desde aquí se sube por medallas
const ESCALONES = { 1: 11, 2: 11, 3: 11, 4: 10, 5: 10, 6: 10, 7: 0 };
const MIN_LISTA = 10;                                       // partidas mínimas para mostrar un mazo
const MIN_RECOMENDAR = 15;                                  // por debajo, nota de "pocos datos"
const MIN_CORTE = 10;                                       // partidas mínimas para fiarse de un corte de sesión
const CORTES = [3, 6, 10];
const REF_MAZO = "RG Fantasma";                             // mazo de referencia para comparar (nombre tal como aparece en partidas)                                  // "sesiones de N": partidas 1..N de cada sesión
const LAPIZ = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 20l4-1L19 8l-3-3L5 16z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

let abierto = false;   // el acordeón conserva su estado al repintar

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pct = (x) => (x === null ? "–" : `${Math.round(x * 100)} %`);
const fmtN = (n) => Number(n).toLocaleString(LANG === "en" ? "en-US" : "es-PE");
const claveTag = (tag) => tag.replace(/^#/, "").toUpperCase();
const CLAVE_REF = (tag) => `elixirLabMeta:${claveTag(tag)}`;

function leerRef(tag) { try { return JSON.parse(localStorage.getItem(CLAVE_REF(tag))) || null; } catch (e) { return null; } }
function guardarRef(tag, ref) { try { localStorage.setItem(CLAVE_REF(tag), JSON.stringify(ref)); } catch (e) {} }

const CLAVE_OBJ = (tag) => `elixirLabMetaObj:${claveTag(tag)}`;
function leerObjetivo(tag, liga) {
  let o = LIGA_META;
  try { const v = parseInt(localStorage.getItem(CLAVE_OBJ(tag)), 10); if (Number.isFinite(v)) o = v; } catch (e) {}
  return o > liga && o <= LIGA_META ? o : LIGA_META;
}
function guardarObjetivo(tag, o) { try { localStorage.setItem(CLAVE_OBJ(tag), String(o)); } catch (e) {} }

// Victorias netas para llegar a liga 7 desde (liga, escalón).
// Ganar en el escalón máximo sube a la liga siguiente en escalón 1, sin escalón extra.
export function escalonesHasta(liga, escalon, objetivo = LIGA_META) {
  let n = Math.max(0, ESCALONES[liga] - escalon);
  for (let k = liga + 1; k < objetivo; k++) n += ESCALONES[k] - 1;
  return n;
}

// Escalón actual. Si no hay referencia o la liga de la API cambió, empieza en escalón 1 (automático).
// Si la referencia es de esta liga, cada partida ranked posterior a ella suma (victoria) o resta (derrota).
export function resolverEscalon(liga, ref, ps, ahora = Date.now()) {
  const N = ESCALONES[liga];
  if (!ref || ref.liga !== liga) return { liga, escalon: 1, desde: ahora, manual: false, cambiado: true };
  let e = Math.min(Math.max(ref.escalon, 1), N);
  for (const p of ps) {
    if (p.t.getTime() < ref.desde) continue;
    e = p.victoria ? Math.min(e + 1, N) : Math.max(e - 1, 1);
  }
  return { ...ref, escalon: e, cambiado: false };
}

const winrate = (xs) => (xs.length ? xs.filter((p) => p.victoria).length / xs.length : null);

// Límite inferior de Wilson (95 %) del winrate: el valor "seguro" de un mazo.
// Penaliza las muestras pequeñas: 10 partidas al 60 % valen menos que 100 partidas al 54 %.
export function wilsonInferior(victorias, n) {
  if (n === 0) return 0;
  const z = 1.96, p = victorias / n;
  const centro = p + (z * z) / (2 * n);
  const margen = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return (centro - margen) / (1 + (z * z) / n);
}

// Todos los mazos ranked con al menos MIN_LISTA partidas, ordenados por su límite inferior
function rankingMazos(ps) {
  const grupos = {};
  for (const p of ps) (grupos[p.mazo] ??= []).push(p);
  return Object.entries(grupos)
    .filter(([, arr]) => arr.length >= MIN_LISTA)
    .map(([mazo, arr]) => {
      const v = arr.filter((p) => p.victoria).length;
      return { mazo, wr: v / arr.length, n: arr.length, seguro: wilsonInferior(v, arr.length), cartas: arr[0].mi_mazo ?? [] };
    })
    .sort((a, b) => b.seguro - a.seguro);
}

// Recomendado: el mejor por límite inferior, solo si tiene MIN_RECOMENDAR partidas.
// Si no, el mejor queda "en observación". El mazo de referencia se muestra para comparar.
function recomendacion(ranking) {
  if (!ranking.length) return { tipo: "vacio" };
  const mejor = ranking[0];
  const ref = ranking.find((m) => m.mazo === REF_MAZO) ?? null;
  if (mejor.n >= MIN_RECOMENDAR) return { tipo: "recomendado", mazo: mejor, ref };
  return { tipo: "observacion", mazo: mejor, ref, faltan: MIN_RECOMENDAR - mejor.n };
}

// Winrate de cada corte acumulado (partidas 1..N de cada sesión)
function winratePorCorte(ps) {
  const sesiones = {};
  for (const p of ps) (sesiones[p.sesion] ??= []).push(p);
  return CORTES.map((hasta) => {
    const xs = [];
    for (const arr of Object.values(sesiones)) xs.push(...arr.slice(0, hasta));
    return { hasta, n: xs.length, wr: xs.length >= MIN_CORTE ? winrate(xs) : null };
  });
}
function mejorCorte(cortes) {
  let mejor = null;
  for (const c of cortes) if (c.wr !== null && (!mejor || c.wr > mejor.wr)) mejor = c;
  return mejor;
}

// Partidas estimadas: cada victoria +1 escalón, cada derrota -1. Neto redondeado para evitar 0,19999…
function partidasHasta(pasos, wr) {
  const neto = Math.round((2 * wr - 1) * 10000) / 10000;
  if (neto <= 0) return null;
  return Math.ceil(pasos / neto);
}

export function pintarMeta(el, data, mio, tag, iconoFn = () => "") {
  const j = data.jugador, liga = j.liga;
  if (!mio || !liga) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;

  // liga 7: sin escalón ni proyección; el rating son las medallas
  if (liga >= LIGA_META) {
    const partes = [
      j.rating ? `${fmtN(j.rating)} ${t("medallas", "trophies")}` : null,
      j.puesto ? `#${j.puesto} ${t("mundial", "world")}` : null,
    ].filter(Boolean).join(" · ");
    el.innerHTML = `<div class="meta-hud"><span class="hud-lbl">Meta</span><p class="meta-linea">${partes ? esc(partes) + " · " : ""}${t("Ya estás en la cima.", "You're already at the top.")}</p></div>`;
    return;
  }

  const ps = preparar(filtrarModo(data, "ranked"));
  const ref = leerRef(tag);
  const res = resolverEscalon(liga, ref, ps);
  if (res.cambiado) guardarRef(tag, { liga, escalon: 1, desde: res.desde, manual: false });

  const N = ESCALONES[liga], e = res.escalon;
  const manual = !!ref && !res.cambiado && !!ref.manual;
  const objetivo = leerObjetivo(tag, liga);
  const restantes = escalonesHasta(liga, e, objetivo);
  const total = escalonesHasta(liga, 1, objetivo);
  const avance = total ? Math.round((100 * (total - restantes)) / total) : 0;

  const segs = Array.from({ length: N }, (_, i) => {
    const n = i + 1, cls = n < e ? "lleno" : n === e ? "actual" : "";
    return `<span class="seg ${cls}"></span>`;
  }).join("");
  const opcionesEsc = Array.from({ length: N }, (_, i) => i + 1)
    .map((n) => `<option value="${n}"${n === e ? " selected" : ""}>${n}</option>`).join("");
  const opcionesObj = Array.from({ length: LIGA_META - liga }, (_, i) => liga + 1 + i)
    .map((k) => `<option value="${k}"${k === objetivo ? " selected" : ""}>${t("Liga", "League")} ${k}</option>`).join("");

  // proyecciones: tarjetas comparables; la más rápida se resalta
  const rec = recomendacion(rankingMazos(ps));
  const mejor = rec.tipo === "vacio" ? null : rec.mazo;
  const corte = mejorCorte(winratePorCorte(ps));
  const nSin = mejor ? partidasHasta(restantes, mejor.wr) : undefined;
  const nCorte = corte ? partidasHasta(restantes, corte.wr) : undefined;
  const menor = [nSin, nCorte].filter((x) => typeof x === "number" && x !== null);
  const mejorValor = menor.length ? Math.min(...menor) : null;

  const tarjeta = (titulo, n, wr, detalleWr) => {
    if (n === undefined) return "";
    const ok = typeof n === "number" && n !== null;
    const destacada = ok && n === mejorValor ? " destacada" : "";
    return `<div class="tile tile-proy${destacada}">
      <span class="tile-lbl">${titulo}</span>
      <span class="tile-val">${ok ? `~${n}` : "–"}</span>
      <span class="tile-det">${ok ? `${t("partidas", "matches")} · ${pct(wr)} ${detalleWr}` : t("al ritmo actual no subes", "at this pace you won't climb")}</span>
    </div>`;
  };
  const tarjetas = [
    mejor ? tarjeta(t("Jugando sin parar", "Playing nonstop"), nSin, mejor.wr, t("de victorias", "wins")) : "",
    corte ? tarjeta(t(`Cortando a ${corte.hasta} partidas`, `Stopping at ${corte.hasta} matches`), nCorte, corte.wr, t("de victorias", "wins")) : "",
  ].join("");

  const bloqueRec = bloqueMazo(rec, iconoFn);

  el.innerHTML = `<details id="metaDet" class="meta-det"${abierto ? " open" : ""}>
    <summary><span class="hud-lbl">Meta</span> <span class="meta-resumen"><strong>${restantes}</strong> ${t(`victorias para subir a liga ${objetivo}`, `wins to reach league ${objetivo}`)}</span><span class="meta-mini" role="img" aria-label="${avance} %"><span style="width:${avance}%"></span></span></summary>
    <div class="meta-hud">
      <div class="hud-top">
        <div class="hud-big">
          <span class="hud-num">${restantes}</span>
          <span class="hud-lbl">${t(`victorias netas para liga ${objetivo}`, `net wins to league ${objetivo}`)}</span>
        </div>
        <div class="hud-escalon">
          <span class="chip-esc">${t("Escalón", "Step")} ${e}/${N}</span>
          <span class="chip-origen${manual ? " manual" : ""}">${manual ? t("corregido a mano", "manual fix") : t("automático", "automatic")}</span>
          <button id="metaLapiz" class="lapiz" type="button" aria-label="${t("Corregir escalón", "Correct step")}">${LAPIZ}</button>
        </div>
      </div>
      <div class="segs${manual ? " manual" : ""}" style="--n:${N}">${segs}</div>
      <select id="metaEscalon" class="meta-select" hidden aria-label="${t("Escalón actual", "Current step")}">${opcionesEsc}</select>
      <div class="barra-meta" role="img" aria-label="${avance} %"><span style="width:${avance}%"></span></div>
      <div class="hud-objetivo">
        <span class="hud-lbl">${t("Objetivo", "Goal")}</span>
        <select id="metaObjetivo" class="meta-select">${opcionesObj}</select>
      </div>
      <div class="hud-grid">
        ${bloqueRec}
        ${tarjetas}
      </div>
      <p class="meta-nota meta-explica">${t("Cada victoria te acerca un escalón y cada derrota te aleja uno. Las tarjetas muestran cuántas partidas te tomaría llegar a la meta según tu ritmo.", "Each win moves you one step up and each loss one step down. The cards show how many matches it would take to reach the goal at your pace.")}</p>
    </div>
  </details>`;

  const det = el.querySelector("#metaDet");
  det.addEventListener("toggle", () => { abierto = det.open; });
  el.querySelector("#metaLapiz").addEventListener("click", () => {
    const sel = el.querySelector("#metaEscalon"); sel.hidden = !sel.hidden;
  });
  el.querySelector("#metaEscalon").addEventListener("change", (ev) => {
    guardarRef(tag, { liga, escalon: parseInt(ev.target.value, 10), desde: Date.now(), manual: true });
    pintarMeta(el, data, mio, tag, iconoFn);
  });
  el.querySelector("#metaObjetivo").addEventListener("change", (ev) => {
    guardarObjetivo(tag, parseInt(ev.target.value, 10));
    pintarMeta(el, data, mio, tag, iconoFn);
  });
}

function bloqueMazo(rec, iconoFn) {
  if (rec.tipo === "vacio") {
    return `<div class="tile tile-rec"><span class="tile-lbl">${t("Recomendado", "Recommended")}</span><span class="tile-det">${t(`Aún no hay ningún mazo con ${MIN_LISTA} partidas en ranked.`, `No deck has ${MIN_LISTA} ranked matches yet.`)}</span></div>`;
  }
  const m = rec.mazo;
  const iconos = m.cartas.slice(0, 8).map((c) => `<span class="mz-ico">${iconoFn(c)}</span>`).join("");
  const probable = Math.round(m.seguro * 100);
  const cabecera = rec.tipo === "recomendado"
    ? t("Recomendado", "Recommended")
    : t("Aún sin datos suficientes", "Not enough data yet");
  const aviso = rec.tipo === "recomendado"
    ? ""
    : `<span class="badge-aviso">${t(`faltan ${rec.faltan} partidas`, `${rec.faltan} more matches`)}</span>`;
  const comparacion = rec.ref && rec.ref.mazo !== m.mazo
    ? `<span class="rec-ref">${t("Tu referencia", "Your reference")}: ${esc(rec.ref.mazo)} · ${pct(rec.ref.wr)} · ${rec.ref.n} ${t("partidas", "matches")}</span>`
    : "";
  return `<div class="tile tile-rec">
    <span class="tile-lbl">${cabecera} ${aviso}</span>
    <div class="rec-cartas">${iconos}</div>
    <div class="rec-pie">
      <span class="barra-wr"><span style="width:${Math.round(m.wr * 100)}%"></span></span>
      <span class="tile-det">${pct(m.wr)} · ${m.n} ${t("partidas", "matches")} · ${t("al menos", "at least")} ${probable} % ${t("probable", "likely")}</span>
    </div>
    ${comparacion}
  </div>`;
}
