import Box from '@mui/material/Box'
import { PaginaFallback } from '@/components/organisms/PaginaFallback'

/** URL que no existe fuera de la app (sin shell): fallback centrado en la página. */
export default function NotFound() {
  return (
    <Box
      component="main"
      sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', px: 2, bgcolor: 'background.default' }}
    >
      <PaginaFallback
        tipo="no-encontrado"
        titulo="Esta página no existe"
        texto="Puede que el enlace esté mal escrito o que la página se haya movido."
      />
    </Box>
  )
}
