# Fuentes de marca para los PDF (21-cotizaciones, P6; identidad Puerto)

`src/lib/pdf/fuentes.ts` registra estas fuentes si los archivos existen; si falta
alguno, los PDF salen en Helvetica (respaldo documentado).

Archivos esperados (TTF **estáticos**, no variables, licencia SIL Open Font
License 1.1, de Google Fonts o de los repositorios oficiales de cada familia):

- `InstrumentSans-Regular.ttf` (400, cuerpo)
- `InstrumentSans-SemiBold.ttf` (600, cuerpo en negrita)
- `Fraunces-SemiBold.ttf` (600, títulos)
- `OFL-Fraunces.txt` y `OFL-InstrumentSans.txt` (licencia de cada familia)

Origen (2026-10-30): instancias estáticas que sirve la API de Google Fonts
(`fonts.googleapis.com/css2?family=Fraunces:wght@600&family=Instrument+Sans:wght@400;600`,
archivos `.ttf` de `fonts.gstatic.com`) y licencias de `github.com/google/fonts`
(`ofl/fraunces/OFL.txt`, `ofl/instrumentsans/OFL.txt`). Incluyen los glifos del
español (ñ, tildes, «», º).

Son las mismas familias que la app carga con `next/font` (`src/app/layout.tsx`).
