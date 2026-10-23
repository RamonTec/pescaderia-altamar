import { DocumentoPublicoLayout } from '@/components/templates/DocumentoPublicoLayout'
import { leerCotizacionPublica } from './datos'

/**
 * Layout del enlace público (21-cotizaciones): fuera de `(protected)`, sin
 * `AppShell` ni datos de usuario. Los datos del negocio del encabezado solo
 * se muestran con una cotización disponible.
 */
export default async function CotizacionPublicaLayout({ children, params }: LayoutProps<'/c/[token]'>) {
  const { token } = await params
  const r = await leerCotizacionPublica(token)
  const datos =
    r.resultado === 'disponible'
      ? [r.negocio.razon_social, r.negocio.rif ? `RIF ${r.negocio.rif}` : null, r.negocio.direccion, r.negocio.telefono]
          .filter(Boolean)
          .join(' · ')
      : null
  return <DocumentoPublicoLayout datosNegocio={datos}>{children}</DocumentoPublicoLayout>
}
