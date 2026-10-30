import { iniciarBarra } from './barra.js?v=67';
import { t } from './i18n.js?v=67';

const PASO = 25;   // filas por vez
// copiar: portapapeles. Copiar en el juego: en el móvil abre el juego en la misma pestaña (el enlace caduca); en PC, en otra pestaña, donde el juego muestra el QR
const TACTIL = matchMedia('(pointer: coarse)').matches;
const COPIAR_ICONO = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const ABRIR_ICONO = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>`;
const OK_ICONO = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4 9-9"/></svg>`;
const SB = 'https://jbhftetfnrdestjzrhgs.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiaGZ0ZXRmbnJkZXN0anpyaGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNzU1ODQsImV4cCI6MjEwNzg1MTU4NH0.k__1Vy8l7-pqemokwBCkrGeX-aOTJUz4-Tv0yz06dSo';
const LOCATIONS = { pe: 57000184, global: 0 };
const LIMITE_MAZOS = { pe: 50, global: 100 };

let nombresES = null;
let cartasExtra = null;

async function sb(path) {
  const r = await fetch(`${SB}${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}

async function cargarNombres() {
  if (!nombresES) {
    const [nombres, extra] = await Promise.all([
      fetch('nombres_es.json').then(r => r.json()),
      fetch('cards_extra.json').then(r => r.json()),
    ]);
    nombresES = nombres;
    cartasExtra = Object.fromEntries(extra.map(c => [c.nombre_en, c.nombre]));
  }
  return nombresES;
}

function nombreES(carta) {
  return nombresES?.[carta.name] ?? cartasExtra?.[carta.name] ?? carta.name;
}

function imagenCarta(carta) {
  const u = carta.iconUrls ?? {};
  if (carta.evolutionLevel === 1 && u.evolutionMedium) return u.evolutionMedium;
  if (carta.evolutionLevel === 2 && u.heroMedium) return u.heroMedium;
  return u.medium;
}

function enlaceMazo(deck) {
  const ids = deck.map(c => c.id).join(';');
  return `https://link.clashroyale.com/es/?clashroyale://copyDeck?deck=${ids}&l=Royale%20Mobile`;
}

function antiguedad(partidaAt) {
  if (!partidaAt) return '';
  const dias = Math.floor((Date.now() - new Date(partidaAt)) / 86400000);
  // días desde la última partida del jugador (no es la antigüedad de los datos)
  if (dias === 0) return t('Jugó hoy', 'Played today');
  if (dias === 1) return t('Jugó ayer', 'Played yesterday');
  return t(`Última partida hace ${dias} días`, `Last match ${dias} days ago`);
}

async function ultimaFoto(locationId) {
  const [f] = await sb(
    `/rest/v1/raw_ranking_snapshots?select=snapshot_at&location_id=eq.${locationId}&order=snapshot_at.desc&limit=1`
  );
  return f?.snapshot_at ?? null;
}

async function cargarMazos(ambito) {
  const loc = LOCATIONS[ambito];
  const [ultima] = await sb(
    `/rest/v1/top_decks?select=snapshot_at&location_id=eq.${loc}&order=snapshot_at.desc&limit=1`
  );
  if (!ultima?.snapshot_at) return [];
  return sb(
    `/rest/v1/top_decks?select=puesto,tag,nombre,rating,deck,partida_at,fuente&location_id=eq.${loc}&snapshot_at=eq.${encodeURIComponent(ultima.snapshot_at)}&order=puesto.asc&limit=${LIMITE_MAZOS[ambito]}`
  );
}

async function cargarRanking(ambito) {
  const loc = LOCATIONS[ambito];
  const snap = await ultimaFoto(loc);
  if (!snap) return { snap: null, filas: [], mazos: [] };
  const filas = await sb(
    `/rest/v1/v_ranking_movimiento?location_id=eq.${loc}&snapshot_at=eq.${encodeURIComponent(snap)}&order=puesto.asc&limit=100`
  );
  const mazos = await cargarMazos(ambito);
  return { snap, filas, mazos };
}

function pintarMovimiento(cambio) {
  if (cambio > 0) return `<span class="sube">▲ ${cambio}</span>`;
  if (cambio < 0) return `<span class="baja">▼ ${Math.abs(cambio)}</span>`;
  return '';
}

function costeMedio(deck) {
  const con = deck.filter(c => c.elixirCost != null);
  if (!con.length) return '?';
  return (con.reduce((s, c) => s + c.elixirCost, 0) / con.length).toFixed(1);
}

function renderMazo(m) {
  const deck = typeof m.deck === 'string' ? JSON.parse(m.deck) : m.deck;
  const enlace = enlaceMazo(deck);
  return `
    <article class="mazo-card">
      <div class="mazo-meta">
        <span class="mazo-antiguedad">${antiguedad(m.partida_at)}</span>
        <span class="mazo-coste">💧 ${costeMedio(deck)}</span>
        <button type="button" class="mazo-copiar" data-enlace="${enlace}" title="Copiar mazo" aria-label="Copiar mazo">${COPIAR_ICONO}</button>
        <a class="mazo-juego" href="${enlace}"${TACTIL ? '' : ' target="_blank" rel="noopener"'}>${ABRIR_ICONO}<span>Copiar en el juego</span></a>
      </div>
      <div class="cartas">
        ${deck.map(c => `<figure><img src="${imagenCarta(c)}" alt="${nombreES(c)}" loading="lazy"></figure>`).join('')}
      </div>
    </article>`;
}

// medalla tenue junto al rating (son las medallas de Senda de Leyendas)
const ICONO_MEDALLA = '<svg class="ranking-medalla" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.6 13.2 L7 21 L12 19 L17 21 L15.4 13.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

function renderFilas(filas, mazosPorTag) {
  return filas.map(f => {
    const fila = `
    <div class="ranking-fila${f.puesto <= 3 ? ` top${f.puesto}` : ''}">
      <span class="ranking-puesto">${f.puesto}</span>
      <span class="ranking-mov">${pintarMovimiento(f.cambio)}</span>
      <span class="ranking-jugador"><a href="jugador.html?tag=${encodeURIComponent(f.tag)}">${f.nombre}</a></span>
      <span class="ranking-rating">${f.rating}${ICONO_MEDALLA}</span>
      <span class="ranking-clan" title="${f.motivo ?? ''}">${f.clan ?? ''}</span>
    </div>`;
    const m = mazosPorTag[f.tag];
    return m
      ? fila + `<div class="ranking-mazo">${renderMazo(m)}</div>`
      : fila;
  }).join('');
}

document.addEventListener('click', async e => {
  const btn = e.target.closest('button[data-enlace]');
  if (!btn) return;
  await navigator.clipboard.writeText(btn.dataset.enlace);
  const orig = btn.innerHTML;
  btn.classList.add('copiado');
  btn.innerHTML = OK_ICONO;
  setTimeout(() => { btn.classList.remove('copiado'); btn.innerHTML = orig; }, 1500);
});

async function iniciar(ambito = 'global') {
  await cargarNombres();
  const { snap, filas, mazos } = await cargarRanking(ambito);
  const mazosPorTag = Object.fromEntries(mazos.map(m => [m.tag, m]));
  document.getElementById('foto').textContent = snap
    ? new Date(snap).toLocaleString('es-PE', { timeZone: 'America/Lima' })
    : 'Sin datos';
  filasActuales = filas; mazosActuales = mazosPorTag; mostrar = PASO;
  pintarTabla();
}

let filasActuales = [], mazosActuales = {}, mostrar = PASO;
function pintarTabla() {
  const visibles = filasActuales.slice(0, mostrar);
  document.getElementById('tabla-ranking').innerHTML = renderFilas(visibles, mazosActuales);
  document.getElementById('contador').textContent = t(
    `Mostrando ${visibles.length} de ${filasActuales.length}`,
    `Showing ${visibles.length} of ${filasActuales.length}`);
  document.getElementById('verMasRanking').hidden = visibles.length >= filasActuales.length;
}
document.getElementById('verMasRanking').addEventListener('click', () => { mostrar += PASO; pintarTabla(); });
iniciarBarra();

document.querySelectorAll('[data-ambito]').forEach(b =>
  b.addEventListener('click', () => {
    document.querySelectorAll('[data-ambito]').forEach(x => {
      x.setAttribute('aria-pressed', 'false');
      x.setAttribute('aria-selected', 'false');
    });
    b.setAttribute('aria-pressed', 'true');
    b.setAttribute('aria-selected', 'true');
    iniciar(b.dataset.ambito);
  })
);
iniciar('global');