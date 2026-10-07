import {
  diasHastaVencimiento,
  estadoDe,
  estaAbierto,
  saldoDocumento,
} from './estado'
import type {
  ConfigCartera,
  DocumentoCartera,
  EstadoCartera,
  ResumenCartera,
  UltimoRecordatorio,
} from './types'

/** Funciones puras de resumen de cartera (09-cuentas-por-cobrar). */

export function conteoVacio(): Record<EstadoCartera, number> {
  return { pagada: 0, pendiente: 0, por_vencer: 0, vencida: 0, anulada: 0 }
}

export function resumenVacio(): ResumenCartera {
  return {
    conteo: conteoVacio(),
    saldo_usd: 0,
    saldo_vencido_usd: 0,
    vencida_mas_antigua_dias: null,
    ultimo_recordatorio: null,
    montos_usd: conteoVacio(),
  }
}

const redondea2 = (n: number) => Math.round(n * 100) / 100

/** Conteos, saldos y antigüedad de la vencida más vieja. */
export function resumirCartera(
  docs: readonly DocumentoCartera[],
  hoy: string,
  cfg: ConfigCartera,
  ultimoRecordatorio: UltimoRecordatorio | null = null
): ResumenCartera {
  const conteo = conteoVacio()
  const montos = conteoVacio()
  let saldo = 0
  let saldoVencido = 0
  let masAntigua: number | null = null

  for (const doc of docs) {
    const estado = estadoDe(doc, hoy, cfg.diasAviso)
    conteo[estado] += 1
    if (estaAbierto(estado)) {
      const s = saldoDocumento(doc)
      saldo += s
      montos[estado] += s
      if (estado === 'vencida') {
        saldoVencido += s
        const dias = -diasHastaVencimiento(doc.fecha_vencimiento, hoy)
        masAntigua = masAntigua === null ? dias : Math.max(masAntigua, dias)
      }
    } else {
      montos[estado] += Number(doc.total_usd)
    }
  }

  for (const k of Object.keys(montos) as EstadoCartera[]) montos[k] = redondea2(montos[k])

  return {
    conteo,
    saldo_usd: redondea2(saldo),
    saldo_vencido_usd: redondea2(saldoVencido),
    vencida_mas_antigua_dias: masAntigua,
    ultimo_recordatorio: ultimoRecordatorio,
    montos_usd: montos,
  }
}

/** Copia del resumen sin montos (rol sin permiso para verlos). */
export function sinMontos(r: ResumenCartera): ResumenCartera {
  return { ...r, saldo_usd: null, saldo_vencido_usd: null, montos_usd: null }
}

/** Total de documentos (sin anuladas). */
export function totalDocumentos(r: ResumenCartera): number {
  return r.conteo.pagada + r.conteo.pendiente + r.conteo.por_vencer + r.conteo.vencida
}

export type NivelCartera = 'vencida' | 'pendiente' | 'al_dia' | 'sin_documentos'

/** Peor estado del resumen, para el color del indicador. */
export function nivelCartera(r: ResumenCartera): NivelCartera {
  if (r.conteo.vencida > 0) return 'vencida'
  if (r.conteo.pendiente + r.conteo.por_vencer > 0) return 'pendiente'
  if (totalDocumentos(r) > 0) return 'al_dia'
  return 'sin_documentos'
}

/**
 * Valor para ordenar por gravedad (mayor = más grave): primero la cantidad
 * de vencidas, luego la de pendientes + por vencer.
 */
export function gravedadCartera(r: ResumenCartera | null | undefined): number {
  if (!r) return 0
  return r.conteo.vencida * 100_000 + r.conteo.por_vencer + r.conteo.pendiente
}
