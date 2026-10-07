# 14 — Refactor visual de ventas (Pedidos, POS y Facturación)

## Contexto

Este módulo aplica la Fase 2b de `00-estandares-ui` al dominio de ventas, que abarca la pantalla principal de `/pedidos` (Pedidos agendados y Venta Directa/POS) y la de `/notas-credito` (Devoluciones). Al igual que los refactors anteriores (clientes, proveedores, catálogos, compras), **no se cambian datos ni reglas de negocio**. El objetivo es uniformar la experiencia del usuario y evitar errores en la interfaz como el doble envío durante la carga, además de mejorar la responsividad y accesibilidad.

## Alcance

1. **Pantallas y Tablas**:
   - `/pedidos`: `PedidosTable` pasará a usar `AppDataGrid` en modo servidor con paginación real, tarjetas para móvil (`mobileCard`) y búsqueda optimizada.
   - `/notas-credito`: `NotasCreditoTable` también pasará a `AppDataGrid` en modo servidor.
2. **Formularios**:
   - `PedidoForm.tsx` (usado para Nueva Venta/POS y Nuevo Pedido) pasará a ser un `AppDialog` con el tamaño adecuado (`md` o `lg` dependiendo de los campos). Se aplicará `FormSection` para agrupar campos ("Cliente y fecha", "Condiciones", "Artículos") y `useForm({ disabled: isPending })` para inhabilitar todo el formulario durante la petición de red.
   - `EntregaPedidoDialog.tsx` se refactorizará a `AppDialog` con `useForm({ disabled: isPending })` y sus campos se agruparán en `FormSection`.
   - `NotaCreditoForm.tsx` se refactorizará a `AppDialog` con `useForm({ disabled: isPending })`.
3. **Listas Dinámicas (Field Arrays)**:
   - Los botones e inputs dentro de `PedidoItemsFieldArray.tsx` u otros FieldArrays relacionados con ventas respetarán el estado de carga (`disabled`).

## Fuera de alcance
- Refactor de cuentas por cobrar/pagar o de la ficha de cliente (eso se aborda o se abordó en módulos separados).
- Modificaciones al esquema de la base de datos o lógica SQL.
