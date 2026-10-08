# Tareas — 06-contratos

Ejecutar en orden. Cada tarea indica archivos y criterio de hecho.

Depende de: `02-clientes`, `03-proveedores`, `04-inventario` y `05-ventas`. Usa lo que dejaron `07-lotes` (items de factura), `08-tasas` (procedencia de la tasa), `09-cuentas-por-cobrar` (vencimiento, `/cobros`, `DocumentosCarteraTable`), `10`/`11`/`12` (fichas y catálogos refactorizados) y `00-estandares-ui` Fase 2. Todos están hechos.

Decisiones cerradas por el usuario el 2026-10-07: ver "Decisión de diseño" en `spec.md` (sin fichas nuevas, solo admin, datos del negocio en `config_negocio`, días de crédito pedidos al generar).

Decisiones 2–5, cerradas por el usuario el 2026-10-07 con los valores por defecto:
- (2) las facturas y compras pagadas también admiten contrato;
- (3) sin RIF/cédula de la contraparte no se genera;
- (4) el PDF muestra abonos, notas de crédito y saldo a la fecha;
- (5) anular sin motivo (solo con confirmación), Helvetica y sin logo.

Regla de avance: después de cada tarea, `npm run lint` y `npx tsc --noEmit`. Migraciones con timestamp posterior a `20261007180400_lotes_rpc_ventas.sql`. No se edita ninguna aplicada.

## Fase A — Evaluación de la librería de PDF

1. **Evaluar `@react-pdf/renderer` con el stack del proyecto** (Next 16.3, React 19.2).
   - Leer antes `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md`. `@react-pdf/renderer` ya está en la lista por defecto, así que no debería hacer falta tocar `next.config.ts`.
   - `npm install @react-pdf/renderer`.
   - Script `scripts/probar-contrato-pdf.tsx` (`npx tsx`) que renderiza un documento mínimo con `renderToBuffer` y lo escribe en un directorio temporal.
   - Server Action de prueba descartable que hace lo mismo, ejecutada con `npm run dev` y luego con `npm run build`.
   - **Hecho**: el PDF se abre bien desde el script y desde la action, y el build pasa.
   - Anotar el resultado al final de este archivo, en "Resultado de la evaluación": versión instalada, si hizo falta `serverExternalPackages` y el tamaño de la función.
   - **Si falla**: desinstalar y usar `pdf-lib` (`StandardFonts.Helvetica`, `drawText`, helper propio de tablas con salto de página). Anotar el motivo. Las tareas 8–10 se implementan contra `pdf-lib` detrás de la misma interfaz `IContratoPdfRenderer`.

## Fase B — Esquema y tipos

2. **`supabase/migrations/20261007190000_config_negocio_datos_contrato.sql`**: agrega a `config_negocio` las columnas `razon_social`, `rif`, `direccion` y `telefono`, con sus checks (ver `spec.md` › Esquema de datos). Encabezado con comentario que cite `06-contratos`. **Hecho**: se aplica sobre la base actual sin errores; `select * from config_negocio` muestra las 4 columnas en `null`.
3. **`supabase/migrations/20261007190100_contratos.sql`**. **Hecho**: aplicada sin errores, con el bucket visible como privado. Contenido:
   - Tabla `contratos` con `contratos_origen_check`, `dias_credito int not null check (0–365)`, `fecha_vencimiento date not null`, los dos índices únicos parciales de contrato activo e índices de fecha y estado.
   - Trigger `contratos_validar`:
     - Al insertar: origen a crédito y no anulado, y `fecha_vencimiento := fecha del origen + dias_credito`, ignorando el valor enviado.
     - Solo `estado`/`notas` editables: `dias_credito` y `fecha_vencimiento` son inmutables.
     - Transiciones válidas.
     - `estado_cambiado_por`/`_at` automáticos.
   - Vista `contratos_listado_view` (`security_invoker = true`).
   - RLS `select`/`insert`/`update` con `public.es_admin()` y sin `delete`.
   - Bucket `contratos` (privado, 5 MB, solo `application/pdf`) con políticas de `storage.objects` `select`/`insert`/`delete` solo admin, siguiendo el patrón de `0010_documentos_proveedor.sql`.
4. **`src/types/domain.ts`**. **Hecho**: `tsc` pasa sin `any`. Cambios:
   - `ConfigNegocio` + `razon_social`, `rif`, `direccion`, `telefono` (`string | null`).
   - `TipoContrato`, `EstadoContrato`, `Contrato`, `ContratoListado` (fila de la vista).
   - `DatosContratoPdf`: negocio, contraparte con representantes, documento de origen, items, totales, tasa con procedencia, saldo.
   - `ElegibilidadContrato` (`{ puedeGenerar, motivo?, contratoActivo?: { id, numero, estado } }`).
5. **`src/lib/contratoValidation.ts`**: `generarContratoSchema` (unión discriminada por `tipo`, más `dias_credito` entero 0–365 obligatorio y `notas` ≤ 500 opcional), `cambiarEstadoContratoSchema`, `filtrosContratosSchema` (con defaults: `pagina` 1, `estado` `activos`) y `TRANSICIONES_CONTRATO` (la misma tabla que el trigger). Mensajes en español; los que se repitan, en `validationMessages.ts`. **Hecho**: exporta esquemas y tipos inferidos.

## Fase C — Plantillas y PDF

6. **`src/lib/contratos/clausulas.ts`**: `CLAUSULA_GANANCIA_CAMBIARIA` (texto único con "EL ACREEDOR"/"EL DEUDOR") + `textoClausulaGananciaCambiaria(tasa)`, que solo sustituye la tasa formateada. **Hecho**: es el único lugar del repo con ese texto (`grep` lo confirma tras la tarea 8).
7. **`src/lib/contratos/textos.ts`**: textos y helpers puros:
   - `describirTasa({ tasa_origen, tasa_fuente, tasa_referencial, tasa_snapshot })` con las frases de `spec.md` › Contenido del PDF › 6.
   - `referenciaDocumento(datos)`: "Factura N.º …" o "Compra del … (ref. …)".
   - `nombreArchivoContrato(numero)`.
   - Títulos por tipo.

   Sin I/O. **Hecho**: casos cubiertos en `scripts/probar-contrato-pdf.tsx` (referencial BCV, referencial paralela, manual con referencial, manual sin referencial).
8. **`src/lib/contratos/plantillas/`**. **Hecho**: ninguna plantilla consulta datos ni calcula tasas. Contenido:
   - `bloques.tsx`: encabezado, partes, documento de origen, tabla de items, totales y saldo, tasa, cláusula, firmas y pie con «Página X de Y». Montos con `lib/format.ts`.
   - `ContratoVentaPdf.tsx` y `ContratoCompraPdf.tsx`: componen los bloques. Ambas muestran `dias_credito` y `fecha_vencimiento` del contrato.
9. **`src/lib/contratos/plantillas/factory.ts`**: `ContratoTemplateFactory.crear(tipo)` devuelve la plantilla del tipo, sin `if/else` repartidos por el servicio. **Hecho**: un `tipo` desconocido no compila (`Record<TipoContrato, …>`).
10. **`src/lib/services/contratoPdfService.ts`**: interfaz `IContratoPdfRenderer` (`render(datos: DatosContratoPdf): Promise<Uint8Array>`) + implementación con `renderToBuffer` y la factory. **Hecho**: desde `scripts/probar-contrato-pdf.tsx` genera los dos PDFs de muestra (venta jurídica con 2 representantes y tasa manual; compra con tasa referencial).
11. **Revisión visual de los PDFs de muestra**: encabezado completo, tabla con varias líneas y salto de página con 30 items, cifras alineadas, la cláusula idéntica en ambos y las firmas. **Hecho**: el usuario aprueba las dos muestras (adjuntarlas o describirlas en "Resultado de la evaluación").

## Fase D — Datos y servicios

12. **`src/lib/repositories/interfaces.ts`**: `IContratoRepository` y `IContratoArchivoRepository`. **Hecho**: interfaces sin lógica de negocio.
    - `IContratoRepository`: `create`, `getById`, `list(filtros) → { rows, total }` sobre la vista, `activosPorFacturas(ids)`, `activosPorCompras(ids)`, `updateEstado(id, estado)`.
    - `IContratoArchivoRepository`: `subir(ruta, bytes)`, `eliminar(ruta)`, `urlFirmada(ruta, ttl, nombreDescarga?)`.
13. **`src/lib/repositories/contratoRepository.ts`** (`makeContratoRepository(client)`). **Hecho**: un error `23505` sale tipado para que el servicio lo reconozca.
    - `list` con `.range()` + `count: 'exact'`, filtros de tipo/estado y `q` (`or` sobre número, número de documento y contraparte), orden `fecha desc, numero desc`.
    - `activosPor*` con `in (...)` y `estado <> 'anulado'`.
14. **`src/lib/repositories/contratoArchivoRepository.ts`** (`makeContratoArchivoRepository(client)`): bucket `contratos`, `upload` con `contentType: 'application/pdf'` y `upsert: false`, `remove`, `createSignedUrl(ruta, ttl, { download })`. **Hecho**: mismo patrón que `documentoProveedorRepository.ts`.
15. **Datos del negocio en la capa de config**: `configValidation.ts` (+ 4 campos: `razon_social` ≤ 160, `rif` con `RIF_CI_REGEX` o vacío, `direccion` ≤ 300, `telefono` con `TELEFONO_VE_REGEX` o vacío; vacío → `null`), `configRepository.ts` y `configService.ts` (leer y guardar los campos nuevos) y la action de `catalogos/actions.ts` (ya valida con `configFormSchema`; verificar que pase los campos). **Hecho**: guardar con un RIF inválido devuelve el error en el campo.
16. **`src/lib/services/contratoService.ts`**. Todas las funciones exigen `requireAdmin()`. **Hecho**: cada regla de `spec.md` › Reglas de negocio tiene su mensaje.
    - `elegibilidadFacturas(ids)` y `elegibilidadCompras(ids)` → `Map<id, ElegibilidadContrato>`. Una sola consulta por lote, no N+1.
    - `generarDesdeFactura(facturaId, { dias_credito, notas })` y `generarDesdeCompra(compraId, { dias_credito, notas })`:
      1. Validan las reglas 1, 2, 7 y 9 con los mensajes de `spec.md`. El vencimiento (fecha del origen + días) se calcula aquí para el PDF y coincide con el que guarda el trigger. Nunca se escribe en `facturas`.
      2. Arman `DatosContratoPdf` con `getById` de factura o compra, cliente o proveedor + representantes y `config_negocio`. Saldo = `total − pagado − Σ notas de crédito emitidas`, sin consultar tasas.
      3. `id = crypto.randomUUID()`, render, subida a `{tipo}/{yyyy}/{id}.pdf` y luego `create`.
      4. Ante cualquier error posterior a la subida, `eliminar(ruta)`. `23505` → mensaje de contrato activo.
    - `listar(filtros)`.
    - `cambiarEstado(id, estado)`: valida con `TRANSICIONES_CONTRATO` antes de escribir.
    - `urlFirmada(id, { descargar })`: TTL 60 s.
17. **`src/app/(protected)/contratos/actions.ts`**. Leer antes `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` y `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md`. **Hecho**: un payload inválido devuelve error sin tocar la base; el operador recibe «Solo un administrador puede…».
    - `generarContratoAction(input)` y `cambiarEstadoContratoAction(input)`: `safeParse` → servicio → `ActionState` (`toActionError`).
    - `revalidatePath` de `/contratos`, `/cobros`, `/compras` y de la ficha de la contraparte.
    - Si hace falta, el segmento declara `runtime = 'nodejs'` (comprobar en la doc de route segment config).
18. **`src/app/(protected)/contratos/[id]/pdf/route.ts`** (entrega del PDF). Leer antes `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` y `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`: cacheo de `GET`, firma de `params` (promesa) y `redirect`/`NextResponse`.
    - `GET`: valida `id` (uuid), `requireAdmin()` (si no, 404), `contratoService.urlFirmada(id, { descargar: searchParams.get('descargar') === '1' })` y 302. Nada de cacheo.
    - **Hecho**: la URL firmada no se guarda en ninguna parte y la ruta responde 404 a un operador.

## Fase E — UI

19. **`ConfigNegocioForm`** (`src/components/organisms/ConfigNegocioForm.tsx`): `FormSection` "Datos del negocio para contratos" con `TextField` (razón social, dirección multilinea), `RifCiField` y `PhoneField`, todos `size="small"`. Ayuda: «Obligatorios para generar contratos». Mantiene el patrón de 12 (`Button loading`, `useForm({ disabled })`). **Hecho**: guarda y recarga los 4 campos; el toast dice «Configuración guardada».
20. **`src/components/organisms/GenerarContratoDialog.tsx`** (`AppDialog xs`, `onSubmit`, `pending`, `dirty`, `error`), según `spec.md` › UI. **Hecho**: con días vacíos en compra o fuera de rango, error en el campo sin llamar al servidor; la factura no cambia tras generar.
    - `react-hook-form` + `generarContratoSchema` (`mode: 'onSubmit'`).
    - `DiasCreditoField` de 09, con la fecha base del origen. Si su aviso "difiere de lo habitual" solo compara con el cliente, agregarle una prop (p. ej. `referencia: { dias, etiqueta }`) sin romper POS ni entrega de pedido, y actualizar su fila en `00-estandares-ui/spec.md`.
    - `Alert` `info` si los días difieren de `facturas.dias_credito`.
    - Notas opcionales.
    - Primario "Generar contrato" con `loading`.
21. **`src/app/(protected)/contratos/useContratoAcciones.tsx`**: hook único para las acciones de contrato. **Hecho**: `generar` no se dispara dos veces con doble clic y se usa en las 4 tablas.
    - `accionesDeOrigen(origen, elegibilidad): RowAction[]` (tabla de opciones de `spec.md` › UI). `origen` = `{ tipo, id, fecha, dias_credito_factura?, etiqueta }`.
    - "Generar contrato" abre `GenerarContratoDialog`, que el hook expone como `dialogos`.
    - Al enviar: `generarContratoAction` dentro de `useGlobalLoader().run(…, 'Generando contrato')`, `notify` y `router.refresh()`.
    - `verPdf(id)` y `descargar(id)` con `window.open('/contratos/{id}/pdf…', '_blank', 'noopener')` sincrónico en el clic.
    - `cambiarEstado` y `anular` (con `useConfirm`, destructivo).
    - `estaPendiente(id)` para el `pending` del `RowActionsMenu`.
22. **`/cobros`**: `cobros/page.tsx` pide `contratoService.elegibilidadFacturas(ids)` (solo admin) y lo pasa a `CobrosScreen`. `cobros-screen.tsx` suma las opciones de contrato al `acciones` actual, sin quitar "Registrar abono" ni "Recordar". **Hecho**: la opción aparece en facturas a crédito y no en las de contado.
23. **Ficha de cliente**: `clientes/[id]/page.tsx` suma `elegibilidadFacturas` de las facturas del cliente al `Promise.all` (solo admin). `cliente-ficha.tsx` pasa `renderAcciones` a `DocumentosCarteraTable` (solo admin). **Hecho**: con "Ver anuladas", la factura anulada muestra la opción deshabilitada con su motivo.
24. **`/compras`**: `compras/page.tsx` pide `elegibilidadCompras` de las filas de la página. `ComprasTable` recibe `accionesExtra?: (row) => RowAction[]` y las suma a "Registrar pago" dentro de `colAcciones` (solo admin). **Hecho**: paginar cambia la elegibilidad sin consultas por fila.
25. **Ficha de proveedor**: `proveedores/[id]/page.tsx` pide `elegibilidadCompras`. `proveedor-ficha.tsx` agrega `colAcciones` (solo admin) a `COLUMNAS_COMPRAS` y al `mobileCard` del historial. Si `CompraFicha` no trae `condicion`, se agrega en la consulta del servicio. **Hecho**: el `⋮` aparece solo para el admin.
26. **`src/components/organisms/ContratosTable.tsx`**: `AppDataGrid` modo servidor con las columnas, chips de filtro (`?tipo=`, `?estado=`), búsqueda `?q=` (debounce 300 ms), `mobileCard`, `getRowHref` a la ficha de la contraparte, `EmptyState` y menú `⋮` con `useContratoAcciones`. Estados con `colEstado` (`generado` default, `enviado` info, `firmado` success, `anulado` default tachado o atenuado) + chip "Documento anulado". **Hecho**: cumple `spec.md` › UI › `/contratos`.
27. **Ruta `/contratos`**: `src/app/(protected)/contratos/page.tsx` (server: `requireAdmin()` → `redirect('/')`, `filtrosContratosSchema` sobre `searchParams`, `paginaDesdeParam`, `contratoService.listar`), `contratos-screen.tsx` (`PageHeader` + `ContratosTable`), `loading.tsx` (`PageLoader table`) y `error.tsx` (`ErrorState`). **Hecho**: volver desde una ficha conserva `?pagina=` y los filtros.
28. **`AppShell`** (`src/components/templates/AppShell.tsx`): ítem "Contratos" con `DescriptionOutlined` y `adminOnly: true`, después de "Cobros y pagos". **Hecho**: el operador no lo ve.
29. **Documentación**: agregar `contratos` (y los 4 campos de `config_negocio`) a `/SPEC.md` §5. Si `useContratoAcciones` o algún bloque resultó genérico, registrarlo en la tabla de componentes de `00-estandares-ui/spec.md`. **Hecho**: `/SPEC.md` §5 lista la tabla.

## Fase F — Verificación

30. `npm run lint`, `npx tsc --noEmit`, `npm run build` y `npx tsx scripts/probar-contrato-pdf.tsx`.
31. **Venta**: contrato desde una factura a crédito real (30 días, tasa manual, 3 items, un abono previo y una nota de crédito). El diálogo precarga 30; se cambia a 45 y aparece el aviso. El PDF coincide al centavo con la factura en:
    - Items, subtotal, IVA y total.
    - Tasa y su procedencia.
    - Saldo.
    - Equivalente en Bs = USD × `tasa_snapshot`.

    El PDF y la fila muestran 45 días y vencimiento = fecha de la factura + 45. `facturas.dias_credito`/`fecha_vencimiento` y el estado en `/cobros` siguen en 30.
32. **Compra**: contrato desde una compra a crédito en Bs. El diálogo exige los días (vacío → error en el campo). Montos en USD y Bs, tasa referencial con su fuente, y días y vencimiento del contrato = fecha de la compra + días.
33. **Duplicados**:
    - Generar dos veces la misma factura (incluso con dos pestañas a la vez) deja un solo contrato activo, con el mensaje claro y sin PDF huérfano en el bucket.
    - Anular y regenerar funciona.
    - Lo mismo para una compra.
34. **Reglas**:
    - La factura o compra anulada no permite generar (UI deshabilitada y la action lo rechaza).
    - Contado no muestra la opción.
    - Sin datos del negocio o sin RIF de la contraparte aparece el mensaje con dónde completarlos.
    - Transición inválida (`firmado → enviado`) rechazada por servicio y trigger.
    - Editar `url_storage`, `dias_credito` o `fecha_vencimiento` por SQL como admin falla.
    - La action rechaza `dias_credito` ausente, negativo, decimal o > 365.
35. **Seguridad con el operador, vía PostgREST** (cliente JS con su sesión o `curl` con su JWT):
    - `select` de `contratos` y de `contratos_listado_view` devuelve `[]`.
    - `insert`/`update` → `42501` o 0 filas.
    - `storage.from('contratos').list()` y `createSignedUrl` fallan.
    - `GET /contratos/<id>/pdf` → 404, y `/contratos` → redirección.
    - No ve el ítem del menú ni las opciones de contrato en `/cobros`, `/compras` y las fichas.
    - Las actions le responden con error.
36. **Signed URL**: abrir "Ver PDF" funciona. La URL firmada copiada deja de servir a los 60 s. Volver a abrir desde la bitácora genera otra. En `contratos.url_storage` solo hay rutas.
37. **Responsive y tema**: 375, 768, 1024 y 1440 px, en claro y oscuro, de `/contratos` (tarjetas en `xs`, chips, menú `⋮` táctil), el `⋮` de las 4 tablas de origen, `GenerarContratoDialog` (en `xs`, diálogo centrado de confirmación según el tamaño `xs`), la sección nueva de `ConfigNegocioForm` y el `BrandLoader` "Generando contrato". Sin scroll horizontal.
38. Recorrer `checklist.md`.

## Resultado de la evaluación (tarea 1 y 11)

- **2026-10-07 — tarea 1**: se queda `@react-pdf/renderer` **4.9.0** (React 19.2.8, Next 16.3.7). No se usa `pdf-lib`.
  - `renderToBuffer` funcionó en un route handler + Server Action de prueba descartable con `next dev` (PDF 1.3 válido) y `npm run build` pasó. Archivos de prueba borrados.
  - **No** hizo falta tocar `serverExternalPackages`: el paquete ya está en la lista por defecto de Next 16 (se combina con `undici` de `next.config.ts`).
  - Tamaño: `node_modules/@react-pdf` ≈ 2,6 MB; la traza `nft` de la función de prueba ≈ 10 MB (319 archivos, incluye el runtime de Next).
  - **Desvío en el script**: `npx tsx scripts/probar-contrato-pdf.tsx` falla (`ERR_PACKAGE_PATH_NOT_EXPORTED` en `@react-pdf/hyphenate/en-us`): el hook CJS de tsx re-resuelve los imports internos de un paquete ESM-only con condiciones `require`. Con `require(esm)` nativo de Node 24 funciona, así que el script se corre precargando el paquete antes de tsx: `node --require @react-pdf/renderer --import tsx scripts/probar-contrato-pdf.tsx`. Next no se ve afectado.

- **2026-10-07 — tareas 10 y 11 (muestras)**: `node --require @react-pdf/renderer --import tsx scripts/probar-contrato-pdf.tsx` genera en un directorio temporal `venta-juridica-tasa-manual.pdf` (2 páginas: jurídica con 2 representantes, tasa manual 42 con referencial 40,5, 30 items con salto de página y cabecera de tabla repetida, abono y nota de crédito, notas) y `compra-tasa-referencial.pdf` (1 página: persona natural sin dirección → "No registrada", moneda Bs, tasa referencial BCV). Encabezado completo, cifras alineadas a la derecha, la misma cláusula en ambos, firmas y pie «Documento interno, no fiscal · Página X de Y».
  - Hallazgo de react-pdf 4.9: un `lineHeight` en `Page` (o en `View`) hace que el pie `fixed` absoluto no se dibuje y multiplica el interlineado; se dejó el interlineado por defecto.
  - **Pendiente**: aprobación visual del usuario (tarea 11).

## Estado de ejecución (2026-10-07, executor)

- Hechas: 1–10, 12–30 (con los desvíos de abajo).
- Pendientes del usuario: 11 (aprobar muestras); aplicar `20261007190000` y `20261007190100` en el SQL Editor; 31–37 (verificación manual con datos y sesiones reales, admin y operador, navegador en 375/768/1024/1440 px y claro/oscuro).
- Desvíos:
  - `contratos.numero` es `generated by default as identity` (no `always`) + RPC `siguiente_numero_contrato()` (solo admin): el PDF lleva el número impreso y se renderiza y sube **antes** de insertar la fila, así que el servicio reserva el número primero. Un fallo deja un hueco en la numeración, nunca un duplicado.
  - `contratos_listado_view` agrega la columna `busqueda` (número de contrato, número de factura, contraparte y RIF en minúsculas) para filtrar `?q=` con un solo `ilike`.
  - `IContratoRepository` agrega `siguienteNumero`, `origenesFacturas(ids)` y `origenesCompras(ids)` (condición y estado del origen para la elegibilidad: dos consultas por lote, no N+1).
  - `filtrosContratosSchema` agrega `?limite=` (25/50/100) para el tamaño de página del `AppDataGrid` en modo servidor.
  - `/contratos` usa su propio campo de búsqueda (en `filters`) en vez del de `AppDataGrid`, para precargar `?q=` al volver de una ficha.
  - Fichas de cliente y proveedor: la elegibilidad se pide después del `Promise.all` (necesita los ids de las facturas/compras), no dentro.
  - `DiasCreditoField`: `diasHabituales` acepta `null` (vacío, sin aviso propio); POS y entrega de pedido no cambian.

## Tarea agregada por otro módulo (anotar aquí cuando ocurra)

- _(ej.: "Cuentas por pagar agrega días de crédito a compras: el diálogo los precarga como en facturas — <fecha>")_
