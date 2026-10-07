# Tareas — 09-cuentas-por-cobrar

Depende de: `02-clientes` (listado y ficha), `05-ventas` (facturas, notas de crédito, `/cobros`). No depende de `07-lotes`. Conviene hacerlo **después de `08-tasas`**: el recordatorio muestra el equivalente en Bs con la tasa vigente (`getTasaVigente`). Si se hace antes, usa la tasa actual y se ajusta después.

Decisiones confirmadas por el usuario el 2026-10-07: días de crédito variables por cliente y por factura (se indican al emitir); envío de recordatorios solo admin por ahora.

Numeración de migraciones: primer número libre al ejecutar. `registrar_factura` también la reescriben `07-lotes` y `08-tasas`: quien la toque después **conserva** lo que agregaron los demás (aquí, `fecha_vencimiento`).

Regla de avance: después de cada tarea, `npm run lint` y `npx tsc --noEmit`.

> **Tarea agregada (2026-10-07, por `10-refactor-visual-clientes`)**: se recomienda ejecutar 10 antes que este módulo. Si 10 ya está hecho: la tarea 16 agrega la columna "Facturas" y el chip "Con facturas vencidas" sobre el `ClientesTable` en `AppDataGrid` (columna con `colEstado`/`RowActionsMenu` del estándar, chip en `filters`, filtro en `?estado=`). La tarea 20 ya tiene hecha la carga en el servidor sin cartera: solo se agregan cartera e historial, y la sección "Facturas y cobranza" reemplaza a la "Facturas" de la ficha usando `AppDataGrid` y `FichaSeccion`. Revisar `10-refactor-visual-clientes/tasks.md` (tarea 13) para ver qué quedó.

## Fase A — Esquema

1. **`NNNN_cartera_vencimientos.sql`**: `config_negocio` (+ `dias_credito_default`, `dias_aviso_por_vencer`, `instrucciones_pago`, `nombre_comercial`, `email_respuesta`); `clientes.dias_credito`; `facturas.dias_credito` + `facturas.fecha_vencimiento` (check `= fecha + dias_credito`, índice; facturas de prueba existentes, si las hay, con 0 días). `registrar_factura` (`create or replace`) recibe `dias_credito` y calcula `fecha_vencimiento` (**conservando** las columnas de tasa de `08-tasas` y la asignación por lote de `07-lotes`, si ya existen).
2. **`NNNN_recordatorios_cobro.sql`**: `recordatorios_cobro`, `recordatorio_facturas`, `recordatorios_cobro_view` (sin `mensaje` para el operador), RLS (insert solo admin).
3. **`NNNN_cartera_clientes_view.sql`**: vista `cartera_clientes_view` según `spec.md`, con un comentario que apunte a `lib/cartera/estado.ts` como regla de referencia.
4. **`src/types/domain.ts`**: `Factura.fecha_vencimiento`, `Cliente.dias_credito`, campos nuevos de `ConfigNegocio`, `RecordatorioCobro`, `CanalRecordatorioId`, `EstadoEnvio`.

## Fase B — Dominio puro (`src/lib/cartera/`)

5. **`types.ts`, `estado.ts`, `resumen.ts`**: `DocumentoCartera`, `EstadoCartera`, `ResumenCartera`, `estadoCartera()`, `resumirCartera()`, `diasHastaVencimiento()`, `ordenarPorGravedad()`. Sin I/O ni imports de Supabase/React.
6. **`recordatorios/telefono.ts`** (`telefonoAWhatsApp`) y **`recordatorios/plantillas.ts`** (`construirRecordatorio(datos, 'whatsapp' | 'email')`): mensaje de WhatsApp con formato `*negrita*`; correo con HTML en línea (600 px, franja de marca, tabla, total, instrucciones de pago) + texto plano. Escapar HTML de todo dato del cliente.
7. **`scripts/probar-cartera.ts`** (`npx tsx`): casos de `estadoCartera` (pagada por abonos, pagada por nota de crédito, vence hoy = pendiente o por vencer, vencida ayer, anulada) y de `telefonoAWhatsApp` (`0412-1234567`, `04121234567`, `+58 412…`, fijo `0212…` → null). No hay framework de tests: el script falla con `process.exit(1)` si algo no coincide.

## Fase C — Datos y servicios

8. **`interfaces.ts` + `carteraRepository.ts`**: `resumenPorCliente()` (vista), `documentosPorCliente(clienteId)` (facturas + suma de notas de crédito emitidas por factura, en una consulta con embedding) y el adaptador `facturaADocumentoCartera()`.
9. **`recordatorioRepository.ts`**: `registrar(recordatorio, facturaIds)`, `listByCliente`, `ultimoPorCliente`.
10. **`recordatorios/canales/whatsapp.ts`** y **`email.ts`** (Strategy `CanalRecordatorio`): el de correo usa `fetch` a `https://api.resend.com/emails` con `RESEND_API_KEY` y `RECORDATORIO_EMAIL_FROM` (agregar a `.env.example`), `disponible()` devuelve "Correo no configurado" sin esas variables, y el timeout y los errores se mapean a mensajes legibles.
11. **`carteraService.ts`**: `resumenPorCliente()` → `Map<clienteId, ResumenCartera>`; `carteraDeCliente(id)` → `{ resumen, documentos }`; anula montos si `getRol() !== 'admin'`.
12. **`recordatorioService.ts`**: `prepararRecordatorio(clienteId, canal, facturaIds)` (devuelve el mensaje armado + disponibilidad + aviso de 24 h, para la vista previa) y `registrarRecordatorio(...)` / `enviarCorreo(...)`. Verifica admin, que las facturas sean del cliente y estén pendientes o vencidas, y la disponibilidad del canal.
13. **`invoiceService` / `pedidoService` / validación de venta**: `dias_credito` por defecto (cliente → config) y aceptar el valor indicado al emitir (zod: entero 0–365; en contado se fuerza 0). `fecha_vencimiento` se deriva y nunca la envía el cliente.
14. **Server Actions** (`clientes/actions.ts` o `cartera/actions.ts`): `prepararRecordatorioAction`, `registrarRecordatorioWhatsappAction`, `enviarRecordatorioCorreoAction`, todas con `safeParse` y `ActionState`.

## Fase D — UI

15. **`atoms/EstadoCarteraChip.tsx`** y **`molecules/CarteraIndicador.tsx`** (badge, color por peor estado, tooltip accesible y táctil). Registrar en `00-estandares-ui/spec.md`.
16. **`ClientesTable` + `clientes/page.tsx`**: columna "Facturas" (esencial, ordenable por gravedad), filtro "Con facturas vencidas", datos desde `carteraService.resumenPorCliente()` en el servidor.
17. **`molecules/CarteraResumenCards.tsx`** y **`organisms/DocumentosCarteraTable.tsx`** (props: `documentos`, `mostrarCliente`, `mostrarMontos`, `renderAcciones?`, `filtroInicial?`; filtros por estado; `EmptyState` por filtro; columnas secundarias ocultas en `xs`).
18. **`organisms/RecordatorioDialog.tsx`**: selección de facturas, canal con disponibilidad, vista previa editable (correo en `iframe sandbox`), aviso de 24 h, apertura de WhatsApp **sincrónica en el clic** y luego registro, envío de correo con loader. `fullScreen` en `xs`.
19. **`organisms/HistorialRecordatorios.tsx`** (con "Reintentar" para correos fallidos).
20. **Ficha de cliente**: `page.tsx` carga en el servidor la cartera, el historial y los pedidos (vía servicios); `cliente-ficha.tsx` **deja de importar `createClient`** y recibe los datos por props. Nueva sección "Facturas y cobranza" (tarjetas, tabla, botón, historial). `loading.tsx` actualizado con el skeleton de la sección.
    - _Tarea agregada (2026-10-07, por `10-refactor-visual-clientes`, tarea 13)_: **la parte sin cartera ya está hecha.** `[id]/page.tsx` carga en el servidor, vía `clienteService` (`getCliente`, `getSaldoPendiente`, `listarRepresentantes`, `listarFacturasDeCliente`, `listarPedidosDeCliente`; nuevo `listByCliente` en `IPedidoRepository`), cliente primero (not-found) y el resto con `Promise.all`, y lo pasa por props; `cliente-ficha.tsx` ya no importa `createClient` ni repositorios; hay `[id]/error.tsx` con `ErrorState`. Aquí solo falta sumar cartera e historial a ese `Promise.all` y reemplazar la sección "Facturas" (hoy `AppDataGrid` embebida con `pageParam="pfacturas"`) por "Facturas y cobranza".
21. **`/cobros`**: reemplazar `FacturasAbiertasTable` por `DocumentosCarteraTable` + acción "Registrar abono" + "Recordar"; tarjetas globales con `CarteraResumenCards`; borrar `FacturasAbiertasTable` si queda sin uso.
22. **POS / `EntregaPedidoDialog`**: campo "Días de crédito" (solo crédito), precargado con los del cliente, atajos 7/15/30, "Vence el …" en vivo y aviso si difiere de lo habitual del cliente.
23. **`ClienteForm`** (días de crédito) y **`ConfigNegocioForm`** (campos nuevos, con vista previa de las instrucciones de pago).

## Fase E — Verificación

24. `npx tsx scripts/probar-cartera.ts`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
25. Aplicar las migraciones; ninguna factura con `fecha_vencimiento` nula; una venta a crédito con 30 días a un cliente de 15 guarda 30 y vence a los 30 días.
26. Cliente con 1 factura vencida, 1 por vencer, 1 pendiente y 2 pagadas (una pagada con nota de crédito): el indicador es rojo con badge 1, el tooltip cuadra, las tarjetas y la tabla cuadran.
27. WhatsApp: el enlace abre con el número `58…` correcto y el texto editado, sin bloqueo de popup; queda registrado como `generado` con sus facturas.
28. Correo sin variables de entorno → canal deshabilitado con su motivo. Con Resend configurado (dominio verificado) → llega el correo, se ve bien en Gmail web y móvil, queda `enviado`. Con una API key inválida → `fallido` con el error y "Reintentar".
29. Operador: ve la columna con cantidades (sin montos en el tooltip), la tabla sin montos y no ve "Enviar recordatorio"; la action rechaza el envío; por PostgREST, `cartera_clientes_view` le devuelve los montos en `null`.
30. `/cobros` funciona igual que antes (registrar abono) con la tabla nueva, más el estado y el filtro de vencidas.
31. 375 px y modo claro/oscuro: listado (columna e indicador), ficha (sección), diálogo y `/cobros`.
32. Recorrer `checklist.md`.

## Tarea agregada por otro módulo (anotar aquí cuando ocurra)
- _(ej.: "Cuentas por pagar reutiliza DocumentosCarteraTable — <fecha>")_
