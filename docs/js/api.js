// Llamadas a las funciones de Supabase.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js?v=63";

const cabeceras = { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" };

export async function consultar(tag) {
  const url = `${SUPABASE_URL}/functions/v1/consultar?tag=${encodeURIComponent(tag)}`;
  const r = await fetch(url, { headers: cabeceras });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "No se pudo consultar ese tag. Prueba en un momento.");
  return data;
}

// token: el de Turnstile (solo para un tag nuevo); renovar: true para renovar sin captcha
export async function seguir(tag, { token = null, renovar = false } = {}) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/seguir`, {
    method: "POST", headers: cabeceras, body: JSON.stringify({ tag, token, renovar }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "No se pudo seguir a este jugador. Prueba en un momento.");
  return data;
}
