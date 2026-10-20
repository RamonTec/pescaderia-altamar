import type {
  AvisoEdicionCompra,
  CondicionPago,
  DetalleCompra,
  EstadoDoc,
  HijoPrevioCompra,
  LineaPreviaCompra,
  Moneda,
  PrevisualizacionEdicionCompra,
  ProcesamientoCompra,
  TotalesCompraPrevia,
} from '@/types/domain'
import { recalcularRepartoProceso } from '@/lib/services/costingService'
import { numeroContrato } from '@/lib/contratos/textos'
import { formatKg, formatUsd } from '@/lib/format'
import { costoUsdKg, redondea3, redondea6, subtotalUsd } from './costo'

/**
 * Edición de compras (19): las mismas cuentas que la RPC `editar_compra`,
 * para la vista previa en vivo del diálogo. La validación real (lock,
 * stock, proveedor, fecha) es de la RPC. Funciones puras, sin Supabase.
 */

/** Tolerancia de saldo de `registrar_pago_proveedor` y la RPC. */
const TOLERANCIA_SALDO = 0.000001

type EstadoVigente = Exclude<EstadoDoc, 'anulada'>

/**
 * Lo pagado tras la edición (D1–D3). Crédito: solo los pagos registrados.
 * Contado: el pago implícito al registrar cubre lo que no cubren los pagos
 * registrados (`max(P, T)`), así que nunca queda saldo.
 */
export function pagadoTrasEdicion(condicionFinal: CondicionPago, pagosRegistrados: number, total: number): number {
  return redondea6(condicionFinal === 'credito' ? pagosRegistrados : Math.max(pagosRegistrados, total))
}

/** `pagada` si `total − pagado ≤ 0,000001` (también a crédito con total 0); si no, `abierta`. */
export function estadoCompra(total: number, pagado: number): EstadoVigente {
  return total - pagado <= TOLERANCIA_SALDO ? 'pagada' : 'abierta'
}

function totales(total: number, pagado: number, estado: EstadoVigente): TotalesCompraPrevia {
  const saldo = redondea6(total - pagado)
  return {
    total_usd: total,
    pagado_usd: pagado,
    saldo_usd: Math.max(saldo, 0),
    saldo_a_favor_usd: Math.max(-saldo, 0),
    estado,
  }
}

/** Valores del formulario de edición que mira la vista previa. */
export interface ValoresEdicionCompra {
  proveedor_id: string
  /** Nombre del proveedor elegido (para los avisos). */
  proveedor_nombre?: string | null
  fecha: string
  condicion: CondicionPago
  moneda: Moneda
  notas: string
  cambiar_tasa: boolean
  tasa_origen: 'referencial' | 'manual'
  tasa_fuente?: 'bcv' | 'paralela' | null
  /** Valor final de la tasa (solo cuenta con `cambiar_tasa`). */
  tasa: number | null
  /** Todas las líneas; un número vacío o inválido conserva el vigente. */
  items: { compra_item_id: string; peso_kg: number | null; costo_kg: number | null }[]
}

/** Kg ya consumidos del lote de una línea: mínimo del peso nuevo (D de kg). */
export function kgMinimoLinea(lote: { peso_inicial_kg: number; stock_kg: number } | null): number {
  return lote ? Math.max(redondea3(lote.peso_inicial_kg - lote.stock_kg), 0) : 0
}

/** Costo/kg nuevo de cada salida de un procesamiento con el costo nuevo del lote crudo (espejo de la RPC). */
export function costosSalidasRecalculados(pr: ProcesamientoCompra, costoLoteUsdKg: number): number[] {
  if (pr.legado) {
    // Legado sin cabecera: cada salida es el 100 % de su propia entrada.
    return pr.salidas.map((s) => {
      const costo = redondea6(s.peso_entrada_kg * costoLoteUsdKg)
      return s.peso_salida_kg > 0 ? redondea6(costo / s.peso_salida_kg) : 0
    })
  }
  const r = recalcularRepartoProceso(
    pr.salidas.map((s) => ({ kg: s.peso_salida_kg, precio: s.precio_referencia_usd_kg })),
    pr.peso_entrada_kg,
    costoLoteUsdKg,
    pr.reparto_costo
  )
  return r.salidas.map((s) => s.costo_usd_kg)
}

const valido = (n: number | null | undefined, min: number, estricto: boolean) =>
  n != null && Number.isFinite(n) && (estricto ? n > min : n >= min)

/**
 * Antes → después de editar la compra con `valores`: costo USD/kg y kg por
 * línea (mínimo por consumo y reapertura D7), total, pagado, saldo o saldo a
 * favor y estado (D1–D3), costo/kg de los lotes hijos (reparto de 16 con el
 * snapshot), costo de lo vendido y los avisos del diálogo.
 */
export function previsualizarEdicionCompra(
  detalle: DetalleCompra,
  valores: ValoresEdicionCompra
): PrevisualizacionEdicionCompra {
  const { compra } = detalle
  const tasaCambia =
    valores.cambiar_tasa &&
    valido(valores.tasa, 0, true) &&
    (redondea6(valores.tasa as number) !== compra.tasa_snapshot ||
      valores.tasa_origen !== compra.tasa_origen ||
      (valores.tasa_fuente ?? null) !== (compra.tasa_fuente ?? null))
  const tasaFinal = tasaCambia ? redondea6(valores.tasa as number) : compra.tasa_snapshot
  const porId = new Map(valores.items.map((i) => [i.compra_item_id, i]))

  // ----- Líneas -----
  const lineas: LineaPreviaCompra[] = detalle.lineas.map((l) => {
    const v = porId.get(l.id)
    const peso = valido(v?.peso_kg, 0, true) ? redondea3(v!.peso_kg as number) : l.peso_kg
    const pactado = valido(v?.costo_kg, 0, false) ? redondea6(v!.costo_kg as number) : l.costo_kg_pactado
    const conserva = pactado === l.costo_kg_pactado && valores.moneda === compra.moneda && tasaFinal === compra.tasa_snapshot
    const costo = conserva ? l.costo_usd_kg : costoUsdKg(pactado, valores.moneda, tasaFinal)
    const delta = redondea3(peso - l.peso_kg)
    const minimo = kgMinimoLinea(l.lote)
    return {
      compra_item_id: l.id,
      producto_nombre: l.producto.nombre,
      lote_codigo: l.lote?.codigo ?? null,
      costo_antes_usd_kg: l.costo_usd_kg,
      costo_despues_usd_kg: costo,
      peso_antes_kg: l.peso_kg,
      peso_despues_kg: peso,
      delta_kg: delta,
      minimo_kg: minimo,
      bajo_minimo: l.lote != null && delta < 0 && -delta > l.lote.stock_kg + 1e-9,
      reabre: l.lote != null && delta > 0 && (l.lote.estado === 'cerrado' || l.lote.estado === 'agotado'),
    }
  })
  const lineasCambian = detalle.lineas.some((l, i) => {
    const p = lineas[i]
    const v = porId.get(l.id)
    const pactado = valido(v?.costo_kg, 0, false) ? redondea6(v!.costo_kg as number) : l.costo_kg_pactado
    return p.peso_despues_kg !== l.peso_kg || pactado !== l.costo_kg_pactado
  })

  // ----- Totales (D1–D3) -----
  const total = subtotalUsd(lineas.map((l) => ({ peso_kg: l.peso_despues_kg, costo_usd_kg: l.costo_despues_usd_kg })))
  const pagado = pagadoTrasEdicion(valores.condicion, detalle.pagos_registrados_usd, total)
  const antes = totales(compra.subtotal_usd, compra.pagado_usd, compra.estado === 'anulada' ? 'abierta' : compra.estado)
  const despues = totales(total, pagado, estadoCompra(total, pagado))

  // ----- Propagación: hijos y costo de lo vendido -----
  const hijos: HijoPrevioCompra[] = []
  let vendidoAntes = 0
  let vendidoDespues = 0
  detalle.lineas.forEach((l, i) => {
    const lote = l.lote
    if (!lote) return
    const nuevo = lineas[i].costo_despues_usd_kg
    vendidoAntes += lote.ventas.kg * lote.costo_usd_kg
    vendidoDespues += lote.ventas.kg * (nuevo !== l.costo_usd_kg ? nuevo : lote.costo_usd_kg)
    for (const pr of lote.procesamientos) {
      const costos = nuevo !== l.costo_usd_kg ? costosSalidasRecalculados(pr, nuevo) : null
      pr.salidas.forEach((s, j) => {
        if (!s.lote) return
        const despuesKg = costos ? costos[j] : s.lote.costo_usd_kg
        vendidoAntes += s.lote.ventas.kg * s.lote.costo_usd_kg
        vendidoDespues += s.lote.ventas.kg * despuesKg
        hijos.push({
          lote_id: s.lote.id,
          codigo: s.lote.codigo,
          producto_nombre: s.producto_nombre,
          costo_antes_usd_kg: s.lote.costo_usd_kg,
          costo_despues_usd_kg: despuesKg,
        })
      })
    }
  })

  // ----- ¿Cambia algo? -----
  const notas = valores.notas.trim() || null
  const cabeceraCambia =
    valores.proveedor_id !== compra.proveedor.id ||
    valores.fecha !== compra.fecha.slice(0, 10) ||
    valores.condicion !== compra.condicion ||
    valores.moneda !== compra.moneda ||
    notas !== (compra.notas ?? null) ||
    tasaCambia
  const sinCambios = !cabeceraCambia && !lineasCambian
  const cambiaCosto = lineas.some((l) => l.costo_despues_usd_kg !== l.costo_antes_usd_kg)

  // ----- Avisos -----
  const avisos: AvisoEdicionCompra[] = []
  const P = detalle.pagos_registrados_usd
  if (!sinCambios) {
    if (P > 0) {
      avisos.push({
        tipo: 'pagos',
        severidad: 'info',
        mensaje: `La compra tiene pagos registrados por ${formatUsd(P)}: no cambian y siguen a la compra.`,
      })
    }
    if (despues.saldo_a_favor_usd > 0) {
      avisos.push({
        tipo: 'saldo_a_favor',
        severidad: 'warning',
        mensaje: `Quedará un saldo a favor del negocio de ${formatUsd(despues.saldo_a_favor_usd)} con el proveedor: se muestra, no se aplica solo a otra compra.`,
      })
    }
    if (detalle.contrato) {
      const c = detalle.contrato
      const proveedorCambia = valores.proveedor_id !== compra.proveedor.id
      avisos.push({
        tipo: 'contrato',
        severidad: 'warning',
        mensaje: `El contrato ${numeroContrato(c.numero)} (${c.estado}) quedará desactualizado${
          proveedorCambia ? ` (nombra a ${compra.proveedor.nombre})` : ''
        }: anúlalo y genera otro desde el menú ⋮.`,
      })
    }
    if (compra.condicion === 'credito' && valores.condicion === 'contado') {
      avisos.push({
        tipo: 'condicion_a_contado',
        severidad: 'info',
        mensaje:
          'Pasa a contado: lo que faltaba se toma como pagado al registrar, a la tasa de la compra y sin ganancia cambiaria. Los pagos registrados se conservan.',
      })
    }
    if (compra.condicion === 'contado' && valores.condicion === 'credito') {
      avisos.push({
        tipo: 'condicion_a_credito',
        severidad: 'info',
        mensaje: `Pasa a crédito: se quita el pago implícito del registro y quedan ${formatUsd(despues.saldo_usd)} por pagar. Si se pagó una parte, regístrala como abono.`,
      })
    }
    if (valores.proveedor_id !== compra.proveedor.id) {
      const nHijos = hijos.length
      const nLotes = detalle.lineas.filter((l) => l.lote).length
      avisos.push({
        tipo: 'proveedor',
        severidad: 'info',
        mensaje: `${valores.proveedor_nombre ? `La compra pasa a ${valores.proveedor_nombre}` : 'Cambia el proveedor de la compra'}, con ${
          nLotes === 1 ? 'su lote' : `sus ${nLotes} lotes`
        }${nHijos > 0 ? ` y ${nHijos === 1 ? 'su lote procesado' : `sus ${nHijos} lotes procesados`}` : ''}. Los pagos registrados siguen a la compra.`,
      })
    }
    for (const l of lineas.filter((x) => x.reabre)) {
      const lote = detalle.lineas.find((x) => x.id === l.compra_item_id)?.lote
      avisos.push({
        tipo: 'reabre_lote',
        severidad: 'warning',
        mensaje: `El lote ${l.lote_codigo} está ${lote?.estado === 'cerrado' ? 'cerrado' : 'agotado'}: se reabrirá con ${formatKg(
          l.delta_kg
        )} más. Ciérralo de nuevo si esos kg no existen.`,
      })
    }
    if (valores.moneda !== compra.moneda) {
      avisos.push({
        tipo: 'moneda',
        severidad: 'info',
        mensaje: `Los costos/kg se conservan y se interpretan en ${valores.moneda === 'bs' ? 'Bs' : 'USD'}: revisa el costo USD resultante.`,
      })
    }
    if (tasaCambia) {
      avisos.push(
        valores.moneda === 'usd'
          ? {
              tipo: 'tasa_usd',
              severidad: 'info',
              mensaje:
                'Compra en USD: la tasa nueva no cambia los costos; solo el resultado en Bs de sus lotes y la ganancia cambiaria de los abonos futuros.',
            }
          : {
              tipo: 'tasa_bs',
              severidad: 'warning',
              mensaje: 'Compra en Bs: la tasa nueva cambia el costo USD de todas las líneas y se recalcula en cascada.',
            }
      )
      if (P > 0) {
        avisos.push({
          tipo: 'ganancia_cambiaria',
          severidad: 'info',
          mensaje: 'La ganancia cambiaria de los abonos ya registrados no se recalcula; los abonos futuros usan la tasa nueva.',
        })
      }
    }
  }

  return {
    lineas,
    antes,
    despues,
    hijos,
    costo_vendido: {
      antes_usd: redondea6(vendidoAntes),
      despues_usd: redondea6(vendidoDespues),
      lineas: detalle.ventas_arbol.lineas,
      facturas: detalle.ventas_arbol.facturas,
    },
    sin_cambios: sinCambios,
    bajo_minimo: lineas.some((l) => l.bajo_minimo),
    cambia_costo: cambiaCosto,
    avisos,
  }
}
