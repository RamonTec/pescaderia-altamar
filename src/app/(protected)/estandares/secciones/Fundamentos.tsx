'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { BrandMark } from '@/components/atoms/BrandMark'
import { FileteLaton } from '@/components/atoms/FileteLaton'
import { AppDialog } from '@/components/organisms/AppDialog'
import { formatUsd } from '@/lib/format'
import { useNotify } from '@/lib/useNotify'
import { useResaltado } from '@/lib/useResaltado'
import { ESPACIO, MOTION, SOMBRAS } from '@/theme/tokens'
import { Apartado, Demo, Demos, Seccion } from './comun'

/* ---------- superficies ---------- */

const SUPERFICIES = [
  { token: 'background.default', nombre: 'Fondo', uso: 'página' },
  { token: 'background.paper', nombre: 'Superficie (0)', uso: 'tablas, secciones, tarjetas', borde: 'divider' },
  { token: 'background.elevated', nombre: 'Elevada (1 y 2)', uso: 'modal, menú, popover', borde: 'dialogDivider' },
  { token: 'background.field', nombre: 'Campo', uso: 'inputs, select', borde: 'inputBorder' },
  { token: 'background.subtle', nombre: 'Suave', uso: 'encabezado de tabla, hover' },
  { token: 'segmented.track', nombre: 'Track de segmentado', uso: 'fondo del SegmentedControl' },
] as const

function Muestra({ token, nombre, uso, borde }: { token: string; nombre: string; uso: string; borde?: string }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.75 }}>
      <Box
        sx={{
          height: 56,
          borderRadius: '6px',
          bgcolor: token,
          border: 1,
          borderColor: borde ?? 'divider',
        }}
      />
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {nombre}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {token} · {uso}
      </Typography>
    </Box>
  )
}

/** Modal de muestra, estático y siempre en oscuro: una sola superficie con campos más oscuros. */
function ModalOscuroEstatico() {
  return (
    <Box data-mui-color-scheme="dark" sx={{ colorScheme: 'dark', bgcolor: 'background.default', p: 2, borderRadius: '8px' }}>
      <Box
        sx={{
          bgcolor: 'background.elevated',
          border: 1,
          borderColor: 'dialogDivider',
          borderRadius: '8px',
          color: 'text.primary',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'dialogDivider' }}>
          <Typography variant="h6">Nuevo producto</Typography>
        </Box>
        <Box sx={{ p: 3, display: 'grid', gap: ESPACIO.formCampoVertical }}>
          <TextField label="Nombre *" size="small" fullWidth defaultValue="Pargo rojo" />
          <TextField label="Categoría" size="small" fullWidth />
        </Box>
        <Box sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'dialogDivider', display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
          <Button color="inherit" sx={{ color: 'text.secondary' }}>
            Cancelar
          </Button>
          <Button variant="contained">Crear producto</Button>
        </Box>
      </Box>
    </Box>
  )
}

/* ---------- movimiento ---------- */

function DemosMovimiento() {
  const notify = useNotify()
  const [modal, setModal] = React.useState(false)
  const [menu, setMenu] = React.useState<HTMLElement | null>(null)
  const { idResaltado, resaltar } = useResaltado()

  return (
    <Demos columnas={2}>
      <Demo label={`Modal: fundido + 8 px (${MOTION.duraciones.lenta} ms / ${MOTION.duraciones.salida} ms)`}>
        <Box>
          <Button variant="outlined" onClick={() => setModal(true)}>
            Abrir modal
          </Button>
        </Box>
        <AppDialog
          open={modal}
          onClose={() => setModal(false)}
          size="xs"
          title="Modal de muestra"
          primaryAction={
            <Button variant="contained" onClick={() => setModal(false)}>
              Listo
            </Button>
          }
        >
          <Typography variant="body2">Entra con fundido y sube 8 px.</Typography>
        </AppDialog>
      </Demo>
      <Demo label={`Menú: fundido + escala (${MOTION.duraciones.media} ms)`}>
        <Box>
          <Button variant="outlined" onClick={(e) => setMenu(e.currentTarget)}>
            Abrir menú
          </Button>
        </Box>
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
          <MenuItem onClick={() => setMenu(null)}>Editar</MenuItem>
          <MenuItem onClick={() => setMenu(null)}>Duplicar</MenuItem>
        </Menu>
      </Demo>
      <Demo label="Toast: entra desde abajo y se va a los 5 s">
        <Box>
          <Button variant="outlined" onClick={() => notify.success('Compra registrada')}>
            Mostrar toast
          </Button>
        </Box>
      </Demo>
      <Demo label="Fila nueva o editada: fondo latón tenue que se desvanece en 2 s">
        <Box>
          <Button variant="outlined" onClick={() => resaltar('fila')}>
            Resaltar
          </Button>
        </Box>
        <Box
          className={idResaltado === 'fila' ? 'puerto-resaltado' : undefined}
          sx={{ px: 2, height: 56, display: 'flex', alignItems: 'center', borderTop: 1, borderBottom: 1, borderColor: 'rowDivider' }}
        >
          <Typography variant="body2">Restaurante El Muelle</Typography>
        </Box>
      </Demo>
      <Demo label="Botón: hover y presión (120 ms) · skeleton con pulso">
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button variant="contained">Pasa el cursor</Button>
          <Skeleton variant="rounded" width={160} height={36} />
        </Box>
      </Demo>
      <Demo label="Movimiento reducido">
        <Typography variant="body2" color="text.secondary">
          Con «Reducir movimiento» activo en el sistema, todo queda quieto: el modal aparece sin
          desplazarse, el filete no barre y el resaltado solo cambia el fondo durante 2 s.
        </Typography>
      </Demo>
    </Demos>
  )
}

/* ---------- sección ---------- */

export function Fundamentos() {
  return (
    <Seccion
      id="fundamentos"
      titulo="Fundamentos"
      descripcion="Superficies por nivel, color y jerarquía, tipografía, espaciado, radios, elevación, movimiento y el decorativo de marca (spec § Design system)."
    >
      <Apartado titulo="Superficies por nivel">
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(6, minmax(0, 1fr))' },
          }}
        >
          {SUPERFICIES.map((s) => (
            <Muestra key={s.token} {...s} />
          ))}
        </Box>
        <Demos>
          <Demo label="Modal en oscuro: encabezado, cuerpo y pie en una sola superficie; campos más oscuros">
            <ModalOscuroEstatico />
          </Demo>
          <Demo label="Divisores: rowDivider entre filas, dialogDivider en lo elevado, scrim detrás del modal">
            <Box sx={{ display: 'grid' }}>
              {['Fila 1', 'Fila 2', 'Fila 3'].map((f) => (
                <Box key={f} sx={{ height: 44, display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'rowDivider' }}>
                  <Typography variant="body2">{f}</Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ height: 48, borderRadius: '6px', bgcolor: 'scrim' }} />
          </Demo>
        </Demos>
      </Apartado>

      <Apartado titulo="Color y jerarquía">
        <Demos>
          <Demo label="Una acción principal por vista; las demás, neutras">
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Button variant="contained">Registrar compra</Button>
              <Button variant="outlined">Exportar</Button>
              <Button>Ver detalle</Button>
              <Button color="inherit" sx={{ color: 'text.secondary' }}>
                Cancelar
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary">
              La destructiva va solo dentro de una confirmación o del menú ⋮, en{' '}
              <Box component="span" sx={{ color: 'error.main' }}>
                error
              </Box>
              .
            </Typography>
          </Demo>
          <Demo label="Dónde va el latón (y en ningún otro lado)">
            <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'grid', gap: 0.5, typography: 'body2' }}>
              <li>Foco visible (anillo en claro, contorno en oscuro).</li>
              <li>Acción principal en oscuro.</li>
              <li>Decorativo de marca: filete, punto del ítem activo, progreso de navegación y loader global.</li>
              <li>Acción del toast («Ver», «Deshacer»).</li>
            </Box>
            <FileteLaton width={80} />
          </Demo>
        </Demos>
      </Apartado>

      <Apartado titulo="Tipografía">
        <Demos>
          <Demo label="Escala: Fraunces en títulos y cifras, Instrument Sans en el resto">
            <Typography variant="h3">h3 · Altamar Sea Food</Typography>
            <Typography variant="h4">h4 · Título de página</Typography>
            <Typography variant="h5">h5 · Cifra {formatUsd(12480.5)}</Typography>
            <Typography variant="h6">h6 · Título de modal y de tarjeta</Typography>
            <Typography variant="sectionTitle">sectionTitle · Sección de formulario</Typography>
            <Typography variant="label">label · Etiqueta fija de campo</Typography>
            <Typography variant="subtitle2">subtitle2 · Encabezado de columna</Typography>
            <Typography variant="body1">body1 · Texto corrido de alertas y descripciones.</Typography>
            <Typography variant="body2">body2 · Tablas, formularios y menús.</Typography>
            <Typography variant="caption">caption · Ayudas y RIF bajo el nombre</Typography>
          </Demo>
          <Demo label="Cifras tabulares: las columnas de montos alinean">
            <Box sx={{ display: 'grid', justifyItems: 'end', fontVariantNumeric: 'tabular-nums' }}>
              <Typography variant="body2">{formatUsd(1500)}</Typography>
              <Typography variant="body2">{formatUsd(111.11)}</Typography>
              <Typography variant="body2">{formatUsd(98765.43)}</Typography>
            </Box>
          </Demo>
        </Demos>
      </Apartado>

      <Apartado titulo="Espaciado, radios y elevación">
        <Demos columnas={3}>
          <Demo label="Escala de 4 px">
            {[4, 8, 12, 16, 24, 32, 40, 48, 64].map((px) => (
              <Box key={px} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="caption" sx={{ width: 28, textAlign: 'right' }}>
                  {px}
                </Typography>
                <Box sx={{ height: 8, width: px, bgcolor: 'text.primary', borderRadius: '2px' }} />
              </Box>
            ))}
            <Typography variant="caption" color="text.secondary">
              Formulario 24 / 16 / 40 · página 16 / 24 / 64 · bloques 48
            </Typography>
          </Demo>
          <Demo label="Radios: 4 chip · 6 control · 8 superficie">
            <Box sx={{ display: 'flex', gap: 2 }}>
              {[4, 6, 8].map((r) => (
                <Box key={r} sx={{ width: 56, height: 56, border: 1, borderColor: 'inputBorder', borderRadius: `${r}px`, display: 'grid', placeItems: 'center' }}>
                  <Typography variant="caption">{r}</Typography>
                </Box>
              ))}
            </Box>
          </Demo>
          <Demo label="Elevación: 0 reposo · 1 menú y toast · 2 modal">
            <Box sx={{ display: 'flex', gap: 2 }}>
              {[0, 1, 2].map((n) => (
                <Box
                  key={n}
                  sx={(t) => ({
                    width: 56,
                    height: 56,
                    borderRadius: '8px',
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: n === 0 ? 'background.paper' : 'background.elevated',
                    border: n === 0 ? 1 : 0,
                    borderColor: 'divider',
                    boxShadow: n === 0 ? 'none' : n === 1 ? SOMBRAS.claro.elevacion1 : SOMBRAS.claro.elevacion2,
                    ...t.applyStyles('dark', {
                      boxShadow: n === 0 ? 'none' : n === 1 ? SOMBRAS.oscuro.elevacion1 : SOMBRAS.oscuro.elevacion2,
                    }),
                  })}
                >
                  <Typography variant="caption">{n}</Typography>
                </Box>
              ))}
            </Box>
          </Demo>
        </Demos>
      </Apartado>

      <Apartado titulo="Movimiento">
        <DemosMovimiento />
      </Apartado>

      <Apartado titulo="Marca">
        <Demos>
          <Demo label="BrandMark: full, isotipo y vertical (isotipo provisional Puerto)">
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3 }}>
              <BrandMark />
              <BrandMark variant="isotipo" size={34} />
              <BrandMark orientation="vertical" size={72} />
            </Box>
            <Box sx={{ bgcolor: 'brand.midnight', p: 2, borderRadius: '8px' }}>
              <BrandMark sobreMedianoche />
            </Box>
          </Demo>
          <Demo label="FileteLaton: rule (2 px) y sweep (3 px, progreso indeterminado)">
            <FileteLaton />
            <FileteLaton variant="sweep" height={3} track />
          </Demo>
        </Demos>
      </Apartado>
    </Seccion>
  )
}
