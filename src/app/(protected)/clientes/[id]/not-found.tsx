import Link from 'next/link'
import Button from '@mui/material/Button'
import { EmptyState } from '@/components/molecules/EmptyState'

export default function NotFound() {
  return (
    <EmptyState
      title="Este cliente no existe"
      description="Puede que el enlace esté mal escrito o que el cliente se haya eliminado."
      action={
        <Button component={Link} href="/clientes" variant="contained">
          Ir a clientes
        </Button>
      }
    />
  )
}
