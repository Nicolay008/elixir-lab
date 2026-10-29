// Sección Meta (solo para el perfil propio): escalón actual, proyección hacia liga 7 y mazo recomendado.
// Sin dibujo: cálculos sobre las partidas ya descargadas y un escalón guardado en este navegador.
import { t, LANG } from "./i18n.js?v=50";
import { preparar, filtrarModo } from "./stats.js?v=50";

const LIGA_META = 7;                                        // liga desde la que se sube por medallas
const ESCALONES = { 1: 11, 2: 11, 3: 11, 4: 10, 5: 10, 6: 10, 7: 0 };
const MIN_LISTA = 10;                                       // partidas mínimas para mostrar un mazo
const MIN_RECOMENDAR = 15;                                  // por debajo, se muestra con nota de "pocos datos"
const MIN_GRUPO = 10;                                       // partidas mínimas para fiarse de un grupo de sesión
// grupos de posición en la sesión y hasta qué partida llega cada uno (para "sesiones de N")
const GRUPOS = [["1-3", 3], ["4-6", 6], ["7-10", 10], ["11+", Infinity]];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pct = (x) => (x === null ? "–" : `${Math.round(x * 100)} %`);
const fmtN = (n) => Number(n).toLocaleString(LANG === "en" ? "en-US" : "es-PE");
const claveTag = (tag) => tag.replace(/^#/, "").toUpperCase();
const CLAVE_ESCALON = (tag) => `elixirLabEscalon:${claveTag(tag)}`;

export function leerEscalon(tag) {
  try { const v = parseInt(localStorage.getItem(CLAVE_ESCALON(tag)), 10); return Number.isFinite(v) ? v : 1; }
  catch (e) { return 1; }
}
function guardarEscalon(tag, v) { try { localStorage.setItem(CLAVE_ESCALON(tag), String(v)); } catch (e) {} }

// Victorias netas para llegar a liga 7 desde (liga, escalón).
// Ganar en el escalón máximo sube a la liga siguiente en escalón 1, sin escalón extra:
// el tramo parcial llega hasta el máximo (N - escalón); cada liga completa entra en escalón 1 y cuenta N - 1.
export function escalonesHastaMeta(liga, escalon) {
  let n = Math.max(0, ESCALONES[liga] - escalon);
  for (let k = liga + 1; k < LIGA_META; k++) n += ESCALONES[k] - 1;
  return n;
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
    if (!mejor || w > mejor.wr) mejor = { mazo, wr: w, n: arr.length };
  }
  return mejor;
}

// Winrate por grupo de posición dentro de la sesión (ranked)
function winratePorGrupo(ps) {
  const sesiones = {};
  for (const p of ps) (sesiones[p.sesion] ??= []).push(p);
  const grupos = Object.fromEntries(GRUPOS.map(([g]) => [g, []]));
  for (const arr of Object.values(sesiones)) {
    arr.forEach((p, i) => {
      const pos = i + 1;
      const g = GRUPOS.find(([, hasta]) => pos <= hasta)[0];
      grupos[g].push(p);
    });
  }
  return GRUPOS.map(([g, hasta]) => ({ g, hasta, n: grupos[g].length, wr: grupos[g].length >= MIN_GRUPO ? winrate(grupos[g]) : null }));
}

// Mejor grupo de sesión (el de mayor winrate con muestra suficiente, excluido 11+ por no ser un corte)
function mejorGrupo(grupos) {
  let mejor = null;
  for (const gr of grupos) {
    if (gr.wr === null || gr.hasta === Infinity) continue;
    if (!mejor || gr.wr > mejor.wr) mejor = gr;
  }
  return mejor;
}

// Partidas estimadas: cada victoria +1 escalón, cada derrota -1
function partidasHasta(pasos, wr) {
  const neto = 2 * wr - 1;
  if (neto <= 0) return null;
  return Math.ceil(pasos / neto);
}

export function pintarMeta(el, data, mio, tag) {
  const j = data.jugador, liga = j.liga;
  if (!mio || !liga) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;

  const titulo = `<h3 class="meta-titulo">${t("Meta", "Goal")}</h3>`;

  // liga 7: sin escalón ni proyección; el rating son las medallas
  if (liga >= LIGA_META) {
    const partes = [
      j.rating ? `${fmtN(j.rating)} ${t("medallas", "trophies")}` : null,
      j.puesto ? `#${j.puesto} ${t("mundial", "world")}` : null,
    ].filter(Boolean).join(" · ");
    el.innerHTML = `${titulo}<p class="meta-linea">${partes ? esc(partes) + " · " : ""}${t("Ya estás en la cima.", "You're already at the top.")}</p>`;
    return;
  }

  const ps = preparar(filtrarModo(data, "ranked"));
  const mejor = mejorMazo(ps);
  const grupos = winratePorGrupo(ps);
  const grupo = mejorGrupo(grupos);

  const escalon = Math.min(leerEscalon(tag), ESCALONES[liga]);
  const opciones = Array.from({ length: ESCALONES[liga] }, (_, i) => i + 1)
    .map((n) => `<option value="${n}"${n === escalon ? " selected" : ""}>${n}</option>`).join("");
  const pasos = escalonesHastaMeta(liga, escalon);

  const fmt = (n) => (n === null ? t("no converge con este winrate", "does not converge at this winrate") : `~${n} ${t("partidas", "matches")}`);
  let proy = "";
  if (mejor) {
    const sinDisciplina = partidasHasta(pasos, mejor.wr);
    proy += `<li>${t("Sin disciplina", "Without discipline")} (${esc(mejor.mazo)}, ${pct(mejor.wr)}): ${fmt(sinDisciplina)}</li>`;
  }
  if (grupo) {
    const conSesiones = partidasHasta(pasos, grupo.wr);
    proy += `<li>${t(`Con sesiones de ${grupo.hasta} (${pct(grupo.wr)})`, `With sessions of ${grupo.hasta} (${pct(grupo.wr)})`)}: ${fmt(conSesiones)}</li>`;
  }
  const proyBloque = proy ? `<ul class="meta-proy">${proy}</ul>` : "";

  el.innerHTML = `${titulo}
    <div class="meta-fila">
      <label class="meta-escalon">${t("Escalón actual", "Current step")}
        <select id="metaEscalon">${opciones}</select>
      </label>
      <span class="meta-pasos">${t(`${pasos} victorias netas hasta liga 7`, `${pasos} net wins to league 7`)}</span>
    </div>
    ${proyBloque}
    ${bloqueMazo(mejor)}`;

  el.querySelector("#metaEscalon").addEventListener("change", (e) => {
    guardarEscalon(tag, parseInt(e.target.value, 10));
    pintarMeta(el, data, mio, tag);
  });
}

function bloqueMazo(mejor) {
  if (!mejor) {
    return `<p class="meta-linea meta-nota">${t(`Aún no hay un mazo con al menos ${MIN_LISTA} partidas en ranked.`, `No deck has at least ${MIN_LISTA} ranked matches yet.`)}</p>`;
  }
  const pocos = mejor.n < MIN_RECOMENDAR ? ` · <span class="meta-nota">${t("pocos datos", "low sample")}</span>` : "";
  return `<p class="meta-linea"><span class="meta-etiqueta">${t("Recomendado", "Recommended")}</span> ${esc(mejor.mazo)} · ${pct(mejor.wr)} · ${mejor.n} ${t("partidas", "matches")}${pocos}</p>`;
}
