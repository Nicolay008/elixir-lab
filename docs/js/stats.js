import { t } from "./i18n.js?v=53";
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

function stddev(xs) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
}
const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pad = (n) => String(n).padStart(2, "0");
export const dia = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
export const hora = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Eventos especiales (p. ej. Tormenta perfecta): llegan como "trail", pero su modo empieza por "Event_".
// Se juegan con un mazo del evento, así que no cuentan en las estadísticas del jugador.
export const esEvento = (p) => typeof p.evento === "string" && p.evento.startsWith("Event_");
export const esDesafio = (p) => typeof p.evento === "string" && p.evento.startsWith("Challenge_");

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
    p.rendicion = !p.victoria && (p.elixir_desperdiciado ?? 0) >= 15 && p.coronas === "0-3";
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
export const GRUPOS = ["todos", "ranked", "escalera", "guerra", "otros", "eventos", "desafio"];
export function grupoDe(p) {
  if (esDesafio(p)) return "desafio";
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
  const elx = ps.filter((p) => !p.rendicion).map((p) => p.elixir_desperdiciado).filter((x) => x !== null);
  const rendiciones = ps.filter((p) => p.rendicion).length;
  const resumen = {
    partidas: ps.length, eventos: ps.filter(esEvento).length, rendiciones,
    winrate: ps.length ? Math.round((100 * ganadas) / ps.length) : null,
    elixir_desperdiciado: elx.length ? Math.round((100 * elx.reduce((a, b) => a + b, 0)) / elx.length) / 100 : null,
  };
  const validas = ps.filter((p) => !p.desconexion);
  const elixires = validas.map((p) => p.elixir_desperdiciado).filter((x) => x !== null);
  const mediaElixir = media(elixires);
  // elixir separado por resultado: ayuda a saber si el problema es de gestión o de derrotas
  const elxVic = validas.filter((p) => p.victoria).map((p) => p.elixir_desperdiciado).filter((x) => x !== null);
  const elxDer = validas.filter((p) => !p.victoria).map((p) => p.elixir_desperdiciado).filter((x) => x !== null);
  const elixirVictorias = media(elxVic);
  const elixirDerrotas = media(elxDer);
  // tendencia del elixir: pendiente de regresión lineal sobre las últimas partidas válidas
  const elxTendencia = (() => {
    const vals = validas.map((p) => p.elixir_desperdiciado).filter((x) => x !== null);
    if (vals.length < 10) return null;
    const n = vals.length, sx = n * (n - 1) / 2, sx2 = n * (n - 1) * (2 * n - 1) / 6;
    const sy = vals.reduce((a, b) => a + b, 0), sxy = vals.reduce((a, v, i) => a + i * v, 0);
    return (n * sxy - sx * sy) / (n * sx2 - sx * sx);
  })();

  // umbral de tilt basado en el propio jugador: mediana + 1.5 × IQR
  // un +1 fijo no distingue entre un jugador controlado (2.3) y uno suelto (6.5)
  const sorted = [...elixires].sort((a, b) => a - b);
  const q1 = sorted.length >= 4 ? sorted[Math.floor(sorted.length * 0.25)] : null;
  const q3 = sorted.length >= 4 ? sorted[Math.floor(sorted.length * 0.75)] : null;
  const mediana = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  const iqr = q1 !== null ? q3 - q1 : null;
  const limite = mediana !== null && iqr !== null ? mediana + 1.5 * iqr : (mediaElixir !== null ? mediaElixir + 1 : null);

  const winrate = movil(ps.map((p) => (p.victoria ? 100 : 0)));
  const elixir = movil(ps.map((p) => (p.desconexion || p.rendicion ? null : p.elixir_desperdiciado)));

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

  // tasa de partidas cerradas (diferencia de 1 corona en la derrota)
  const derrotas = ps.filter((p) => !p.victoria && !p.rendicion);
  const cerradas = derrotas.filter((p) => { const [m, s] = p.coronas.split("-").map(Number); return Math.abs(m - s) <= 1; });
  const tasaCerrada = derrotas.length >= 3 ? Math.round((100 * cerradas.length) / derrotas.length) : null;

  // winrate por posición en la sesión
  const porPosicion = {};
  const contSesion = {};
  for (const p of ps) {
    contSesion[p.sesion] = (contSesion[p.sesion] ?? 0) + 1;
    const pos = contSesion[p.sesion];
    const grupo = pos <= 3 ? "1-3" : pos <= 6 ? "4-6" : pos <= 10 ? "7-10" : "11+";
    porPosicion[grupo] ??= { n: 0, v: 0 };
    porPosicion[grupo].n++;
    if (p.victoria) porPosicion[grupo].v++;
  }
  for (const g of Object.values(porPosicion)) g.wr = g.n >= 3 ? Math.round((100 * g.v) / g.n) : null;

  // cambio de mazo tras 3+ derrotas seguidas
  let cambiosTrasRacha = 0, rachasTotales = 0;
  for (let k = 2; k < ps.length; k++) {
    if (!ps[k - 1].victoria && !ps[k - 2].victoria && (k < 3 || !ps[k - 3].victoria || k === 2)) {
      // empieza una racha de 3+ en k-2
    } else if (!ps[k].victoria && !ps[k - 1].victoria && !ps[k - 2].victoria) {
      // en medio de racha, solo contar si hay partida siguiente
    } else continue;
    // buscar el final de la racha
    let fin = k;
    while (fin + 1 < ps.length && !ps[fin + 1].victoria) fin++;
    if (fin + 1 < ps.length) {
      rachasTotales++;
      if (ps[fin + 1].mazo !== ps[fin].mazo) cambiosTrasRacha++;
    }
    k = fin + 1; // saltar al final
  }
  const pctCambioMazo = rachasTotales >= 2 ? Math.round((100 * cambiosTrasRacha) / rachasTotales) : null;

  // calificación de mazos: winrate, control de elixir, consistencia, resistencia al cierre, cobertura
  const porMazo = {};
  for (const p of ps) { (porMazo[p.mazo] ??= []).push(p); }
  const mazosCalif = Object.entries(porMazo)
    .filter(([, arr]) => arr.length >= 5)
    .map(([mazo, arr]) => {
      const n = arr.length;
      const vic = arr.filter((p) => p.victoria).length;
      const wr = Math.round((100 * vic) / n);

      // intervalo de confianza Wilson 95 %
      const z = 1.96, phat = vic / n;
      const den = 1 + z * z / n;
      const centro = (phat + z * z / (2 * n)) / den;
      const margen = (z * Math.sqrt(phat * (1 - phat) / n + z * z / (4 * n * n))) / den;
      const ic = [Math.round(100 * Math.max(0, centro - margen)), Math.round(100 * Math.min(1, centro + margen))];

      // control de elixir (normalizado por costo promedio si se conoce)
      const elxArr = arr.map((p) => p.elixir_desperdiciado).filter((x) => x !== null);
      const elxMedia = elxArr.length ? elxArr.reduce((a, b) => a + b, 0) / elxArr.length : null;

      // consistencia: desviación del winrate en bloques de 10
      const bloques = [];
      for (let i = 0; i + 9 < n; i += 10) {
        const bl = arr.slice(i, i + 10);
        bloques.push(bl.filter((p) => p.victoria).length / bl.length);
      }
      const consis = bloques.length >= 2
        ? 1 - Math.min(1, stddev(bloques) * 2)
        : null;

      // resistencia al cierre: % de derrotas que fueron por 1 corona
      const derrotas = arr.filter((p) => !p.victoria && !p.rendicion);
      const cerradas = derrotas.filter((p) => {
        const [a, b] = p.coronas.split("-").map(Number);
        return Math.abs(a - b) <= 1;
      });
      const resCierre = derrotas.length >= 3 ? cerradas.length / derrotas.length : null;

      // cobertura: contra cuántos mazos rivales distintos gana más del 50 %
      const vsRival = {};
      for (const p of arr) {
        const riv = (p.mazo_rival ?? []).sort().join(",");
        if (riv) { vsRival[riv] ??= { n: 0, v: 0 }; vsRival[riv].n++; if (p.victoria) vsRival[riv].v++; }
      }
      const rivales5 = Object.values(vsRival).filter((x) => x.n >= 2);
      const cobertura = rivales5.length >= 3
        ? rivales5.filter((x) => x.v / x.n > 0.5).length / rivales5.length
        : null;

      // nota compuesta (1-10): pesos wr 35%, elixir 25%, consistencia 20%, cierre 10%, cobertura 10%
      const nWr = wr / 100;
      const nElx = elxMedia !== null ? Math.max(0, 1 - elxMedia / 10) : 0.5;
      const nCon = consis ?? 0.5;
      const nCie = resCierre ?? 0.5;
      const nCob = cobertura ?? 0.5;
      const nota = Math.round((nWr * 0.35 + nElx * 0.25 + nCon * 0.20 + nCie * 0.10 + nCob * 0.10) * 10 * 10) / 10;
      const letra = nota >= 8.5 ? "S" : nota >= 7 ? "A" : nota >= 5.5 ? "B" : nota >= 4 ? "C" : "D";

      return {
        mazo, cartas: arr[0].mi_mazo, n, wr, ic, elxMedia: elxMedia !== null ? Math.round(elxMedia * 10) / 10 : null,
        consistencia: consis !== null ? Math.round(consis * 100) : null,
        resCierre: resCierre !== null ? Math.round(resCierre * 100) : null,
        cobertura: cobertura !== null ? Math.round(cobertura * 100) : null,
        nota, letra,
      };
    })
    .sort((a, b) => b.nota - a.nota);

  // pesadillas y fortalezas: cartas del rival con más partidas, ordenadas por winrate
  const cuentaCartas = {};
  for (const p of ps) for (const c of (p.mazo_rival ?? [])) {
    const base = c.replace(/ \((Evo|Héroe)\)$/, "");
    cuentaCartas[base] ??= { n: 0, v: 0 };
    cuentaCartas[base].n++;
    if (p.victoria) cuentaCartas[base].v++;
  }
  const maxFrec = Math.max(1, ...Object.values(cuentaCartas).map((x) => x.n));
  const matchups = Object.entries(cuentaCartas)
    .filter(([, x]) => x.n >= 5)
    .map(([carta, x]) => ({ carta, partidas: x.n, wr: Math.round((100 * x.v) / x.n), calor: x.n / maxFrec }))
    .sort((a, b) => a.wr - b.wr);
  const pesadillas = matchups.filter((x) => x.wr < 45).slice(0, 8);
  const fortalezas = matchups.filter((x) => x.wr > 55).sort((a, b) => b.wr - a.wr).slice(0, 8);

  return { ps, todas, resumen, winrate, elixir, mediaElixir, mediana, iqr, limite, elixirVictorias, elixirDerrotas, elxTendencia, franjas, tasaCerrada, porPosicion, pctCambioMazo, pesadillas, fortalezas, mazosCalif, estado: estado(ps, mio), horas: porHora(validas) };
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
