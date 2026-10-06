'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import LogoutIcon from '@mui/icons-material/Logout'
import PersonIcon from '@mui/icons-material/Person'
import { createClient } from '@/lib/supabase/client'
import { signOutAction } from '@/app/login/actions'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import DashboardIcon from '@mui/icons-material/Dashboard'
import ScaleIcon from '@mui/icons-material/Scale'
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag'
import CategoryIcon from '@mui/icons-material/Category'
import CleaningServicesIcon from '@mui/icons-material/CleaningServices'
import PaymentsIcon from '@mui/icons-material/Payments'

const NAV_WIDTH = 240

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { href: '/catalogos', label: 'Catálogos', icon: <CategoryIcon /> },
  { href: '/compras', label: 'Compras', icon: <ShoppingBagIcon /> },
  { href: '/procesamiento', label: 'Procesamiento', icon: <CleaningServicesIcon /> },
  { href: '/pedidos', label: 'Pedidos / POS', icon: <PointOfSaleIcon /> },
  { href: '/cobros', label: 'Cobros y Pagos', icon: <PaymentsIcon /> },
  { href: '/inventario', label: 'Inventario', icon: <Inventory2Icon /> },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [email, setEmail] = React.useState<string | null>(null)
  const [rol, setRol] = React.useState<'admin' | 'operador' | null>(null)

  React.useEffect(() => {
    let active = true
    const supabase = createClient()
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return
        const user = data.session?.user
        setEmail(user?.email ?? null)
        if (user) {
          const { data: perfil } = await supabase
            .from('perfiles')
            .select('rol')
            .eq('id', user.id)
            .single()
          if (active) setRol((perfil?.rol as 'admin' | 'operador') ?? null)
        }
      })
      .catch(() => {
        if (active) setEmail(null)
      })
    return () => {
      active = false
    }
  }, [])

  const drawer = (
    <Box>
      <Toolbar>
        <ScaleIcon color="primary" sx={{ mr: 1.5 }} />
        <Typography variant="h6" noWrap component="div">
          Pescadería
        </Typography>
      </Toolbar>
      <List>
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              selected={active}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          )
        })}
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        color="transparent"
        elevation={0}
        sx={{ zIndex: (t) => t.zIndex.drawer + 1, bgcolor: 'background.paper' }}
      >
        <Toolbar>
          <Typography variant="subtitle2" color="text.secondary" sx={{ flexGrow: 1 }}>
            <ReceiptLongIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />
            Gestión interna · Venezuela
          </Typography>
          {email ? (
            <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>
              {email}
              {rol ? ` · ${rol}` : ''}
            </Typography>
          ) : null}
          <Button
            size="small"
            color="inherit"
            component={Link}
            href="/perfil"
            startIcon={<PersonIcon />}
            sx={{ color: 'text.secondary', mr: 1 }}
          >
            Perfil
          </Button>
          <form action={signOutAction}>
            <Button
              type="submit"
              size="small"
              color="inherit"
              startIcon={<LogoutIcon />}
              sx={{ color: 'text.secondary' }}
            >
              Salir
            </Button>
          </form>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: NAV_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: NAV_WIDTH, boxSizing: 'border-box' },
        }}
      >
        {drawer}
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, ml: `${NAV_WIDTH}px` }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  )
}
