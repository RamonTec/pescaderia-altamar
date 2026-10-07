/**
 * Utilidades de paginación compartidas entre servidor y cliente.
 *
 * `AppDataGrid` es un Client Component; las páginas (`page.tsx`) no pueden
 * importar funciones desde módulos `'use client'` para invocarlas en el
 * servidor, así que la lectura de `?pagina=` vive aquí (módulo neutro).
 */

/** Lee `?pagina=N` (1-based) y devuelve la página 0-based. Para `page.tsx` en modo servidor. */
export function paginaDesdeParam(value: string | string[] | null | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value
  const n = Number(raw)
  return Number.isInteger(n) && n > 1 ? n - 1 : 0
}