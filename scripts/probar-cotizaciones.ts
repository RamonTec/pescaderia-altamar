/**
 * Pruebas del dominio puro de cotizaciones (21-cotizaciones).
 * Sin framework de tests: falla con `process.exit(1)` si algún caso no coincide.
 *
 *   npx tsx scripts/probar-cotizaciones.ts
 *   npx tsx scripts/probar-cotizaciones.ts --sql > paridad-cotizaciones.sql
 *
 * Con `--sql` no corre las pruebas: imprime un script SQL que, dentro de una
 * transacción que se revierte, llama 200 veces a `guardar_cotizacion` (con
 * el primer perfil y el primer producto activo de la base, cliente libre) y
 * compara subtotal, IVA y total guardados con `totalesCotizacion` (falla con
 * una excepción si alguno difiere). Requiere la migración `20261022100000`.
 *
 *   node --require @react-pdf/renderer --import tsx scripts/probar-cotizaciones.ts --pdf
 *
 * Con `--pdf` renderiza un PDF de 60 líneas en el directorio temporal del
 * sistema (`cotizacion-COT-000123.pdf`) y verifica que empieza con `%PDF` y
 * tiene al menos 2 páginas. El `--require` precarga `@react-pdf/renderer`
 * (ESM-only) antes del hook CJS de tsx, igual que `probar-contrato-pdf.tsx`.
 */
import { subtotalLinea, totalesCotizacion } from '../src/lib/cotizaciones/totales'
import { accionesPermitidas, diasParaVencer, estadoEfectivo, sumarDias } from '../src/lib/cotizaciones/estado'
import { formatNumeroCotizacion, parseBusquedaNumero } from '../src/lib/cotizaciones/numero'
import {
  anularCotizacionSchema,
  cotizacionFormSchema,
  responderCotizacionSchema,
  type CotizacionFormInput,
} from '../src/lib/cotizacionValidation'
import { fechaHoy } from '../src/lib/format'
import {
  mensajeCotizacionGenerica,
  mensajeCotizacionVencida,
  mensajeWhatsAppCotizacion,
  urlWhatsAppCotizacion,
} from '../src/lib/cotizaciones/mensaje'
import { tokenValido, urlPublica } from '../src/lib/cotizaciones/enlace'

let fallas = 0

function igual<T>(nombre: string, obtenido: T, esperado: T) {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado)
  console.log(
    `${ok ? 'OK  ' : 'FALLA'} ${nombre}${ok ? '' : ` → obtenido ${JSON.stringify(obtenido)}, esperado ${JSON.stringify(esperado)}`}`
  )
  if (!ok) fallas++
}

function verdadero(nombre: string, condicion: boolean, detalle = '') {
  console.log(`${condicion ? 'OK  ' : 'FALLA'} ${nombre}${condicion ? '' : ` → ${detalle}`}`)
  if (!condicion) fallas++
}

// ---------- Generador determinista (mismo que los scripts de 16/17/19/20) ----------
let semilla = 21
const azar = () => {
  semilla = (semilla * 1103515245 + 12345) % 2147483648
  return semilla / 2147483648
}

interface CasoCotizacion {
  items: { peso_kg: number; precio_usd_kg: number }[]
  descuento: number
  ivaPct: number
}

function casosAleatorios(n: number): CasoCotizacion[] {
  semilla = 1021
  const casos: CasoCotizacion[] = []
  for (let k = 0; k < n; k++) {
    const nItems = 1 + Math.floor(azar() * 6)
    const items = Array.from({ length: nItems }, () => {
      const peso = (1 + Math.floor(azar() * 500_000)) / 1000
      const dec = 2 + Math.floor(azar() * 5)
      const precio = Math.floor(azar() * 40 * 10 ** dec) / 10 ** dec
      return { peso_kg: peso, precio_usd_kg: precio }
    })
    const { subtotal_usd } = totalesCotizacion(items, 0, 0)
    const descuento = azar() < 0.4 ? Math.floor(azar() * subtotal_usd * 100) / 100 : 0
    const r = azar()
    const ivaPct = r < 0.3 ? 0 : r < 0.8 ? 16 : Math.floor(azar() * 3000) / 100
    casos.push({ items, descuento, ivaPct })
  }
  return casos
}

if (process.argv.includes('--pdf')) {
  // Renderiza un PDF de 60 líneas en el directorio temporal y verifica la firma `%PDF`.
  void (async () => {
    const { writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { reactPdfCotizacionRenderer } = await import('../src/lib/cotizaciones/pdf/renderer')
    const items = Array.from({ length: 60 }, (_, k) => ({
      producto_nombre: `Producto de prueba ${k + 1}`,
      peso_kg: 1 + k * 0.25,
      precio_usd_kg: 8.5 + (k % 7),
      subtotal_usd: subtotalLinea({ peso_kg: 1 + k * 0.25, precio_usd_kg: 8.5 + (k % 7) }),
      nota: k % 5 === 0 ? 'Limpio, en filetes de 200 g' : null,
    }))
    const t = totalesCotizacion(items, 10, 16)
    const bytes = await reactPdfCotizacionRenderer.render({
      documento: {
        numero: 123,
        fecha: fechaHoy(),
        fecha_vencimiento: sumarDias(fechaHoy(), 7),
        cliente: { nombre: 'Cliente de prueba', rif_ci: 'J-12345678-9', telefono: null },
        items,
        ...t,
        iva_pct: 16,
        notas_cliente: 'Entrega en 24 horas.',
        terminos: 'Pago de contado. Precios sujetos a disponibilidad.',
      },
      negocio: {
        nombre_comercial: 'Altamar Sea Food',
        razon_social: 'Altamar Sea Food, C.A.',
        rif: 'J-12345678-9',
        direccion: 'Porlamar, Nueva Esparta',
        telefono: '0295-2911234',
      },
      instrucciones_pago: 'Pago Móvil 0414-1234567',
      sello: null,
      actualizada_at: new Date().toISOString(),
    })
    const ruta = join(tmpdir(), 'cotizacion-COT-000123.pdf')
    writeFileSync(ruta, bytes)
    const firma = Buffer.from(bytes.slice(0, 4)).toString('latin1')
    const paginas = (Buffer.from(bytes).toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
    console.log(`${firma === '%PDF' ? 'OK  ' : 'FALLA'} PDF de 60 líneas en ${ruta} (${bytes.length} bytes, ${paginas} páginas)`)
    process.exit(firma === '%PDF' && paginas >= 2 ? 0 : 1)
  })()
} else if (process.argv.includes('--sql')) {
  const casos = casosAleatorios(200)
  const lineas: string[] = [
    '-- Paridad TS ↔ SQL de guardar_cotizacion (21), generado por probar-cotizaciones.ts',
    'begin;',
    "select set_config('request.jwt.claim.sub', (select id::text from public.perfiles order by created_at limit 1), true);",
    'do $$',
    'declare v_prod uuid; v_id uuid; v_c public.cotizaciones%rowtype;',
    'begin',
    '  select id into v_prod from public.productos where activo order by nombre limit 1;',
  ]
  casos.forEach((c, k) => {
    const t = totalesCotizacion(c.items, c.descuento, c.ivaPct)
    const items = JSON.stringify(
      c.items.map((i) => ({ producto_id: '__PROD__', peso_kg: i.peso_kg, precio_usd_kg: i.precio_usd_kg }))
    )
    const cab = JSON.stringify({ validez_dias: 7, cliente_nombre: `Paridad ${k}`, iva_pct: c.ivaPct, descuento_usd: c.descuento })
    lineas.push(
      `  v_id := public.guardar_cotizacion(null, '${cab}'::jsonb, replace('${items}', '__PROD__', v_prod::text)::jsonb);`,
      '  select * into v_c from public.cotizaciones where id = v_id;',
      `  if v_c.subtotal_usd <> ${t.subtotal_usd.toFixed(6)} or v_c.iva_usd <> ${t.iva_usd.toFixed(6)} or v_c.total_usd <> ${t.total_usd.toFixed(6)} then raise exception 'caso ${k} difiere: % / % / % vs ${t.subtotal_usd.toFixed(6)} / ${t.iva_usd.toFixed(6)} / ${t.total_usd.toFixed(6)}', v_c.subtotal_usd, v_c.iva_usd, v_c.total_usd; end if;`
    )
  })
  lineas.push("  raise notice 'paridad SQL guardar_cotizacion: 200 casos iguales';", 'end $$;', 'rollback;')
  console.log(lineas.join('\n'))
  process.exit(0)
}

function correrPruebas() {
// ---------- totales ----------
{
  const items = [
    { peso_kg: 10, precio_usd_kg: 8.5 },
    { peso_kg: 5.5, precio_usd_kg: 12 },
  ]
  igual('2 líneas, sin descuento ni IVA → $151', totalesCotizacion(items, 0, 0), {
    subtotal_usd: 151,
    descuento_usd: 0,
    iva_usd: 0,
    total_usd: 151,
  })
  igual('descuento $1, IVA 16 % → base 150, IVA 24, total 174', totalesCotizacion(items, 1, 16), {
    subtotal_usd: 151,
    descuento_usd: 1,
    iva_usd: 24,
    total_usd: 174,
  })
  igual('descuento $1, sin IVA → $150', totalesCotizacion(items, 1, 0).total_usd, 150)
}
igual('línea 1,234 kg × 3,333333 → 4,113333 (redondeo a 6)', subtotalLinea({ peso_kg: 1.234, precio_usd_kg: 3.333333 }), 4.113333)
igual('línea 0,001 kg × 0,000500 → 0,000001 (mitad hacia arriba)', subtotalLinea({ peso_kg: 0.001, precio_usd_kg: 0.0005 }), 0.000001)
igual(
  'líneas incompletas cuentan 0',
  totalesCotizacion([{ peso_kg: null, precio_usd_kg: 5 }, { peso_kg: 2, precio_usd_kg: null }], null, 16).total_usd,
  0
)
igual('IVA 16 % de 0,1 + 0,2 → 0,048', totalesCotizacion([{ peso_kg: 1, precio_usd_kg: 0.3 }], 0, 16).iva_usd, 0.048)

{
  // Invariantes en 200 casos aleatorios (los mismos que compara `--sql`).
  let malos = 0
  for (const c of casosAleatorios(200)) {
    const t = totalesCotizacion(c.items, c.descuento, c.ivaPct)
    const total = Math.round((t.subtotal_usd - t.descuento_usd + t.iva_usd) * 1e6) / 1e6
    if (total !== t.total_usd || t.descuento_usd > t.subtotal_usd || t.iva_usd < 0) malos++
  }
  igual('200 casos aleatorios: total = subtotal − descuento + IVA', malos, 0)
}

// ---------- estado ----------
const hoy = fechaHoy()
const ayer = sumarDias(hoy, -1)
igual('vence hoy → vigente (enviada)', estadoEfectivo({ estado: 'enviada', fecha_vencimiento: hoy }, hoy), 'enviada')
igual('venció ayer → vencida (borrador)', estadoEfectivo({ estado: 'borrador', fecha_vencimiento: ayer }, hoy), 'vencida')
igual('aceptada nunca vencida', estadoEfectivo({ estado: 'aceptada', fecha_vencimiento: ayer }, hoy), 'aceptada')
igual('rechazada nunca vencida', estadoEfectivo({ estado: 'rechazada', fecha_vencimiento: ayer }, hoy), 'rechazada')
verdadero('vencida no se acepta ni comparte', !accionesPermitidas('vencida').has('aceptar') && !accionesPermitidas('vencida').has('compartir'))
verdadero('vencida se renueva', accionesPermitidas('vencida').has('renovar'))
verdadero('aceptada con pedido no se anula', !accionesPermitidas('aceptada', true).has('anular'))
verdadero('aceptada sin pedido se anula y convierte', accionesPermitidas('aceptada').has('anular') && accionesPermitidas('aceptada').has('convertir_pedido'))
verdadero('anulada sin PDF', !accionesPermitidas('anulada').has('descargar_pdf'))
verdadero('aceptada no se edita', !accionesPermitidas('aceptada').has('editar'))
igual('sumarDias 2026-12-28 + 7 → 2027-01-04', sumarDias('2026-12-28', 7), '2027-01-04')
igual('diasParaVencer de ayer → -1', diasParaVencer(ayer, hoy), -1)

// ---------- numeración ----------
igual('formatNumeroCotizacion(123) → COT-000123', formatNumeroCotizacion(123), 'COT-000123')
igual('formatNumeroCotizacion(1234567) → COT-1234567', formatNumeroCotizacion(1234567), 'COT-1234567')
igual('parse cot123 → 123', parseBusquedaNumero('cot123'), 123)
igual('parse COT-000123 → 123', parseBusquedaNumero('COT-000123'), 123)
igual('parse 123 → 123', parseBusquedaNumero('123'), 123)
igual('parse cot12 → 12', parseBusquedaNumero('cot12'), 12)
igual('parse « 45 » → 45', parseBusquedaNumero(' 45 '), 45)
igual('parse Pescados → null', parseBusquedaNumero('Pescados'), null)
igual('parse 0 → null', parseBusquedaNumero('0'), null)

// ---------- mensajes y enlace ----------
{
  const m = mensajeWhatsAppCotizacion({
    cliente: 'Ana',
    numero: 123,
    nombreComercial: 'Altamar Sea Food',
    totalUsd: 174,
    fechaVencimiento: '2026-10-29',
    url: 'https://altamar.test/c/x',
  })
  verdadero('mensaje con número, negocio, total y enlace', m.startsWith('Hola Ana, le enviamos la cotización COT-000123 de Altamar Sea Food por ') && m.endsWith('Puede verla y descargarla aquí: https://altamar.test/c/x'), m)
  verdadero('mensaje sin Bs', !/Bs/.test(m), m)
  igual('wa.me con 0414-1234567', urlWhatsAppCotizacion('0414-1234567', 'hola'), 'https://wa.me/584141234567?text=hola')
  igual('wa.me sin teléfono → elegir contacto', urlWhatsAppCotizacion(null, 'hola'), 'https://wa.me/?text=hola')
  igual('wa.me con fijo 0295 → elegir contacto', urlWhatsAppCotizacion('0295-2911234', 'hola'), 'https://wa.me/?text=hola')
  igual('respaldo vencida', mensajeCotizacionVencida(123), 'Hola, la cotización COT-000123 venció. Quisiera una nueva.')
  igual('respaldo genérico', mensajeCotizacionGenerica(), 'Hola, quisiera una cotización.')
  igual('urlPublica sin barra doble', urlPublica('t', 'https://a.test/'), 'https://a.test/c/t')
  verdadero('token de 32 base64url válido', tokenValido('abcdefghijABCDEFGHIJ0123456789_-'))
  verdadero('token de 31 inválido', !tokenValido('abcdefghijABCDEFGHIJ0123456789_'))
  verdadero('token con caracteres raros inválido', !tokenValido('abcdefghijABCDEFGHIJ0123456789%%'))
}

// ---------- esquemas ----------
const UUID = '22222222-2222-4222-8222-222222222222'
const base: CotizacionFormInput = {
  tipo_cliente: 'registrado',
  cliente_id: '11111111-1111-4111-8111-111111111111',
  cliente_nombre: '',
  cliente_telefono: '',
  fecha: hoy,
  validez_dias: 7,
  con_iva: true,
  descuento_usd: 0,
  notas_cliente: '',
  notas_internas: '',
  terminos: '',
  items: [{ producto_id: UUID, peso_kg: 10, precio_usd_kg: 8.5, nota: '' }],
}
const campos = (r: ReturnType<typeof cotizacionFormSchema.safeParse>) =>
  r.success ? [] : r.error.issues.map((i) => i.path.join('.'))

verdadero('formulario válido', cotizacionFormSchema.safeParse(base).success)
igual('cliente registrado vacío → cliente_id', campos(cotizacionFormSchema.safeParse({ ...base, cliente_id: null })), ['cliente_id'])
igual(
  'cliente libre sin nombre → cliente_nombre',
  campos(cotizacionFormSchema.safeParse({ ...base, tipo_cliente: 'libre', cliente_id: null })),
  ['cliente_nombre']
)
igual(
  'cliente libre con teléfono inválido → cliente_telefono',
  campos(cotizacionFormSchema.safeParse({ ...base, tipo_cliente: 'libre', cliente_nombre: 'Ana', cliente_telefono: '123' })),
  ['cliente_telefono']
)
verdadero(
  'cliente libre con 0414-1234567 válido',
  cotizacionFormSchema.safeParse({ ...base, tipo_cliente: 'libre', cliente_nombre: 'Ana', cliente_telefono: '04141234567' }).success
)
igual('0 líneas → items', campos(cotizacionFormSchema.safeParse({ ...base, items: [] })), ['items'])
igual('descuento mayor que el subtotal → descuento_usd', campos(cotizacionFormSchema.safeParse({ ...base, descuento_usd: 86 })), ['descuento_usd'])
verdadero('descuento igual al subtotal válido', cotizacionFormSchema.safeParse({ ...base, descuento_usd: 85 }).success)
igual('fecha futura → fecha', campos(cotizacionFormSchema.safeParse({ ...base, fecha: sumarDias(hoy, 1) })), ['fecha'])
igual('validez 91 → validez_dias', campos(cotizacionFormSchema.safeParse({ ...base, validez_dias: 91 })), ['validez_dias'])
igual(
  'peso con 4 decimales → items.0.peso_kg',
  campos(cotizacionFormSchema.safeParse({ ...base, items: [{ ...base.items[0], peso_kg: 1.2345 }] })),
  ['items.0.peso_kg']
)
verdadero(
  'precio 0 permitido',
  cotizacionFormSchema.safeParse({ ...base, items: [{ ...base.items[0], precio_usd_kg: 0 }] }).success
)
verdadero(
  '51 líneas rechazadas',
  !cotizacionFormSchema.safeParse({ ...base, items: Array.from({ length: 51 }, () => base.items[0]) }).success
)
verdadero('responder sin motivo válido', responderCotizacionSchema.safeParse({ id: UUID, respuesta: 'aceptada', motivo: '' }).success)
verdadero('anular con motivo > 500 falla', !anularCotizacionSchema.safeParse({ id: UUID, motivo: 'x'.repeat(501) }).success)

if (fallas > 0) {
  console.error(`\n${fallas} caso(s) fallaron`)
  process.exit(1)
}
console.log('\nTodas las pruebas de cotizaciones pasaron')
}

if (!process.argv.includes('--pdf') && !process.argv.includes('--sql')) correrPruebas()
