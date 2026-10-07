# SDD — Pescadería MVP

Este directorio es la fuente de verdad para ejecutar el proyecto bajo **Spec-Driven Development (SDD)**: cada módulo tiene su `spec.md` (qué se construye y por qué), `tasks.md` (en qué orden, en tareas atómicas) y `checklist.md` (cómo se verifica que quedó bien).

Este README lo escribió el agente planificador; los agentes de ejecución (incluido Claude Code en este mismo repo) deben implementar siguiendo estos documentos **sin reabrir decisiones ya cerradas** en `/SPEC.md` (raíz del repo) salvo que el usuario lo pida explícitamente.

## Relación con `/SPEC.md`

`/SPEC.md` (raíz) sigue siendo la visión técnica global: stack, modelo de datos completo, decisiones de diseño cerradas, servicios SRP y patrones. **No se duplica aquí.** Cada spec de módulo referencia las secciones de `/SPEC.md` que aplican y solo detalla lo nuevo o lo que cambia (p. ej. extender `clientes`, crear tabla `contratos`).

## Orden de ejecución y dependencias

```
00-estandares-ui  → no depende de nada; se ejecuta primero
   (modo oscuro/claro, responsive, tipografía, loaders, estados vacíos/error,
    confirmaciones, notificaciones, formularios, formato de números —
    toda pantalla de los módulos 01-06 debe seguir este estándar)

01-auth        → depende de 00-estandares-ui (el login ya debe seguir el estándar)
   ├─ Fase 1: login básico + sesión
   ├─ Fase 2: roles admin/operador + RLS real
   ├─ Fase 3: protección de rutas (middleware) + perfil
   └─ Fase 4: recuperación de contraseña + alta de usuarios

02-clientes    → depende de 00-estandares-ui, 01-auth (Fase 2 para RLS de columnas sensibles)
   (incluye captación KYC/antifraude: representante legal, documentos, bloqueo)

03-proveedores → depende de 00-estandares-ui, 01-auth (Fase 2)
   (control e información de proveedores — mismo principio que 02-clientes
    aplicado al otro lado del negocio: contacto, datos de pago, documento de
    RIF, bloqueo por no confiable)

04-inventario  → depende de 00-estandares-ui, 01-auth, 03-proveedores
   (productos, compras, procesamiento, stock/valorización —
    ya tiene esquema y servicios parciales, falta UI + repos + ledger real;
    Compras ahora selecciona proveedores ya registrados en 03-proveedores
    en vez de gestionarlos dentro de Catálogo)

05-ventas      → depende de 00-estandares-ui, 01-auth, 02-clientes, 04-inventario
   (pedidos/POS, facturación, notas de crédito, cobros/pagos, ganancia cambiaria)

06-contratos   → depende de 02-clientes, 03-proveedores y 05-ventas
   (genera documento a partir de una factura/compra a crédito ya existente)

07-lotes       → depende de 04-inventario y 05-ventas (ya implementados)
   (lotes físicos por recepción, costo por lote, PEPS en ventas, pérdidas,
    trazabilidad y resultado por lote; absorbe la pantalla /inventario de 04.
    No depende de 06-contratos: se recomienda ejecutarlo ANTES de 06 porque
    corrige dos fallas de 05-ventas — costo de venta y venta sin stock)

08-tasas       → depende de 01-auth, 04-inventario y 05-ventas (ya implementados)
   (scraping BCV USD/EUR + dolarapi, tasa vigente por fecha valor, tasa
    referencial o manual en compras/ventas/abonos, pantalla /tasas.
    Se ejecuta ANTES de 07-lotes: desbloquea el POS, que hoy falla si no hay
    tasa del día cargada por SQL)

09-cuentas-por-cobrar → depende de 02-clientes y 05-ventas (conviene después de 08-tasas)
   (vencimiento de facturas, estado pagada/pendiente/por vencer/vencida,
    columna "Facturas" en clientes, sección en la ficha, recordatorios por
    WhatsApp y correo; núcleo `lib/cartera` reutilizable en /cobros y, más
    adelante, en cuentas por pagar a proveedores)

00-estandares-ui · Fase 2 (acabado visual, 2026-10-07)
   (logo y loader global, shell persistente, AppDataGrid, AppDialog, botones
    en carga, tipografía, responsive; migración de las pantallas existentes)

10-refactor-visual-clientes → depende de 00-estandares-ui Fase 2a y 02-clientes (hechos)
   (Fase 2b de 00 aplicada a clientes, como piloto: listado en AppDataGrid,
    ficha con FichaHeader y carga en servidor, BloqueoDialog en AppDialog;
    deja en los componentes base lo que el resto de la Fase 2b reusa)

Orden recomendado de lo pendiente: 00 Fase 2a (base) → 08-tasas → 10-refactor-visual-clientes → 09-cuentas-por-cobrar → 07-lotes → 00 Fase 2b (resto de pantallas) → 06-contratos.
(10 va antes de 09 para que la columna "Facturas" y la sección de cobranza de 09 nazcan sobre AppDataGrid y FichaHeader.)
(`registrar_factura` la tocan 07, 08 y 09: cada módulo conserva lo que agregaron los otros.)
```

`02-clientes` y `03-proveedores` no dependen entre sí — se pueden ejecutar en paralelo (agentes distintos), ambos después de `01-auth` Fase 2. Pueden compartir componentes genéricos (ej. `DocumentoUpload`, `RifCiField`): el que se construya primero los deja en `components/atoms`/`molecules` y el otro los reusa — ver la nota de "tarea agregada por otro módulo" en cada `tasks.md`.

No se empieza un módulo sin que el anterior en la cadena esté en estado `done` según su checklist (o explícitamente marcado como aceptado con deuda técnica documentada). `00-estandares-ui` es la excepción: no se "termina" del todo, se amplía con nuevos componentes compartidos a medida que los demás módulos los necesitan (ver su propio `tasks.md`, sección final).

## Cambios de alcance registrados (quién los pidió y por qué)

- **Notas de crédito** (antes "fuera de alcance" en `05-ventas`): el negocio emite facturas y notas de crédito sobre ellas (devoluciones/correcciones). Se agregó la sección 4.4 en `05-ventas/spec.md`.
- **KYC/antifraude en clientes**: el negocio necesita identificar representante legal, cédula/RIF y documentos adjuntos de cada cliente (persona natural o jurídica) para protegerse ante estafas e impagos. Se agregó a `02-clientes/spec.md` (tabla `representantes_legales`, `documentos_cliente`, flag `bloqueado`).
- **Estándares de UI/UX**: se agregó `00-estandares-ui` como módulo transversal para fijar de una vez decisiones de modo oscuro, responsive, loaders, formularios, etc. — evita que cada módulo (y cada agente que lo ejecute) las reinvente, ahorrando tokens y manteniendo consistencia visual entre pantallas.
- **Módulo de proveedores**: se separó `03-proveedores` de `04-inventario` (antes el CRUD de proveedores vivía dentro de `/catalogos`). Mismo principio que `02-clientes`: control de datos de contacto/pago, documento de RIF y bloqueo por proveedor no confiable, con su propio saldo pendiente (`proveedorBalanceService` en `04-inventario`).
- **Proveedores: KYC completo y métodos de pago (2026-10-06)**: igual que en clientes, los proveedores jurídicos llevan representantes legales con su cédula, y se suma el acta constitutiva a los documentos. En lugar de una sola cuenta bancaria, cada proveedor puede tener varios métodos de pago (transferencia, Pago Móvil, Zelle). La documentación incompleta es solo un indicador visual y no bloquea compras. Detalle en `03-proveedores/spec.md`.
- **Lotes y trazabilidad (2026-10-07, pedido del cliente)**: el negocio separa físicamente cada recepción en lotes, elige de qué lote procesa y quiere ver, por lote, lo comprado, perdido y vendido con sus tasas. **Se reabre la decisión cerrada de costeo de `/SPEC.md` §2**: el promedio ponderado se reemplaza por costo por lote, con PEPS sugerido en ventas. Un lote crudo da un lote procesado, y cualquier usuario registra pérdidas con motivo. Nuevo módulo `07-lotes`; se anotó como tarea agregada en `04-inventario` y `05-ventas`. La base solo tiene datos de prueba: se vacían y se empieza limpio (sin lote "inicial").
- **Tasas BCV/EUR y tasa por operación (2026-10-07, pedido del usuario)**: scraping de bcv.gob.ve (USD y EUR; el EUR solo como referencia), dolarapi como respaldo y para la paralela, fecha valor y tasa arrastrada en fines de semana. En compras, ventas y abonos se usa la referencial o una manual (cualquier usuario, con registro). Amplía la decisión de tasas de `/SPEC.md` §2 sin reemplazarla. Nuevo módulo `08-tasas`; se anotó como tarea agregada en `04-inventario`, `05-ventas` y `07-lotes`.
- **Cuentas por cobrar y recordatorios (2026-10-07, pedido del cliente)**: columna con el estado de las facturas en el listado de clientes, sección de facturas en la ficha y recordatorios por **WhatsApp y correo** (canal confirmado por el usuario). Agrega el vencimiento de facturas, que no existía. Confirmado el 2026-10-07: los días de crédito varían por cliente y se indican en cada factura al emitirla; los recordatorios los envía solo el admin por ahora (no hay operadores). Nuevo módulo `09-cuentas-por-cobrar`. Siguiente paso previsto para "Cobros y pagos": cuentas por pagar a proveedores reutilizando `lib/cartera` (ver la spec de 09).
- **Acabado visual (2026-10-07, pedido del usuario)**: estándares de calidad para loaders (global con el logo de Altamar), botones en carga, paginación, tablas, modales, responsive y tipografía. Se documenta en `00-estandares-ui/spec.md` la identidad "Peñero" (aprobada el 2026-10-06), que reemplaza la regla vieja de "Geist, no cambiar". Fase 2 en `00-estandares-ui/tasks.md`.
- **Refactor visual de clientes (2026-10-07, pedido del usuario)**: la Fase 2b de `00-estandares-ui` se empieza por clientes como módulo propio, `10-refactor-visual-clientes`, con su historia de usuario, tareas y checklist. No cambia datos ni reglas de negocio. Sí mueve al servidor la carga de la ficha (misma tarea que la 20 de `09`, sin la cartera) y agrega o extiende componentes compartidos (`FichaHeader`, búsqueda normalizable y fila abrible con teclado en `AppDataGrid`, `StatusChips` `soft`, `BloqueoDialog` en `AppDialog`). Se anotó en `00-estandares-ui/tasks.md` (Fase 2b) y en `09-cuentas-por-cobrar/tasks.md`.

## Cómo debe trabajar el agente ejecutor en cada módulo

1. Leer `spec.md` completo antes de tocar código.
2. Leer `tasks.md` y ejecutar las tareas **en orden**; cada tarea indica archivos a crear/tocar y su criterio de "hecho".
3. Al terminar una tarea, no pasar a la siguiente sin que compile/lint pase (`npm run lint`, `npx tsc --noEmit`).
4. Al terminar el módulo completo, recorrer `checklist.md` ítem por ítem y marcarlo. Si algo no aplica o se decide diferir, anotar el motivo en el propio checklist (no borrarlo).
5. No modificar el esquema de otro módulo sin anotarlo en ese módulo (si 05-ventas necesita una columna en `clientes`, se anota en `02-clientes/tasks.md` como tarea agregada, con fecha).
6. Las migraciones SQL son incrementales y versionadas en `supabase/migrations/NNNN_descripcion.sql`. Nunca editar una migración ya aplicada; crear una nueva.

## Definition of Done (aplica a todo módulo)

- [ ] Migraciones SQL aplicadas (o script listo si no hay acceso al proyecto Supabase real) y RLS acorde al rol.
- [ ] Repositorios (`lib/repositories/*`) implementan la interfaz correspondiente contra Supabase; nada de lógica de negocio en el repo (solo acceso a datos).
- [ ] Servicios (`lib/services/*`) contienen la lógica de negocio, con responsabilidad única, y son los únicos que usan los repositorios.
- [ ] UI construida con Atomic Design: `components/atoms`, `components/molecules`, `components/organisms`, `components/templates`; las páginas en `app/**/page.tsx` solo componen organisms/templates.
- [ ] UI sigue `00-estandares-ui`: modo oscuro/claro probado, responsive, loaders/estados vacíos/error con los componentes compartidos, confirmaciones y notificaciones (nunca `window.alert`/`confirm`), formato de números con `lib/format.ts`. Si el módulo crea un componente genérico nuevo, se agrega a la tabla de "Componentes compartidos" de `00-estandares-ui/spec.md`.
- [ ] Sin `any` sin justificar; tipos en `src/types/domain.ts` actualizados si el módulo agrega entidades.
- [ ] `npm run lint` y `npx tsc --noEmit` sin errores.
- [ ] Checklist del módulo completo (o con pendientes explícitos).

## Convenciones de nomenclatura

- Carpetas de módulo: `NN-nombre` (orden de ejecución, no de aparición en el menú).
- Tablas y columnas en `snake_case`, en español, igual que el esquema ya existente.
- Servicios: `xxxService.ts` con funciones puras cuando sea posible (como `costingService.ts`, `creditService.ts`), o clase cuando necesite estado/DI.
- Repositorios: `IXxxRepository` (interfaz en `interfaces.ts`) + `SupabaseXxxRepository` (implementación).
