import { CotizacionError, contexto, traducir } from './cotizacionService'

/**
 * Conversión de una cotización en pedido (21-cotizaciones, Fase D, P8).
 *
 * Decisión al ejecutar (tarea 21): `pedidoService.crearPedido` ya delega en
 * la RPC `registrar_pedido` (05), así que la conversión es una sola RPC
 * atómica, `convertir_cotizacion_en_pedido`, que acepta una enviada vigente
 * si hace falta, exige cliente registrado y productos activos, crea el
 * pedido con `registrar_pedido` (peso estimado = kg de la línea, precio
 * pactado) y fija `pedido_id`. Sin pedidos huérfanos si el enlace falla.
 */
export async function convertirEnPedido(id: string, fechaEntrega: string): Promise<string> {
  const { cotizaciones } = await contexto()
  const c = await cotizaciones.getById(id)
  if (!c) throw new CotizacionError('La cotización no existe')
  if (!c.cliente_id) throw new CotizacionError('Registra el cliente para convertir la cotización en pedido')
  if (c.pedido_id) throw new CotizacionError('La cotización ya se convirtió en pedido')
  try {
    return await cotizaciones.convertirEnPedido(id, fechaEntrega)
  } catch (e) {
    traducir(e)
  }
}
