'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import LogoutIcon from '@mui/icons-material/Logout'
import PersonIcon from '@mui/icons-material/Person'
import GroupIcon from '@mui/icons-material/Group'
import PeopleIcon from '@mui/icons-material/People'
import MenuIcon from '@mui/icons-material/Menu'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import DashboardIcon from '@mui/icons-material/Dashboard'
import ScaleIcon from '@mui/icons-material/Scale'
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag'
import CategoryIcon from '@mui/icons-material/Category'
import CleaningServicesIcon from '@mui/icons-material/CleaningServices'
import PaymentsIcon from '@mui/icons-material/Payments'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import { createClient } from '@/lib/supabase/client'
import { signOutAction } from '@/app/login/actions'
import { ColorModeToggle } from '@/components/atoms/ColorModeToggle'

const NAV_WIDTH = 240

const NAV_ITEMS: {
  href: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
}[] = [
  { href: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { href: '/clientes', label: 'Clientes', icon: <PeopleIcon /> },
  { href: '/proveedores', label: 'Proveedores', icon: <LocalShippingIcon /> },
  { href: '/catalogos', label: 'Catálogos', icon: <CategoryIcon /> },
  { href: '/compras', label: 'Compras', icon: <ShoppingBagIcon /> },
  { href: '/procesamiento', label: 'Procesamiento', icon: <CleaningServicesIcon /> },
  { href: '/pedidos', label: 'Pedidos / POS', icon: <PointOfSaleIcon /> },
  { href: '/cobros', label: 'Cobros y Pagos', icon: <PaymentsIcon /> },
  { href: '/inventario', label: 'Inventario', icon: <Inventory2Icon /> },
  { href: '/usuarios', label: 'Usuarios', icon: <GroupIcon />, adminOnly: true },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [email, setEmail] = React.useState<string | null>(null)
  const [rol, setRol] = React.useState<'admin' | 'operador' | null>(null)

  const [prevDesktop, setPrevDesktop] = React.useState(isDesktop)
  if (prevDesktop !== isDesktop) {
    setPrevDesktop(isDesktop)
    setMobileOpen(false)
  }

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

  const closeDrawer = React.useCallback(() => setMobileOpen(false), [])

  const drawer = (
    <Box>
      <Toolbar>
        <ScaleIcon color="primary" sx={{ mr: 1.5 }} />
        <Typography variant="h6" noWrap component="div">
          Pescadería
        </Typography>
      </Toolbar>
      <List>
        {NAV_ITEMS.filter((item) => !item.adminOnly || rol === 'admin').map(
          (item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)
            return (
              <ListItemButton
                key={item.href}
                component={Link}
                href={item.href}
                selected={active}
                onClick={closeDrawer}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            )
          }
        )}
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
          {!isDesktop ? (
            <IconButton
              color="inherit"
              aria-label="Abrir menú"
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 1, color: 'text.secondary' }}
            >
              <MenuIcon />
            </IconButton>
          ) : null}
          <Typography variant="subtitle2" color="text.secondary" sx={{ flexGrow: 1 }}>
            <ReceiptLongIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />
            Gestión interna · Venezuela
          </Typography>
          {email ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}
            >
              {email}
              {rol ? ` · ${rol}` : ''}
            </Typography>
          ) : null}
          <ColorModeToggle />
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

      <Box
        component="nav"
        sx={{ width: { md: NAV_WIDTH }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant={isDesktop ? 'permanent' : 'temporary'}
          open={isDesktop ? true : mobileOpen}
          onClose={closeDrawer}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: NAV_WIDTH,
              boxSizing: 'border-box',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, width: { md: `calc(100% - ${NAV_WIDTH}px)` } }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  )
}
