# 13 - Refactor Visual de Compras

## Resumen
Este módulo aplica los estándares definidos en `00-estandares-ui` a la pantalla de Compras (`/compras`). 

Los componentes principales (`ComprasTable`, `error.tsx`) ya se encontraban actualizados previamente, por lo que el enfoque es:
1. Asegurar que los formularios (`CompraForm`, `PagoProveedorDialog`) utilicen la sintaxis `useForm({ disabled: isPending })` para inhabilitarse completamente durante su envío y evitar ejecuciones dobles.
2. Envolver los campos de `CompraForm` en bloques visuales legibles utilizando el componente base `FormSection`.
3. Inhabilitar los botones de "Agregar/Quitar" en listas de campos (`CompraItemsFieldArray`) durante el envío asíncrono.

## Referencias
- `00-estandares-ui` (Estándares base de interfaz)
