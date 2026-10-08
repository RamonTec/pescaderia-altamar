# Checklist — 06-contratos

## Esquema, RLS y Storage
- [ ] `20261007190000_config_negocio_datos_contrato.sql` aplicada: `config_negocio` tiene `razon_social`, `rif`, `direccion` y `telefono` con sus checks. — Migración escrita (2026-10-07); **pendiente: aplicar migraciones `20261007190000` y `20261007190100` (usuario, SQL Editor)**. No se pudo validar contra Postgres desde aquí.
- [ ] `20261007190100_contratos.sql` aplicada. Incluye: — Migración escrita (2026-10-07); **pendiente: aplicar migraciones `20261007190000` y `20261007190100` (usuario, SQL Editor)**. No se pudo validar contra Postgres desde aquí. Desvío: `numero` es identity `by default` + RPC `siguiente_numero_contrato()` (ver tasks.md › Estado de ejecución).
  - Tabla `contratos` con checks de `tipo`, `estado` y origen (exactamente una referencia según `tipo`).
  - `numero` identity.
  - `dias_credito int not null check (0–365)` y `fecha_vencimiento date not null`.
  - Índices únicos parciales de contrato activo por factura y por compra.
- [ ] El trigger `contratos_validar` rechaza:
  - Origen de contado o anulado.
  - Cambios de `tipo`/`factura_id`/`compra_id`/`url_storage`/`numero`/`dias_credito`/`fecha_vencimiento`.
  - Transiciones de estado inválidas.

  Al insertar, deriva `fecha_vencimiento = fecha del origen + dias_credito` e ignora el valor enviado.

  _(Escrito en la migración; sin marcar hasta aplicarla y probarlo por SQL — tarea 34.)_
- [x] RLS de `contratos` solo `public.es_admin()` (`select`/`insert`/`update`), sin política de `delete`. `contratos_listado_view` con `security_invoker = true`. _(en el archivo; efectivo al aplicar la migración)_
- [x] El bucket `contratos` se crea en la migración: privado, 5 MB, solo `application/pdf`. Políticas `select`/`insert`/`delete` solo admin, sin `update`. _(en el archivo; efectivo al aplicar la migración)_
- [x] Ninguna migración aplicada fue editada. Los nombres nuevos usan timestamp posterior a `20261007180400`.

## Seguridad: operador (verificado vía PostgREST con su JWT, no solo en la UI)
- [ ] `select` sobre `contratos` y `contratos_listado_view` devuelve `[]`. `insert`/`update` fallan. — Pendiente (2026-10-07): verificación manual con la sesión/JWT de un operador real tras aplicar las migraciones (tarea 35); no ejecutable desde aquí.
- [ ] `storage.from('contratos')`: `list`, `download` y `createSignedUrl` fallan. — Pendiente (2026-10-07): verificación manual con la sesión/JWT de un operador real tras aplicar las migraciones (tarea 35); no ejecutable desde aquí.
- [ ] `GET /contratos/<id>/pdf` → 404, y `/contratos` redirige. — En código: el route handler responde 404 si no es admin y `page.tsx` hace `redirect('/')`; sin sesión, `curl` dio 404 y 307→/login. Falta probar con sesión de operador (tarea 35).
- [ ] No ve el ítem "Contratos" del `AppShell` ni las opciones de contrato en `/cobros`, `/compras`, ficha de cliente y ficha de proveedor. — En código: `adminOnly` en el menú y las 4 tablas solo suman acciones con `esAdmin`. Falta revisarlo en navegador con un operador (tarea 35).
- [ ] `generarContratoAction` y `cambiarEstadoContratoAction` responden con error para el operador. — En código: `requireAdmin()` → «Solo un administrador puede gestionar contratos» antes de validar; falta prueba real (tarea 35).

## Repositorios y servicios
- [x] `IContratoRepository` e `IContratoArchivoRepository` en `interfaces.ts`, con implementación Supabase sin lógica de negocio.
- [x] `contratoService` es el único que usa esos repositorios y exige admin en todas sus funciones.
- [x] La elegibilidad (`elegibilidadFacturas`/`elegibilidadCompras`) se resuelve en una consulta por lote, no por fila. _(dos consultas por lote en paralelo: condición/estado del origen + contratos activos)_
- [x] La generación sube el PDF y después inserta la fila. Si el insert falla, el archivo se borra (no quedan PDFs huérfanos). _(en código; la prueba real con dos pestañas es la tarea 33)_
- [ ] Un segundo contrato activo para la misma factura o compra se rechaza con el mensaje claro, también en concurrencia (dos pestañas). — En código (comprobación previa + `23505` → `ContratoActivoDuplicadoError` → mismo mensaje y borrado del PDF). Falta la prueba con dos pestañas (tarea 33).
- [x] Facturas y compras anuladas no permiten generar contrato. Las de contado no ofrecen la opción. _(servicio + trigger + UI; verificación manual en tarea 34)_
- [x] Sin datos del negocio o sin RIF/cédula de la contraparte, el mensaje dice qué falta y dónde completarlo.
- [x] Las Server Actions validan con zod (`contratoValidation.ts`) antes de llamar al servicio, incluido `dias_credito` (entero 0–365, obligatorio). _(ausente/null, negativo, decimal y > 365 probados con `safeParse`)_
- [x] Generar un contrato con días distintos a los de la factura no modifica `facturas.dias_credito` ni `facturas.fecha_vencimiento`, y `/cobros` sigue mostrando el vencimiento original. _(el servicio nunca escribe en `facturas`; confirmación con datos reales en tarea 31)_

## PDF
- [x] La evaluación de `@react-pdf/renderer` (o el cambio a `pdf-lib`) está documentada en `tasks.md` › "Resultado de la evaluación".
- [x] `ContratoTemplateFactory` elige la plantilla por `tipo`. El render está detrás de `IContratoPdfRenderer`.
- [ ] El PDF de venta coincide al centavo con la factura en: _(pendiente: comparación con una factura real, tarea 31; con datos de muestra los totales salen de los valores guardados sin recalcular)_
  - Items, subtotal, IVA, total, abonos, notas de crédito y saldo.
  - Días de crédito y fecha de vencimiento **del contrato**.
  - Tasa con su procedencia (referencial con fuente, o manual con la referencial vigente).
  - Equivalente en Bs a `tasa_snapshot`.
- [ ] El PDF de compra coincide con la compra (items, total USD/Bs, tasa y procedencia) y muestra los días de crédito y el vencimiento del contrato. _(pendiente: compra real, tarea 32; la muestra muestra todos los bloques)_
- [x] Nada se recalcula: ninguna consulta de tasa vigente durante la generación.
- [x] La cláusula de ganancia cambiaria sale solo de `CLAUSULA_GANANCIA_CAMBIARIA` y es idéntica en ambos tipos. _(grep: solo `clausulas.ts` y el script de prueba la referencian)_
- [x] El encabezado tiene nombre comercial, razón social, RIF, dirección y teléfono. El pie dice «Documento interno, no fiscal» y la paginación.
- [ ] Ver y descargar usan una signed URL generada al momento (TTL 60 s). `contratos.url_storage` solo guarda rutas. — En código (route handler 302 + `createSignedUrl(ruta, 60)`); falta comprobar la expiración real (tarea 36).

## UI (`00-estandares-ui` Fase 2)
- [x] Menú `⋮` (solo admin) con "Generar contrato" / "Ver contrato N.º …" en `/cobros`, ficha de cliente, `/compras` y ficha de proveedor, todo desde `useContratoAcciones`.
- [x] "Generar contrato" abre `GenerarContratoDialog` (`AppDialog xs`):
  - "Días de crédito *" con `DiasCreditoField`: vacío en compras, precargado con los de la factura.
  - Vista previa «Vence el …» y aviso si difiere de la factura.
  - Notas opcionales.
  - `Button loading`, campos deshabilitados y cierre protegido mientras genera.
- [x] Al enviar: `BrandLoader` "Generando contrato", toast de éxito o error y doble envío imposible. _(error del servidor: en el `Alert` del diálogo, que queda abierto)_
- [x] `/contratos`:
  - `PageHeader`.
  - `ContratosTable` en `AppDataGrid` modo servidor con `?pagina=`, chips `?tipo=`/`?estado=` y `?q=` en la URL.
  - `mobileCard` en `xs`, `EmptyState` con enlaces a `/cobros` y `/compras`.
  - `loading.tsx` y `error.tsx`.
- [x] Anular pasa por `ConfirmDialog` destructivo. Solo se ofrecen las transiciones válidas. El aviso "Documento anulado" aparece si el origen se anuló después.
- [x] `ConfigNegocioForm` tiene la sección "Datos del negocio para contratos" (`FormSection`, `RifCiField`, `PhoneField`, `size="small"`), validada en cliente y en la action.
- [x] Íconos `Outlined`, tipografía de la escala, montos con `lib/format.ts` y cifras tabulares, sin `window.alert`/`confirm`. _(nota: "Contratos" usa `DescriptionOutlined` como pide la spec, el mismo ícono que "Notas de crédito" en el `AppShell`; revisar si conviene otro)_
- [ ] Revisado a 375, 768, 1024 y 1440 px, sin scroll horizontal. — Pendiente (tarea 37): requiere sesión admin real en navegador y migraciones aplicadas.
- [ ] Revisado en modo claro y oscuro (tabla, tarjetas, chips, menú, `GenerarContratoDialog`, formulario de configuración, loader). — Pendiente (tarea 37), mismo motivo.

## Tipos, documentación y calidad
- [x] Tipos nuevos en `src/types/domain.ts` (`Contrato`, `ContratoListado`, `DatosContratoPdf`, `ElegibilidadContrato`, `ConfigNegocio` ampliado), sin `any` sin justificar.
- [x] `/SPEC.md` §5 lista `contratos` y los campos nuevos de `config_negocio`. La tabla de componentes de `00-estandares-ui/spec.md` está actualizada si se creó algo genérico. _(fila de `DiasCreditoField` actualizada; `useContratoAcciones` es de dominio, no se registra)_
- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores. _(2026-10-07: 0 errores; 1 warning ajeno en `NotaCreditoForm.tsx`)_

## Pendientes / deuda técnica
- [ ] Aplicar migraciones `20261007190000_config_negocio_datos_contrato.sql` y `20261007190100_contratos.sql` (usuario, SQL Editor) — 2026-10-07.
- [ ] Aprobar las dos muestras de PDF (tarea 11) — generarlas con `node --require @react-pdf/renderer --import tsx scripts/probar-contrato-pdf.tsx` — 2026-10-07.
- [ ] Verificación manual 31–37 (venta/compra reales, duplicados con dos pestañas, reglas por SQL, operador vía PostgREST, expiración de la URL firmada, responsive y tema) — requiere migraciones aplicadas y sesiones reales — 2026-10-07.
- [ ] Logo y tipografía de marca en el PDF: fuera de alcance hasta tener el archivo real del logo (spec › Fuera de alcance) — 2026-10-07.
- [ ] `npx tsx scripts/probar-contrato-pdf.tsx` no funciona con `@react-pdf/renderer` 4.9 (ESM-only + hook CJS de tsx); se usa el comando con `--require`. Next no se ve afectado — 2026-10-07.
