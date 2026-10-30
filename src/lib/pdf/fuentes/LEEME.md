# Fuentes de marca para los PDF (21-cotizaciones, P6; identidad Puerto)

`src/lib/pdf/fuentes.ts` registra estas fuentes si los archivos existen; si falta
alguno, los PDF salen en Helvetica (respaldo documentado).

Archivos esperados (TTF **estáticos**, no variables, licencia SIL Open Font
License 1.1, de Google Fonts o de los repositorios oficiales de cada familia):

- `InstrumentSans-Regular.ttf` (400, cuerpo)
- `InstrumentSans-SemiBold.ttf` (600, cuerpo en negrita)
- `Fraunces-SemiBold.ttf` (600, títulos)
- `OFL.txt` (texto de la licencia de cada familia)

Son las mismas familias que la app carga con `next/font` (`src/app/layout.tsx`).
