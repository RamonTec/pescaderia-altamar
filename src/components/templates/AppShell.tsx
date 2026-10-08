'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined'
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined'
import CleaningServicesOutlinedIcon from '@mui/icons-material/CleaningServicesOutlined'
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import CurrencyExchangeOutlinedIcon from '@mui/icons-material/CurrencyExchangeOutlined'
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import { signOutAction } from '@/app/(auth)/login/actions'
import { BrandMark } from '@/components/atoms/BrandMark'
import { ColorModeToggle } from '@/components/atoms/ColorModeToggle'
import {
  NavigationProgress,
  NavigationProgressProvider,
  NavLinkStatus,
} from '@/components/atoms/NavigationProgress'
import type { Rol } from '@/lib/services/authService'
import { useGlobalLoader } from '@/lib/useGlobalLoader'

/** Ancho del menú lateral en `md+` y del riel de íconos en `sm`. */
const NAV_WIDTH = 248
const RAIL_WIDTH = 72

export interface AppShellUsuario {
  email: string
  nombre: string | null
  rol: Rol | null
}

export interface AppShellProps {
  /** Sesión resuelta en el servidor (`(protected)/layout.tsx`). */
  usuario: AppShellUsuario
  /**
   * Contenido al inicio de la barra superior (ej. el indicador de la tasa
   * del día de `08-tasas`). Opcional.
   */
  topBarStart?: React.ReactNode
  children: React.ReactNode
}

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
  devOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Inicio', icon: <HomeOutlinedIcon /> },
  { href: '/clientes', label: 'Clientes', icon: <PeopleOutlinedIcon /> },
  {
    href: '/proveedores',
    label: 'Proveedores',
    icon: <LocalShippingOutlinedIcon />,
  },
  { href: '/catalogos', label: 'Catálogos', icon: <CategoryOutlinedIcon /> },
  { href: '/compras', label: 'Compras', icon: <ShoppingBagOutlinedIcon /> },
  {
    href: '/procesamiento',
    label: 'Procesamiento',
    icon: <CleaningServicesOutlinedIcon />,
  },
  {
    href: '/pedidos',
    label: 'Pedidos / POS',
    icon: <PointOfSaleOutlinedIcon />,
  },
  { href: '/cobros', label: 'Cobros y pagos', icon: <PaymentsOutlinedIcon /> },
  // 06-contratos: bitácora de contratos, solo admin.
  {
    href: '/contratos',
    label: 'Contratos',
    icon: <DescriptionOutlinedIcon />,
    adminOnly: true,
  },
  {
    href: '/tasas',
    label: 'Tasas de cambio',
    icon: <CurrencyExchangeOutlinedIcon />,
  },
  {
    href: '/notas-credito',
    label: 'Notas de crédito',
    icon: <DescriptionOutlinedIcon />,
  },
  {
    href: '/inventario',
    label: 'Inventario',
    icon: <Inventory2OutlinedIcon />,
  },
  {
    href: '/usuarios',
    label: 'Usuarios',
    icon: <GroupOutlinedIcon />,
    adminOnly: true,
  },
  {
    href: '/estandares',
    label: 'Estándares UI',
    icon: <PaletteOutlinedIcon />,
    adminOnly: true,
    devOnly: true,
  },
]

/**
 * COMPAT TEMPORAL (2026-10-07): `cobros/page.tsx` (y las otras páginas con
 * cambios de 08-tasas sin commitear) todavía se envuelven en `<AppShell>`.
 * Si un `AppShell` queda dentro de otro, el interno solo renderiza
 * `children` para no duplicar el shell. Borrar este contexto cuando ninguna
 * página importe `AppShell` (ver specs/00-estandares-ui/tasks.md, tarea 32).
 */
const AppShellNestingContext = React.createContext(false)

export function AppShell(props: AppShellProps | { children: React.ReactNode }) {
  const nested = React.useContext(AppShellNestingContext)
  if (nested || !('usuario' in props)) {
    return <>{props.children}</>
  }
  return (
    <AppShellNestingContext.Provider value>
      <AppShellFrame {...props} />
    </AppShellNestingContext.Provider>
  )
}

function iniciales(usuario: AppShellUsuario): string {
  const base = usuario.nombre?.trim() || usuario.email
  const partes = base.split(/[\s@._-]+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '?'
}

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

/** Marcador del ítem activo: las franjas de la borda, verticales. */
function ActiveStripes() {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        position: 'absolute',
        left: 0,
        top: 6,
        bottom: 6,
        width: 4,
        display: 'grid',
        gridTemplateRows: '2fr 1fr 2fr',
        borderRadius: '1px',
        overflow: 'hidden',
      }}
    >
      <Box component="span" sx={{ bgcolor: 'brand.ochre' }} />
      <Box component="span" sx={{ bgcolor: 'brand.trim' }} />
      <Box component="span" sx={{ bgcolor: 'brand.red' }} />
    </Box>
  )
}

function NavList({
  items,
  pathname,
  rail,
  onNavigate,
}: {
  items: NavItem[]
  pathname: string
  /** `true` en el menú permanente: en `sm` se colapsa a riel de íconos. */
  rail: boolean
  onNavigate?: () => void
}) {
  const theme = useTheme()
  const isRail = useMediaQuery(theme.breakpoints.only('sm')) && rail
  const hideOnRail = rail ? { display: { sm: 'none', md: 'block' } } : undefined

  return (
    <List
      component="div"
      sx={{
        px: rail ? { sm: 1, md: 1.5 } : 1.5,
        py: 1,
        display: 'grid',
        gap: 0.25,
      }}
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Tooltip key={item.href} title={isRail ? item.label : ''} placement="right">
            <ListItemButton
              component={Link}
              href={item.href}
              selected={active}
              aria-current={active ? 'page' : undefined}
              onClick={onNavigate}
              sx={(t) => ({
                position: 'relative',
                minHeight: 44,
                borderRadius: '6px',
                px: 1.5,
                gap: 1.5,
                justifyContent: rail ? { sm: 'center', md: 'flex-start' } : 'flex-start',
                color: 'text.secondary',
                transition: t.transitions.create(['background-color', 'color'], {
                  duration: t.transitions.duration.shortest,
                }),
                '&.Mui-selected': { color: 'primary.main', fontWeight: 500 },
                '&.Mui-selected .MuiListItemIcon-root': {
                  color: 'primary.main',
                },
              })}
            >
              <NavLinkStatus />
              {active ? <ActiveStripes /> : null}
              <ListItemIcon sx={{ minWidth: 0, color: 'inherit' }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                sx={{ m: 0, ...hideOnRail }}
                slotProps={{
                  primary: {
                    variant: 'body2',
                    sx: { fontWeight: 'inherit', fontSize: 'inherit' },
                  },
                }}
              />
            </ListItemButton>
          </Tooltip>
        )
      })}
    </List>
  )
}

function AccountMenu({ usuario }: { usuario: AppShellUsuario }) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)
  const close = () => setAnchor(null)
  const menuId = React.useId()

  return (
    <>
      <Tooltip title="Cuenta">
        <IconButton
          aria-label={`Cuenta de ${usuario.email}`}
          aria-controls={anchor ? menuId : undefined}
          aria-haspopup="menu"
          aria-expanded={anchor ? 'true' : undefined}
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ p: 0.5 }}
        >
          <Avatar
            sx={(t) => ({
              width: 34,
              height: 34,
              typography: 'body2',
              fontWeight: 600,
              bgcolor: `rgba(${t.vars?.palette.primary.mainChannel} / 0.12)`,
              color: 'primary.main',
            })}
          >
            {iniciales(usuario)}
          </Avatar>
        </IconButton>
      </Tooltip>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 240, mt: 0.5 } } }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle1" noWrap>
            {usuario.nombre || usuario.email}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="p">
            {usuario.nombre ? `${usuario.email} · ` : ''}
            {usuario.rol === 'admin'
              ? 'Administrador'
              : usuario.rol === 'operador'
                ? 'Operador'
                : 'Sin rol'}
          </Typography>
        </Box>
        <Divider />
        <MenuItem component={Link} href="/perfil" onClick={close}>
          <ListItemIcon>
            <PersonOutlineOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Mi perfil
        </MenuItem>
        <SignOutMenuItem onDone={close} />
      </Menu>
    </>
  )
}

function SignOutMenuItem({ onDone }: { onDone: () => void }) {
  const globalLoader = useGlobalLoader()
  const [isPending, startTransition] = React.useTransition()

  const signOut = () => {
    if (isPending) return
    onDone()
    // La action termina en `redirect('/login')`: el loader se libera al cambiar de ruta.
    const release = globalLoader.show('Cerrando sesión', { untilNavigation: true })
    startTransition(async () => {
      try {
        await signOutAction()
      } catch (error) {
        // Sin esto, un fallo (red caída) dejaría el loader a pantalla completa pegado.
        release()
        throw error
      }
    })
  }

  return (
    <MenuItem onClick={signOut} disabled={isPending}>
      <ListItemIcon>
        <LogoutOutlinedIcon fontSize="small" />
      </ListItemIcon>
      Cerrar sesión
    </MenuItem>
  )
}

function AppShellFrame({ usuario, topBarStart, children }: AppShellProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const closeDrawer = React.useCallback(() => setMobileOpen(false), [])

  const items = React.useMemo(
    () =>
      NAV_ITEMS.filter(
        (item) =>
          (!item.adminOnly || usuario.rol === 'admin') &&
          (!item.devOnly || process.env.NODE_ENV !== 'production')
      ),
    [usuario.rol]
  )

  return (
    <NavigationProgressProvider>
      <Box sx={{ display: 'flex', minHeight: '100dvh', width: '100%' }}>
        {/* sm+: menú permanente (riel de 72 px en sm, 248 px en md+) */}
        <Box
          component="nav"
          aria-label="Principal"
          sx={{
            display: { xs: 'none', sm: 'block' },
            width: { sm: RAIL_WIDTH, md: NAV_WIDTH },
            flexShrink: 0,
          }}
        >
          <Drawer
            variant="permanent"
            open
            sx={{
              '& .MuiDrawer-paper': {
                width: { sm: RAIL_WIDTH, md: NAV_WIDTH },
                boxSizing: 'border-box',
                overflowX: 'hidden',
              },
            }}
          >
            <Box
              sx={{
                height: 64,
                display: 'flex',
                alignItems: 'center',
                justifyContent: { sm: 'center', md: 'flex-start' },
                px: { sm: 0, md: 2.5 },
                flexShrink: 0,
              }}
            >
              <Box sx={{ display: { sm: 'none', md: 'flex' } }}>
                <BrandMark size={40} />
              </Box>
              <Box sx={{ display: { sm: 'flex', md: 'none' } }}>
                <BrandMark variant="isotipo" size={40} />
              </Box>
            </Box>
            <NavList items={items} pathname={pathname} rail />
          </Drawer>
        </Box>

        {/* xs: menú temporal */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={closeDrawer}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { width: NAV_WIDTH, boxSizing: 'border-box' },
          }}
        >
          <Box component="nav" aria-label="Principal">
            <Box
              sx={{
                height: 56,
                display: 'flex',
                alignItems: 'center',
                px: 2.5,
              }}
            >
              <BrandMark size={36} />
            </Box>
            <NavList items={items} pathname={pathname} rail={false} onNavigate={closeDrawer} />
          </Box>
        </Drawer>

        <Box
          sx={{
            flexGrow: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            component="header"
            sx={(t) => ({
              position: 'sticky',
              top: 0,
              zIndex: t.zIndex.appBar,
              height: { xs: 56, sm: 64 },
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 0.5, sm: 2 },
              px: { xs: 0.75, sm: 3, lg: 4 },
              bgcolor: 'background.paper',
              borderBottom: 1,
              borderColor: 'divider',
            })}
          >
            <IconButton
              aria-label="Abrir menú"
              onClick={() => setMobileOpen(true)}
              sx={{
                display: { xs: 'inline-flex', sm: 'none' },
                color: 'text.primary',
              }}
            >
              <MenuOutlinedIcon />
            </IconButton>
            <Box sx={{ display: { xs: 'flex', sm: 'none' } }}>
              <BrandMark variant="isotipo" size={34} />
            </Box>
            {topBarStart}
            <Box sx={{ flexGrow: 1 }} />
            <ColorModeToggle />
            <AccountMenu usuario={usuario} />
            {/* Progreso de navegación: borde inferior de la barra, arriba del contenido */}
            <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: -3 }}>
              <NavigationProgress />
            </Box>
          </Box>

          <Box
            component="main"
            sx={{
              flexGrow: 1,
              width: '100%',
              maxWidth: 1440,
              mx: 'auto',
              px: { xs: 2, sm: 3, lg: 4 },
              py: { xs: 3, md: 4 },
            }}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </NavigationProgressProvider>
  )
}
