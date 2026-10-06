import Box from '@mui/material/Box'
import { RecuperarForm } from '@/components/organisms/RecuperarForm'

export default function RecuperarPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        bgcolor: 'background.default',
      }}
    >
      <RecuperarForm />
    </Box>
  )
}
