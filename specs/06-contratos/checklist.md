# Checklist — 06-contratos

## Esquema, RLS y Storage
- [ ] `20261007190000_config_negocio_datos_contrato.sql` aplicada: `config_negocio` tiene `razon_social`, `rif`, `direccion` y `telefono` con sus checks.
- [ ] `20261007190100_contratos.sql` aplicada. Incluye:
  - Tabla `contratos` con checks de `tipo`, `estado` y origen (exactamente una referencia según `tipo`).
  - `numero` identity.
  - `dias_credito int not null check (0–365)` y `fecha_vencimiento date not null`.
  - Índices únicos parciales de contrato activo por factura y por compra.
- [ ] El trigger `contratos_validar` rechaza:
  - Origen de contado o anulado.
  - Cambios de `tipo`/`factura_id`/`compra_id`/`url_storage`/`numero`/`dias_credito`/`fecha_vencimiento`.
  - Transiciones de estado inválidas.

  Al insertar, deriva `fecha_vencimiento = fecha del origen + dias_credito` e ignora el valor enviado.
- [ ] RLS de `contratos` solo `public.es_admin()` (`select`/`insert`/`update`), sin política de `delete`. `contratos_listado_view` con `security_invoker = true`.
- [ ] El bucket `contratos` se crea en la migración: privado, 5 MB, solo `application/pdf`. Políticas `select`/`insert`/`delete` solo admin, sin `update`.
- [ ] Ninguna migración aplicada fue editada. Los nombres nuevos usan timestamp posterior a `20261007180400`.

## Seguridad: operador (verificado vía PostgREST con su JWT, no solo en la UI)
- [ ] `select` sobre `contratos` y `contratos_listado_view` devuelve `[]`. `insert`/`update` fallan.
- [ ] `storage.from('contratos')`: `list`, `download` y `createSignedUrl` fallan.
- [ ] `GET /contratos/<id>/pdf` → 404, y `/contratos` redirige.
- [ ] No ve el ítem "Contratos" del `AppShell` ni las opciones de contrato en `/cobros`, `/compras`, ficha de cliente y ficha de proveedor.
- [ ] `generarContratoAction` y `cambiarEstadoContratoAction` responden con error para el operador.

## Repositorios y servicios
- [ ] `IContratoRepository` e `IContratoArchivoRepository` en `interfaces.ts`, con implementación Supabase sin lógica de negocio.
- [ ] `contratoService` es el único que usa esos repositorios y exige admin en todas sus funciones.
- [ ] La elegibilidad (`elegibilidadFacturas`/`elegibilidadCompras`) se resuelve en una consulta por lote, no por fila.
- [ ] La generación sube el PDF y después inserta la fila. Si el insert falla, el archivo se borra (no quedan PDFs huérfanos).
- [ ] Un segundo contrato activo para la misma factura o compra se rechaza con el mensaje claro, también en concurrencia (dos pestañas).
- [ ] Facturas y compras anuladas no permiten generar contrato. Las de contado no ofrecen la opción.
- [ ] Sin datos del negocio o sin RIF/cédula de la contraparte, el mensaje dice qué falta y dónde completarlo.
- [ ] Las Server Actions validan con zod (`contratoValidation.ts`) antes de llamar al servicio, incluido `dias_credito` (entero 0–365, obligatorio).
- [ ] Generar un contrato con días distintos a los de la factura no modifica `facturas.dias_credito` ni `facturas.fecha_vencimiento`, y `/cobros` sigue mostrando el vencimiento original.

## PDF
- [ ] La evaluación de `@react-pdf/renderer` (o el cambio a `pdf-lib`) está documentada en `tasks.md` › "Resultado de la evaluación".
- [ ] `ContratoTemplateFactory` elige la plantilla por `tipo`. El render está detrás de `IContratoPdfRenderer`.
- [ ] El PDF de venta coincide al centavo con la factura en:
  - Items, subtotal, IVA, total, abonos, notas de crédito y saldo.
  - Días de crédito y fecha de vencimiento **del contrato**.
  - Tasa con su procedencia (referencial con fuente, o manual con la referencial vigente).
  - Equivalente en Bs a `tasa_snapshot`.
- [ ] El PDF de compra coincide con la compra (items, total USD/Bs, tasa y procedencia) y muestra los días de crédito y el vencimiento del contrato.
- [ ] Nada se recalcula: ninguna consulta de tasa vigente durante la generación.
- [ ] La cláusula de ganancia cambiaria sale solo de `CLAUSULA_GANANCIA_CAMBIARIA` y es idéntica en ambos tipos.
- [ ] El encabezado tiene nombre comercial, razón social, RIF, dirección y teléfono. El pie dice «Documento interno, no fiscal» y la paginación.
- [ ] Ver y descargar usan una signed URL generada al momento (TTL 60 s). `contratos.url_storage` solo guarda rutas.

## UI (`00-estandares-ui` Fase 2)
- [ ] Menú `⋮` (solo admin) con "Generar contrato" / "Ver contrato N.º …" en `/cobros`, ficha de cliente, `/compras` y ficha de proveedor, todo desde `useContratoAcciones`.
- [ ] "Generar contrato" abre `GenerarContratoDialog` (`AppDialog xs`):
  - "Días de crédito *" con `DiasCreditoField`: vacío en compras, precargado con los de la factura.
  - Vista previa «Vence el …» y aviso si difiere de la factura.
  - Notas opcionales.
  - `Button loading`, campos deshabilitados y cierre protegido mientras genera.
- [ ] Al enviar: `BrandLoader` "Generando contrato", toast de éxito o error y doble envío imposible.
- [ ] `/contratos`:
  - `PageHeader`.
  - `ContratosTable` en `AppDataGrid` modo servidor con `?pagina=`, chips `?tipo=`/`?estado=` y `?q=` en la URL.
  - `mobileCard` en `xs`, `EmptyState` con enlaces a `/cobros` y `/compras`.
  - `loading.tsx` y `error.tsx`.
- [ ] Anular pasa por `ConfirmDialog` destructivo. Solo se ofrecen las transiciones válidas. El aviso "Documento anulado" aparece si el origen se anuló después.
- [ ] `ConfigNegocioForm` tiene la sección "Datos del negocio para contratos" (`FormSection`, `RifCiField`, `PhoneField`, `size="small"`), validada en cliente y en la action.
- [ ] Íconos `Outlined`, tipografía de la escala, montos con `lib/format.ts` y cifras tabulares, sin `window.alert`/`confirm`.
- [ ] Revisado a 375, 768, 1024 y 1440 px, sin scroll horizontal.
- [ ] Revisado en modo claro y oscuro (tabla, tarjetas, chips, menú, `GenerarContratoDialog`, formulario de configuración, loader).

## Tipos, documentación y calidad
- [ ] Tipos nuevos en `src/types/domain.ts` (`Contrato`, `ContratoListado`, `DatosContratoPdf`, `ElegibilidadContrato`, `ConfigNegocio` ampliado), sin `any` sin justificar.
- [ ] `/SPEC.md` §5 lista `contratos` y los campos nuevos de `config_negocio`. La tabla de componentes de `00-estandares-ui/spec.md` está actualizada si se creó algo genérico.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores.

## Pendientes / deuda técnica
- [ ] _(anotar aquí cualquier ítem diferido con motivo y fecha, p. ej. logo real en el PDF)_
