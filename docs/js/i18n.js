// Idioma compartido con Elixir Lab: misma clave en localStorage ("elixirLang").
const CLAVE = "elixirLang";
export const LANG = (() => {
  try { const v = localStorage.getItem(CLAVE); if (v === "es" || v === "en") return v; } catch (e) {}
  return (navigator.language || "es").toLowerCase().startsWith("es") ? "es" : "en";
})();
export const t = (es, en) => (LANG === "en" ? en : es);

// Traduce los textos fijos del HTML que llevan data-en
export function aplicar() {
  document.documentElement.lang = LANG;
  if (LANG === "en") document.querySelectorAll("[data-en]").forEach((el) => { el.innerHTML = el.dataset.en; });
  if (LANG === "en") document.querySelectorAll("[data-en-placeholder]").forEach((el) => { el.placeholder = el.dataset.enPlaceholder; });
  if (LANG === "en") document.querySelectorAll("[data-en-label]").forEach((el) => { el.setAttribute("aria-label", el.dataset.enLabel); });
}

// Cambia de idioma y recarga, igual que en Elixir Lab
export function alternar() {
  try { localStorage.setItem(CLAVE, LANG === "en" ? "es" : "en"); } catch (e) {}
  location.reload();
}
