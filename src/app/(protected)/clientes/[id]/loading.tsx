import { PageLoader } from '@/components/atoms/PageLoader'
import { CarteraSeccionSkeleton } from '@/components/molecules/CarteraResumenCards'

export default function Loading() {
  return (
    <PageLoader variant="ficha">
      <CarteraSeccionSkeleton />
    </PageLoader>
  )
}
