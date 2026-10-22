// Une el buscador, la consulta, los seguidos y el dibujo de la página del jugador.
import { consultar, seguir } from "./api.js?v=5";
import { modelo } from "./stats.js?v=5";
import { tendencia, coronas, franjasVisibles } from "./charts.js?v=5";
import { reloj } from "./clock.js?v=5";
import { partidas } from "./partidas.js?v=5";
let vistaActual = "partidas", graficasListas = false;
import { t, LANG, aplicar, alternar } from "./i18n.js?v=5";
import { TURNSTILE_SITE_KEY, MAX_SEGUIDOS } from "./config.js?v=5";
import * as seguidos from "./seguidos.js?v=5";

const $ = (id) => document.getElementById(id);
let m = null, ultimo = null, vista = "racha", graficaTendencia = null, graficaCoronas = null, captchaId = null;

const leyendas = {
  racha: () => `<span><span class="punto lleno"></span>${t("Victoria", "Win")}</span><span><span class="punto hueco"></span>${t("Derrota", "Loss")}</span><span><span class="raya"></span>${t("50 %: ni subes ni bajas", "50 %: you neither climb nor drop")}</span>`,
  elixir: () => `<span><span class="punto lleno"></span>${t("Victoria", "Win")}</span><span><span class="punto hueco"></span>${t("Derrota", "Loss")}</span><span><span class="raya"></span>${t("Tu límite: algo más de lo que sueles perder", "Your limit: a bit more than you usually leak")}</span>`,
};

// ---------- atajos y botón seguir ----------
function pintarAtajos() {
  const l = seguidos.lista(), actual = ultimo?.jugador.tag.replace("#", "");
  $("atajos").hidden = l.length === 0;
  $("atajos").innerHTML = l.map((s) => `<button type="button" data-tag="${s.tag}"${s.tag === actual ? ' aria-current="true"' : ""}>${s.nombre}</button>`).join("");
  $("atajos").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { $("tag").value = `#${b.dataset.tag}`; buscar(b.dataset.tag); }));
}
function pintarBotonSeguir() {
  const sigo = ultimo && seguidos.sigo(ultimo.jugador.tag);
  $("botonSeguir").setAttribute("aria-pressed", !!sigo);
  $("botonSeguir").textContent = sigo ? t("Siguiendo", "Following") : t("Seguir", "Follow");
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
  if (m.limite !== null)
    $("detalleLimite").textContent = t(`Tu media en estas partidas es ${m.mediaElixir.toFixed(1)}. El límite es tu media más 1 punto: ${m.limite.toFixed(1)}.`, `Your average in these matches is ${m.mediaElixir.toFixed(1)}. Your limit is your average plus 1: ${m.limite.toFixed(1)}.`);
  graficaTendencia = tendencia($("graficaTendencia"), m, vista, graficaTendencia);
  $("franjas").innerHTML = franjasVisibles(m).map((f) => `<li class="chip ${f.tipo}">${f.texto}</li>`).join("");
}

function pintar(data) {
  ultimo = data;
  m = modelo(data);
  const j = data.jugador;
  $("nombre").textContent = j.nombre;
  $("detalleJugador").textContent = [j.clan, j.liga ? `${t("Liga", "League")} ${j.liga}` : null, j.mejor_liga ? `${t("mejor liga", "best league")} ${j.mejor_liga}` : null].filter(Boolean).join(", ");
  $("estadoTitulo").textContent = m.estado.titulo;
  $("estadoTexto").textContent = m.estado.texto;
  $("estado").dataset.tono = m.estado.tono;
  $("resumenPartidas").textContent = data.resumen.partidas;
  $("resumenWinrate").textContent = data.resumen.winrate === null ? "–" : `${data.resumen.winrate} %`;
  $("resumenElixir").textContent = data.resumen.elixir_desperdiciado ?? "–";
  $("notaApi").textContent = data.seguido
    ? t(`Historial guardado: ${data.resumen.partidas} partidas.`, `Saved history: ${data.resumen.partidas} matches.`)
    : t("La API solo conserva las últimas ~30 partidas de cada jugador.", "The API only keeps each player’s last ~30 matches.");
  $("resultado").hidden = false;
  pintarBotonSeguir(); pintarAtajos();
  partidas($("listaPartidas"), $("verMas"), m.ps);
  graficasListas = false;
  if (vistaActual === "estadisticas") pintarGraficas();
}

function pintarGraficas() {
  if (graficasListas || !m) return;
  pintarTendencia();
  graficaCoronas = coronas($("graficaCoronas"), m, graficaCoronas);
  reloj({ svg: $("reloj"), botonAM: $("botonAM"), botonPM: $("botonPM"), detalle: $("detalleHora") }, m.horas);
  graficasListas = true;
}

function verPestana(cual) {
  vistaActual = cual;
  const p = cual === "partidas";
  $("tabPartidas").setAttribute("aria-pressed", p); $("tabPartidas").setAttribute("aria-selected", p);
  $("tabEstadisticas").setAttribute("aria-pressed", !p); $("tabEstadisticas").setAttribute("aria-selected", !p);
  $("vistaPartidas").hidden = !p; $("vistaEstadisticas").hidden = p;
  if (!p) {
    $("tabEstadisticas").classList.remove("brillo");
    try { localStorage.setItem("elixirVioEstadisticas", "1"); } catch (e) {}
    pintarGraficas();
  }
}

async function buscar(tag, { silencioso = false } = {}) {
  const limpio = String(tag).trim();
  if (!limpio) return;
  if (!silencioso) { $("error").hidden = true; $("buscar").disabled = true; $("buscar").textContent = t("Consultando…", "Looking up…"); cerrarPanel(); }
  try {
    const data = await consultar(limpio);
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
try { if (!localStorage.getItem("elixirVioEstadisticas")) $("tabEstadisticas").classList.add("brillo"); } catch (e) {}
$("vistaRacha").addEventListener("click", () => { vista = "racha"; pintarTendencia(); });
$("vistaElixir").addEventListener("click", () => { vista = "elixir"; pintarTendencia(); });
$("botonSeguir").addEventListener("click", pedirSeguir);
$("panelCerrar").addEventListener("click", cerrarPanel);

aplicar();
$("idioma").textContent = LANG === "en" ? "ES" : "EN";
$("idioma").addEventListener("click", alternar);
pintarAtajos();
seguidos.renovarTodos();

// tag desde la dirección (?tag=) o el último consultado
const inicial = new URLSearchParams(location.search).get("tag") || (() => { try { return localStorage.getItem("elixirLabTag"); } catch (e) { return null; } })();
if (inicial) { $("tag").value = inicial.startsWith("#") ? inicial : `#${inicial}`; buscar(inicial); }

matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { graficasListas = false; ultimo && pintar(ultimo); });
