// Une el buscador, la consulta, los seguidos y el dibujo de la página del jugador.
import { consultar, seguir } from "./api.js?v=46";
import { modelo, filtrarModo } from "./stats.js?v=46";
import { tendencia, coronas, franjasVisibles, setPagina, getPagina, totalPaginas } from "./charts.js?v=46";
import { reloj } from "./clock.js?v=46";
import { partidas } from "./partidas.js?v=46";
let vistaActual = "partidas", graficasListas = false;
import { t, LANG, aplicar, alternar } from "./i18n.js?v=46";
import { TURNSTILE_SITE_KEY, MAX_SEGUIDOS } from "./config.js?v=46";
import * as seguidos from "./seguidos.js?v=46";
import { ICONOS, escudoLiga } from "./iconos.js?v=46";

let catalogo = null;
function iconoCarta(cat, nombre) {
  const m = nombre.match(/^(.*?)(?: \((Evo|Héroe)\))?$/);
  const base = m[1], forma = m[2] ?? "";
  const entry = cat.get(base);
  if (!entry) return { img: null, nombre: LANG === "es" ? base : base };
  const ico = forma === "Evo" ? (entry.evo || entry.icono) : forma === "Héroe" ? (entry.heroe || entry.icono) : entry.icono;
  return { img: ico, nombre: LANG === "es" ? entry.es : entry.en };
}
async function cargarCatalogo() {
  if (catalogo) return catalogo;
  try {
    const r = await fetch("cards.json");
    const arr = await r.json();
    catalogo = new Map(arr.map((c) => [c.nombre_en, { icono: c.icono, evo: c.icono_evo, heroe: c.icono_heroe, es: c.nombre, en: c.nombre_en }]));
    return catalogo;
  } catch (e) { return new Map(); }
}
import { iniciarBarra } from "./barra.js?v=46";

const LIGA_TOP = 7;   // la liga más alta lleva la gema amatista
let grupoModo = "todos";  // filtro por modo
let mazoFiltro = null;    // firma del mazo seleccionado, o null: todos, ranked, escalera, guerra, otros

const $ = (id) => document.getElementById(id);
let m = null, ultimo = null, vista = "racha", graficaTendencia = null, graficaCoronas = null, captchaId = null;

const leyendas = {
  racha: () => `<span><span class="punto lleno"></span>${t("Victoria", "Win")}</span><span><span class="punto hueco"></span>${t("Derrota", "Loss")}</span><span><span class="raya"></span>${t("50 %: ni subes ni bajas", "50 %: you neither climb nor drop")}</span>`,
  elixir: () => `<span><span class="punto lleno"></span>${t("Victoria", "Win")}</span><span><span class="punto hueco"></span>${t("Derrota", "Loss")}</span><span><span class="raya"></span>${t("Tu límite: algo más de lo que sueles perder", "Your limit: a bit more than you usually leak")}</span>`,
};

// ---------- atajos y botón seguir ----------
// Barra compacta: el perfil fijado a la vista y un desplegable con el resto de seguidos
function pintarAtajos() {
  const l = seguidos.ordenados(), actual = ultimo?.jugador.tag.replace("#", ""), fij = seguidos.fijado();
  $("atajos").hidden = l.length === 0;
  const boton = (s) => `<button type="button" data-tag="${s.tag}"${s.tag === actual ? ' aria-current="true"' : ""}${s.tag === fij ? ' class="fijado"' : ""}>${s.tag === fij ? ICONOS.chincheta : ""}${s.nombre}</button>`;
  const resto = l.filter((s) => s.tag !== fij);
  const pin = l.find((s) => s.tag === fij);
  $("pinSeguido").innerHTML = pin ? boton(pin) : "";
  $("botonSeguidos").hidden = resto.length === 0;
  $("botonSeguidos").innerHTML = `${t("Seguidos", "Following")} (${l.length})${ICONOS.flecha}`;
  $("listaSeguidos").innerHTML = resto.map(boton).join("");
  if (!resto.length) cerrarSeguidos();
  $("atajos").querySelectorAll("button[data-tag]").forEach((b) => b.addEventListener("click", () => {
    $("tag").value = `#${b.dataset.tag}`; cerrarSeguidos(); buscar(b.dataset.tag);
  }));
}
function cerrarSeguidos() {
  $("botonSeguidos").setAttribute("aria-expanded", "false");
  $("listaSeguidos").hidden = true;
}
function pintarBotonSeguir() {
  const sigo = ultimo && seguidos.sigo(ultimo.jugador.tag);
  const fij = ultimo && seguidos.esFijado(ultimo.jugador.tag);
  $("botonFijar").setAttribute("aria-pressed", !!fij);
  $("botonFijar").innerHTML = `${ICONOS.chincheta}<span>${fij ? t("Fijado", "Pinned") : t("Fijar", "Pin")}</span>`;
  $("botonFijar").title = fij ? t("Quitar como perfil principal", "Unpin as main profile") : t("Fijar como tu perfil principal", "Pin as your main profile");
  $("botonSeguir").setAttribute("aria-pressed", !!sigo);
  $("botonSeguir").innerHTML = `${ICONOS.corazon}<span>${sigo ? t("Siguiendo", "Following") : t("Seguir", "Follow")}</span>`;
}
function cerrarPanel() {
  $("panelSeguir").hidden = true; $("panelError").hidden = true; $("panelLista").innerHTML = "";
  if (captchaId !== null && window.turnstile) { window.turnstile.remove(captchaId); captchaId = null; }
}
function errorPanel(msg) { $("panelError").textContent = msg; $("panelError").hidden = false; }

async function confirmarSeguir(opciones) {
  const j = ultimo.jugador;
  try {
    await seguir(j.tag, opciones);
    seguidos.anadir(j.tag, j.nombre);
    cerrarPanel(); pintarBotonSeguir(); pintarAtajos();
    buscar(j.tag, { silencioso: true });   // volver a consultar para mostrar el historial guardado
  } catch (e) { errorPanel(e.message); }
}

function pedirSeguir() {
  const j = ultimo.jugador;
  if (seguidos.sigo(j.tag)) { seguidos.quitar(j.tag); pintarBotonSeguir(); pintarAtajos(); return; }
  cerrarPanel(); $("panelSeguir").hidden = false;

  // lista llena: elegir a quién dejar de seguir, en lugar de quitar uno en silencio
  if (seguidos.llena()) {
    $("panelTexto").textContent = t(`Ya sigues a ${MAX_SEGUIDOS} jugadores. Deja de seguir a uno para añadir a ${j.nombre}.`, `You already follow ${MAX_SEGUIDOS} players. Unfollow one to add ${j.nombre}.`);
    $("panelLista").innerHTML = seguidos.lista().map((s) => `<button type="button" data-tag="${s.tag}"><span>${s.nombre}</span><span>${t("Dejar de seguir", "Unfollow")}</span></button>`).join("");
    $("panelLista").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { seguidos.quitar(b.dataset.tag); pintarAtajos(); pedirSeguir(); }));
    return;
  }
  // ya lo sigue alguien: solo renovar, sin captcha
  if (ultimo.seguido) { $("panelSeguir").hidden = true; confirmarSeguir({ renovar: true }); return; }

  // tag nuevo: aviso y filtro anti-bots
  $("panelTexto").textContent = t(`A partir de ahora guardaremos las partidas de ${j.nombre} para darte estadísticas fiables. Su historial será visible para quien consulte su tag.`, `From now on we’ll save ${j.nombre}’s matches to give you reliable stats. Their history will be visible to anyone who looks up their tag.`);
  if (!window.turnstile) { errorPanel(t("No se pudo cargar la verificación anti-bots. Recarga la página.", "The anti-bot check couldn’t load. Reload the page.")); return; }
  captchaId = window.turnstile.render("#captcha", {
    sitekey: TURNSTILE_SITE_KEY, language: LANG,
    callback: (token) => confirmarSeguir({ token }),
    "error-callback": () => errorPanel(t("La verificación falló. Vuelve a intentarlo.", "The check failed. Try again.")),
  });
}

// ---------- gráficas ----------
function pintarTendencia() {
  $("vistaRacha").setAttribute("aria-pressed", vista === "racha");
  $("vistaElixir").setAttribute("aria-pressed", vista === "elixir");
  $("leyendaTendencia").innerHTML = leyendas[vista]();
  $("explicaElixir").hidden = vista !== "elixir";
  if (m.limite !== null) {
    const rMin = m.mediana !== null && m.iqr !== null ? Math.max(0, m.mediana - m.iqr).toFixed(1) : "?";
    const rMax = m.mediana !== null && m.iqr !== null ? (m.mediana + m.iqr).toFixed(1) : "?";
    $("detalleLimite").textContent = t(
      `Mediana: ${m.mediana?.toFixed(1) ?? "?"} · Tu zona normal: ${rMin} – ${rMax} · Tilt: por encima de ${m.limite?.toFixed(1) ?? "?"}`,
      `Median: ${m.mediana?.toFixed(1) ?? "?"} · Normal range: ${rMin} – ${rMax} · Tilt: above ${m.limite?.toFixed(1) ?? "?"}`);
  }
  graficaTendencia = tendencia($("graficaTendencia"), m, vista, graficaTendencia);
  $("franjas").innerHTML = franjasVisibles(m).map((f) => `<li class="chip ${f.tipo}">${f.texto}</li>`).join("");
}

// el perfil fijado se trata como "tú"; los demás, por su nombre
const esMio = () => ultimo && seguidos.esFijado(ultimo.jugador.tag);

// escudo de la liga actual (protagonista), con el puesto mundial y el rating al lado del nombre
function pintarIdentidad(j) {
  const liga = $("liga");
  liga.hidden = !j.liga;
  liga.innerHTML = j.liga
    ? `${escudoLiga(j.liga, j.liga === LIGA_TOP)}<span class="liga-texto">${t("Liga", "League")} ${j.liga}</span>`
    : "";
  const fmt = (n) => Number(n).toLocaleString(LANG === "en" ? "en-US" : "es-PE");
  $("rango").textContent = [j.puesto ? `#${j.puesto}` : null, j.rating ? `${t("Rating", "Rating")} ${fmt(j.rating)}` : null].filter(Boolean).join(" · ");
}

function pintarModos() {
  document.querySelectorAll("#modos button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.modo === grupoModo));
}

function pintar(data) {
  ultimo = data;
  setPagina(0);
  let filtrado = filtrarModo(data, grupoModo);
  if (mazoFiltro) filtrado = { ...filtrado, partidas: filtrado.partidas.filter((p) => p.mazo === mazoFiltro) };
  m = modelo(filtrado, !!esMio());
  const j = data.jugador;
  $("nombre").textContent = j.nombre;
  pintarIdentidad(j);
  $("compartir").hidden = false;
  pintarModos();
  $("detalleJugador").textContent = [j.clan, j.mejor_liga ? `${t("mejor liga", "best league")} ${j.mejor_liga}` : null].filter(Boolean).join(", ");
  $("estadoTitulo").textContent = m.estado.titulo;
  $("estadoTexto").textContent = m.estado.texto;
  $("estado").dataset.tono = m.estado.tono;
  $("estado").style.setProperty("--lleno", `${m.estado.lleno}%`);
  $("muestra").textContent = esMio()
    ? t(`Basadas en tus últimas ${m.resumen.partidas} partidas.`, `Based on your last ${m.resumen.partidas} matches.`)
    : t(`Basadas en sus últimas ${m.resumen.partidas} partidas.`, `Based on their last ${m.resumen.partidas} matches.`);
  $("resumenPartidas").textContent = m.resumen.partidas;
  $("resumenWinrate").textContent = m.resumen.winrate === null ? "–" : `${m.resumen.winrate} %`;
  const elxNum = m.resumen.elixir_desperdiciado;
  const flecha = m.elxTendencia === null ? "" : m.elxTendencia < -0.01 ? " ↓" : m.elxTendencia > 0.01 ? " ↑" : " →";
  const flechaCls = m.elxTendencia === null ? "" : m.elxTendencia < -0.01 ? "ok" : m.elxTendencia > 0.01 ? "bad" : "mid";
  $("resumenElixir").innerHTML = elxNum !== null
    ? `${elxNum}<span class="tendencia ${flechaCls}">${flecha}</span>`
    : "–";
  const elxVic = m.elixirVictorias !== null ? m.elixirVictorias.toFixed(1) : "–";
  const elxDer = m.elixirDerrotas !== null ? m.elixirDerrotas.toFixed(1) : "–";
  $("detalleElixir").textContent = `W ${elxVic} · L ${elxDer}`;
  $("notaApi").textContent = data.seguido
    ? t(`Historial guardado: ${data.resumen.partidas} partidas.`, `Saved history: ${data.resumen.partidas} matches.`)
    : t("La API solo conserva las últimas ~30 partidas de cada jugador.", "The API only keeps each player’s last ~30 matches.");
  $("resultado").hidden = false;
  pintarBotonSeguir(); pintarAtajos();
  const nombres = { yo: esMio() ? t("Tú", "You") : j.nombre, jugador: esMio() ? t("Tú", "You") : j.nombre };
  partidas($("listaPartidas"), $("verMas"), m.todas, nombres, (tag) => {
    $("tag").value = tag; window.scrollTo({ top: 0, behavior: "smooth" }); buscar(tag);
  });
  if (!m.todas.length) $("listaPartidas").innerHTML = `<li class="vacio">${t("No hay partidas de este modo.", "No matches in this mode.")}</li>`;
  graficasListas = false;
  pintarVistaMazos();
  verPestana(vistaActual);
}

function actualizarNavGrafica() {
  const pags = totalPaginas(m);
  $("navGrafica").hidden = pags <= 1;
  $("grafPagina").textContent = (getPagina() + 1) + " / " + pags;
  $("grafAnterior").disabled = getPagina() >= pags - 1;
  $("grafSiguiente").disabled = getPagina() <= 0;
}

function pintarGraficas() {
  if (graficasListas || !m) return;
  pintarTendencia();
  actualizarNavGrafica();
  graficaCoronas = coronas($("graficaCoronas"), m, graficaCoronas);
  reloj({ svg: $("reloj"), botonAM: $("botonAM"), botonPM: $("botonPM"), detalle: $("detalleHora") }, m.horas);
  pintarNuevos();
  graficasListas = true;
}

function pintarPosicion(pos) {
  const GRUPOS = [["1-3", "1\u00AA-3\u00AA"], ["4-6", "4\u00AA-6\u00AA"], ["7-10", "7\u00AA-10\u00AA"], ["11+", "11+"]];
  const filas = GRUPOS.map(([k, label]) => {
    const g = pos[k];
    if (!g) return "";
    const wr = g.wr ?? null;
    const cls = wr === null ? "muted" : wr >= 55 ? "ok" : wr >= 45 ? "mid" : "bad";
    return `<div class="pos-fila"><span class="pos-label">${label}</span><span class="pos-n">${g.n}p</span><div class="pos-bar-track"><div class="pos-bar-fill ${cls}" style="width:${wr ?? 0}%"></div></div><span class="pos-wr ${cls}">${wr !== null ? wr + " %" : "\u2013"}</span></div>`;
  }).join("");
  $("tablaPosicion").innerHTML = filas || `<p class="muted">${t("Pocas partidas para calcular.", "Too few matches.")}</p>`;
}

async function pintarMatchups(contenedor, lista) {
  const cat = await cargarCatalogo();
  contenedor.innerHTML = lista.map((x) => {
    const entry = cat.get(x.carta);
    const img = entry ? `<img class="mu-ico" src="${entry.icono}" alt="" loading="lazy">` : "";
    const nombre = entry ? (LANG === "es" ? entry.es : entry.en) : x.carta;
    const cls = x.wr < 35 ? "bad" : x.wr < 45 ? "mid" : x.wr > 55 ? "ok" : "";
    return `<div class="mu-item"><div class="mu-heat" style="opacity:${(0.25 + 0.75 * x.calor).toFixed(2)}"></div>${img}<span class="mu-name">${nombre}</span><span class="mu-wr ${cls}">${x.wr} %</span><span class="mu-n">${x.partidas}p</span></div>`;
  }).join("") || `<p class="muted">${t("Pocas partidas para calcular.", "Too few matches.")}</p>`;
}



function pintarNuevos() {
  $("tasaCerrada").textContent = m.tasaCerrada !== null ? `${m.tasaCerrada} %` : "\u2013";
  $("rendiciones").textContent = m.resumen.rendiciones ?? 0;
  $("cambioMazo").textContent = m.pctCambioMazo !== null ? `${m.pctCambioMazo} %` : "\u2013";
  pintarPosicion(m.porPosicion);
  pintarMatchups($("pesadillas"), m.pesadillas);
  pintarMatchups($("fortalezas"), m.fortalezas);
}

function verPestana(cual) {
  vistaActual = cual;
  $("tabPartidas").setAttribute("aria-pressed", cual === "partidas"); $("tabPartidas").setAttribute("aria-selected", cual === "partidas");
  $("tabEstadisticas").setAttribute("aria-pressed", cual === "estadisticas"); $("tabEstadisticas").setAttribute("aria-selected", cual === "estadisticas");
  $("tabMazos").setAttribute("aria-pressed", cual === "mazos"); $("tabMazos").setAttribute("aria-selected", cual === "mazos");
  $("vistaPartidas").hidden = cual !== "partidas";
  $("vistaEstadisticas").hidden = cual !== "estadisticas";
  $("vistaMazos").hidden = cual !== "mazos";
  if (cual === "estadisticas") {
    $("tabEstadisticas").classList.remove("brillo");
    try { localStorage.setItem("elixirVioEstadisticas", "1"); } catch (e) {}
    pintarGraficas();
  }
  // mazos se pinta en pintar(), aquí solo se muestra/oculta
}

async function buscar(tag, { silencioso = false } = {}) {
  const limpio = String(tag).trim();
  if (!limpio) return;
  if (!silencioso) { $("error").hidden = true; $("buscar").disabled = true; $("buscar").textContent = t("Consultando…", "Looking up…"); cerrarPanel(); }
  try {
    const data = await consultar(limpio);
    $("intro").hidden = true;   // con un resultado en pantalla, la presentación sobra
    pintar(data);
    history.replaceState(null, "", `?tag=${encodeURIComponent(data.jugador.tag.replace("#", ""))}`);
    try { localStorage.setItem("elixirLabTag", data.jugador.tag); } catch (e) {}
  } catch (err) {
    if (!silencioso) { $("error").textContent = err.message; $("error").hidden = false; }
  } finally {
    $("buscar").disabled = false; $("buscar").textContent = t("Consultar", "Look up");
  }
}

$("formulario").addEventListener("submit", (e) => { e.preventDefault(); buscar($("tag").value); });
$("tabPartidas").addEventListener("click", () => verPestana("partidas"));
$("tabEstadisticas").addEventListener("click", () => verPestana("estadisticas"));
$("tabMazos").addEventListener("click", () => verPestana("mazos"));
try { if (!localStorage.getItem("elixirVioEstadisticas")) $("tabEstadisticas").classList.add("brillo"); } catch (e) {}
$("vistaRacha").addEventListener("click", () => { vista = "racha"; pintarTendencia(); });
// Pestaña Mazos
function pintarVistaMazos() {
  if (!m) return;
  const cat = catalogo || new Map();
  const html = m.mazosCalif.map((d, idx) => {
    const iconos = (d.cartas ?? []).map((c) => {
      const { img, nombre } = iconoCarta(cat, c);
      return img ? `<img class="mc-ico" src="${img}" alt="${nombre}" title="${nombre}" loading="lazy">` : `<span class="mc-ico mc-falta">?</span>`;
    }).join("");
    const letraCls = d.letra === "S" ? "s" : d.letra === "A" ? "a" : d.letra === "B" ? "b" : "c";
    const opacidad = Math.max(0.3, Math.min(1, (d.ic[1] - d.ic[0] < 30) ? 1 : (d.ic[1] - d.ic[0] < 50) ? 0.7 : 0.4));
    const wrColor = d.wr >= 55 ? "ok" : d.wr >= 45 ? "mid" : "bad";
    return `<div class="mc-item" data-idx="${idx}">
      <div class="mc-letra ${letraCls}">${d.letra}</div>
      <div class="mc-cartas">${iconos}</div>
      <div class="mc-barra-wrap"><div class="mc-barra ${wrColor}" style="width:${d.wr}%;opacity:${opacidad}"></div></div>
      <span class="mc-wr">${d.wr} %</span>
      <span class="mc-n">${d.n}p</span>
    </div>
    <div class="mc-detalle" id="mcDetalle${idx}" hidden>
      <div class="mc-det-grid">
        <div><span class="mc-det-label">${t("Partidas", "Matches")}</span><span class="mc-det-val">${d.n}</span></div>
        <div><span class="mc-det-label">${t("Confianza", "Confidence")}</span><span class="mc-det-val">${d.ic[0]}-${d.ic[1]} %</span></div>
        <div><span class="mc-det-label">${t("Elixir perdido", "Elixir leaked")}</span><span class="mc-det-val">${d.elxMedia ?? "–"}</span></div>
        <div><span class="mc-det-label">${t("Consistencia", "Consistency")}</span><span class="mc-det-val">${d.consistencia !== null ? d.consistencia + " %" : "–"}</span></div>
        <div><span class="mc-det-label">${t("Cerradas", "Close games")}</span><span class="mc-det-val">${d.resCierre !== null ? d.resCierre + " %" : "–"}</span></div>
        <div><span class="mc-det-label">${t("Cobertura", "Coverage")}</span><span class="mc-det-val">${d.cobertura !== null ? d.cobertura + " %" : "–"}</span></div>
        <div><span class="mc-det-label">${t("Nota", "Score")}</span><span class="mc-det-val">${d.nota}</span></div>
      </div>
    </div>`;
  }).join("");
  $("vistaMazos").innerHTML = html || `<p class="muted">${t("Menos de 5 partidas por mazo.", "Less than 5 matches per deck.")}</p>`;
  $("vistaMazos").querySelectorAll(".mc-item").forEach((el) => {
    // tap to expand detail
    el.addEventListener("click", () => {
      const det = $("mcDetalle" + el.dataset.idx);
      det.hidden = !det.hidden;
    });
    // long press or double tap to filter by this deck
    el.addEventListener("dblclick", () => {
      const d = m.mazosCalif[parseInt(el.dataset.idx)];
      if (!d) return;
      mazoFiltro = mazoFiltro === d.mazo ? null : d.mazo;
      pintarChipMazo();
      if (ultimo) pintar(ultimo);
    });
  });
}
$("vistaElixir").addEventListener("click", () => { vista = "elixir"; pintarTendencia(); });
$("botonSeguir").addEventListener("click", pedirSeguir);
$("botonFijar").addEventListener("click", () => {
  if (!ultimo) return;
  const j = ultimo.jugador;
  if (seguidos.esFijado(j.tag)) seguidos.desfijar(); else seguidos.fijar(j.tag, j.nombre);
  pintar(ultimo);   // redibuja con "tú" o con el nombre
});
$("panelCerrar").addEventListener("click", cerrarPanel);
// en pantalla ancha, la gráfica de tendencia puede ocupar todo el ancho para estudiarla
// chip del mazo filtrado
function pintarChipMazo() {
  if (!mazoFiltro) { $("chipMazo").hidden = true; return; }
  const cartas = (ultimo?.partidas ?? []).find((p) => p.mazo === mazoFiltro)?.mi_mazo ?? [];
  const cat = catalogo || new Map();
  const iconos = cartas.slice(0, 4).map((c) => {
    const { img } = iconoCarta(cat, c);
    return img ? `<img class="chip-mazo-ico" src="${img}">` : "";
  }).join("");
  $("chipMazo").innerHTML = `${iconos}<span class="chip-mazo-txt">${t("Filtrando por mazo", "Filtered by deck")}</span><button class="chip-mazo-x" type="button" aria-label="${t("Quitar filtro", "Clear filter")}">✕</button>`;
  $("chipMazo").hidden = false;
  $("chipMazo").querySelector(".chip-mazo-x").addEventListener("click", () => {
    mazoFiltro = null; pintarChipMazo(); if (ultimo) pintar(ultimo);
  });
}

// toggle pesadillas/fortalezas en móvil
$("btnPesadillas").addEventListener("click", () => {
  $("btnPesadillas").setAttribute("aria-pressed", "true");
  $("btnFortalezas").setAttribute("aria-pressed", "false");
  $("panelPesadillas").classList.remove("mu-oculto-movil");
  $("panelFortalezas").classList.add("mu-oculto-movil");
});
$("btnFortalezas").addEventListener("click", () => {
  $("btnFortalezas").setAttribute("aria-pressed", "true");
  $("btnPesadillas").setAttribute("aria-pressed", "false");
  $("panelFortalezas").classList.remove("mu-oculto-movil");
  $("panelPesadillas").classList.add("mu-oculto-movil");
});

$("grafAnterior").addEventListener("click", () => {
  setPagina(getPagina() + 1); pintarTendencia();
  graficaCoronas = coronas($("graficaCoronas"), m, graficaCoronas);
  actualizarNavGrafica();
});
$("grafSiguiente").addEventListener("click", () => {
  setPagina(Math.max(0, getPagina() - 1)); pintarTendencia();
  graficaCoronas = coronas($("graficaCoronas"), m, graficaCoronas);
  actualizarNavGrafica();
});

$("botonSeguidos").addEventListener("click", () => {
  const abierto = $("botonSeguidos").getAttribute("aria-expanded") !== "true";
  $("botonSeguidos").setAttribute("aria-expanded", abierto);
  $("listaSeguidos").hidden = !abierto;
});
document.addEventListener("click", (e) => { if (!$("atajos").contains(e.target)) cerrarSeguidos(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarSeguidos(); });
// Compartir el perfil del jugador actual
$("compartir").addEventListener("click", async () => {
  const tag = ultimo?.jugador?.tag;
  if (!tag) return;
  const url = `${location.origin}${location.pathname}?tag=${tag.replace("#", "")}`;
  const titulo = `${ultimo.jugador.nombre} · Elixir Lab`;
  if (navigator.share) {
    try { await navigator.share({ title: titulo, url }); } catch (e) { /* cancelado */ }
  } else {
    try {
      await navigator.clipboard.writeText(url);
      $("compartir").classList.add("copiado");
      setTimeout(() => $("compartir").classList.remove("copiado"), 1500);
    } catch (e) { /* sin acceso */ }
  }
});
document.querySelectorAll("#modos button").forEach((b) => b.addEventListener("click", () => {
  grupoModo = b.dataset.modo;
  if (ultimo) pintar(ultimo);
  else pintarModos();
}));

aplicar();
iniciarBarra();
cargarCatalogo();  // pre-cargar iconos de cartas
$("idioma").textContent = LANG === "en" ? "ES" : "EN";
$("idioma").addEventListener("click", alternar);
pintarAtajos();
seguidos.renovarTodos();

// tag desde la dirección (?tag=) o el último consultado
const inicial = new URLSearchParams(location.search).get("tag") || (() => { try { return localStorage.getItem("elixirLabTag"); } catch (e) { return null; } })();
if (inicial) { $("tag").value = inicial.startsWith("#") ? inicial : `#${inicial}`; buscar(inicial); }

matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { graficasListas = false; ultimo && pintar(ultimo); });
