import { totalesDe, ivaSobre, redondea6, type TotalesFactura } from './totales'

/**
 * Vista previa de la corrección de una línea (17): las mismas cuentas que la
 * RPC `corregir_linea_factura`, para mostrarlas en vivo en el diálogo. La
 * validación real (stock, notas, lock) es de la RPC. Funciones puras.
 */

export const redondea3 = (n: number) => Math.round(n * 1e3) / 1e3

/** Tolerancia de saldo de `registrar_pago` / la RPC. */
const TOLERANCIA_SALDO = 0.000001

export interface LineaParaCorreccion {
  id: string
  peso_kg: number
  precio_usd_kg: number
  /** Kg devueltos por notas de crédito emitidas: el peso no baja de aquí. */
  kg_devueltos: number
}

export interface FacturaParaCorreccion extends TotalesFactura {
  iva_pct: number
  pagado_usd: number
  /** Σ notas de crédito emitidas. */
  creditos_usd: number
  lineas: readonly LineaParaCorreccion[]
}

export interface PrevisualizacionCorreccion {
  antes: TotalesFactura
  despues: TotalesFactura
  /** Pendiente de cobro antes / después (≥ 0). */
  saldo_antes_usd: number
  saldo_despues_usd: number
  /** A favor del cliente antes / después (≥ 0). */
  saldo_a_favor_antes_usd: number
  saldo_a_favor_despues_usd: number
  /** Estado que dejará la RPC (`total − pagado ≤ 0,000001` → pagada). */
  estado_despues: 'abierta' | 'pagada'
  /** Peso nuevo − actual (redondeado a 3 decimales): + sale de lotes, − vuelve. */
  delta_kg: number
  /** Kg ya devueltos por notas de crédito: mínimo del peso nuevo. */
  minimo_kg: number
  bajo_minimo: boolean
  sin_cambios: boolean
  /** Variación del total. */
  delta_total_usd: number
}

function saldos(total: number, pagado: number, creditos: number) {
  const saldo = redondea6(total - pagado - creditos)
  return { saldo: Math.max(saldo, 0), aFavor: Math.max(-saldo, 0) }
}

/**
 * Totales antes → después de cambiar la línea `itemId` a `peso` / `precio`,
 * con el `iva_pct` de la factura. `antes` son los totales guardados.
 */
export function previsualizarCorreccion(
  factura: FacturaParaCorreccion,
  itemId: string,
  peso: number,
  precio: number
): PrevisualizacionCorreccion {
  const linea = factura.lineas.find((l) => l.id === itemId)
  if (!linea) throw new Error('La línea no pertenece a la factura')

  const pesoNuevo = redondea3(peso)
  const precioNuevo = redondea6(precio)
  const despues = totalesDe(
    factura.lineas.map((l) => (l.id === itemId ? { peso_kg: pesoNuevo, precio_usd_kg: precioNuevo } : l)),
    factura.iva_pct
  )
  const antes: TotalesFactura = {
    subtotal_usd: factura.subtotal_usd,
    iva_usd: factura.iva_usd,
    total_usd: factura.total_usd,
  }
  const sAntes = saldos(antes.total_usd, factura.pagado_usd, factura.creditos_usd)
  const sDespues = saldos(despues.total_usd, factura.pagado_usd, factura.creditos_usd)

  return {
    antes,
    despues,
    saldo_antes_usd: sAntes.saldo,
    saldo_despues_usd: sDespues.saldo,
    saldo_a_favor_antes_usd: sAntes.aFavor,
    saldo_a_favor_despues_usd: sDespues.aFavor,
    estado_despues: despues.total_usd - factura.pagado_usd <= TOLERANCIA_SALDO ? 'pagada' : 'abierta',
    delta_kg: redondea3(pesoNuevo - linea.peso_kg),
    minimo_kg: linea.kg_devueltos,
    bajo_minimo: pesoNuevo < linea.kg_devueltos,
    sin_cambios: pesoNuevo === redondea3(linea.peso_kg) && precioNuevo === redondea6(linea.precio_usd_kg),
    delta_total_usd: redondea6(despues.total_usd - antes.total_usd),
  }
}

/* ==================== Cambio de IVA (18) ==================== */

/** Lo mínimo de la factura para previsualizar el cambio de IVA. */
export interface FacturaParaCambioIva extends TotalesFactura {
  iva_pct: number
  pagado_usd: number
}

/** Nota de crédito `emitida` de la factura (las anuladas no se tocan). */
export interface NotaParaCambioIva {
  subtotal_usd: number
  total_usd: number
}

export type MotivoSinCambioIva = 'sin_cambios' | 'iva_config_cero'

export interface PrevisualizacionCambioIva {
  /** `null` si el cambio es posible; si no, el mismo `hint` que daría la RPC. */
  bloqueo: MotivoSinCambioIva | null
  aplicar: boolean
  iva_pct_antes: number
  iva_pct_despues: number
  antes: TotalesFactura
  despues: TotalesFactura
  /** Σ total de las notas emitidas antes / después (al % nuevo). */
  creditos_antes_usd: number
  creditos_despues_usd: number
  saldo_antes_usd: number
  saldo_despues_usd: number
  saldo_a_favor_antes_usd: number
  saldo_a_favor_despues_usd: number
  /** Estado que dejará la RPC (`total − pagado ≤ 0,000001` → pagada). */
  estado_despues: 'abierta' | 'pagada'
  /** Variación del total de la factura. */
  delta_total_usd: number
}

/**
 * Vista previa de `cambiar_iva_factura`: mismas cuentas y mismo redondeo que
 * la RPC (`ivaSobre` / `redondea6`). No lanza: `sin_cambios` (ya tiene o ya
 * no tiene IVA) e `iva_config_cero` (activar con config en 0 %) vuelven en
 * `bloqueo`, con `despues` igual a `antes`.
 */
export function previsualizarCambioIva(
  factura: FacturaParaCambioIva,
  notasEmitidas: readonly NotaParaCambioIva[],
  aplicar: boolean,
  configPct: number
): PrevisualizacionCambioIva {
  const antes: TotalesFactura = {
    subtotal_usd: factura.subtotal_usd,
    iva_usd: factura.iva_usd,
    total_usd: factura.total_usd,
  }
  const creditosAntes = redondea6(notasEmitidas.reduce((s, n) => s + n.total_usd, 0))

  let bloqueo: MotivoSinCambioIva | null = null
  if (factura.iva_pct > 0 === aplicar) bloqueo = 'sin_cambios'
  else if (aplicar && !(configPct > 0)) bloqueo = 'iva_config_cero'

  const ivaPctDespues = bloqueo ? factura.iva_pct : aplicar ? configPct : 0

  let despues = antes
  let creditosDespues = creditosAntes
  if (!bloqueo) {
    const iva = ivaSobre(factura.subtotal_usd, ivaPctDespues)
    despues = { subtotal_usd: factura.subtotal_usd, iva_usd: iva, total_usd: redondea6(factura.subtotal_usd + iva) }
    creditosDespues = redondea6(
      notasEmitidas.reduce((s, n) => {
        const ivaNota = ivaSobre(n.subtotal_usd, ivaPctDespues)
        return s + redondea6(n.subtotal_usd + ivaNota)
      }, 0)
    )
  }

  const sAntes = saldos(antes.total_usd, factura.pagado_usd, creditosAntes)
  const sDespues = saldos(despues.total_usd, factura.pagado_usd, creditosDespues)

  return {
    bloqueo,
    aplicar,
    iva_pct_antes: factura.iva_pct,
    iva_pct_despues: ivaPctDespues,
    antes,
    despues,
    creditos_antes_usd: creditosAntes,
    creditos_despues_usd: creditosDespues,
    saldo_antes_usd: sAntes.saldo,
    saldo_despues_usd: sDespues.saldo,
    saldo_a_favor_antes_usd: sAntes.aFavor,
    saldo_a_favor_despues_usd: sDespues.aFavor,
    estado_despues: despues.total_usd - factura.pagado_usd <= TOLERANCIA_SALDO ? 'pagada' : 'abierta',
    delta_total_usd: redondea6(despues.total_usd - antes.total_usd),
  }
}

export interface LoteDeLinea {
  codigo: string
  orden: number
  peso_kg: number
  kg_devueltos: number
}

/**
 * Kg que vuelven a cada lote al bajar el peso `kgBaja`: orden inverso de la
 * asignación, con tope `peso − devuelto por notas` por lote (misma regla
 * que la RPC y que las notas de crédito).
 */
export function repartoBajaPeso(lotes: readonly LoteDeLinea[], kgBaja: number): { codigo: string; peso_kg: number }[] {
  let resto = redondea3(kgBaja)
  const out: { codigo: string; peso_kg: number }[] = []
  for (const l of [...lotes].sort((a, b) => b.orden - a.orden)) {
    if (resto <= 0) break
    const toma = redondea3(Math.min(resto, l.peso_kg - l.kg_devueltos))
    if (toma <= 0) continue
    out.push({ codigo: l.codigo, peso_kg: toma })
    resto = redondea3(resto - toma)
  }
  return out
}
