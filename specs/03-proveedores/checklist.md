# Checklist — 03-proveedores

## Datos y seguridad
- [ ] Migraciones `0007`–`0010` aplicadas sin romper los proveedores semilla. *(archivos creados; aplicación en Supabase pendiente de ejecutar vía SQL Editor, igual que `02-clientes`)*
- [ ] El bucket `documentos-proveedores` existe, es privado, limita a 5 MB y a imagen/PDF; los archivos solo se abren con signed URL. *(bucket creado por la migración `0010`; falta aplicarla)*
- [ ] Un operador no puede bloquear ni desbloquear, ni desde la UI ni llamando la action o PostgREST directamente (lo rechaza el trigger). *(trigger `proveedores_guard_bloqueo` + `getRol()` en el servicio; falta verificación manual con sesión de operador)*
- [ ] Bloquear sin motivo es imposible (lo impiden zod, el servicio y el `check` de la base).
- [ ] No se pueden crear dos proveedores con el mismo RIF (sin importar mayúsculas); el error aparece en el campo RIF, no como error crudo de Postgres. *(índice único `upper(rif_ci)` + mapeo `23505`→`rif_ci` en `toActionError`)*
- [ ] Un proveedor con compras nunca se borra físicamente; la UI solo ofrece desactivar.

## Validación de formularios
- [x] Cada Server Action corre `safeParse` antes de llamar al servicio (verificado leyendo `proveedores/actions.ts`).
- [x] Persona jurídica sin representante → error visible en el paso 1.
- [x] Transferencia: cuenta ≠ 20 dígitos o banco desconocido → error; el banco se detecta solo con una cuenta válida.
- [x] Pago Móvil exige banco + teléfono móvil + RIF/CI; Zelle exige titular + email o teléfono.
- [x] A lo sumo un método preferido; no se aceptan métodos duplicados.
- [x] Los errores del servidor (`fieldErrors`) se muestran en su campo y el Stepper salta al paso que los tiene.
- [x] `validationMessages.ts` creado y usado por `clienteValidation.ts` y `proveedorValidation.ts`.

## Documentos
- [x] Subir, ver y reemplazar funciona para cédula, RIF, acta constitutiva, cédula de cada representante y "otros".
- [x] Reemplazar deja un solo documento de ese tipo (no se acumulan).
- [x] Archivos de tipo no permitido o de más de 5 MB se rechazan con un mensaje antes de subirlos; las fotos grandes se comprimen.
- [x] El indicador "Documentación incompleta" lista los faltantes correctos para persona natural y para jurídica, y desaparece al completarlos.

## UI/UX
- [x] Alta en un solo flujo: "Guardar y continuar" lleva a Documentos sin cerrar el diálogo.
- [x] Cerrar el formulario con cambios sin guardar pide confirmación.
- [x] Listado: búsqueda rápida, switch de inactivos, chips de estado con tooltip, `EmptyState` para "sin proveedores" y para "sin resultados".
- [x] Ficha: alerts de bloqueo y de documentación, copiar al portapapeles en los métodos de pago, historial de compras (o `EmptyState`).
- [x] `loading.tsx` del listado (skeleton de tabla) y de la ficha (skeleton de ficha); `error.tsx` con `ErrorState`; `not-found` para un id inexistente.
- [x] Todo botón de acción muestra un loader interno y queda `disabled` mientras procesa; toda escritura termina en un toast.
- [x] Sin `window.alert`/`confirm`; acciones destructivas con `ConfirmDialog`.
- [ ] Responsive a 375 px: diálogo a pantalla completa, columnas secundarias ocultas, sin scroll horizontal. *(implementado: `fullScreen` en `xs` y `columnVisibilityModel`; falta verificación manual)*
- [ ] Modo claro y oscuro revisados en el listado, el formulario (3 pasos) y la ficha. *(pendiente verificación manual)*

## Animaciones y acabados
- [x] Filas de representantes y tarjetas de métodos de pago entran y salen con `Collapse`.
- [x] Cambio de paso del Stepper y paso de skeleton a contenido con `Fade` (`duration.short`).
- [x] Ninguna transición usa `transition: 'all'` ni milisegundos escritos a mano (solo tokens del theme).
- [x] Con `prefers-reduced-motion` no hay animaciones molestas.

## Integración y cierre
- [x] `/proveedores` aparece en `AppShell`; `/catalogos` ya no gestiona proveedores.
- [x] `/clientes` sigue funcionando igual tras generalizar `DocumentoUpload`, `RepresentantesLegalesFieldArray` y `actionState`.
- [x] Componentes nuevos registrados en la tabla de `00-estandares-ui/spec.md`.
- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores.
- [ ] Si `04-inventario` ya existe: el saldo pendiente muestra un valor real, no `—`. *(04-inventario no implementa `proveedorBalanceService` → se muestra `—`, como prevé el spec)*

## Pendientes / deuda técnica
- [ ] Aplicar migraciones `0007`–`0010` en el proyecto Supabase real (SQL Editor / `db push`).
- [ ] Verificar el catálogo `BANCOS_VE` contra la lista vigente de SUDEBAN (marcado en `src/lib/bancosVe.ts`).
- [ ] Verificación manual en navegador (claro/oscuro, desktop/375px): alta natural y jurídica completa, RIF duplicado, cuenta con prefijo desconocido, Zelle sin email ni teléfono, reemplazo de documento, sesión de operador sin bloquear, copiar cuenta desde la ficha.
