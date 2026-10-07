# 08 — Tasas de cambio (BCV, euro, tasa manual por operación)

## Contexto

Pedido del usuario (2026-10-07):
- Obtener las tasas **oficiales del BCV (USD y EUR)** directamente de la página del Banco Central (scraping).
- Al **recibir una compra, hacer una venta o registrar un abono**, usar por defecto la **tasa referencial** o ingresar una **tasa manual** para esa operación.

Hoy (`src/lib/services/rateService.ts`, tabla `tasas` de `0001`) existe la estructura base, pero con huecos que afectan la operación diaria (ver "Hallazgos"). El más grave: **no hay ninguna pantalla para registrar tasas** y la facturación exige una tasa guardada con la fecha de hoy, así que el POS falla con "No hay tasa registrada hoy" si nadie la cargó por SQL.

Módulo transversal: toca compras y pagos a proveedores (`04-inventario`), facturas y cobros (`05-ventas`) y la configuración. Se anota como "tarea agregada" en esos módulos.

**Orden recomendado: ejecutar `08-tasas` antes que `07-lotes`.** Es más chico y desbloquea el POS. `07-lotes` reescribe `registrar_compra`/`registrar_factura` y debe conservar las columnas de tasa que agrega este módulo.

## Decisiones cerradas (2026-10-07, con el usuario)

| Tema | Decisión |
|---|---|
| Fuente principal | **BCV oficial**, obtenida por scraping de `www.bcv.org.ve` (USD y EUR). |
| Euro | **Solo referencia**: se consulta, se guarda y se muestra. Compras, ventas y abonos siguen en USD/Bs; no se agrega EUR como moneda de operación. |
| Paralela | **Se mantiene como opción** (vía dolarapi). BCV es el default de `config_negocio.fuente_tasa_default`; en cada operación se puede elegir la otra fuente. |
| Tasa manual por operación | **Cualquier usuario** puede reemplazar la referencial en compras, ventas y abonos. Queda registrado: que fue manual, quién la puso y cuánto difería de la referencial. El admin lo ve y puede filtrarlo. |
| Tasa manual "del día" | Distinta de la anterior: un **admin** puede cargar o corregir la tasa referencial de una fecha en `/tasas` (si el BCV no publicó o la fuente falló). Una tasa manual de **una operación** nunca se convierte en la tasa del día. |

## Fuentes y obtención automática

Cadena de obtención (en orden), con un **origen** registrado en cada tasa guardada:

| # | Origen | Qué trae | Nota |
|---|---|---|---|
| 1 | `bcv_scraping` | USD y EUR oficiales + **fecha valor** | Página principal del BCV: bloques `#dolar` y `#euro` (valor con coma decimal, ej. `36,50290000`) y la "Fecha Valor" (`span.date-display-single[content]`). **Selectores verificados el 2026-10-07 contra la página real** (`www.bcv.org.ve`): el scraping en vivo devuelve USD, EUR y fecha valor correctos. Nota: el dominio `bcv.gob.ve` no resuelve DNS; el real es `www.bcv.org.ve` (la advertencia original de "verificar selectores" quedó resuelta). |
| 2 | `dolarapi` | USD y EUR oficiales (espejo del BCV) + USD/EUR paralelo | `https://ve.dolarapi.com/v1/dolares` y `/v1/euros` (verificado el 2026-10-07: devuelven `fuente: oficial/paralelo`, `promedio`, `fechaActualizacion`). Respaldo del BCV y **única** fuente de la paralela. |
| 3 | `manual` | Lo que cargue un admin | Último recurso, y para corregir. |

Detalles técnicos del scraping (`src/lib/tasas/bcvScraper.ts`, solo servidor):
- `parsearPaginaBcv(html): { usd, eur, fechaValor } | null`: función **pura**, sin dependencias nuevas (búsqueda acotada a los bloques con `id="dolar"` / `id="euro"`). Se valida contra un **HTML de ejemplo guardado** en `src/lib/tasas/__fixtures__/bcv.html`, para detectar cuando el BCV cambie su página.
- **TLS**: el sitio del BCV ha tenido históricamente la cadena de certificados incompleta, y Node la rechaza. Solución permitida: agregar el certificado intermedio que falta como `ca` adicional en un `Agent` de `undici` solo para ese host. **Prohibido** desactivar la verificación (`rejectUnauthorized: false` o `NODE_TLS_REJECT_UNAUTHORIZED=0`).
- Timeout de 10 s y `User-Agent` propio. Si falla, se pasa a dolarapi sin que el usuario lo note; el origen queda registrado.
- Sanidad: un valor ≤ 0, no numérico o que difiere más de 20 % de la última tasa guardada de esa fuente/moneda **no se guarda** y se registra el error. Si BCV y dolarapi responden y difieren más de 0,5 %, se guarda la del BCV y se registra la discrepancia.
- **Disponibilidad**: el sitio del BCV es lento o inaccesible desde fuera de Venezuela con frecuencia, y Vercel corre en regiones de EE. UU. Por eso dolarapi es un respaldo real, no decorativo.

### Fecha valor (importante)

El BCV publica por la tarde la tasa que rige **el siguiente día hábil** ("Fecha Valor"). La del viernes rige el lunes, y no hay publicación para sábado ni domingo. Por eso:
- `tasas.fecha` guarda la **fecha valor**, no la fecha en que se consultó.
- **Tasa vigente para una fecha X** = la de mayor `fecha ≤ X` para esa fuente y moneda. Así el fin de semana o un feriado usan la última publicada, en vez de fallar como hoy.

### Cuándo se obtienen

- **Cron de Vercel** (`vercel.json` → `/api/cron/tasas`, protegido con `CRON_SECRET`), escribe con el cliente `service_role` (`lib/supabase/admin.ts`, solo servidor). Horarios sugeridos: 21:30 UTC (17:30 VET, después de la publicación) y 12:00 UTC (08:00 VET, reintento). **En el plan Hobby de Vercel los cron corren como máximo una vez al día**: en ese caso queda solo el de las 08:00 VET, y se apoya en la obtención bajo demanda.
- **Bajo demanda**: si una pantalla necesita la tasa vigente de hoy y la última guardada es de una fecha anterior, el servidor intenta obtenerla (con una sola obtención concurrente y caché de 15 min si falla, para no golpear la fuente en cada render) y la guarda.
- Botón **"Actualizar ahora"** en `/tasas` (solo admin).

## Modelo de datos

### `tasas` (cambios)

| Columna | Cambio |
|---|---|
| `bs_por_usd` | **renombrar a `valor_bs`** (Bs por 1 unidad de `moneda`). Con el euro el nombre viejo sería engañoso; son 14 referencias en el código, que se actualizan en este módulo. |
| `moneda` | **nueva**, text check (`USD`,`EUR`), default `USD` |
| `origen` | **nueva**, text check (`bcv_scraping`,`dolarapi`,`manual`) |
| `registrada_por` | **nueva**, uuid nullable (usuario si es manual; null si es automática) |
| `publicada_en` | **nueva**, timestamptz nullable (hora reportada por la fuente) |
| unique | `(fecha, fuente, moneda)` en lugar de `(fecha, fuente)` |

`fuente` sigue siendo `bcv | paralela | manual`. El índice existente `(fecha desc)` pasa a `(fuente, moneda, fecha desc)`.

**RLS (corrige el hallazgo 4)**: lectura para `authenticated`; insert/update **solo admin** (`es_admin()`). Las tasas automáticas se escriben con `service_role` desde el servidor, nunca desde el navegador.

### Snapshot de tasa en cada operación

`compras`, `facturas`, `pagos` y `pagos_proveedores` ya guardan el valor usado (`tasa_snapshot` / `tasa_pago`), y eso **no cambia** (`/SPEC.md` §2: nunca se recalcula la historia). Se agregan columnas de procedencia:

| Columna | Tipo | Nota |
|---|---|---|
| `tasa_origen` | text check (`referencial`,`manual`), default `referencial` | |
| `tasa_fuente` | text check (`bcv`,`paralela`), nullable | fuente de la referencial elegida (o de la que se reemplazó) |
| `tasa_referencial` | numeric(14,6), nullable | valor referencial vigente en ese momento, para mostrar la diferencia cuando fue manual |
| `tasa_registrada_por` | uuid, default `auth.uid()` | lo fija un trigger, no el cliente |

Check: `tasa_origen = 'referencial'` ⇒ `tasa_snapshot = tasa_referencial`. Con una manual, la diferencia `(tasa_snapshot / tasa_referencial − 1)` queda calculable.

### `config_negocio` (cambios)

- `fuente_tasa_default` (ya existe, `bcv`): sin cambios.
- `+ umbral_desviacion_tasa_pct numeric(5,2) default 10`: si una tasa manual difiere de la referencial más que esto, se pide confirmación (evita errores de tipeo de un orden de magnitud, como `87,38` en lugar de `873,8`).

## Reglas de negocio

- `getTasaVigente(fecha, fuente, moneda)` reemplaza a `getTasaViva`: devuelve la de mayor `fecha ≤ X` e indica si es "del día" o "arrastrada" (y desde qué fecha).
- **La referencial depende de la fecha de la operación**: si se registra hoy una compra con fecha de ayer, se propone la tasa vigente de ayer. Cambiar la fecha en el formulario recalcula la sugerencia.
- **Tasa manual por operación**: > 0 (zod + servidor + `check`). Si la desviación supera el umbral, la UI pide confirmación; el servidor **no** la rechaza (puede ser una tasa acordada), pero queda con `tasa_origen = 'manual'`.
- Una operación **nunca falla por falta de tasa**: si no hay referencial disponible (ninguna fuente respondió y no hay tasa anterior), el formulario exige la manual con el mensaje "No hay tasa referencial disponible: ingresa la tasa de esta operación".
- Abonos (cobros y pagos a proveedores): la referencial propuesta es la vigente en la fecha del abono; la ganancia cambiaria (§4.5) usa la tasa final elegida, igual que hoy.
- Los servicios **no confían en el valor referencial que envía el cliente**: lo recalculan en el servidor para la fecha y fuente indicadas. Si el cliente dice "referencial" pero el valor no coincide con la vigente (por ejemplo, porque el BCV publicó mientras el formulario estaba abierto), se guarda como referencial con el valor vigente del servidor y se avisa en el resultado.

## Pantallas

### Indicador en la barra superior (`AppShell`)

Chip compacto "BCV $ 873,87 · € 984,26" (en `xs`, solo el USD). Tooltip con fecha valor, origen y hora de actualización. Ícono de advertencia si la tasa es arrastrada de un día anterior. Clic → `/tasas`.

### `/tasas` (nueva; lectura para todos, acciones de admin)

- Tarjetas "Vigentes hoy": BCV USD, BCV EUR, Paralela USD, Paralela EUR, cada una con valor (`formatTasa`), fecha valor, chip de origen (BCV / dolarapi / manual), variación contra la anterior (▲▼ %) y "hace X min".
- **Actualizar ahora** (admin): botón con loader interno; toast con el resultado por fuente ("BCV: actualizado · Paralela: sin cambios · EUR: falló, se usó dolarapi").
- **Registrar tasa manual del día** (admin): diálogo con fecha valor, fuente (bcv/paralela), moneda y valor, con aviso de desviación. Corrige o completa un día.
- **Historial**: DataGrid (fecha valor, fuente, moneda, valor, origen, registrada por) con filtros por fuente/moneda y rango de fechas. Columnas secundarias ocultas en `xs`. Sin gráficos (no hay librería de charts instalada y no se agrega por esto).
- **Operaciones con tasa manual** (solo admin): listado de compras, facturas y abonos con `tasa_origen = 'manual'` (fecha, tipo, documento, usuario, referencial, manual, diferencia %), ordenado por desviación. Es el control del registro que pidió el usuario.
- `loading.tsx` (skeleton de tarjetas + tabla), `error.tsx`, `EmptyState` si no hay historial.

### Selector de tasa en formularios (`organisms/TasaSelector.tsx`, reutilizable)

Se usa en `CompraForm`, POS/`PedidoForm` (venta directa), `EntregaPedidoDialog`, `RegistrarPagoDialog` y `PagoProveedorDialog`:
- Por defecto: **"Tasa referencial"**. Muestra el valor, la fuente (selector BCV / Paralela, default desde la config), la fecha valor y un chip "arrastrada del vie 03/10" si aplica.
- Interruptor **"Usar tasa manual"** → `NumberField` (6 decimales, `formatTasa`), autofocus, con la diferencia contra la referencial en vivo ("+2,4 % vs BCV"). Si supera el umbral, el texto de ayuda pasa a warning y al enviar aparece `ConfirmDialog` ("La tasa difiere 900 % de la referencial. ¿Confirmas?").
- Equivalencia en vivo (total en Bs ↔ USD) usando la tasa elegida, debajo del selector.
- Campos de formulario: `tasa_origen`, `tasa_fuente`, `tasa` (valor final). El esquema zod de cada entidad los incluye (`tasaSchema` compartido en `src/lib/tasaValidation.ts`).
- Transición: el campo manual aparece y desaparece con `Collapse`; el cambio de valor referencial al cambiar fuente o fecha, con `Fade`.

### Configuración (`ConfigNegocioForm`)

Fuente por defecto (ya existe) + umbral de desviación %.

## Hallazgos sobre lo ya implementado (se corrigen en este módulo)

1. **Sin pantalla para registrar tasas**: `upsertTasaManual` y `listTasas` no tienen ningún llamador. La facturación (`invoiceService`) solo lee `tasas` de hoy y lanza "No hay tasa registrada hoy", así que **el POS no funciona** si nadie insertó la tasa por SQL.
2. **Fines de semana y feriados**: `getTasaViva` exige `fecha = hoy`. Aunque el BCV haya publicado el viernes la tasa del lunes, el sábado no hay tasa y la venta falla.
3. **Tasas inconsistentes en el mismo día**: compras y cobros (`getTasaSugerida`) caen a la API si no hay tasa guardada, pero **no la guardan**; ventas no consultan la API. Dos operaciones del mismo día pueden usar valores distintos sin que quede registro.
4. **Cualquier usuario puede escribir o modificar tasas** (RLS `write_all`/`update_all` de `0001`), incluso cambiar la tasa de un día pasado.
5. **La venta no permite elegir la tasa** (es justamente lo que pide el usuario): `invoiceService` la toma siempre de la base, sin opción manual.

## Fuera de alcance (MVP)

- EUR como moneda de operación (decisión cerrada: solo referencia).
- Otras monedas (CNY, TRY, RUB, que el BCV también publica).
- Gráficos de evolución de la tasa.
- Recalcular operaciones pasadas cuando se corrige la tasa de un día (las operaciones guardan su propia tasa; corregir la tasa del día solo afecta a las operaciones futuras).
