// Une el buscador, la consulta, los seguidos y el dibujo de la página del jugador.
import { consultar, seguir } from "./api.js";
import { modelo } from "./stats.js";
import { tendencia, coronas, franjasVisibles } from "./charts.js";
import { reloj } from "./clock.js";
import { TURNSTILE_SITE_KEY, MAX_SEGUIDOS } from "./config.js";
import * as seguidos from "./seguidos.js";

const $ = (id) => document.getElementById(id);
let m = null, ultimo = null, vista = "racha", graficaTendencia = null, graficaCoronas = null, captchaId = null;

const leyendas = {
  racha: () => `<span><span class="punto lleno"></span>Victoria</span><span><span class="punto hueco"></span>Derrota</span><span><span class="raya"></span>50 %: ni subes ni bajas</span>`,
  elixir: () => `<span><span class="punto lleno"></span>Victoria</span><span><span class="punto hueco"></span>Derrota</span><span><span class="raya"></span>Tu límite: algo más de lo que sueles perder</span>`,
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
  $("botonSeguir").textContent = sigo ? "Siguiendo" : "Seguir";
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
    $("panelTexto").textContent = `Ya sigues a ${MAX_SEGUIDOS} jugadores. Deja de seguir a uno para añadir a ${j.nombre}.`;
    $("panelLista").innerHTML = seguidos.lista().map((s) => `<button type="button" data-tag="${s.tag}"><span>${s.nombre}</span><span>Dejar de seguir</span></button>`).join("");
    $("panelLista").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { seguidos.quitar(b.dataset.tag); pintarAtajos(); pedirSeguir(); }));
    return;
  }
  // ya lo sigue alguien: solo renovar, sin captcha
  if (ultimo.seguido) { $("panelSeguir").hidden = true; confirmarSeguir({ renovar: true }); return; }

  // tag nuevo: aviso y filtro anti-bots
  $("panelTexto").textContent = `A partir de ahora guardaremos las partidas de ${j.nombre} para darte estadísticas fiables. Su historial será visible para quien consulte su tag.`;
  if (!window.turnstile) { errorPanel("No se pudo cargar la verificación anti-bots. Recarga la página."); return; }
  captchaId = window.turnstile.render("#captcha", {
    sitekey: TURNSTILE_SITE_KEY, language: "es",
    callback: (token) => confirmarSeguir({ token }),
    "error-callback": () => errorPanel("La verificación falló. Vuelve a intentarlo."),
  });
}

// ---------- gráficas ----------
function pintarTendencia() {
  $("vistaRacha").setAttribute("aria-pressed", vista === "racha");
  $("vistaElixir").setAttribute("aria-pressed", vista === "elixir");
  $("leyendaTendencia").innerHTML = leyendas[vista]();
  $("explicaElixir").hidden = vista !== "elixir";
  if (m.limite !== null)
    $("detalleLimite").textContent = `Tu media en estas partidas es ${m.mediaElixir.toFixed(1)}. El límite es tu media más 1 punto: ${m.limite.toFixed(1)}.`;
  graficaTendencia = tendencia($("graficaTendencia"), m, vista, graficaTendencia);
  $("franjas").innerHTML = franjasVisibles(m).map((f) => `<li class="chip ${f.tipo}">${f.texto}</li>`).join("");
}

function pintar(data) {
  ultimo = data;
  m = modelo(data);
  const j = data.jugador;
  $("nombre").textContent = j.nombre;
  $("detalleJugador").textContent = [j.clan, j.liga ? `Liga ${j.liga}` : null, j.mejor_liga ? `mejor liga ${j.mejor_liga}` : null].filter(Boolean).join(", ");
  $("estadoTitulo").textContent = m.estado.titulo;
  $("estadoTexto").textContent = m.estado.texto;
  $("estado").dataset.tono = m.estado.tono;
  $("resumenPartidas").textContent = data.resumen.partidas;
  $("resumenWinrate").textContent = data.resumen.winrate === null ? "–" : `${data.resumen.winrate} %`;
  $("resumenElixir").textContent = data.resumen.elixir_desperdiciado ?? "–";
  $("notaApi").textContent = data.nota ?? "";
  $("resultado").hidden = false;
  pintarBotonSeguir(); pintarAtajos();
  pintarTendencia();
  graficaCoronas = coronas($("graficaCoronas"), m, graficaCoronas);
  reloj({ svg: $("reloj"), botonAM: $("botonAM"), botonPM: $("botonPM"), detalle: $("detalleHora") }, m.horas);
}

async function buscar(tag, { silencioso = false } = {}) {
  const limpio = String(tag).trim();
  if (!limpio) return;
  if (!silencioso) { $("error").hidden = true; $("buscar").disabled = true; $("buscar").textContent = "Consultando…"; cerrarPanel(); }
  try {
    const data = await consultar(limpio);
    pintar(data);
    history.replaceState(null, "", `?tag=${encodeURIComponent(data.jugador.tag.replace("#", ""))}`);
    try { localStorage.setItem("elixirLabTag", data.jugador.tag); } catch (e) {}
  } catch (err) {
    if (!silencioso) { $("error").textContent = err.message; $("error").hidden = false; }
  } finally {
    $("buscar").disabled = false; $("buscar").textContent = "Consultar";
  }
}

$("formulario").addEventListener("submit", (e) => { e.preventDefault(); buscar($("tag").value); });
$("vistaRacha").addEventListener("click", () => { vista = "racha"; pintarTendencia(); });
$("vistaElixir").addEventListener("click", () => { vista = "elixir"; pintarTendencia(); });
$("botonSeguir").addEventListener("click", pedirSeguir);
$("panelCerrar").addEventListener("click", cerrarPanel);

pintarAtajos();
seguidos.renovarTodos();

// tag desde la dirección (?tag=) o el último consultado
const inicial = new URLSearchParams(location.search).get("tag") || (() => { try { return localStorage.getItem("elixirLabTag"); } catch (e) { return null; } })();
if (inicial) { $("tag").value = inicial.startsWith("#") ? inicial : `#${inicial}`; buscar(inicial); }

matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => ultimo && pintar(ultimo));
