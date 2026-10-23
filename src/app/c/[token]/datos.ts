import { cache } from 'react'
import { getPorToken } from '@/lib/services/cotizacionPublicaService'

/** Una sola lectura de la RPC por request (layout, metadata y página). */
export const leerCotizacionPublica = cache((token: string) => getPorToken(token))
