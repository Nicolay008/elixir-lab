// Iconos de línea, de un solo color (heredan el color del texto). Sin emojis.
const svg = (d, extra = "") =>
  `<svg class="icono" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;

export const ICONOS = {
  // coste medio del mazo: flechas en círculo (ciclo)
  ciclo: svg('<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 20v-4h-4"/>'),
  // elixir perdido: gota de contorno
  gota: svg('<path d="M12 3.5c3 3.8 6 7.4 6 10.6a6 6 0 0 1-12 0c0-3.2 3-6.8 6-10.6z"/>'),
  // victoria / derrota
  coronaLlena: svg('<path d="M4 18h16l1-10-5 4-4-6-4 6-5-4z" fill="currentColor"/>'),
  coronaVacia: svg('<path d="M4 18h16l1-10-5 4-4-6-4 6-5-4z"/>'),
  // modos
  espadas: svg('<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="M9.5 17.5 21 6V3h-3L6.5 14.5"/><path d="m11 19-6-6"/><path d="m8 16-4 4"/>'),
  trofeo: svg('<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/>'),
  escudos: svg('<path d="M9 3 3 5.5v4.5c0 4 2.6 6.7 6 8 1.1-.4 2.1-1 3-1.8"/><path d="M15 6l6 2.5V13c0 4-2.6 6.7-6 8-3.4-1.3-6-4-6-8V8.5z"/>'),
  medalla: svg('<path d="m7 3 3 6"/><path d="m17 3-3 6"/><circle cx="12" cy="15" r="6"/><path d="m12 12.5.8 1.7 1.9.3-1.4 1.3.3 1.9-1.6-.9-1.6.9.3-1.9-1.4-1.3 1.9-.3z"/>'),
  destello: svg('<path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="m6 6 2.5 2.5"/><path d="m15.5 15.5 2.5 2.5"/><path d="m18 6-2.5 2.5"/><path d="m8.5 15.5-2.5 2.5"/>'),
};
