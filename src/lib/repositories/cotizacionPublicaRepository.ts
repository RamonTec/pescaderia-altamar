import type { SupabaseClient } from '@supabase/supabase-js'
import type { ICotizacionPublicaRepository } from './interfaces'
import type {
  ContactoNegocio,
  CotizacionPublica,
  NegocioDocumento,
  ResultadoCotizacionPublica,
} from '@/types/domain'

/**
 * Lectura anónima del enlace público (21-cotizaciones, P7). Solo llama a la
 * RPC `cotizacion_publica` con el cliente anónimo sin cookies
 * (`createAnonClient`); mapea el `jsonb` a la unión discriminada.
 */

interface FilaPublica {
  resultado: 'disponible' | 'vencida' | 'no_disponible'
  negocio: Partial<NegocioDocumento> | null
  cotizacion?: Record<string, unknown> | null
}

const num = (v: unknown): number => Number(v ?? 0)
const texto = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

function contacto(n: FilaPublica['negocio']): ContactoNegocio {
  return { nombre_comercial: texto(n?.nombre_comercial), telefono: texto(n?.telefono) }
}

function cotizacionDe(c: Record<string, unknown>): CotizacionPublica {
  const cliente = (c.cliente ?? {}) as { nombre?: unknown; rif_ci?: unknown }
  const items = (Array.isArray(c.items) ? c.items : []) as Record<string, unknown>[]
  const estado = c.estado_publico
  return {
    numero: num(c.numero),
    fecha: String(c.fecha),
    fecha_vencimiento: String(c.fecha_vencimiento),
    estado_publico: estado === 'aceptada' || estado === 'rechazada' ? estado : 'vigente',
    cliente: { nombre: texto(cliente.nombre) ?? '—', rif_ci: texto(cliente.rif_ci), telefono: null },
    items: items.map((i) => ({
      producto_nombre: String(i.producto_nombre ?? ''),
      peso_kg: num(i.peso_kg),
      precio_usd_kg: num(i.precio_usd_kg),
      subtotal_usd: num(i.subtotal_usd),
      nota: texto(i.nota),
    })),
    subtotal_usd: num(c.subtotal_usd),
    descuento_usd: num(c.descuento_usd),
    iva_pct: num(c.iva_pct),
    iva_usd: num(c.iva_usd),
    total_usd: num(c.total_usd),
    notas_cliente: texto(c.notas_cliente),
    terminos: texto(c.terminos),
    updated_at: String(c.updated_at),
  }
}

export function makeCotizacionPublicaRepository(db: SupabaseClient): ICotizacionPublicaRepository {
  return {
    async porToken(token) {
      const { data, error } = await db.rpc('cotizacion_publica', { p_token: token })
      if (error) throw error
      const fila = data as FilaPublica
      if (fila.resultado === 'disponible' && fila.cotizacion) {
        const n = fila.negocio ?? {}
        const resultado: ResultadoCotizacionPublica = {
          resultado: 'disponible',
          negocio: {
            nombre_comercial: texto(n.nombre_comercial),
            telefono: texto(n.telefono),
            razon_social: texto(n.razon_social),
            rif: texto(n.rif),
            direccion: texto(n.direccion),
          },
          cotizacion: cotizacionDe(fila.cotizacion),
        }
        return resultado
      }
      if (fila.resultado === 'vencida') {
        return { resultado: 'vencida', negocio: contacto(fila.negocio), numero: num(fila.cotizacion?.numero) }
      }
      return { resultado: 'no_disponible', negocio: contacto(fila.negocio) }
    },
  }
}
