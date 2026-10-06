import { redirect } from 'next/navigation'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'
import { AppShell } from '@/components/templates/AppShell'
import { CrearUsuarioForm } from '@/components/organisms/CrearUsuarioForm'
import { requireAdmin, listUsuarios } from '@/lib/services/authService'

export default async function UsuariosPage() {
  if (!(await requireAdmin())) redirect('/login')

  const usuarios = await listUsuarios()

  return (
    <AppShell>
      <Typography variant="h4" gutterBottom>
        Usuarios
      </Typography>

      <Box sx={{ maxWidth: 480, mb: 4 }}>
        <CrearUsuarioForm />
      </Box>

      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Rol</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {usuarios.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.nombre ?? '—'}</TableCell>
                <TableCell>
                  <Chip
                    label={u.rol}
                    size="small"
                    color={u.rol === 'admin' ? 'primary' : 'default'}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </AppShell>
  )
}
