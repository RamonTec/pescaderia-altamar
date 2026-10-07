import Link from 'next/link'
import Button from '@mui/material/Button'
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined'
import { EmptyState } from '@/components/molecules/EmptyState'

export default function NotFound() {
  return (
    <EmptyState
      icon={<PersonSearchOutlinedIcon fontSize="large" />}
      title="Este cliente no existe"
      description="Puede que el enlace esté mal escrito o que el cliente se haya eliminado. Búscalo en el listado."
      action={
        <Button component={Link} href="/clientes" variant="contained">
          Ir a clientes
        </Button>
      }
    />
  )
}
