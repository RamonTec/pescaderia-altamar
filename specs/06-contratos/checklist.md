# Checklist — 06-contratos

- [ ] Tabla `contratos` creada con sus checks (`tipo`, `estado`, exactamente una referencia según tipo).
- [ ] Bucket de Storage `contratos` existe y es privado (no accesible por URL pública directa).
- [ ] Generar contrato desde una factura a crédito produce un PDF con los mismos montos, tasa e items que la factura, sin recalcular.
- [ ] Generar contrato desde una compra a crédito produce un PDF con los mismos montos, tasa e items que la compra.
- [ ] El PDF incluye la cláusula de ganancia cambiaria con el texto único compartido (`CLAUSULA_GANANCIA_CAMBIARIA`), no duplicado/editado por plantilla.
- [ ] Descargar/ver un contrato usa una signed URL generada al momento, no una URL guardada que pueda expirar silenciosamente.
- [ ] No se puede generar un segundo contrato `generado`/`firmado` activo para la misma factura o compra sin anular el anterior primero.
- [ ] El botón "generar contrato" solo aparece en facturas/compras con `condicion = 'credito'`.
- [ ] Cambiar el estado de un contrato (`enviado`, `firmado`, `anulado`) se refleja en el listado `/contratos`.
- [ ] `npm run lint` y `npx tsc --noEmit` sin errores.

## Pendientes / deuda técnica
- [ ] _(anotar aquí cualquier ítem diferido con motivo y fecha, p. ej. firma digital real o envío automático)_
