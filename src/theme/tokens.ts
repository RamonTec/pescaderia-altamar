/**
 * Design system Altamar — Tokens de fundamentos (Fase 4, 2026-10-29).
 * Fuente: specs/00-estandares-ui/spec.md § Design system (Fase 4).
 *
 * Movimiento, tiempos de carga/feedback, espaciado semántico y sombras
 * por nivel de elevación. Ningún componente escribe milisegundos,
 * sombras sueltas ni números mágicos de espaciado.
 */

export const MOTION = {
  duraciones: {
    rapida: 120,
    media: 200,
    lenta: 280,
    salida: 180,
  },
  curvas: {
    entrada: 'cubic-bezier(0.2, 0, 0, 1)',
    salida: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const

export const TIEMPOS = {
  LOADER_RETARDO_MS: 150,
  LOADER_MINIMO_MS: 400,
  NAV_RETARDO_MS: 100,
  TOAST_MS: 5000,
  RESALTADO_MS: 2000,
} as const

/**
 * Usos semánticos de espaciado en unidades de `theme.spacing` (base 8 px).
 * En `sx` se usan directamente estos valores: p: ESPACIO.modalPadding
 */
export const ESPACIO = {
  /** Márgenes de página */
  paginaMargenXs: 2, // 16 px
  paginaMargenSm: 3, // 24 px
  paginaMargenLg: 8, // 64 px

  /** Entre bloques de página (encabezado, barra, tabla, secciones de ficha) */
  bloquesPagina: 6, // 48 px
  bloquesPaginaXs: 4, // 32 px

  /** Formulario: entre bloques campo + ayuda (vertical) */
  formCampoVertical: 3, // 24 px

  /** Formulario: entre columnas */
  formColumnas: 2, // 16 px

  /** Formulario: entre secciones */
  formSecciones: 5, // 40 px

  /** Formulario: del título de sección al contenido */
  formTituloAContenido: 2, // 16 px

  /** Formulario: de la etiqueta al campo, y del campo a su ayuda */
  formEtiquetaACampo: 0.75, // 6 px
  formCampoAAyuda: 0.75, // 6 px

  /** Padding del modal */
  modalPadding: 3, // 24 px
  modalPaddingXs: 2, // 16 px
} as const

/**
 * Sombras por elevación (spec.md § Radios y elevación).
 * Nivel 0: sin sombra (borde 1 px).
 * Nivel 1: menú, popover, autocomplete, toast.
 * Nivel 2: modal y drawer temporal, con scrim.
 */
export const SOMBRAS = {
  claro: {
    elevacion1: '0 12px 32px rgba(11, 27, 51, 0.14)',
    elevacion2: '0 24px 56px rgba(11, 27, 51, 0.22)',
  },
  oscuro: {
    elevacion1: '0 12px 32px rgba(0, 0, 0, 0.4)', // DS-8
    elevacion2: '0 24px 56px rgba(0, 0, 0, 0.5)',
  },
} as const
