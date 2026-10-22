// Llamada a la función "consultar" de Supabase.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export async function consultar(tag) {
  const url = `${SUPABASE_URL}/functions/v1/consultar?tag=${encodeURIComponent(tag)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "No se pudo consultar ese tag. Prueba en un momento.");
  return data;
}
