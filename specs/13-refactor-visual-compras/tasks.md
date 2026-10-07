# Tareas — 13-refactor-visual-compras

- [x] 1. **`CompraForm.tsx`**:
   - Importar `FormSection`.
   - Modificar `useForm` añadiendo `{ disabled: isPending }`.
   - Reestructurar el grid de campos utilizando `<FormSection titulo="...">` para separar "Proveedor y fecha" (primera), "Condiciones" y "Notas".
- [x] 2. **`CompraItemsFieldArray.tsx`**:
   - Extraer `disabled` de `useFormContext` y utilizarlo para inhabilitar los botones de eliminar/agregar.
   - Pasar la prop `disabled` a los `Controller` e inputs correspondientes de la lista.
- [x] 3. **`PagoProveedorDialog.tsx`**:
   - Modificar `useForm` añadiendo `{ disabled: isPending }`.
   - Transmitir la prop de deshabilitado a `ToggleButtonGroup` y al enlace "Pagar el saldo completo".
- [x] 4. **Verificación**: 
   - Compilar y asegurar que no hay errores TS ni de ESLint.
