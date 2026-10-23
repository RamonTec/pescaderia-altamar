import Link from 'next/link'
import Button from '@mui/material/Button'
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined'
import { EmptyState } from '@/components/molecules/EmptyState'

export default function NotFound() {
  return (
    <EmptyState
      icon={<RequestQuoteOutlinedIcon fontSize="large" />}
      title="Esta cotización no existe"
      description="Puede que el enlace esté mal escrito. Búscala en el listado por número o cliente."
      action={
        <Button component={Link} href="/cotizaciones" variant="contained">
          Ir a cotizaciones
        </Button>
      }
    />
  )
}
