import { t } from "./i18n.js?v=15";
// Cálculos de la página del jugador. Sin dibujo: solo datos.

export const VENTANA = 10;        // partidas para la tendencia
export const SESION_MIN = 45;     // minutos entre partidas para seguir en la misma sesión
export const RACHA_MALA = 3;      // derrotas seguidas para marcar una franja
export const RACHA_BUENA = 5;     // victorias seguidas para marcar una franja
export const DESCONEXION = 8.5;   // elixir perdido a partir del cual sospechamos desconexión

// "20261021T224500.000Z" → Date
export function fecha(s) {
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
}

const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pad = (n) => String(n).padStart(2, "0");
export const dia = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
export const hora = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Eventos especiales (p. ej. Tormenta perfecta): llegan como "trail", pero su modo empieza por "Event_".
// Se juegan con un mazo del evento, así que no cuentan en las estadísticas del jugador.
export const esEvento = (p) => typeof p.evento === "string" && p.evento.startsWith("Event_");

// Partidas en orden cronológico, con lo que necesitan las gráficas
export function preparar(data) {
  const ps = [...data.partidas].reverse().map((p) => {
    const [mias, suyas] = p.coronas.split("-").map(Number);
    return { ...p, t: fecha(p.hora), dif: mias - suyas };
  });
  // marcar sesiones: más de SESION_MIN minutos sin jugar empieza una nueva
  let s = 0;
  ps.forEach((p, i) => {
    if (i > 0 && (p.t - ps[i - 1].t) / 60000 > SESION_MIN) s++;
    p.sesion = s;
    p.desconexion = !p.victoria && (p.elixir_desperdiciado ?? 0) >= DESCONEXION;
  });
  return ps;
}

// Media móvil de una lista (null se ignora)
// Con menos de MIN_MUESTRA valores en la ventana devuelve null, para no empezar con picos engañosos
export const MIN_MUESTRA = 5;
export function movil(xs, w = VENTANA) {
  return xs.map((_, i) => {
    const vals = xs.slice(Math.max(0, i - w + 1), i + 1).filter((x) => x !== null);
    return vals.length >= MIN_MUESTRA ? media(vals) : null;
  });
}

// Grupos del filtro: Ranked = solo camino de leyendas; los eventos especiales van en Otros
export const GRUPOS = ["todos", "ranked", "escalera", "guerra", "otros", "eventos"];
export function grupoDe(p) {
  if (esEvento(p)) return "eventos";
  if (p.modo === "pathOfLegend") return "ranked";
  if (p.modo === "trail" || p.modo === "ladder") return "escalera";
  if (typeof p.modo === "string" && p.modo.startsWith("riverRace")) return "guerra";
  return "otros";
}
// Devuelve los datos solo con las partidas del grupo elegido (todo lo demás se recalcula desde ahí)
export function filtrarModo(data, grupo) {
  if (!grupo || grupo === "todos") return data;
  return { ...data, partidas: data.partidas.filter((p) => grupoDe(p) === grupo) };
}

export function modelo(data, mio = true) {
  const todas = preparar(data);
  // las estadísticas salen de lo que haya en el filtro: Todos mezcla todo (también eventos)
  const ps = todas;
  const ganadas = ps.filter((p) => p.victoria).length;
  const elx = ps.map((p) => p.elixir_desperdiciado).filter((x) => x !== null);
  const resumen = {
    partidas: ps.length, eventos: ps.filter(esEvento).length,
    winrate: ps.length ? Math.round((100 * ganadas) / ps.length) : null,
    elixir_desperdiciado: elx.length ? Math.round((100 * elx.reduce((a, b) => a + b, 0)) / elx.length) / 100 : null,
  };
  const validas = ps.filter((p) => !p.desconexion);
  const elixires = validas.map((p) => p.elixir_desperdiciado).filter((x) => x !== null);
  const mediaElixir = media(elixires);
  const limite = mediaElixir !== null ? mediaElixir + 1 : null;

  const winrate = movil(ps.map((p) => (p.victoria ? 100 : 0)));
  const elixir = movil(ps.map((p) => (p.desconexion ? null : p.elixir_desperdiciado)));

  // franjas: derrotas seguidas en una sesión, victorias seguidas en cualquier momento
  const franjas = [];
  let i = 0;
  while (i < ps.length) {
    let j = i;
    const gana = ps[i].victoria;
    while (j + 1 < ps.length && ps[j + 1].victoria === gana && (gana || ps[j + 1].sesion === ps[i].sesion)) j++;
    const n = j - i + 1;
    if (!gana && n >= RACHA_MALA) {
      const e = media(ps.slice(i, j + 1).map((p) => p.elixir_desperdiciado).filter((x) => x !== null));
      franjas.push({ desde: i, hasta: j, tipo: limite !== null && e > limite ? "tilt" : "mala" });
    }
    if (gana && n >= RACHA_BUENA) franjas.push({ desde: i, hasta: j, tipo: "buena" });
    i = j + 1;
  }

  return { ps, todas, resumen, winrate, elixir, mediaElixir, limite, franjas, estado: estado(ps, mio), horas: porHora(validas) };
}

// Mensaje principal: titular corto, consejo y porcentaje para la barra de elixir.
// mio = true si es el perfil fijado: entonces se habla de "tú"; si no, en tono neutro.
export function estado(ps, mio = true, ahora = new Date()) {
  const X = (tuEs, elEs, tuEn, elEn) => t(mio ? tuEs : elEs, mio ? tuEn : elEn);
  if (ps.length < 6) return { tono: "neutro", lleno: 0, titulo: t("Pocas partidas", "Few matches"), texto: t("Aún hay pocas partidas para leer la racha.", "Not enough matches yet to read the streak.") };
  const ult = ps.slice(-VENTANA);
  const ganadas = ult.filter((p) => p.victoria).length;
  const wrUlt = (100 * ganadas) / ult.length;
  const wrTotal = (100 * ps.filter((p) => p.victoria).length) / ps.length;
  const min = (ahora - ps[ps.length - 1].t) / 60000;
  let derrotasFinal = 0;
  for (let k = ps.length - 1; k >= 0 && !ps[k].victoria; k--) derrotasFinal++;
  const enSesion = min < SESION_MIN, descansado = min > 120;
  const marcador = t(`${ganadas} de ${ult.length}`, `${ganadas} of ${ult.length}`);
  const base = { lleno: Math.round(wrUlt) };

  if (derrotasFinal >= 3 || wrUlt <= wrTotal - 10) {
    const titulo = t(`Racha difícil · ${marcador}`, `Rough streak · ${marcador}`);
    if (enSesion) return { ...base, tono: "alerta", titulo, texto: X("Buen momento para una pausa.", "Viene de varias derrotas seguidas.", "Good time for a break.", "Several losses in a row.") };
    if (descansado) return { ...base, tono: "aviso", titulo, texto: X("Ya descansaste: buen momento para remontar.", "Pasó un rato desde su última partida.", "You’re rested: a good time to bounce back.", "Some time has passed since the last match.") };
    return { ...base, tono: "aviso", titulo, texto: X("Juega cuando estés descansado.", "Por debajo de su nivel habitual.", "Play when you’re rested.", "Below the usual level.") };
  }
  if (wrUlt >= wrTotal + 10 || ganadas >= 7) {
    if (enSesion) return { ...base, tono: "bien", titulo: t(`En racha · ${marcador}`, `On a roll · ${marcador}`), texto: X("Aprovéchala, pero para si llegan 3 derrotas.", "Está ganando la mayoría de sus partidas.", "Make the most of it, but stop after 3 losses.", "Winning most of the recent matches.") };
    return { ...base, tono: "bien", titulo: t(`Buena racha · ${marcador}`, `Good streak · ${marcador}`), texto: X("Vienes en buena forma.", "Viene en buena forma.", "You’re in good form.", "In good form.") };
  }
  return { ...base, tono: "neutro", titulo: t(`Racha estable · ${marcador}`, `Steady streak · ${marcador}`), texto: X("Vas en tu nivel habitual.", "En su nivel habitual.", "You’re at your usual level.", "At the usual level.") };
}

// Winrate y elixir por hora local
export function porHora(ps) {
  const h = {};
  for (const p of ps) {
    const k = p.t.getHours();
    h[k] ??= { n: 0, v: 0, e: [] };
    h[k].n++; if (p.victoria) h[k].v++;
    if (p.elixir_desperdiciado !== null) h[k].e.push(p.elixir_desperdiciado);
  }
  let mejor = null;
  for (const [k, x] of Object.entries(h)) {
    x.wr = Math.round((100 * x.v) / x.n);
    x.elixir = media(x.e);
    if (x.n >= 5 && (!mejor || x.wr > h[mejor].wr || (x.wr === h[mejor].wr && x.n > h[mejor].n))) mejor = k;
  }
  return { porHora: h, mejor: mejor === null ? null : +mejor };
}
