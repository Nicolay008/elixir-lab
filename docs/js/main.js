// Une el buscador, la consulta y el dibujo de la página del jugador.
import { consultar } from "./api.js";
import { modelo } from "./stats.js";
import { tendencia, coronas, franjasVisibles } from "./charts.js";
import { reloj } from "./clock.js";

const $ = (id) => document.getElementById(id);
let m = null, ultimo = null, vista = "racha", graficaTendencia = null, graficaCoronas = null;

const leyendas = {
  racha: () => `<span><span class="punto lleno"></span>Victoria</span><span><span class="punto hueco"></span>Derrota</span><span><span class="raya"></span>50 %: ni subes ni bajas</span>`,
  elixir: () => `<span><span class="punto lleno"></span>Victoria</span><span><span class="punto hueco"></span>Derrota</span><span><span class="raya"></span>Tu límite: algo más de lo que sueles perder</span>`,
};

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
  $("resultado").hidden = false;
  pintarTendencia();
  graficaCoronas = coronas($("graficaCoronas"), m, graficaCoronas);
  reloj({ svg: $("reloj"), botonAM: $("botonAM"), botonPM: $("botonPM"), detalle: $("detalleHora") }, m.horas);
}

async function buscar(tag) {
  const limpio = tag.trim();
  if (!limpio) return;
  $("error").hidden = true;
  $("buscar").disabled = true; $("buscar").textContent = "Consultando…";
  try {
    const data = await consultar(limpio);
    pintar(data);
    history.replaceState(null, "", `?tag=${encodeURIComponent(data.jugador.tag.replace("#", ""))}`);
    try { localStorage.setItem("elixirLabTag", data.jugador.tag); } catch (e) {}
  } catch (err) {
    $("error").textContent = err.message; $("error").hidden = false;
  } finally {
    $("buscar").disabled = false; $("buscar").textContent = "Consultar";
  }
}

$("formulario").addEventListener("submit", (e) => { e.preventDefault(); buscar($("tag").value); });
$("vistaRacha").addEventListener("click", () => { vista = "racha"; pintarTendencia(); });
$("vistaElixir").addEventListener("click", () => { vista = "elixir"; pintarTendencia(); });

// tag desde la dirección (?tag=) o el último consultado
const inicial = new URLSearchParams(location.search).get("tag") || (() => { try { return localStorage.getItem("elixirLabTag"); } catch (e) { return null; } })();
if (inicial) { $("tag").value = inicial.startsWith("#") ? inicial : `#${inicial}`; buscar(inicial); }

// al cambiar entre modo claro y oscuro, redibujar con los colores nuevos
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => ultimo && pintar(ultimo));
