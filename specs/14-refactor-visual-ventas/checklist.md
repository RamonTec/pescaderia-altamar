# Checklist — 14-refactor-visual-ventas

- [x] Las tablas `PedidosTable` y `NotasCreditoTable` usan `AppDataGrid` en `mode="server"` y se visualizan como tarjetas en dispositivos móviles (`xs`).
- [x] Los formularios en `PedidoForm.tsx`, `EntregaPedidoDialog.tsx` y `NotaCreditoForm.tsx` han sido reescritos para usar `AppDialog`.
- [x] Los campos dentro de dichos formularios están ordenados en bloques mediante `FormSection`.
- [x] Los botones, inputs y arreglos dinámicos (ej. `PedidoItemsFieldArray`) se deshabilitan globalmente mientras dura la petición `isPending` (`react-hook-form`).
- [x] La paginación en el servidor de `/pedidos` y `/notas-credito` carga la data correspondiente.
- [x] No existen fallas de compilación TS ni errores de linting.
