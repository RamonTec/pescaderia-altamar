import Link from 'next/link'
import { EmptyState } from '@/components/molecules/EmptyState'
import Button from '@mui/material/Button'

export default function NotFound() {
  return (
    <EmptyState
      title="Proveedor no encontrado"
      description="El proveedor que buscas no existe o fue eliminado."
      action={
        <Button component={Link} href="/proveedores" variant="contained">
          Volver a proveedores
        </Button>
      }
    />
  )
}
