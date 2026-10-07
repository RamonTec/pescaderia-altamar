/**
 * Estado de una Server Action y traducción de errores de Postgres a mensajes
 * de dominio. Centraliza lo que antes vivía duplicado en `clientes/actions.ts`.
 *
 * `fieldErrors` permite mapear un error a un campo concreto del formulario
 * (ej. RIF duplicado → campo `rif_ci`) para que react-hook-form lo muestre
 * con `setError` en su lugar.
 */
export interface ActionState {
  error: string | null
  success: string | null
  fieldErrors?: Record<string, string>
}

interface PostgresErrorLike {
  code?: string
  details?: string
  hint?: string
  message?: string
}

export interface ToActionErrorOptions {
  /** Mapea un nombre de columna/índice de Postgres a un campo del formulario. */
  mapaCampos?: Record<string, string>
}

const ERRORES_CODIGO: Record<string, string> = {
  '23505': 'Ya existe un registro con este dato',
  '23514': 'Datos de pago incompletos',
  '42501': 'Solo un administrador puede realizar esta acción',
}

function nombreColumnaDuplicada(e: PostgresErrorLike): string | null {
  const detail = e.details ?? ''
  const m = detail.match(/Key \(([^)]+)\)/)
  return m ? m[1] : null
}

/**
 * Traduce un error desconocido (tipicamente de PostgREST) a un mensaje de
 * dominio. Mapea códigos conocidos (`23505` duplicado, `23514` check,
 * `42501` permisos) y registra en consola el resto para diagnóstico.
 */
export function toActionError(e: unknown, options: ToActionErrorOptions = {}): {
  error: string
  fieldErrors?: Record<string, string>
} {
  if (e instanceof Error) {
    const pg = e as Error & PostgresErrorLike
    console.error('[action] error:', {
      message: pg.message,
      code: pg.code,
      details: pg.details,
      hint: pg.hint,
    })

    if (pg.code) {
      const mensaje = ERRORES_CODIGO[pg.code]
      if (mensaje) {
        if (pg.code === '23505') {
          const columna = nombreColumnaDuplicada(pg)
          if (columna && options.mapaCampos?.[columna]) {
            return {
              error: mensaje,
              fieldErrors: { [options.mapaCampos[columna]]: mensaje },
            }
          }
        }
        return { error: mensaje }
      }
    }

    // `raise exception` de nuestras funciones SQL: el mensaje ya es de dominio
    // y el hint es un código interno, no texto para el usuario.
    if (pg.code === 'P0001') return { error: pg.message }

    if (pg.hint) return { error: `${pg.message} (${pg.hint})` }
    if (pg.code) return { error: `${pg.message} [${pg.code}]` }
    return { error: pg.message }
  }
  return { error: 'Ocurrió un error inesperado' }
}
