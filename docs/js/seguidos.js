// Lista de jugadores seguidos, guardada en este navegador (sin cuenta).
import { MAX_SEGUIDOS } from "./config.js?v=32";
import { seguir } from "./api.js?v=32";

const CLAVE = "elixirLabSeguidos";
const sinAlmohadilla = (t) => t.replace(/^#/, "").toUpperCase();

export function lista() {
  try { return JSON.parse(localStorage.getItem(CLAVE)) || []; } catch (e) { return []; }
}
function guardar(l) { try { localStorage.setItem(CLAVE, JSON.stringify(l)); } catch (e) {} }

export const sigo = (tag) => lista().some((s) => s.tag === sinAlmohadilla(tag));
export const llena = () => lista().length >= MAX_SEGUIDOS;

export function anadir(tag, nombre) {
  const t = sinAlmohadilla(tag), l = lista().filter((s) => s.tag !== t);
  l.unshift({ tag: t, nombre, renovado: Date.now() });
  guardar(l.slice(0, MAX_SEGUIDOS));
}
export function quitar(tag) { guardar(lista().filter((s) => s.tag !== sinAlmohadilla(tag))); }

// Renueva en el servidor, como mucho una vez al día, los tags que sigues.
// Si nadie renueva un tag en 30 días, se deja de descargar.
export async function renovarTodos() {
  const dia = 24 * 3600 * 1000, l = lista();
  for (const s of l) {
    if (Date.now() - (s.renovado || 0) < dia) continue;
    try { await seguir(s.tag, { renovar: true }); s.renovado = Date.now(); }
    catch (e) { /* si ya no se sigue en el servidor, se volverá a registrar al pulsar Seguir */ }
  }
  guardar(l);
}

// Perfil fijado: el que más te interesa (normalmente el tuyo). Solo uno, y solo en este navegador.
const CLAVE_FIJADO = "elixirLabFijado";
export function fijado() { try { return localStorage.getItem(CLAVE_FIJADO); } catch (e) { return null; } }
export const esFijado = (tag) => fijado() === sinAlmohadilla(tag);
export function fijar(tag, nombre) {
  try { localStorage.setItem(CLAVE_FIJADO, sinAlmohadilla(tag)); } catch (e) {}
  if (!sigo(tag)) anadir(tag, nombre);
}
export function desfijar() { try { localStorage.removeItem(CLAVE_FIJADO); } catch (e) {} }

// atajos: el fijado primero, luego el resto en su orden
export function ordenados() {
  const f = fijado(), l = lista();
  return [...l.filter((s) => s.tag === f), ...l.filter((s) => s.tag !== f)];
}
