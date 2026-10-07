# Tareas — 00-estandares-ui

No depende de otro módulo. Se ejecuta primero (o en paralelo muy temprano con `01-auth`, ya que el login también debe quedar construido con estos estándares).

## Theme y modo oscuro

1. **Instalar `@mui/material-nextjs`** — DECIDIDO: no se instaló. Se mantuvo el `ThemeRegistry` custom (CacheProvider + useServerInsertedHTML) y se usó `InitColorSchemeScript` directamente desde `@mui/material` (`import InitColorSchemeScript from '@mui/material/InitColorSchemeScript'`), que ya trae la integración con App Router. Motivo: evitar dependencia nueva y el provider manual ya funciona con SSR. Documentado 2026-10-06.
2. **`src/theme/theme.ts`**: reemplazar `palette: {...}` por `colorSchemes: { light: { palette: {...} }, dark: { palette: {...} } }`, manteniendo `cssVariables: true`. Definir paleta oscura con `background.default`/`background.paper` oscuros reales y los mismos `primary`/`secondary`/`success`/`warning`/`error` ajustados si el contraste AA no se cumple sobre fondo oscuro (verificar con una herramienta de contraste, no a ojo).
3. **`src/theme/ThemeRegistry.tsx`**: agregar `InitColorSchemeScript` antes del render para evitar flash of wrong theme en el primer load.
4. **`src/components/atoms/ColorModeToggle.tsx`**: usa `useColorScheme()` de MUI, ciclo `light → dark → system`, ícono acorde (`LightModeIcon`/`DarkModeIcon`/`SettingsBrightnessIcon`).
5. **Insertar `ColorModeToggle` en `AppShell.tsx`** (dentro del `AppBar`, a la derecha).

## Responsive

6. **`AppShell.tsx`**: agregar estado `mobileOpen` + `IconButton`/`MenuIcon` en el `AppBar` (visible solo `xs`/`sm`), `Drawer` pasa a `variant={isDesktop ? 'permanent' : 'temporary'}` usando `useMediaQuery(theme.breakpoints.up('md'))`.
   - Hecho cuando: en viewport `<900px` el drawer no está montado permanentemente, se abre con el botón de menú y se cierra al navegar o tocar fuera.

## Utilidades compartidas

7. **`src/lib/format.ts`**: `formatUsd`, `formatBs`, `formatKg`, `formatTasa` (usar `Intl.NumberFormat` con locale `es-VE` donde aplique, o formateo manual si `es-VE` no da el resultado exacto esperado — verificar con un caso real antes de asumir).
8. **`src/components/atoms/NumberField.tsx`**: envuelve `TextField` de MUI, props `decimals`, `prefix`/`suffix` (ej. `$`, `kg`), maneja el parseo a `number` para el form sin perder el formato visual mientras se escribe.

## Loaders y estados

9. **`src/components/atoms/PageLoader.tsx`**: variante `table` (filas de `Skeleton`) y variante `form` (bloques de `Skeleton` simulando campos) — recibe una prop `variant` para reusar en distintos `loading.tsx`.
10. **`src/components/molecules/EmptyState.tsx`**: props `icon`, `title`, `description?`, `action?` (botón opcional).
11. **`src/components/molecules/ErrorState.tsx`**: props `message`, `onRetry?`.
12. **`src/components/molecules/ConfirmDialog.tsx`** + **`src/lib/useConfirm.tsx`** (hook/contexto que renderiza el diálogo y retorna una promesa `confirm(options): Promise<boolean>`).

## Notificaciones

13. **`src/components/organisms/NotificationProvider.tsx`**: contexto + `Snackbar` de MUI, con cola si hay más de una notificación en simultáneo (usar el patrón de cola recomendado en la documentación de MUI para `Snackbar`, no mostrar dos superpuestos).
14. **`src/lib/useNotify.ts`**: hook que consume el contexto anterior, expone `notify.success/error/info`.
15. **Envolver el árbol en `src/app/layout.tsx`** con `NotificationProvider` (dentro de `ThemeRegistry`, para que los toasts respeten el theme).

## Formularios

16. **Instalar `react-hook-form`, `zod`, `@hookform/resolvers`**.
17. **`src/components/molecules/PageHeader.tsx`**: título (`h4`) + `children` para acciones (botones a la derecha), usado como encabezado estándar de toda página de listado.

## Validación de formularios (ya en uso, formalizar para los módulos siguientes)

21. **No crear `useAppForm`/`schemas/` nuevos** — el patrón ya vigente (`src/lib/clienteValidation.ts`: un archivo `<entidad>Validation.ts` con regex + esquema `zod` + tipo inferido, `mode: 'onSubmit'` en `useForm`) es el estándar. Esta tarea es solo dejarlo escrito en `spec.md` (ya hecho) para que `03-proveedores` lo siga sin tener que inferirlo del código.
22. **`src/lib/validationMessages.ts`**: crear **solo cuando** un segundo módulo repita un mensaje literal ya usado en `clienteValidation.ts` (ej. `proveedorValidation.ts` necesitará el mismo mensaje de RIF inválido) — en ese momento, extraer esos mensajes puntuales, no todos, y actualizar `clienteValidation.ts` para usarlos también.

## Validación en Server Actions (gap a corregir)

23. **Agregar a `02-clientes` (retroactivo)**: en `src/app/(protected)/clientes/actions.ts`, después de `JSON.parse(raw)`, correr `clienteFormSchema.safeParse(input)` y devolver el error estructurado si falla, antes de llamar a `clienteService`/`clienteRepository`. Hoy ese archivo valida el JSON pero no el esquema de negocio — queda expuesto a datos inválidos si algo llama la action sin pasar por `ClienteForm.tsx`.
24. **Regla para todos los módulos siguientes** (`03-proveedores` en adelante): ninguna Server Action que reciba datos de formulario se considera completa sin su `safeParse` correspondiente al inicio. Se verifica en el checklist de cada módulo, no solo aquí.

## Transiciones (nuevo estándar, revisar si ya se montó algo que lo contradiga)

25. **`src/app/layout.tsx` o `ThemeRegistry.tsx`**: agregar transición corta (`background-color`, `color`) a nivel global (`body` o el elemento que `CssBaseline` estiliza) usando `theme.transitions.create([...], { duration: theme.transitions.duration.short })`, para que alternar `ColorModeToggle` no sea un corte brusco. Verificar que no quede ya resuelto de otra forma antes de duplicar.
26. **Revisar formularios dinámicos existentes** (`RepresentantesLegalesFieldArray.tsx` en `02-clientes`, que usa `useFieldArray`): envolver cada fila en `Collapse` si hoy aparece/desaparece de golpe al agregar/quitar un representante. Si ya se ve bien, anotar aquí que se revisó y no hizo falta cambio.

## Verificación

18. Alternar manualmente entre claro/oscuro/sistema en al menos dos pantallas existentes (`/` y `/catalogos` aunque sigan siendo placeholders) y confirmar que no hay texto illegible ni fondos que no cambian.
19. Reducir el viewport a 375px de ancho sobre `AppShell` y confirmar que el drawer se oculta y aparece el botón de menú.
20. Documentar en este archivo (al pie) cualquier componente nuevo agregado después de esta primera pasada, para mantener la tabla de "Componentes compartidos" del `spec.md` actualizada.
27. Alternar `ColorModeToggle` y confirmar que el cambio de fondo/texto se ve como una transición corta, no un corte instantáneo.
28. Confirmar (leyendo el código, no solo probando la UI) que `clientes/actions.ts` corre `clienteFormSchema.safeParse` antes de escribir — si no, es la tarea 23 pendiente.

## Componentes agregados después de la primera pasada
- _(los módulos 01-05 anotan aquí cualquier componente genérico nuevo que creen, con fecha y motivo, y lo agregan también a la tabla de `spec.md`)_
- **2026-10-06 (03-proveedores)**: `lib/validationMessages.ts` (cierra tarea 22), `lib/actionState.ts`, `lib/documentoStore.ts`, `lib/bancosVe.ts`, generalización de `DocumentoUpload` (adaptador `DocumentoStore`) y de `RepresentantesLegalesFieldArray` (tipado genérico + `Collapse`, cierra tarea 26), y `CopyableText` / `StatusChips` en `molecules`. Todos agregados a la tabla de `spec.md`.

## Nota de implementación (2026-10-06)

- Persistencia del modo en cookie: `src/lib/themeStorage.ts` implementa un `StorageManager` de MUI que escribe la cookie `mui-mode` además de `localStorage`; `layout.tsx` la lee y aplica `data-mui-color-scheme` en `<html>` antes del render. El `InitColorSchemeScript` cubre el primer load del cliente. No se usó Server Action para setear la cookie (diferido, ver checklist).
- `useNotify` es un re-export en `src/lib/useNotify.ts` que apunta a `components/organisms/NotificationProvider.tsx` (fuente única del hook + proveedor).
- `useConfirm` vive en `src/lib/useConfirm.tsx` (proveedor + hook) y usa `components/molecules/ConfirmDialog.tsx`.
- `NotificationProvider` usa un `useReducer` con cola para mostrar notificaciones en serie (patrón recomendado por MUI), evitando superponer Snackbars.
