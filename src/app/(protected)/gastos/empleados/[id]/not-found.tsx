import Link from 'next/link'
import Button from '@mui/material/Button'
import { EmptyState } from '@/components/molecules/EmptyState'

export default function NotFound() {
  return (
    <EmptyState
      title="Empleado no encontrado"
      description="El empleado que buscas no existe."
      action={
        <Button component={Link} href="/gastos?tab=empleados" variant="contained">
          Volver a empleados
        </Button>
      }
    />
  )
}
