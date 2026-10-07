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
```

`02-clientes` y `03-proveedores` no dependen entre sí — se pueden ejecutar en paralelo (agentes distintos), ambos después de `01-auth` Fase 2. Pueden compartir componentes genéricos (ej. `DocumentoUpload`, `RifCiField`): el que se construya primero los deja en `components/atoms`/`molecules` y el otro los reusa — ver la nota de "tarea agregada por otro módulo" en cada `tasks.md`.

No se empieza un módulo sin que el anterior en la cadena esté en estado `done` según su checklist (o explícitamente marcado como aceptado con deuda técnica documentada). `00-estandares-ui` es la excepción: no se "termina" del todo, se amplía con nuevos componentes compartidos a medida que los demás módulos los necesitan (ver su propio `tasks.md`, sección final).

## Cambios de alcance registrados (quién los pidió y por qué)

- **Notas de crédito** (antes "fuera de alcance" en `05-ventas`): el negocio emite facturas y notas de crédito sobre ellas (devoluciones/correcciones). Se agregó la sección 4.4 en `05-ventas/spec.md`.
- **KYC/antifraude en clientes**: el negocio necesita identificar representante legal, cédula/RIF y documentos adjuntos de cada cliente (persona natural o jurídica) para protegerse ante estafas e impagos. Se agregó a `02-clientes/spec.md` (tabla `representantes_legales`, `documentos_cliente`, flag `bloqueado`).
- **Estándares de UI/UX**: se agregó `00-estandares-ui` como módulo transversal para fijar de una vez decisiones de modo oscuro, responsive, loaders, formularios, etc. — evita que cada módulo (y cada agente que lo ejecute) las reinvente, ahorrando tokens y manteniendo consistencia visual entre pantallas.
- **Módulo de proveedores**: se separó `03-proveedores` de `04-inventario` (antes el CRUD de proveedores vivía dentro de `/catalogos`). Mismo principio que `02-clientes`: control de datos de contacto/pago, documento de RIF y bloqueo por proveedor no confiable, con su propio saldo pendiente (`proveedorBalanceService` en `04-inventario`).
- **Proveedores: KYC completo y métodos de pago (2026-10-06)**: igual que en clientes, los proveedores jurídicos llevan representantes legales con su cédula, y se suma el acta constitutiva a los documentos. En lugar de una sola cuenta bancaria, cada proveedor puede tener varios métodos de pago (transferencia, Pago Móvil, Zelle). La documentación incompleta es solo un indicador visual y no bloquea compras. Detalle en `03-proveedores/spec.md`.

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
