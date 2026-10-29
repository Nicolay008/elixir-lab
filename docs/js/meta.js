// Sección Meta (solo perfil propio). La API manda la liga; dentro de la liga el escalón se cuenta
// con tus partidas ranked desde una referencia guardada en este navegador, y se puede corregir a mano.
import { t, LANG } from "./i18n.js?v=51";
import { preparar, filtrarModo } from "./stats.js?v=51";

const LIGA_META = 7;                                        // desde aquí se sube por medallas
const ESCALONES = { 1: 11, 2: 11, 3: 11, 4: 10, 5: 10, 6: 10, 7: 0 };
const MIN_LISTA = 10;                                       // partidas mínimas para mostrar un mazo
const MIN_RECOMENDAR = 15;                                  // por debajo, nota de "pocos datos"
const MIN_CORTE = 10;                                       // partidas mínimas para fiarse de un corte de sesión
const CORTES = [3, 6, 10];                                  // "sesiones de N": partidas 1..N de cada sesión
const LAPIZ = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 20l4-1L19 8l-3-3L5 16z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

let abierto = false;   // el acordeón conserva su estado al repintar

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pct = (x) => (x === null ? "–" : `${Math.round(x * 100)} %`);
const fmtN = (n) => Number(n).toLocaleString(LANG === "en" ? "en-US" : "es-PE");
const claveTag = (tag) => tag.replace(/^#/, "").toUpperCase();
const CLAVE_REF = (tag) => `elixirLabMeta:${claveTag(tag)}`;

function leerRef(tag) { try { return JSON.parse(localStorage.getItem(CLAVE_REF(tag))) || null; } catch (e) { return null; } }
function guardarRef(tag, ref) { try { localStorage.setItem(CLAVE_REF(tag), JSON.stringify(ref)); } catch (e) {} }

// Victorias netas para llegar a liga 7 desde (liga, escalón).
// Ganar en el escalón máximo sube a la liga siguiente en escalón 1, sin escalón extra.
export function escalonesHastaMeta(liga, escalon) {
  let n = Math.max(0, ESCALONES[liga] - escalon);
  for (let k = liga + 1; k < LIGA_META; k++) n += ESCALONES[k] - 1;
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

// Mazo con mejor winrate en ranked (mínimo MIN_LISTA partidas)
function mejorMazo(ps) {
  const grupos = {};
  for (const p of ps) (grupos[p.mazo] ??= []).push(p);
  let mejor = null;
  for (const [mazo, arr] of Object.entries(grupos)) {
    if (arr.length < MIN_LISTA) continue;
    const w = winrate(arr);
    if (!mejor || w > mejor.wr) mejor = { mazo, wr: w, n: arr.length, cartas: arr[0].mi_mazo ?? [] };
  }
  return mejor;
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
    el.innerHTML = `<h3 class="meta-titulo">Meta</h3><p class="meta-linea">${partes ? esc(partes) + " · " : ""}${t("Ya estás en la cima.", "You're already at the top.")}</p>`;
    return;
  }

  const ps = preparar(filtrarModo(data, "ranked"));
  const ref = leerRef(tag);
  const res = resolverEscalon(liga, ref, ps);
  if (res.cambiado) guardarRef(tag, { liga, escalon: 1, desde: res.desde, manual: false });

  const N = ESCALONES[liga], e = res.escalon;
  const manual = !!ref && !res.cambiado && !!ref.manual;
  const restantes = escalonesHastaMeta(liga, e);
  const total = escalonesHastaMeta(liga, 1);
  const avance = total ? Math.round((100 * (total - restantes)) / total) : 0;

  const segs = Array.from({ length: N }, (_, i) => {
    const n = i + 1, cls = n < e ? "lleno" : n === e ? "actual" : "";
    return `<span class="seg ${cls}"></span>`;
  }).join("");

  const opciones = Array.from({ length: N }, (_, i) => i + 1)
    .map((n) => `<option value="${n}"${n === e ? " selected" : ""}>${n}</option>`).join("");

  const mejor = mejorMazo(ps);
  const corte = mejorCorte(winratePorCorte(ps));
  const proy = [];
  if (mejor) proy.push(`<li>${t("Sin disciplina", "Without discipline")} (${pct(mejor.wr)}): ${estimacion(restantes, mejor.wr)}</li>`);
  if (corte) proy.push(`<li>${t(`Con sesiones de ${corte.hasta} (${pct(corte.wr)})`, `With sessions of ${corte.hasta} (${pct(corte.wr)})`)}: ${estimacion(restantes, corte.wr)}</li>`);

  const cuerpo = `
    <div class="via">
      <div class="segs ${manual ? "manual" : ""}" style="--n:${N}">${segs}</div>
      <div class="via-info">
        <span class="via-escalon">${t("Escalón", "Step")} ${e}/${N}</span>
        <span class="via-origen">${manual ? t("corregido a mano", "manual fix") : t("automático", "automatic")}</span>
        <button id="metaLapiz" class="lapiz" type="button" aria-label="${t("Corregir escalón", "Correct step")}">${LAPIZ}</button>
      </div>
      <select id="metaEscalon" class="meta-select" hidden aria-label="${t("Escalón actual", "Current step")}">${opciones}</select>
    </div>
    <div class="barra-meta" role="img" aria-label="${avance} %"><span style="width:${avance}%"></span></div>
    <p class="meta-linea">${t(`Faltan ${restantes} victorias netas para liga 7`, `${restantes} net wins left to league 7`)}</p>
    ${bloqueMazo(mejor, iconoFn)}
    ${proy.length ? `<ul class="meta-proy">${proy.join("")}</ul>` : ""}`;

  el.innerHTML = `<details id="metaDet" class="meta-det"${abierto ? " open" : ""}>
    <summary><span class="meta-titulo">Meta</span> <span class="meta-resumen">${t("Escalón", "Step")} ${e} · ${restantes} ${t("para liga 7", "to league 7")}</span></summary>
    ${cuerpo}
  </details>`;

  const det = el.querySelector("#metaDet");
  det.addEventListener("toggle", () => { abierto = det.open; });
  el.querySelector("#metaLapiz").addEventListener("click", () => {
    const s = el.querySelector("#metaEscalon"); s.hidden = !s.hidden;
  });
  el.querySelector("#metaEscalon").addEventListener("change", (ev) => {
    guardarRef(tag, { liga, escalon: parseInt(ev.target.value, 10), desde: Date.now(), manual: true });
    pintarMeta(el, data, mio, tag, iconoFn);
  });
}

function estimacion(pasos, wr) {
  const n = partidasHasta(pasos, wr);
  return n === null ? t("no converge con este winrate", "does not converge at this winrate") : `~${n} ${t("partidas", "matches")}`;
}

function bloqueMazo(mejor, iconoFn) {
  if (!mejor) {
    return `<p class="meta-linea meta-nota">${t(`Aún no hay un mazo con al menos ${MIN_LISTA} partidas en ranked.`, `No deck has at least ${MIN_LISTA} ranked matches yet.`)}</p>`;
  }
  const iconos = mejor.cartas.slice(0, 8).map((c) => `<span class="mz-ico">${iconoFn(c)}</span>`).join("");
  const pocos = mejor.n < MIN_RECOMENDAR ? ` <span class="meta-nota">${t("pocos datos", "low sample")}</span>` : "";
  return `<div class="rec">
    <span class="meta-etiqueta">${t("Recomendado", "Recommended")}</span>
    <div class="rec-cartas">${iconos}</div>
    <div class="rec-wr"><span class="barra-wr"><span style="width:${Math.round(mejor.wr * 100)}%"></span></span>
      <span>${pct(mejor.wr)} · ${mejor.n} ${t("partidas", "matches")}${pocos}</span></div>
  </div>`;
}
