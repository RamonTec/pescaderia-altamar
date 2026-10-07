# Checklist — 00-estandares-ui

## Modo oscuro/claro
- [x] `theme.ts` usa `colorSchemes` (light/dark), no `palette.mode` fijo.
- [x] Cambiar el toggle alterna todo (fondo, texto, componentes MUI) sin parchar colores en componentes individuales.
- [x] Recargar la página con preferencia "oscuro" no muestra un flash en claro antes de aplicar el tema.
- [x] Contraste verificado (no solo "se ve bien") en ambos esquemas para texto normal y botones.

## Responsive
- [x] `AppShell` en viewport móvil (<600px) oculta el drawer permanente y lo reemplaza por uno temporal con botón de menú.
- [ ] Ninguna pantalla existente requiere scroll horizontal involuntario en móvil (tablas usan `columnVisibilityModel`, no se desbordan).
- [x] Formularios con varios campos se apilan en una columna en móvil.

## Loaders y estados
- [ ] Cada ruta principal tiene su `loading.tsx` usando `PageLoader` (no pantalla blanca durante la navegación).
- [ ] Ninguna tabla queda vacía sin `EmptyState` cuando no hay datos.
- [ ] Ningún `catch` de carga de datos deja la pantalla rota sin `ErrorState`.
- [ ] Ningún botón de acción se queda "sin feedback" mientras procesa (loader interno + disabled).

## Notificaciones y confirmaciones
- [x] No queda ningún `window.alert` o `window.confirm` en el código.
- [ ] Toda escritura a base de datos muestra un toast de éxito o error.
- [ ] Toda acción destructiva pasa por `ConfirmDialog`.

## Formularios y formato
- [x] `react-hook-form` + `zod` instalados y usados en al menos un formulario de referencia (el que se construya primero en `01-auth` o `02-clientes`).
- [x] `NumberField` se usa para todo campo de dinero o peso, no `<input type="number">` plano.
- [x] `formatUsd`/`formatBs`/`formatKg`/`formatTasa` son las únicas funciones de formato de estos valores en todo el código (sin `toFixed()` repetido).

## Validación de formularios
- [ ] `clientes/actions.ts` corre `clienteFormSchema.safeParse(input)` antes de escribir (hoy NO lo hace — ver tarea 23 de `tasks.md`).
- [ ] Cada módulo nuevo (`03-proveedores` en adelante) sigue el patrón `<entidad>Validation.ts` y valida también en su Server Action, desde el primer commit.
- [ ] `src/lib/validationMessages.ts` existe solo si ya hubo un segundo módulo repitiendo un mensaje — si no hay repetición todavía, este ítem no aplica (marcar como N/A, no como pendiente).

## Transiciones
- [ ] Alternar modo claro/oscuro se ve como una transición corta, no un corte brusco.
- [ ] Ninguna transición custom (`sx`) usa `transition: 'all'`.
- [ ] Filas que se agregan/quitan en formularios dinámicos (ej. representantes legales) no aparecen/desaparecen de golpe.

## General
- [x] La tabla de "Componentes compartidos" en `spec.md` está al día con lo que realmente existe en `src/components`.
- [x] `npm run lint` y `npx tsc --noEmit` sin errores.

## Pendientes / deuda técnica
- [ ] Persistencia del modo via cookie: la cookie `mui-mode` se escribe desde el cliente (en `themeStorage.ts`); el `layout.tsx` la lee y fija `data-mui-color-scheme` en `<html>`. No se usa Server Action — el primer render server-side no conoce la preferencia y depende de `InitColorSchemeScript` (igual que el flujo recomendado por MUI). Diferido: no hay Server Action dedicada para setear la cookie antes del primer render.
- [ ] Los ítems no marcados de "Loaders y estados" y "Notificaciones y confirmaciones" (por pantalla) se completan en los módulos 01-05 al construir sus pantallas reales; los componentes base ya existen y `layout.tsx` ya envuelve con `NotificationProvider`/`ConfirmProvider`.
- [ ] `@mui/material-nextjs` NO se instaló: se mantuvo el `ThemeRegistry` custom (CacheProvider + useServerInsertedHTML) y se usó `InitColorSchemeScript` de `@mui/material` directamente, que ya trae la integración necesaria. Documentado en `tasks.md` tarea 1.
