// Barra fija de arriba: el botón para subir aparece cuando has bajado de la cabecera.
export function iniciarBarra(umbral = 320) {
  const subir = document.getElementById("subir");
  if (!subir) return;
  subir.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  const mirar = () => { subir.hidden = window.scrollY < umbral; };
  window.addEventListener("scroll", mirar, { passive: true });
  mirar();
}
