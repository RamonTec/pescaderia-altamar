# Checklist — 03-proveedores

## Datos y seguridad
- [x] Migraciones `0007`–`0010` aplicadas sin romper los proveedores semilla. *(Aplicadas; confirmado por el usuario el 2026-10-07. Falta comprobar a mano que los proveedores semilla siguen bien.)*
- [ ] El bucket `documentos-proveedores` existe, es privado, limita a 5 MB y a imagen/PDF; los archivos solo se abren con signed URL. *(bucket creado por la migración `0010`, aplicada el 2026-10-07; falta comprobar a mano el límite de 5 MB, los tipos y la signed URL)*
- [ ] Un operador no puede bloquear ni desbloquear, ni desde la UI ni llamando la action o PostgREST directamente (lo rechaza el trigger). *(trigger `proveedores_guard_bloqueo` + `getRol()` en el servicio; falta verificación manual con sesión de operador)*
- [ ] Bloquear sin motivo es imposible (lo impiden zod, el servicio y el `check` de la base).
- [ ] No se pueden crear dos proveedores con el mismo RIF (sin importar mayúsculas); el error aparece en el campo RIF, no como error crudo de Postgres. *(índice único `upper(rif_ci)` + mapeo `23505`→`rif_ci` en `toActionError`)*
- [ ] Un proveedor con compras nunca se borra físicamente; la UI solo ofrece desactivar.

## Validación de formularios
- [x] Cada Server Action corre `safeParse` antes de llamar al servicio (verificado leyendo `proveedores/actions.ts`).
- [x] Persona jurídica sin representante → error visible en el paso 1. *(Reemplazado el 2026-10-13: los representantes pasan a ser opcionales; ver sección "Cambio de alcance 2026-10-13".)*
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
- [x] Si `04-inventario` ya existe: el saldo pendiente muestra un valor real, no `—`. *(2026-10-06: `proveedorService.getSaldoPendiente` delega en `proveedorBalanceService` de 04-inventario; requiere la migración `0012` aplicada para tener compras registradas)*

## Cambio de alcance 2026-10-13: representante legal opcional
- [x] Un jurídico sin representantes se guarda sin errores (en el form y en la server action). *(Comprobado con `proveedorFormSchema.safeParse`, el mismo schema que usan `zodResolver` y `actions.ts`; falta el recorrido manual en el navegador.)*
- [x] Una fila de representante agregada pero incompleta sigue mostrando el error en su campo. *(Con `safeParse`, los errores caen en `representantes.0.nombre` y `representantes.0.cedula`.)*
- [x] El estado vacío del paso 1 dice "Sin representantes (opcional)."; en `/clientes` sigue diciendo "Agrega al menos uno." *(Prop `opcional` solo en `ProveedorIdentificacionFields`.)*
- [x] La ficha del jurídico sin representantes muestra el `Alert` `info` con el botón "Agregar". *(Implementado; falta la verificación visual en claro y oscuro.)*
- [x] La documentación del jurídico sin representantes solo exige RIF y acta constitutiva; con representantes, también la cédula de cada uno. *(`evaluarDocumentacion` ya iteraba solo sobre los existentes; solo cambió el JSDoc.)*
- [x] `/clientes` jurídico sigue exigiendo al menos un representante. *(`clienteValidation.ts` y `clienteService.ts` sin cambios.)*
- [x] Sin migración nueva (confirmado: 0008 no tiene constraint); `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores. *(Lint: 0 errores; queda 1 warning previo en `NotaCreditoForm.tsx`, ajeno a este cambio.)*
- [ ] Recorrido manual en el navegador: alta de un jurídico sin representantes en los 3 pasos y ficha resultante. *(Pendiente: requiere sesión en la app.)*

## Pendientes / deuda técnica
- [x] Aplicar migraciones `0007`–`0010` en el proyecto Supabase real (SQL Editor / `db push`). _(Aplicadas; confirmado por el usuario el 2026-10-07.)_
- [ ] Verificar el catálogo `BANCOS_VE` contra la lista vigente de SUDEBAN (marcado en `src/lib/bancosVe.ts`).
- [ ] Verificación manual en navegador (claro/oscuro, desktop/375px): alta natural y jurídica completa, RIF duplicado, cuenta con prefijo desconocido, Zelle sin email ni teléfono, reemplazo de documento, sesión de operador sin bloquear, copiar cuenta desde la ficha.
