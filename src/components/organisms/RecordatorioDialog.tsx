'use client'

import * as React from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Collapse from '@mui/material/Collapse'
import Fade from '@mui/material/Fade'
import FormControlLabel from '@mui/material/FormControlLabel'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import MailOutlineOutlinedIcon from '@mui/icons-material/MailOutlineOutlined'
import { EstadoCarteraChip } from '@/components/atoms/EstadoCarteraChip'
import { AppDialog } from '@/components/organisms/AppDialog'
import { ErrorState } from '@/components/molecules/ErrorState'
import { formatFecha, formatUsd } from '@/lib/format'
import { estadoDe, saldoDocumento, textoVencimiento } from '@/lib/cartera/estado'
import { construirRecordatorio, totalRecordado } from '@/lib/cartera/recordatorios/plantillas'
import { urlWhatsApp } from '@/lib/cartera/recordatorios/canales/whatsapp'
import type { CanalRecordatorioId } from '@/lib/cartera/types'
import type { PreparacionRecordatorio } from '@/lib/services/recordatorioService'
import {
  enviarRecordatorioCorreoAction,
  prepararRecordatorioAction,
  registrarRecordatorioWhatsappAction,
} from '@/app/(protected)/cartera/actions'
import { useNotify } from '@/lib/useNotify'

const ETIQUETA_CANAL: Record<CanalRecordatorioId, string> = { whatsapp: 'WhatsApp', email: 'correo' }

const horaFormatter = new Intl.DateTimeFormat('es-VE', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Caracas',
})
const diaFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Caracas',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function textoAviso(aviso: NonNullable<PreparacionRecordatorio['aviso']>, hoy: string): string {
  const fecha = new Date(aviso.fecha)
  const cuando = diaFormatter.format(fecha) === hoy ? 'hoy' : 'ayer'
  return `Ya se le recordó ${cuando} por ${ETIQUETA_CANAL[aviso.canal]} a las ${horaFormatter.format(fecha)}.`
}

export interface RecordatorioDialogProps {
  open: boolean
  clienteId: string
  /** Nombre para el subtítulo mientras carga. */
  clienteNombre: string
  /** Preselección (ej. "Recordar" en una fila de `/cobros`); sin valor, todas las que tienen saldo. */
  facturaIds?: string[]
  onClose: () => void
  /** Enlace "Editar cliente" cuando un canal no está disponible por datos del cliente. */
  onEditarCliente?: () => void
  /** Tras registrar o enviar (ej. `router.refresh()`). */
  onEnviado?: () => void
}

type Carga =
  | { estado: 'cargando' }
  | { estado: 'error'; mensaje: string }
  | { estado: 'listo'; datos: PreparacionRecordatorio }

/**
 * Recordatorio de cobro (09-cuentas-por-cobrar), solo admin:
 *   1. facturas a incluir (preseleccionadas las que tienen saldo) con el
 *      total en vivo;
 *   2. canal (WhatsApp / correo) con su disponibilidad y motivo;
 *   3. vista previa editable (correo: asunto, HTML en `iframe sandbox` sin
 *      scripts y texto plano);
 *   4. aviso si ya hubo un recordatorio en las últimas 24 h;
 *   5. "Abrir WhatsApp" (abre `wa.me` en el mismo clic y luego registra) o
 *      "Enviar correo" (loader en el botón y toast con el resultado).
 * Montar con `key` al abrir para reiniciar el estado.
 */
export function RecordatorioDialog({
  open,
  clienteId,
  clienteNombre,
  facturaIds,
  onClose,
  onEditarCliente,
  onEnviado,
}: RecordatorioDialogProps) {
  const notify = useNotify()
  const theme = useTheme()
  const [carga, setCarga] = React.useState<Carga>({ estado: 'cargando' })
  const [intento, setIntento] = React.useState(0)
  const [seleccion, setSeleccion] = React.useState<ReadonlySet<string>>(() => new Set())
  const [canal, setCanal] = React.useState<CanalRecordatorioId>('whatsapp')
  const [textoWhatsapp, setTextoWhatsapp] = React.useState('')
  const [asunto, setAsunto] = React.useState('')
  const [textoCorreo, setTextoCorreo] = React.useState('')
  const [editado, setEditado] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const enviandoRef = React.useRef(false)
  const facturaIdsKey = facturaIds?.join(',') ?? ''

  React.useEffect(() => {
    if (!open) return
    let vigente = true
    const ids = facturaIdsKey ? facturaIdsKey.split(',') : undefined
    prepararRecordatorioAction({ clienteId, facturaIds: ids })
      .then((r) => {
        if (!vigente) return
        if (r.error || !r.preparacion) {
          setCarga({ estado: 'error', mensaje: r.error ?? 'No se pudo preparar el recordatorio' })
          return
        }
        const p = r.preparacion
        setCarga({ estado: 'listo', datos: p })
        setSeleccion(new Set(p.seleccion))
        setTextoWhatsapp(p.mensajes.whatsapp.texto)
        setAsunto(p.mensajes.email.asunto)
        setTextoCorreo(p.mensajes.email.texto)
        setEditado(false)
        setCanal(!p.canales.whatsapp.ok && p.canales.email.ok ? 'email' : 'whatsapp')
      })
      .catch(() => {
        if (vigente) {
          setCarga({
            estado: 'error',
            mensaje: 'No se pudo preparar el recordatorio. Revisa tu conexión e intenta de nuevo.',
          })
        }
      })
    return () => {
      vigente = false
    }
  }, [open, clienteId, facturaIdsKey, intento])

  const datos = carga.estado === 'listo' ? carga.datos : null
  const seleccionados = React.useMemo(
    () => (datos ? datos.documentos.filter((d) => seleccion.has(d.id)) : []),
    [datos, seleccion]
  )
  const total = totalRecordado(seleccionados)

  // HTML de la vista previa del correo: se rearma con la selección (el texto
  // plano y el asunto son los editables).
  const htmlCorreo = React.useMemo(() => {
    if (!datos || seleccionados.length === 0) return ''
    return construirRecordatorio({ ...datos.datos, documentos: seleccionados }, 'email').html
  }, [datos, seleccionados])

  const cambiarSeleccion = (id: string, marcado: boolean) => {
    if (!datos) return
    const next = new Set(seleccion)
    if (marcado) next.add(id)
    else next.delete(id)
    setSeleccion(next)
    // Al cambiar las facturas se rearma el mensaje.
    const docs = datos.documentos.filter((d) => next.has(d.id))
    if (docs.length > 0) {
      const base = { ...datos.datos, documentos: docs }
      setTextoWhatsapp(construirRecordatorio(base, 'whatsapp').texto)
      const correo = construirRecordatorio(base, 'email')
      setAsunto(correo.asunto)
      setTextoCorreo(correo.texto)
    }
  }

  const disponibilidad = datos?.canales[canal]
  const puedeEnviar =
    !!datos && !!disponibilidad?.ok && seleccionados.length > 0 && !pending &&
    (canal === 'whatsapp' ? !!textoWhatsapp.trim() : !!textoCorreo.trim() && !!asunto.trim())

  const abrirWhatsapp = () => {
    if (!datos || !disponibilidad?.ok || enviandoRef.current) return
    // La pestaña se abre en el mismo gesto del clic: después de un `await`
    // el navegador la bloquearía como ventana emergente.
    const ventana = window.open(urlWhatsApp(disponibilidad.destino, textoWhatsapp.trim()), '_blank')
    if (!ventana) {
      setError('El navegador bloqueó la ventana de WhatsApp. Permite las ventanas emergentes para este sitio e intenta de nuevo.')
      return
    }
    ventana.opener = null
    enviandoRef.current = true
    setPending(true)
    setError(null)
    registrarRecordatorioWhatsappAction({
      clienteId,
      facturaIds: seleccionados.map((d) => d.id),
      texto: textoWhatsapp,
    })
      .then((r) => {
        if (r.error) {
          setError(`WhatsApp se abrió, pero no se pudo registrar el recordatorio: ${r.error}`)
          return
        }
        notify.success(r.success ?? 'Recordatorio registrado')
        onEnviado?.()
        onClose()
      })
      .catch(() => setError('WhatsApp se abrió, pero no se pudo registrar el recordatorio. Revisa tu conexión.'))
      .finally(() => {
        enviandoRef.current = false
        setPending(false)
      })
  }

  const enviarCorreo = async () => {
    if (!datos || !disponibilidad?.ok || enviandoRef.current) return
    enviandoRef.current = true
    setPending(true)
    setError(null)
    try {
      const r = await enviarRecordatorioCorreoAction({
        clienteId,
        facturaIds: seleccionados.map((d) => d.id),
        asunto,
        texto: textoCorreo,
      })
      if (r.error) {
        setError(r.error)
        notify.error(r.error)
        // Un correo fallido queda en el historial con "Reintentar".
        if (r.resultado) onEnviado?.()
        return
      }
      notify.success(r.success ?? 'Correo enviado')
      onEnviado?.()
      onClose()
    } catch {
      setError('No se pudo enviar el correo. Revisa tu conexión e intenta de nuevo.')
    } finally {
      enviandoRef.current = false
      setPending(false)
    }
  }

  const primaryAction =
    carga.estado === 'listo' ? (
      canal === 'whatsapp' ? (
        <Button
          variant="contained"
          startIcon={<WhatsAppIcon />}
          loading={pending}
          loadingPosition="start"
          disabled={!puedeEnviar}
          onClick={abrirWhatsapp}
        >
          Abrir WhatsApp
        </Button>
      ) : (
        <Button
          variant="contained"
          startIcon={<MailOutlineOutlinedIcon />}
          loading={pending}
          loadingPosition="start"
          disabled={!puedeEnviar}
          onClick={() => void enviarCorreo()}
        >
          Enviar correo
        </Button>
      )
    ) : null

  const fade = { enter: theme.transitions.duration.short, exit: theme.transitions.duration.shortest }

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      size="md"
      title="Enviar recordatorio"
      subtitle={datos ? datos.cliente.nombre : clienteNombre}
      pending={pending}
      dirty={editado}
      error={error}
      primaryAction={primaryAction}
      autoFocusFirstField={false}
    >
      {carga.estado === 'cargando' ? (
        <Box sx={{ display: 'grid', gap: 1.5 }} aria-busy="true" aria-label="Preparando recordatorio">
          <Skeleton variant="rounded" height={24} width="40%" />
          <Skeleton variant="rounded" height={44} />
          <Skeleton variant="rounded" height={44} />
          <Skeleton variant="rounded" height={36} width="60%" />
          <Skeleton variant="rounded" height={160} />
        </Box>
      ) : carga.estado === 'error' ? (
        <ErrorState
          message={carga.mensaje}
          onRetry={() => {
            setCarga({ estado: 'cargando' })
            setIntento((n) => n + 1)
          }}
        />
      ) : datos ? (
        <Fade in timeout={fade}>
          <Box sx={{ display: 'grid', gap: 3 }}>
            <Collapse in={!!datos.aviso} timeout={theme.transitions.duration.standard}>
              {datos.aviso ? (
                <Alert severity="info" sx={{ maxWidth: '75ch' }}>
                  {textoAviso(datos.aviso, datos.datos.hoy)}
                </Alert>
              ) : null}
            </Collapse>

            {/* 1. Facturas */}
            <Box component="fieldset" sx={{ border: 0, m: 0, p: 0, minWidth: 0, display: 'grid', gap: 1 }}>
              <Box component="legend" sx={{ p: 0, mb: 1, display: 'flex', width: '100%', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="subtitle1" component="span">
                  Facturas a incluir
                </Typography>
                <Typography variant="subtitle1" component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  Total: {formatUsd(total)}
                </Typography>
              </Box>
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.5 }}>
                {datos.documentos.map((d) => {
                  const estado = estadoDe(d, datos.datos.hoy, datos.datos.diasAviso)
                  return (
                    <Box
                      component="li"
                      key={d.id}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 48, borderBottom: 1, borderColor: 'divider' }}
                    >
                      <FormControlLabel
                        sx={{ flexGrow: 1, minWidth: 0, mr: 0 }}
                        control={
                          <Checkbox
                            checked={seleccion.has(d.id)}
                            disabled={pending}
                            onChange={(e) => cambiarSeleccion(d.id, e.target.checked)}
                          />
                        }
                        label={
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                              {d.numero}
                            </Typography>
                            <Typography
                              variant="caption"
                              color={estado === 'vencida' ? 'error' : 'text.secondary'}
                              noWrap
                              component="p"
                            >
                              {textoVencimiento(d, datos.datos.hoy, datos.datos.diasAviso) ??
                                `Vence ${formatFecha(d.fecha_vencimiento)}`}
                            </Typography>
                          </Box>
                        }
                      />
                      <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                        <EstadoCarteraChip estado={estado} />
                      </Box>
                      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', minWidth: 88, textAlign: 'right' }}>
                        {formatUsd(saldoDocumento(d))}
                      </Typography>
                    </Box>
                  )
                })}
              </Box>
              <Collapse in={seleccionados.length === 0}>
                <Typography variant="caption" color="error" component="p">
                  Selecciona al menos una factura.
                </Typography>
              </Collapse>
            </Box>

            {/* 2. Canal */}
            <Box sx={{ display: 'grid', gap: 1 }}>
              <Typography variant="subtitle1" component="h3">
                Canal
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={canal}
                onChange={(_, next: CanalRecordatorioId | null) => {
                  if (next) {
                    setCanal(next)
                    setError(null)
                  }
                }}
                aria-label="Canal del recordatorio"
                disabled={pending}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                {(['whatsapp', 'email'] as const).map((id) => {
                  const d = datos.canales[id]
                  const boton = (
                    <ToggleButton
                      value={id}
                      disabled={!d.ok}
                      aria-label={d.ok ? ETIQUETA_CANAL[id] : `${ETIQUETA_CANAL[id]}: ${d.motivo}`}
                      sx={{ flex: { xs: 1, sm: 'none' }, gap: 1, px: 2 }}
                    >
                      {id === 'whatsapp' ? <WhatsAppIcon fontSize="small" /> : <MailOutlineOutlinedIcon fontSize="small" />}
                      {id === 'whatsapp' ? 'WhatsApp' : 'Correo'}
                    </ToggleButton>
                  )
                  return d.ok ? (
                    <React.Fragment key={id}>{boton}</React.Fragment>
                  ) : (
                    <Tooltip key={id} title={d.motivo}>
                      <Box component="span" sx={{ display: 'inline-flex', flex: { xs: 1, sm: 'none' } }}>
                        {boton}
                      </Box>
                    </Tooltip>
                  )
                })}
              </ToggleButtonGroup>
              {(['whatsapp', 'email'] as const)
                .filter((id) => !datos.canales[id].ok)
                .map((id) => {
                  const d = datos.canales[id]
                  const deCliente = !d.ok && d.motivo !== 'Correo no configurado'
                  return (
                    <Typography key={id} variant="caption" color="text.secondary" component="p">
                      {ETIQUETA_CANAL[id][0].toUpperCase() + ETIQUETA_CANAL[id].slice(1)} no disponible:{' '}
                      {d.ok ? '' : d.motivo}.
                      {deCliente && onEditarCliente ? (
                        <>
                          {' '}
                          <Link component="button" type="button" variant="caption" onClick={onEditarCliente}>
                            Editar cliente
                          </Link>
                        </>
                      ) : null}
                    </Typography>
                  )
                })}
            </Box>

            {/* 3. Vista previa editable */}
            {disponibilidad?.ok ? (
              <Fade in key={canal} timeout={fade}>
                <Box sx={{ display: 'grid', gap: 1.5 }}>
                  <Typography variant="subtitle1" component="h3">
                    Mensaje
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Para: {disponibilidad.destino}
                  </Typography>
                  {canal === 'whatsapp' ? (
                    <TextField
                      label="Texto del mensaje"
                      multiline
                      minRows={8}
                      maxRows={18}
                      fullWidth
                      value={textoWhatsapp}
                      disabled={pending}
                      onChange={(e) => {
                        setTextoWhatsapp(e.target.value)
                        setEditado(true)
                      }}
                      helperText="Puedes editarlo antes de abrir WhatsApp. *Texto* sale en negrita."
                    />
                  ) : (
                    <>
                      <TextField
                        label="Asunto *"
                        fullWidth
                        value={asunto}
                        disabled={pending}
                        onChange={(e) => {
                          setAsunto(e.target.value)
                          setEditado(true)
                        }}
                      />
                      <Box
                        component="iframe"
                        title="Vista previa del correo"
                        sandbox=""
                        srcDoc={htmlCorreo}
                        sx={{
                          width: '100%',
                          height: 360,
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: '8px',
                          bgcolor: 'background.default',
                        }}
                      />
                      <TextField
                        label="Texto plano del correo"
                        multiline
                        minRows={6}
                        maxRows={14}
                        fullWidth
                        value={textoCorreo}
                        disabled={pending}
                        onChange={(e) => {
                          setTextoCorreo(e.target.value)
                          setEditado(true)
                        }}
                        helperText="Versión sin formato para clientes de correo que no muestran HTML."
                      />
                    </>
                  )}
                </Box>
              </Fade>
            ) : null}
          </Box>
        </Fade>
      ) : null}
    </AppDialog>
  )
}
