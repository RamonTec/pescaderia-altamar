/**
 * Pruebas del dominio de cartera (09-cuentas-por-cobrar). Sin framework de
 * tests: falla con `process.exit(1)` si algún caso no coincide.
 *
 *   npx tsx scripts/probar-cartera.ts
 */
import { estadoCartera, ordenarPorGravedad, textoVencimiento } from '../src/lib/cartera/estado'
import { resumirCartera, gravedadCartera, nivelCartera } from '../src/lib/cartera/resumen'
import { telefonoAWhatsApp } from '../src/lib/cartera/recordatorios/telefono'
import { construirRecordatorio } from '../src/lib/cartera/recordatorios/plantillas'
import type { DocumentoCartera } from '../src/lib/cartera/types'

let fallas = 0

function igual<T>(nombre: string, obtenido: T, esperado: T) {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado)
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${nombre}${ok ? '' : ` → obtenido ${JSON.stringify(obtenido)}, esperado ${JSON.stringify(esperado)}`}`)
  if (!ok) fallas++
}

const HOY = '2026-10-07'
const AVISO = 3

function doc(parcial: Partial<DocumentoCartera> & { id: string }): DocumentoCartera {
  return {
    numero: `F-${parcial.id}`,
    fecha: '2026-09-20',
    fecha_vencimiento: '2026-10-20',
    total_usd: 100,
    pagado_usd: 0,
    creditos_usd: 0,
    anulado: false,
    ...parcial,
  }
}

// ---------- estadoCartera ----------
const pagadaAbonos = doc({ id: '1', pagado_usd: 100 })
const pagadaNC = doc({ id: '2', pagado_usd: 40, creditos_usd: 60, fecha_vencimiento: '2026-10-01' })
const venceHoy = doc({ id: '3', fecha_vencimiento: HOY })
const vencidaAyer = doc({ id: '4', fecha_vencimiento: '2026-10-06' })
const anulada = doc({ id: '5', anulado: true, fecha_vencimiento: '2026-09-01' })
const pendiente = doc({ id: '6', fecha_vencimiento: '2026-10-30' })
const porVencer = doc({ id: '7', fecha_vencimiento: '2026-10-10' })
const casiPagada = doc({ id: '8', pagado_usd: 99.996 })

igual('pagada por abonos', estadoCartera(pagadaAbonos, HOY, AVISO), 'pagada')
igual('pagada por nota de crédito (aunque venció)', estadoCartera(pagadaNC, HOY, AVISO), 'pagada')
igual('vence hoy → por vencer (aviso 3)', estadoCartera(venceHoy, HOY, AVISO), 'por_vencer')
igual('vence hoy → pendiente si aviso < 0', estadoCartera(venceHoy, HOY, -1), 'pendiente')
igual('vencida ayer', estadoCartera(vencidaAyer, HOY, AVISO), 'vencida')
igual('anulada', estadoCartera(anulada, HOY, AVISO), 'anulada')
igual('pendiente (vence en 23 días)', estadoCartera(pendiente, HOY, AVISO), 'pendiente')
igual('por vencer (vence en 3 días)', estadoCartera(porVencer, HOY, AVISO), 'por_vencer')
igual('saldo ≤ 0,005 → pagada', estadoCartera(casiPagada, HOY, AVISO), 'pagada')
igual('texto vencida', textoVencimiento(vencidaAyer, HOY, AVISO), 'Vencida hace 1 día')
igual('texto vence hoy', textoVencimiento(venceHoy, HOY, AVISO), 'Vence hoy')
igual('texto por vencer', textoVencimiento(porVencer, HOY, AVISO), 'Vence en 3 días')

// ---------- orden y resumen ----------
const vencidaVieja = doc({ id: '9', fecha_vencimiento: '2026-09-28', pagado_usd: 30 })
const todos = [pagadaAbonos, pendiente, anulada, vencidaAyer, porVencer, vencidaVieja, pagadaNC]
igual(
  'orden por gravedad',
  ordenarPorGravedad(todos, HOY, AVISO).map((d) => d.id),
  ['9', '4', '7', '6', '1', '2', '5']
)

const r = resumirCartera(todos, HOY, { diasAviso: AVISO })
igual('conteo', r.conteo, { pagada: 2, pendiente: 1, por_vencer: 1, vencida: 2, anulada: 1 })
igual('saldo', r.saldo_usd, 70 + 100 + 100 + 100)
igual('saldo vencido', r.saldo_vencido_usd, 170)
igual('vencida más antigua (días)', r.vencida_mas_antigua_dias, 9)
igual('nivel', nivelCartera(r), 'vencida')
igual('gravedad', gravedadCartera(r), 200_002)

// ---------- telefonoAWhatsApp ----------
igual('0412-1234567', telefonoAWhatsApp('0412-1234567'), '584121234567')
igual('04121234567', telefonoAWhatsApp('04121234567'), '584121234567')
igual('+58 412 123 4567', telefonoAWhatsApp('+58 412 123 4567'), '584121234567')
igual('+58 (424) 555-1234', telefonoAWhatsApp('+58 (424) 555-1234'), '584245551234')
igual('fijo 0212-5551234 → null', telefonoAWhatsApp('0212-5551234'), null)
igual('corto → null', telefonoAWhatsApp('0412-123'), null)
igual('vacío → null', telefonoAWhatsApp(''), null)

// ---------- plantillas ----------
const datos = {
  negocio: { nombre_comercial: 'Altamar Sea Food', instrucciones_pago: 'Pago Móvil 0412-0000000', email_respuesta: null },
  destinatario: { nombre: 'Pesca <script>alert(1)</script> & Co' },
  documentos: [vencidaAyer, porVencer],
  hoy: HOY,
  diasAviso: AVISO,
  tasaBs: 36.5,
}
const correo = construirRecordatorio(datos, 'email')
igual('correo escapa HTML del cliente', correo.html.includes('<script>'), false)
igual('correo incluye nombre escapado', correo.html.includes('Pesca &lt;script&gt;'), true)
igual('correo con texto plano', correo.texto.includes('Total adeudado: $200.00'), true)
const wa = construirRecordatorio(datos, 'whatsapp')
igual('whatsapp con negrita', wa.texto.includes('*Total adeudado: $200.00*'), true)
igual('whatsapp vencidas primero', wa.texto.indexOf('F-4') < wa.texto.indexOf('F-7'), true)

if (fallas > 0) {
  console.error(`\n${fallas} caso(s) fallaron`)
  process.exit(1)
}
console.log('\nTodos los casos pasaron')
