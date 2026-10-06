# 03 — Inventario (catálogo, compras, procesamiento, stock)

## Contexto

Este módulo agrupa todo lo que mueve el stock físico, descrito en `/SPEC.md` §4.1–4.3 y §5 (tablas `productos`, `compras`, `compra_items`, `pagos_proveedores`, `procesamientos`, `proceso_items`, `movimientos`). El esquema SQL **ya existe** (`0001_initial_schema.sql`) y hay funciones puras ya escritas en `costingService.ts` (`costoPonderado`, `costoDestino`, `getStockProducto`, `getInventarioValorizado`). Lo que falta es: repositorios reales, servicios que escriban (no solo lean) el ledger de movimientos, y las pantallas (hoy son placeholders en `app/catalogos`, `app/compras`, `app/procesamiento`, `app/inventario`).

Se agrupa en un solo módulo porque comparten el mismo dominio de datos (stock por producto) y dependen entre sí: Compras y Procesamiento son los que *generan* movimientos; Inventario es la *vista* de ese ledger.

## Alcance

### 3.1 Catálogo (`/catalogos`)
- CRUD de `productos` (tipo crudo/procesado, categoría, controla_stock, activo) — `IProductoRepository` ya existe.
- CRUD de `proveedores` — `IProveedorRepository` ya existe.
- Configuración: IVA por defecto (16%), fuente de tasa preferida (bcv/paralela) — nuevo, no tiene tabla aún (ver tarea de migración).
- **Clientes ya no vive aquí** (ver `02-clientes`).

### 3.2 Compras (`/compras`)
- Flujo de `/SPEC.md` §4.2: proveedor + fecha + condición (contado/crédito) + moneda + tasa del día (snapshot, tomada de `RateService`/`getTasaViva`, con opción de override manual) + items (producto crudo, peso_kg, costo_usd_kg).
- Al guardar una compra: crear fila en `compras`, sus `compra_items`, y **un movimiento de tipo `compra` por item** en la tabla `movimientos` (esto es lo que falta: hoy no hay ningún código que escriba en `movimientos`).
- Si `condicion = 'contado'`, `pagado_usd = subtotal_usd` al crear. Si `credito`, queda abierta para registrar `pagos_proveedores` después (eso puede vivir aquí o esperar a 04-ventas si se decide compartir la pantalla de cobros/pagos para ambos sentidos — **decisión a tomar por el equipo al llegar a esta tarea**, por defecto: pagos a proveedores se gestionan aquí mismo, no en `/cobros`).

### 3.3 Procesamiento (`/procesamiento`)
- Flujo de `/SPEC.md` §4.3: selecciona producto origen (crudo) + peso_entrada_kg, producto destino (procesado) + peso_salida_kg. Usa `costoDestino()` (ya implementada) para calcular `costo_total_usd`, `costo_kg_destino`, `merma_kg`, `rendimiento`.
- Al guardar: fila en `procesamientos` + `proceso_items`, y **dos movimientos**: `proceso_out` (resta stock del producto origen) y `proceso_in` (suma stock al producto destino, con el nuevo costo).

### 3.4 Inventario / stock (`/inventario`)
- Tabla de stock actual por producto usando `getInventarioValorizado()` (ya existe, solo falta conectarla a la UI): kg en stock, costo promedio, valor USD y valor Bs (a la tasa vigente).
- Historial de movimientos por producto (tabla `movimientos`, de solo lectura aquí).
- Alertas simples de stock bajo (umbral configurable por producto o global — MVP: umbral global en la config de catálogo).
- **Costos y valorización solo visibles para rol `admin`** (depende de `01-auth` Fase 2) — para `operador` se muestra solo kg en stock, sin costo ni valor.

## Patrones a aplicar (ya anotados en `/SPEC.md` §6)
- **Repository**: `CompraRepository`, `ProcesamientoRepository`, `MovimientoRepository` nuevos, siguiendo el estilo de `catalogRepositories.ts`.
- **Strategy**: fuente de tasa (bcv/paralela/manual) ya resuelta en `rateService.ts`; reutilizar, no duplicar.
- **Factory**: `crearMovimiento(tipo, ...)` para no construir objetos `Movimiento` a mano en cada sitio (evita inconsistencias en signo de `peso_kg` entre entradas/salidas).

## Fuera de alcance (MVP)
- Transferencias entre sucursales (no hay multi-sucursal).
- Conteo físico / ajuste de inventario con flujo de aprobación (el tipo `ajuste` existe en el ledger pero el flujo de "por qué se ajustó" es manual/notas, no un módulo de auditoría).
