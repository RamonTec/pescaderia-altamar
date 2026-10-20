import Link from 'next/link'
import Button from '@mui/material/Button'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import { EmptyState } from '@/components/molecules/EmptyState'

export default function NotFound() {
  return (
    <EmptyState
      icon={<LocalShippingOutlinedIcon fontSize="large" />}
      title="Esta compra no existe"
      description="Puede que el enlace esté mal escrito. Búscala en Compras o en la ficha del proveedor."
      action={
        <Button component={Link} href="/compras" variant="contained">
          Ir a compras
        </Button>
      }
    />
  )
}
