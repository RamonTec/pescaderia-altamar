# 05 — Contratos (documentos de acuerdo de crédito)

## Contexto

Módulo nuevo, no estaba en `/SPEC.md` original. Surge de la necesidad de **trazabilidad formal** de compra/venta a crédito frente a la volatilidad cambiaria: cuando el negocio fía (a un cliente) o le fían (un proveedor), conviene dejar un documento firmable que registre monto en USD, tasa de referencia al pactar, y cómo se calculará la ganancia/pérdida cambiaria en cada abono — no un contrato legal complejo, sino un **comprobante de acuerdo de crédito** imprimible/descargable.

Este módulo no reemplaza la factura interna (`04-ventas`) ni la cuenta por pagar (`03-inventario`); genera un documento derivado de una de esas dos, pensado para que el cliente o proveedor lo firme en papel o lo reciba por WhatsApp/correo como respaldo.

## Alcance

### Tipos de contrato (MVP: 2)
- `venta_credito`: generado a partir de una `factura` con `condicion = 'credito'` (de `04-ventas`). Incluye cliente, items (producto, kg, precio), total en USD, tasa de referencia, y la cláusula de cómo se calcula la ganancia cambiaria en cada abono (texto fijo basado en la fórmula de `/SPEC.md` §4.5).
- `compra_credito`: generado a partir de una `compra` con `condicion = 'credito'` (de `03-inventario`). Análogo, con proveedor.

### Esquema de datos

Nueva migración, tabla `public.contratos`:

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `tipo` | text check (`venta_credito`,`compra_credito`) | |
| `factura_id` | uuid null, references facturas | solo si `tipo = venta_credito` |
| `compra_id` | uuid null, references compras | solo si `tipo = compra_credito` |
| `fecha` | date default current_date | |
| `estado` | text check (`generado`,`enviado`,`firmado`,`anulado`) default `generado` | MVP: cambios de estado manuales, sin flujo de firma digital |
| `url_pdf` | text null | ruta en Supabase Storage |
| `notas` | text null | |
| `created_at` | timestamptz default now() | |

Constraint: exactamente uno de `factura_id`/`compra_id` no nulo según `tipo` (check o validación en servicio; preferible en servicio para mensaje de error claro).

### Generación de PDF

- Librería: `@react-pdf/renderer` (se integra bien con componentes React/TS, consistente con el resto del stack; evaluar en la tarea 2 si el tamaño de bundle es aceptable en Vercel serverless — alternativa si no: `pdf-lib` con plantillas más manuales).
- Plantilla por tipo de contrato (`ContratoVentaTemplate`, `ContratoCompraTemplate`) con: datos del negocio (nombre, RIF — de `config_negocio`, extender esa tabla si falta), datos de la contraparte, tabla de items, total en USD y su equivalente en Bs a la tasa de referencia, cláusula de ganancia cambiaria, espacio de firma (líneas, no firma digital en MVP).
- El PDF generado se sube a un bucket de Supabase Storage (`contratos`, privado) y se guarda la ruta en `contratos.url_pdf`; para visualizar/descargar se genera una signed URL al vuelo (no URLs públicas permanentes).

### Pantalla `/contratos`
- Listado: tipo, contraparte (cliente o proveedor, resuelto según `tipo`), fecha, estado, acciones (ver/descargar PDF, cambiar estado, anular).
- Botón "generar contrato" accesible **desde la ficha de una factura a crédito** (en `04-ventas`) y **desde la ficha de una compra a crédito** (en `03-inventario`) — no solo desde `/contratos` a secas, para que el flujo natural sea "esta venta es a crédito → genero el contrato ahí mismo". `/contratos` queda como bitácora central de todos los generados.

## Patrones
- **Factory**: `ContratoTemplateFactory` que, dado el `tipo`, devuelve el componente de plantilla correcto — evita `if/else` repetido en el servicio de generación.
- **Repository**: `ContratoRepository` (CRUD sobre la tabla) separado de `ContratoPdfService` (que solo sabe generar/subir el PDF) — SRP: uno persiste metadatos, el otro genera el archivo.

## Fuera de alcance (MVP)
- Firma digital real (ej. integración con un proveedor de e-signature).
- Envío automático por correo/WhatsApp (se puede descargar y enviar manualmente).
- Versionado de contrato si cambian los montos después de generado (si la factura/compra cambia, se genera un contrato nuevo, no se edita el anterior — el anterior se anula).
