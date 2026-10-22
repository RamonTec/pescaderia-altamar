'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import SubdirectoryArrowRightOutlinedIcon from '@mui/icons-material/SubdirectoryArrowRightOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined'
import { RowActionsMenu, type RowAction } from '@/components/molecules/RowActionsMenu'
import { EmptyState } from '@/components/molecules/EmptyState'
import { CategoriaGastoForm } from '@/components/organisms/CategoriaGastoForm'
import { useConfirm } from '@/lib/useConfirm'
import { useNotify } from '@/lib/useNotify'
import { cambiarActivoCategoriaGastoAction } from '@/app/(protected)/gastos/actions'
import type { CategoriaGasto } from '@/types/domain'

export interface CategoriasGastoPanelProps {
  /** Árbol: categorías de primer nivel con `subcategorias`. */
  categorias: CategoriaGasto[]
}

type Dialogo =
  | { tipo: 'nueva'; padreId: string | null }
  | { tipo: 'editar'; categoria: CategoriaGasto }
  | null

/**
 * Catálogo de categorías de gasto (20-gastos): lista agrupada (categoría con
 * sus subcategorías), chip "Sistema" en Nómina y "Inactiva" en las
 * desactivadas. Acciones en `⋮`: Nueva subcategoría, Editar (renombrar,
 * mover, ordenar) y Desactivar/Activar con confirmación. Desactivar oculta la
 * categoría en los selectores pero conserva sus gastos.
 */
export function CategoriasGastoPanel({ categorias }: CategoriasGastoPanelProps) {
  const confirm = useConfirm()
  const notify = useNotify()
  const [dialogo, setDialogo] = React.useState<Dialogo>(null)
  const [pendiente, setPendiente] = React.useState<string | null>(null)
  const [, startTransition] = React.useTransition()

  const cambiarActivo = async (c: CategoriaGasto) => {
    if (c.activo) {
      const ok = await confirm({
        title: `¿Desactivar ${c.nombre}?`,
        message:
          c.categoria_padre_id === null && (c.subcategorias?.length ?? 0) > 0
            ? 'Deja de aparecer al registrar gastos, junto con sus subcategorías. Sus gastos siguen en los reportes.'
            : 'Deja de aparecer al registrar gastos. Sus gastos siguen en los reportes.',
        confirmLabel: 'Desactivar',
        destructive: true,
      })
      if (!ok) return
    }
    setPendiente(c.id)
    startTransition(async () => {
      const r = await cambiarActivoCategoriaGastoAction({ id: c.id, activo: !c.activo })
      setPendiente(null)
      if (r.error) notify.error(r.error)
      else notify.success(r.success ?? 'Categoría actualizada')
    })
  }

  const acciones = (c: CategoriaGasto): RowAction[] => {
    const lista: RowAction[] = []
    if (c.categoria_padre_id === null && c.clave !== 'nomina' && c.activo) {
      lista.push({
        label: 'Nueva subcategoría',
        icon: <SubdirectoryArrowRightOutlinedIcon fontSize="small" />,
        onClick: () => setDialogo({ tipo: 'nueva', padreId: c.id }),
      })
    }
    lista.push({
      label: c.es_sistema ? 'Cambiar orden' : 'Editar',
      icon: <EditOutlinedIcon fontSize="small" />,
      onClick: () => setDialogo({ tipo: 'editar', categoria: c }),
    })
    if (!c.es_sistema) {
      lista.push(
        c.activo
          ? {
              label: 'Desactivar',
              icon: <VisibilityOffOutlinedIcon fontSize="small" />,
              onClick: () => void cambiarActivo(c),
              destructive: true,
            }
          : {
              label: 'Activar',
              icon: <VisibilityOutlinedIcon fontSize="small" />,
              onClick: () => void cambiarActivo(c),
            }
      )
    }
    return lista
  }

  const fila = (c: CategoriaGasto, sub: boolean) => (
    <ListItem
      key={c.id}
      divider
      sx={{ pl: sub ? { xs: 4, sm: 6 } : 2, opacity: c.activo ? 1 : 0.7 }}
      secondaryAction={
        <RowActionsMenu label={c.nombre} actions={acciones(c)} pending={pendiente === c.id} size="small" />
      }
    >
      <ListItemText
        primary={
          <Box component="span" sx={{ display: 'inline-flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {sub ? <SubdirectoryArrowRightOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} /> : null}
            <span>{c.nombre}</span>
            {c.es_sistema ? <Chip size="small" variant="soft" color="info" label="Sistema" /> : null}
            {!c.activo ? <Chip size="small" variant="soft" label="Inactiva" /> : null}
          </Box>
        }
        secondary={
          !sub && (c.subcategorias?.length ?? 0) > 0
            ? `${c.subcategorias?.length} subcategoría${c.subcategorias?.length === 1 ? '' : 's'}`
            : undefined
        }
        slotProps={{ primary: { variant: sub ? 'body2' : 'subtitle2' } }}
      />
    </ListItem>
  )

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<AddOutlinedIcon />}
          onClick={() => setDialogo({ tipo: 'nueva', padreId: null })}
        >
          Nueva categoría
        </Button>
      </Box>
      <Paper variant="outlined">
        {categorias.length === 0 ? (
          <EmptyState icon={<CategoryOutlinedIcon />} title="Aún no hay categorías" compact />
        ) : (
          <List disablePadding aria-label="Categorías de gasto">
            {categorias.map((c) => [fila(c, false), ...(c.subcategorias ?? []).map((s) => fila(s, true))])}
          </List>
        )}
      </Paper>

      <CategoriaGastoForm
        key={
          dialogo ? (dialogo.tipo === 'editar' ? dialogo.categoria.id : `nueva-${dialogo.padreId ?? ''}`) : 'cerrado'
        }
        open={!!dialogo}
        categoria={dialogo?.tipo === 'editar' ? dialogo.categoria : null}
        padreInicial={dialogo?.tipo === 'nueva' ? dialogo.padreId : null}
        categorias={categorias}
        onClose={() => setDialogo(null)}
      />
    </Box>
  )
}
