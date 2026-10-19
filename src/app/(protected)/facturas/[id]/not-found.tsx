import Link from 'next/link'
import Button from '@mui/material/Button'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import { EmptyState } from '@/components/molecules/EmptyState'

export default function NotFound() {
  return (
    <EmptyState
      icon={<ReceiptLongOutlinedIcon fontSize="large" />}
      title="Esta factura no existe"
      description="Puede que el enlace esté mal escrito. Búscala en Cobros o en la ficha del cliente."
      action={
        <Button component={Link} href="/cobros" variant="contained">
          Ir a cobros
        </Button>
      }
    />
  )
}
