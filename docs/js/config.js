// Configuración pública del proyecto en Supabase.
// La clave anónima es pública por diseño: lo que protege los datos son las reglas de las tablas.
export const SUPABASE_URL = "https://jbhftetfnrdestjzrhgs.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiaGZ0ZXRmbnJkZXN0anpyaGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNzU1ODQsImV4cCI6MjEwNzg1MTU4NH0.k__1Vy8l7-pqemokwBCkrGeX-aOTJUz4-Tv0yz06dSo";

// Cloudflare Turnstile (filtro anti-bots). La Site Key es pública; la Secret Key vive en Supabase.
export const TURNSTILE_SITE_KEY = "0x4AAAAAAFhgfBT-lm2SfNxc";
export const MAX_SEGUIDOS = 10;
