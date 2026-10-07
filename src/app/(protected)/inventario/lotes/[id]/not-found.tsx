import Link from 'next/link'
import Button from '@mui/material/Button'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import { EmptyState } from '@/components/molecules/EmptyState'

export default function NotFound() {
  return (
    <EmptyState
      icon={<Inventory2OutlinedIcon fontSize="large" />}
      title="Este lote no existe"
      description="Puede que el código o el enlace estén mal escritos. Búscalo por código en la pestaña Lotes."
      action={
        <Button component={Link} href="/inventario?tab=lotes" variant="contained">
          Ir a lotes
        </Button>
      }
    />
  )
}
