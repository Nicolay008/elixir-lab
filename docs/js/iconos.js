// Iconos de línea en dos tonos: un relleno muy suave detrás (profundidad) y el trazo delante.
// Heredan el color del texto, así que se adaptan al modo claro y oscuro.
const svg = (fondo, trazo) =>
  `<svg class="icono" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">` +
  (fondo ? `<path d="${fondo}" fill="currentColor" fill-opacity=".18" stroke="none"/>` : "") +
  `<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${trazo}</g></svg>`;

const CORONA = "M4 18h16l1-10-5 4-4-6-4 6-5-4z";
const GOTA = "M12 3.5c3 3.8 6 7.4 6 10.6a6 6 0 0 1-12 0c0-3.2 3-6.8 6-10.6z";
const COPA = "M7 4h10v5a5 5 0 0 1-10 0z";
const ESCUDO = "M15 6l6 2.5V13c0 4-2.6 6.7-6 8-3.4-1.3-6-4-6-8V8.5z";

// Escudo de la liga actual: el número va dentro; la liga más alta lleva una gema amatista en el centro.
export function escudoLiga(n, gema) {
  const forma = "M20 3 L36 8.5 V22 C36 32.5 29 39.5 20 43 C11 39.5 4 32.5 4 22 V8.5 Z";
  const centro = gema
    ? `<path d=\"M13 19.5 L20 14 L27 19.5 L20 31 Z\" style=\"fill:var(--elixir)\" stroke=\"none\"/><path d=\"M13 19.5 H27 M17 19.5 L20 14 L23 19.5 M17 19.5 L20 31 L23 19.5\" fill=\"none\" stroke=\"#fff\" stroke-opacity=\".7\" stroke-width=\"1\" stroke-linejoin=\"round\"/>`
    : `<text x=\"20\" y=\"27\" text-anchor=\"middle\" font-family=\"'Lilita One', Nunito, sans-serif\" font-size=\"15\" fill=\"currentColor\">${n}</text>`;
  return `<svg class=\"escudo\" viewBox=\"0 0 40 46\" aria-hidden=\"true\"><path d=\"${forma}\" fill=\"currentColor\" fill-opacity=\".18\" stroke=\"none\"/><path d=\"${forma}\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/>${centro}</svg>`;
}

export const ICONOS = {
  ciclo: svg("M12 4a8 8 0 1 1 0 16a8 8 0 1 1 0-16z",
    '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 20v-4h-4"/>'),
  gota: svg(GOTA, `<path d="${GOTA}"/>`),
  coronaLlena: `<svg class="icono" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="${CORONA}" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  coronaVacia: svg(CORONA, `<path d="${CORONA}"/>`),
  espadas: svg(null, '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="M9.5 17.5 21 6V3h-3L6.5 14.5"/><path d="m11 19-6-6"/><path d="m8 16-4 4"/>'),
  trofeo: svg(COPA, `<path d="M8 21h8"/><path d="M12 17v4"/><path d="${COPA}"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/>`),
  escudos: svg(ESCUDO, `<path d="M9 3 3 5.5v4.5c0 4 2.6 6.7 6 8 1.1-.4 2.1-1 3-1.8"/><path d="${ESCUDO}"/>`),
  laurel: svg(null, '<path d="M7.5 20C4.5 17.8 3 14.8 3 11.5S4.3 5.4 6.5 3.5"/><path d="M16.5 20c3-2.2 4.5-5.2 4.5-8.5s-1.3-6.1-3.5-8"/><path d="M4.2 8.2c1.6.1 2.8 1 3.3 2.4"/><path d="M3.4 12.6c1.6-.3 3 .3 3.8 1.6"/><path d="M4.8 16.6c1.5-.6 3-.3 4 .8"/><path d="M19.8 8.2c-1.6.1-2.8 1-3.3 2.4"/><path d="M20.6 12.6c-1.6-.3-3 .3-3.8 1.6"/><path d="M19.2 16.6c-1.5-.6-3-.3-4 .8"/>'),
  destello: svg("M12 7l1.6 3.4L17 12l-3.4 1.6L12 17l-1.6-3.4L7 12l3.4-1.6z", '<path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="M12 7l1.6 3.4L17 12l-3.4 1.6L12 17l-1.6-3.4L7 12l3.4-1.6z"/>'),
  chincheta: svg("M9 4h6l-1 6 3 3H7l3-3z", '<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>'),
  repetido: svg(null, '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>'),
  // amistosas: dos personas
  amistosa: svg("M9 11a3 3 0 1 0 0-6a3 3 0 1 0 0 6z", '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.5a3 3 0 0 1 0 5.5"/><path d="M18 14.5c1.8.8 3 2.9 3 5.5"/>'),
  flecha: svg(null, '<path d="m6 9 6 6 6-6"/>'),
};
