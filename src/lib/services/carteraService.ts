import type { SupabaseClient } from '@supabase/supabase-js'
import type { FacturaResumen, FilaCarteraCliente } from '@/lib/repositories/interfaces'
import type { DocumentoCartera, ResumenCartera } from '@/lib/cartera/types'
import { estadoCartera } from '@/lib/cartera/estado'
import { conteoVacio, resumirCartera, sinMontos } from '@/lib/cartera/resumen'
import {
  facturaADocumentoCartera,
  makeCarteraRepository,
} from '@/lib/repositories/carteraRepository'
import { makeConfigNegocioRepository } from '@/lib/repositories/configRepository'
import { makeRecordatorioRepository } from '@/lib/repositories/recordatorioRepository'
import { createClient } from '@/lib/supabase/server'
import { fechaHoy } from '@/lib/format'
import { getRol } from './authService'

/**
 * CarteraService (SRP): cuentas por cobrar por cliente (09-cuentas-por-cobrar).
 * Orquesta repositorios + funciones puras de `lib/cartera` y **aplica el
 * rol**: el operador recibe cantidades por estado, sin montos (los documentos
 * llegan con el estado ya resuelto y los montos en 0).
 */

export const DIAS_AVISO_DEFAULT = 3

/** Lo que la UI necesita para calcular estados igual que el servidor. */
export interface ContextoCartera {
  /** Fecha de hoy en Venezuela (`YYYY-MM-DD`). */
  hoy: string
  diasAviso: number
  mostrarMontos: boolean
}

export interface CarteraDeCliente {
  resumen: ResumenCartera
  documentos: DocumentoCartera[]
  contexto: ContextoCartera
}

export interface CobrosAbiertos {
  resumen: ResumenCartera
  documentos: DocumentoCartera[]
  /** Facturas para el diálogo de abono (vacío si el rol no ve montos). */
  facturas: FacturaResumen[]
  contexto: ContextoCartera
}

export async function getContextoCartera(db?: SupabaseClient): Promise<ContextoCartera> {
  const client = db ?? (await createClient())
  const [config, rol] = await Promise.all([makeConfigNegocioRepository(client).get(), getRol()])
  return {
    hoy: fechaHoy(),
    diasAviso: Number(config?.dias_aviso_por_vencer ?? DIAS_AVISO_DEFAULT),
    mostrarMontos: rol === 'admin',
  }
}

/** Fila de la vista → resumen (los saldos ya llegan `null` al operador). */
export function filaAResumen(f: FilaCarteraCliente): ResumenCartera {
  return {
    conteo: {
      ...conteoVacio(),
      pagada: Number(f.pagadas),
      pendiente: Number(f.pendientes),
      por_vencer: Number(f.por_vencer),
      vencida: Number(f.vencidas),
      anulada: Number(f.anuladas),
    },
    saldo_usd: f.saldo_usd,
    saldo_vencido_usd: f.saldo_vencido_usd,
    vencida_mas_antigua_dias:
      f.vencida_mas_antigua_dias === null ? null : Number(f.vencida_mas_antigua_dias),
    ultimo_recordatorio:
      f.ultimo_recordatorio_fecha && f.ultimo_recordatorio_canal
        ? { fecha: f.ultimo_recordatorio_fecha, canal: f.ultimo_recordatorio_canal }
        : null,
    montos_usd: null,
  }
}

/**
 * Resumen de todos los clientes en una consulta (vista
 * `cartera_clientes_view`). Clave: id del cliente.
 */
export async function resumenPorCliente(db?: SupabaseClient): Promise<Map<string, ResumenCartera>> {
  const client = db ?? (await createClient())
  const [filas, rol] = await Promise.all([makeCarteraRepository(client).resumenPorCliente(), getRol()])
  const admin = rol === 'admin'
  return new Map(
    filas.map((f) => {
      const r = filaAResumen(f)
      return [f.cliente_id, admin ? r : sinMontos(r)]
    })
  )
}

/** Montos en 0 y estado ya resuelto: lo que recibe un rol sin montos. */
function ocultarMontos(doc: DocumentoCartera, hoy: string, diasAviso: number): DocumentoCartera {
  return {
    ...doc,
    estado: estadoCartera(doc, hoy, diasAviso),
    total_usd: 0,
    pagado_usd: 0,
    creditos_usd: 0,
  }
}

function aplicarRol(
  docs: DocumentoCartera[],
  resumen: ResumenCartera,
  ctx: ContextoCartera
): { documentos: DocumentoCartera[]; resumen: ResumenCartera } {
  if (ctx.mostrarMontos) return { documentos: docs, resumen }
  return {
    documentos: docs.map((d) => ocultarMontos(d, ctx.hoy, ctx.diasAviso)),
    resumen: sinMontos(resumen),
  }
}

/** Resumen + documentos de un cliente (ficha). */
export async function carteraDeCliente(
  clienteId: string,
  db?: SupabaseClient
): Promise<CarteraDeCliente> {
  const client = db ?? (await createClient())
  const [facturas, ultimo, contexto] = await Promise.all([
    makeCarteraRepository(client).documentosPorCliente(clienteId),
    makeRecordatorioRepository(client).ultimoPorCliente(clienteId),
    getContextoCartera(client),
  ])
  const docs = facturas.map(facturaADocumentoCartera)
  const resumen = resumirCartera(
    docs,
    contexto.hoy,
    { diasAviso: contexto.diasAviso },
    ultimo ? { fecha: ultimo.created_at, canal: ultimo.canal } : null
  )
  return { ...aplicarRol(docs, resumen, contexto), contexto }
}

/** Facturas abiertas de todos los clientes (`/cobros`) con su resumen global. */
export async function cobrosAbiertos(db?: SupabaseClient): Promise<CobrosAbiertos> {
  const client = db ?? (await createClient())
  const [facturas, contexto] = await Promise.all([
    makeCarteraRepository(client).documentosAbiertos(),
    getContextoCartera(client),
  ])
  const docs = facturas.map(facturaADocumentoCartera)
  const resumen = resumirCartera(docs, contexto.hoy, { diasAviso: contexto.diasAviso })
  return {
    ...aplicarRol(docs, resumen, contexto),
    facturas: contexto.mostrarMontos ? facturas : [],
    contexto,
  }
}
