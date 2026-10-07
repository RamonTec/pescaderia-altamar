import { redirect } from 'next/navigation'
import { AppShell } from '@/components/templates/AppShell'
import { TasaIndicador, type TasaIndicadorDato } from '@/components/molecules/TasaIndicador'
import { getUsuarioActual } from '@/lib/services/authService'
import { getTasasVigentesHoy, type TasasHoy } from '@/lib/services/tasaService'

/**
 * Shell persistente: el menú y la barra superior viven aquí y no se vuelven a
 * montar al navegar; solo cambia `children` (y su `loading.tsx`). La sesión y
 * el rol se resuelven una vez en el servidor y llegan por props.
 *
 * El indicador de tasas (08-tasas) también se resuelve aquí: el chip de la
 * barra con las vigentes de hoy (la obtención bajo demanda la cubre
 * `getTasasVigentesHoy`).
 */
export default async function ProtectedLayout({ children }: LayoutProps<'/'>) {
  const usuario = await getUsuarioActual()
  if (!usuario) {
    redirect('/login')
  }

  // El indicador no debe tumbar el shell si las fuentes fallan: sin tasas
  // simplemente no se muestra el chip.
  let bcv: TasaIndicadorDato | null = null
  let bcvEur: TasaIndicadorDato | null = null
  try {
    const tasas = await getTasasVigentesHoy()
    const aDato = (t: TasasHoy['bcv']['usd']): TasaIndicadorDato | null =>
      t
        ? {
            valor: Number(t.tasa.valor_bs),
            fecha_valor: t.fecha_valor,
            origen: t.tasa.origen,
            publicada_en: t.tasa.publicada_en,
            arrastrada: t.arrastrada,
          }
        : null
    bcv = aDato(tasas.bcv.usd)
    bcvEur = aDato(tasas.bcv.eur)
  } catch (e) {
    console.error('[layout] no se pudieron resolver las tasas de hoy:', e)
  }

  return (
    <AppShell
      usuario={{ email: usuario.email, nombre: usuario.nombre, rol: usuario.rol }}
      topBarStart={<TasaIndicador bcv={bcv} bcvEur={bcvEur} />}
    >
      {children}
    </AppShell>
  )
}