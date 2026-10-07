import type {
  DocumentoProveedor,
  Proveedor,
  RepresentanteProveedor,
  EstadoDocumental,
} from '@/types/domain'

/**
 * Documentación requerida (indicador, no bloquea nada).
 *   - Natural: cédula + RIF.
 *   - Jurídica: RIF + acta constitutiva + cédula de cada representante.
 * Función pura, sin I/O. Vive en un módulo propio para poder importarse
 * tanto desde el servicio (server) como desde la ficha (client).
 */
export function evaluarDocumentacion(
  proveedor: Pick<Proveedor, 'tipo_persona'>,
  representantes: RepresentanteProveedor[],
  documentos: DocumentoProveedor[]
): EstadoDocumental {
  const tipos = new Set(documentos.map((d) => d.tipo))
  const faltantes: string[] = []

  if (proveedor.tipo_persona === 'natural') {
    if (!tipos.has('cedula')) faltantes.push('cédula')
    if (!tipos.has('rif')) faltantes.push('RIF')
  } else {
    if (!tipos.has('rif')) faltantes.push('RIF')
    if (!tipos.has('acta_constitutiva')) faltantes.push('acta constitutiva')

    const docsConRep = new Set(
      documentos.filter((d) => d.representante_id).map((d) => d.representante_id)
    )
    for (const r of representantes) {
      if (!docsConRep.has(r.id)) {
        faltantes.push(`cédula de ${r.nombre}`)
      }
    }
  }

  return { completa: faltantes.length === 0, faltantes }
}
