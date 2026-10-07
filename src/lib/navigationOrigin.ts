/**
 * Recuerda desde qué listado se abrió una ficha, para que "volver" use
 * `router.back()` y conserve la página y los filtros del listado (`?pagina=`,
 * `?estado=`, que se escriben con `history.replaceState`).
 *
 * Vive en memoria del módulo: sobrevive a la navegación del App Router y se
 * pierde al recargar, que es justo cuando `router.back()` ya no es fiable
 * (entonces se usa el `href` de vuelta).
 *
 * - `AppDataGrid` llama a `recordarOrigen(href)` al abrir una fila.
 * - `FichaHeader` llama a `consumirOrigen(backHref)` al montarse: así, si
 *   desde la ficha se va a otra pantalla y se vuelve con el navegador, el
 *   origen ya no vale y "volver" usa el `href`.
 */

let origen: { desde: string; hacia: string } | null = null

function pathname(url: string): string {
  return url.split(/[?#]/)[0] ?? url
}

/** Se navega de la página actual a `destino` (ruta de la ficha). */
export function recordarOrigen(destino: string): void {
  if (typeof window === 'undefined') return
  origen = { desde: window.location.pathname, hacia: pathname(destino) }
}

/**
 * `true` si la página actual se abrió desde `listado` (misma ruta, sin
 * importar los parámetros), y por tanto `router.back()` regresa a él. El
 * origen se borra: solo lo usa la primera ficha que lo lee.
 */
export function consumirOrigen(listado: string): boolean {
  if (typeof window === 'undefined' || !origen) return false
  const ok = origen.hacia === window.location.pathname && origen.desde === pathname(listado)
  if (ok) origen = null
  return ok
}
