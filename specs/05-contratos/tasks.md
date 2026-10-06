# Tareas — 05-contratos

Depende de: `02-clientes` y `04-ventas` completos (para `venta_credito`); `03-inventario` completo (para `compra_credito`, usa datos de `compras`/`proveedores`).

## Esquema e infraestructura

1. **Migración `0007_contratos.sql`**: crear tabla `public.contratos` según el spec, con sus checks. RLS: `select`/`insert`/`update` para `authenticated` (refinar por rol si se decide que `operador` no debe anular contratos — por defecto, anular es solo `admin`).
2. **Confirmar datos del negocio**: si `config_negocio` (de `03-inventario`) no tiene `nombre_negocio`/`rif_negocio`, agregar migración `0008_config_negocio_datos_fiscales.sql` con esas columnas (necesarias para el encabezado del PDF).
3. **Bucket de Supabase Storage `contratos`** (privado, no público) — crear vía dashboard o script de setup; documentar el nombre exacto en este archivo si cambia.
4. **Instalar `@react-pdf/renderer`** (`npm install @react-pdf/renderer`). Si el tamaño de bundle o la compatibilidad con Server Components de Next 16 da problemas, documentar aquí la alternativa evaluada (`pdf-lib`) y por qué se cambió.

## Repositorios y servicios

5. **`src/lib/repositories/contratoRepository.ts`** (+ `IContratoRepository`): `create`, `list(filtro_tipo?, filtro_estado?)`, `getById`, `updateEstado(id, estado)`.
6. **`src/lib/services/contratoTemplateFactory.tsx`**: dado `tipo`, retorna el componente de plantilla (`ContratoVentaTemplate` | `ContratoCompraTemplate`) con los datos ya resueltos (no las queries, solo el render).
7. **`src/lib/services/contratoPdfService.ts`**: `generarPdf(contratoData): Promise<Buffer>` (usa la plantilla vía factory + `@react-pdf/renderer`), `subirPdf(buffer, nombreArchivo): Promise<string>` (sube a Storage, retorna la ruta).
8. **`src/lib/services/contratoService.ts`**: orquesta — `generarDesdeFactura(facturaId)`: lee factura + items + cliente (vía repos de `04-ventas`/`02-clientes`), construye el payload de la plantilla, llama a `contratoPdfService`, guarda en `contratoRepository.create`. `generarDesdeCompra(compraId)`: análogo con `03-inventario`/proveedores.
9. **`src/lib/services/contratoService.getUrlDescarga(contratoId)`**: genera signed URL de Supabase Storage al vuelo (no guardar URLs firmadas en BD, expiran).

## Plantillas de PDF

10. **`src/components/contratos/ContratoVentaTemplate.tsx`**: layout con `@react-pdf/renderer` (`Document`, `Page`, `View`, `Text`) — encabezado negocio, datos cliente, tabla de items, totales, cláusula de ganancia cambiaria (texto fijo, parametrizado con la tasa de referencia), líneas de firma.
11. **`src/components/contratos/ContratoCompraTemplate.tsx`**: análogo para proveedor.
12. **Texto de la cláusula de ganancia cambiaria**: redactar una sola vez como constante compartida (`CLAUSULA_GANANCIA_CAMBIARIA`) y reutilizar en ambas plantillas, para no desincronizar el texto legal/explicativo si cambia.

## UI

13. **`src/app/contratos/page.tsx`**: listado general (`ContratosTable`: tipo, contraparte, fecha, estado, acciones ver/descargar/anular).
14. **Botón "generar contrato" en la ficha de factura** (`04-ventas`, `src/app/pedidos` o donde se vea el detalle de una factura a crédito): visible solo si `factura.condicion === 'credito'` y no existe ya un contrato `generado`/`firmado` para esa factura (evitar duplicados accidentales; si se quiere regenerar, primero anular el anterior).
15. **Botón "generar contrato" en la ficha de compra** (`03-inventario`), análogo con `compra.condicion === 'credito'`.
16. **Cambiar estado del contrato** (`generado → enviado → firmado`, o `→ anulado`) desde `ContratosTable`, acción simple de update.
17. **Agregar `/contratos` a `AppShell.tsx`** (ícono `DescriptionIcon` o similar).

## Verificación

18. Prueba manual: generar contrato desde una factura a crédito real → el PDF descargado tiene los montos y la tasa exactamente iguales a los de la factura, sin recalcular nada.
19. Prueba manual: anular un contrato y generar uno nuevo para la misma factura no deja dos contratos `generado` simultáneos activos para la misma factura.
