import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'

/**
 * Skeleton de `/tasas` (spec 08: tarjetas + tabla). Nivel 3 de carga: la
 * forma de la pantalla real, dentro del shell.
 */
export default function Loading() {
  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      {/* Encabezado */}
      <Box sx={{ display: 'grid', gap: 1 }}>
        <Skeleton variant="text" width={280} />
        <Skeleton variant="text" width={220} />
      </Box>

      {/* Tarjetas de vigentes hoy */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr))',
          },
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={150} />
        ))}
      </Box>

      {/* Tabla de historial */}
      <Skeleton variant="rounded" height={420} />
    </Box>
  )
}